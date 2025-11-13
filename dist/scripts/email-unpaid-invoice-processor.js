"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailUnpaidInvoiceProcessor = void 0;
const config_1 = require("../config");
const error_handler_utils_1 = require("../utils/error-handler.utils");
class EmailUnpaidInvoiceProcessor {
    constructor(config, branchId, page, excludedClients = [], previouslyProcessedIds = []) {
        this.unsuccessfulInvoiceIds = []; // IDs that need processing
        this.processedInvoiceIds = []; // IDs successfully processed in this run
        this.previouslyProcessedIds = []; // IDs processed in previous runs
        this.page = page;
        this.branchId = branchId;
        this.loginPageUrl = config.integration_url;
        this.username = config.username;
        this.password = config.password;
        this.branchLoginSelectorId = config.branchLoginSelectorId;
        this.unpaidInvoicesUrl = config.unpaidInvoicesUrl;
        this.globalTimeout = config_1.config.puppeteer.globalTimeout;
        this.requestTimeout = 1000; // 1 second delay between requests
        this.excludedClients = excludedClients;
        this.previouslyProcessedIds = previouslyProcessedIds;
        // Initialize results tracking - we'll set the total after finding invoices
        this.emailResults = {
            success: 0,
            failure: 0,
            total: 0,
        };
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async handleLogin() {
        console.log(`Navigating to login page: ${this.loginPageUrl}`);
        await this.page.goto(this.loginPageUrl, {
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        console.log("Logging in...");
        await this.page.waitForSelector("#id_username", {
            timeout: this.globalTimeout,
        });
        await this.page.type("#id_username", this.username, { delay: 0 });
        await this.page.waitForSelector("#id_password", {
            timeout: this.globalTimeout,
        });
        await this.page.type("#id_password", this.password, { delay: 0 });
        await this.page.waitForSelector("#email-signin", {
            timeout: this.globalTimeout,
        });
        await this.page.click("#email-signin");
        console.log(`Selecting branch: ${this.branchLoginSelectorId}`);
        // Wait for branch selection buttons to appear
        await this.page.waitForSelector("button.list-group-item", {
            timeout: this.globalTimeout,
        });
        // Find and click the right branch button
        const branchButtonHandle = await this.page.evaluateHandle((branchName) => {
            const buttons = document.querySelectorAll("button.list-group-item");
            for (const button of buttons) {
                if (button.textContent.toLowerCase().includes(branchName.toLowerCase())) {
                    return button;
                }
            }
            return null;
        }, this.branchLoginSelectorId);
        if (!branchButtonHandle) {
            throw new Error(`Branch button with text containing "${this.branchLoginSelectorId}" not found`);
        }
        await branchButtonHandle.click();
        await this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        console.log("Login successful");
    }
    async navigateToUnpaidInvoicesPage() {
        console.log(`Navigating to unpaid invoices page: ${this.unpaidInvoicesUrl}`);
        await this.page.goto(this.unpaidInvoicesUrl);
        await this.page.waitForSelector("body", { timeout: this.globalTimeout });
        console.log("Unpaid invoices page loaded");
    }
    async getMaxPageNumber() {
        const maxPage = await this.page.evaluate(() => {
            const pageLinks = document.querySelectorAll(".pagination .page-item:not(.disabled) .page-link");
            let highest = 1;
            pageLinks.forEach((link) => {
                const text = link.textContent.trim();
                const pageNum = parseInt(text);
                if (!isNaN(pageNum) && pageNum > highest) {
                    highest = pageNum;
                }
            });
            return highest;
        });
        console.log(`Maximum pagination page found: ${maxPage}`);
        return maxPage;
    }
    async navigateToPage(pageNumber) {
        console.log(`Navigating to page ${pageNumber}...`);
        await this.page.click(`.pagination .page-item .page-link[href*="page=${pageNumber}"]`);
        await this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        // Removed onCorrectPage check as requested
        console.log(`Successfully navigated to page ${pageNumber}`);
        return true;
    }
    async scrapeInvoicesFromCurrentPage() {
        console.log("Scraping invoice URLs from current page...");
        // Pass excluded clients to the page context
        const excludedClientsLower = this.excludedClients.map((name) => name.toLowerCase());
        const invoiceIds = await this.page.evaluate((excludedClientsLower) => {
            const rows = document.querySelectorAll("table tbody tr");
            const ids = [];
            rows.forEach((row) => {
                // Check client name first (3rd column)
                const clientCell = row.querySelector("td:nth-child(2)");
                const clientName = clientCell ? clientCell.textContent?.trim() : "";
                // Skip this row if client is excluded (case insensitive)
                if (clientName &&
                    excludedClientsLower.includes(clientName.toLowerCase())) {
                    return; // Skip to next row
                }
                // Only process link if client is not excluded
                const linkElement = row.querySelector("td:first-child a");
                if (linkElement) {
                    const href = linkElement.getAttribute("href");
                    const idMatch = href.match(/\/accounting\/invoices\/(\d+)\//);
                    const id = idMatch ? idMatch[1] : null;
                    if (id) {
                        ids.push(id);
                    }
                }
            });
            return ids;
        }, excludedClientsLower);
        console.log(`Found ${invoiceIds.length} invoice IDs on current page`);
        return invoiceIds;
    }
    async getUnsuccessfulInvoiceIds() {
        console.log("Collecting all unsuccessful invoice IDs...");
        if (this.previouslyProcessedIds.length > 0) {
            console.log(`Found ${this.previouslyProcessedIds.length} previously processed invoice IDs that will be excluded`);
        }
        // Get max page number
        const maxPageNumber = await this.getMaxPageNumber();
        let allInvoiceIds = [];
        // Process each page to collect all invoice IDs
        for (let currentPage = 1; currentPage <= maxPageNumber; currentPage++) {
            // If not on the first page, navigate to it
            if (currentPage > 1) {
                const success = await this.navigateToPage(currentPage);
                if (!success) {
                    console.warn(`Could not navigate to page ${currentPage}, skipping...`);
                    continue;
                }
            }
            // Scrape invoice IDs from current page
            console.log(`Processing page ${currentPage} of ${maxPageNumber}`);
            const pageInvoiceIds = await this.scrapeInvoicesFromCurrentPage();
            // Filter out already processed invoice IDs
            const newInvoiceIds = pageInvoiceIds.filter((id) => !this.previouslyProcessedIds.includes(id));
            console.log(`Found ${pageInvoiceIds.length} total invoice IDs, ${newInvoiceIds.length} need processing`);
            allInvoiceIds = [...allInvoiceIds, ...newInvoiceIds];
            console.log(`Total invoice IDs collected so far: ${allInvoiceIds.length}`);
        }
        console.log(`Completed collection of ${allInvoiceIds.length} unsuccessful invoice IDs that need processing`);
        return allInvoiceIds;
    }
    async processEmails() {
        console.log("\n======== STARTING EMAIL SENDING PROCESS ========");
        console.log(`Total invoices to email: ${this.unsuccessfulInvoiceIds.length}`);
        for (let i = 0; i < this.unsuccessfulInvoiceIds.length; i++) {
            const invoiceId = this.unsuccessfulInvoiceIds[i];
            console.log(`Processing invoice ${i + 1}/${this.unsuccessfulInvoiceIds.length} (ID: ${invoiceId})`);
            const result = await this.sendEmailForInvoice(invoiceId);
            if (result.success) {
                this.processedInvoiceIds.push(invoiceId);
            }
            // Add timeout after each invoice processing
            if (i < this.unsuccessfulInvoiceIds.length - 1) {
                // Don't wait after the last one
                console.log(`Waiting ${this.requestTimeout}ms before next invoice...`);
                await this.delay(this.requestTimeout);
            }
        }
        console.log("\n======== EMAIL SENDING COMPLETED ========");
        console.log(`Total invoices processed: ${this.emailResults.total}`);
        console.log(`Emails sent successfully: ${this.emailResults.success}`);
        console.log(`Failed to send emails: ${this.emailResults.failure}`);
        console.log("========================================\n");
    }
    async sendEmailForInvoice(invoiceId) {
        const baseUrl = this.loginPageUrl.replace(/\/$/, "");
        const invoiceUrl = `${baseUrl}/accounting/invoices/${invoiceId}/`;
        console.log(`\n==== Sending email for invoice #${invoiceId} ====`);
        console.log(`Navigating to invoice URL: ${invoiceUrl}`);
        try {
            // Navigate to invoice page
            await this.page.goto(invoiceUrl, {
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            // Check if the page loaded properly
            const pageTitle = await this.page.title();
            if (pageTitle.includes("Page not found") || pageTitle.includes("Error")) {
                console.error(`Error: Invoice page for invoice #${invoiceId} not found`);
                this.emailResults.failure++;
                return { success: false, reason: "page_not_found" };
            }
            // Check if client has "instit" in name
            const clientHasInstit = await this.page.evaluate(() => {
                // Find the client detail item
                const detailItems = document.querySelectorAll(".detail-item");
                for (const item of detailItems) {
                    const label = item.querySelector("label");
                    if (label &&
                        label.textContent.trim().toLowerCase().includes("client")) {
                        const clientInfo = item.querySelector(".detail-info");
                        if (clientInfo) {
                            const clientName = clientInfo.textContent.trim().toLowerCase();
                            return clientName.includes("instit");
                        }
                    }
                }
                return false;
            });
            if (clientHasInstit) {
                console.log(`Skipping email for invoice #${invoiceId} - client has 'instit' in name`);
                return { success: false, reason: "instit_client_skipped" };
            }
            // Wait for and click the "Send reminder" button
            const sendReminderSelector = `a[href="/accounting/invoices/send-reminder/${invoiceId}/"]`;
            await this.page.waitForSelector(sendReminderSelector, {
                visible: true,
                timeout: this.globalTimeout,
            });
            console.log(`Clicking "Send reminder" button for invoice #${invoiceId}`);
            await this.page.click(sendReminderSelector);
            // Wait for modal to appear
            await this.page.waitForSelector(".modal-content", {
                visible: true,
                timeout: this.globalTimeout,
            });
            // Small delay to ensure modal is fully loaded
            await this.delay(200);
            // Click the "Send" button in the modal
            const sendButtonSelector = "a.btn.btn-primary.submit-modal";
            await this.page.waitForSelector(sendButtonSelector, {
                visible: true,
                timeout: this.globalTimeout,
            });
            console.log(`Clicking "Send" button in modal for invoice #${invoiceId}`);
            await this.page.click(sendButtonSelector);
            // Wait for page reload
            await this.page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            // Wait 1 second after each successful email
            await this.delay(1000);
            console.log(`✅ Email sent successfully for invoice #${invoiceId}`);
            this.emailResults.success++;
            return { success: true };
        }
        catch (error) {
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `sendEmailForInvoice-${invoiceId}`);
            console.error(`❌ Error sending email for invoice #${invoiceId}:`, error);
            this.emailResults.failure++;
            return { success: false, reason: "exception", message: error.message };
        }
    }
    async processBranch() {
        console.log("\n========================================");
        console.log(`STARTING EMAIL SENDING FOR BRANCH ID: ${this.branchId}`);
        console.log("========================================");
        try {
            // Login to the system
            await this.handleLogin();
            // Navigate to the page with unpaid invoices
            await this.navigateToUnpaidInvoicesPage();
            // Find invoices that need email processing
            this.unsuccessfulInvoiceIds = await this.getUnsuccessfulInvoiceIds();
            // Update the total in results
            this.emailResults.total = this.unsuccessfulInvoiceIds.length;
            // If no invoices need email, return early
            if (this.unsuccessfulInvoiceIds.length === 0) {
                console.log("No invoices found that need email processing");
                return {
                    success: true,
                    branchId: this.branchId,
                    message: "No invoices need email processing",
                    emailResults: this.emailResults,
                };
            }
            // Process emails for all identified invoices
            await this.processEmails();
            // Combine previously processed IDs with newly processed ones
            const allProcessedIds = [
                ...this.previouslyProcessedIds,
                ...this.processedInvoiceIds,
            ];
            return {
                success: true,
                branchId: this.branchId,
                totalInvoices: this.unsuccessfulInvoiceIds.length,
                emailResults: this.emailResults,
                processedInvoiceIds: allProcessedIds,
            };
        }
        catch (error) {
            console.error(`Error in email sending process for branch ${this.branchId} after successfully processing ${this.processedInvoiceIds.length} invoices:`, error);
            // Combine previously processed IDs with newly processed ones
            const allProcessedIds = [
                ...this.previouslyProcessedIds,
                ...this.processedInvoiceIds,
            ];
            console.log(`Total successfully processed invoice IDs: ${allProcessedIds.length}`);
            // Check if it's a browser error
            if (error_handler_utils_1.BrowserErrorHandler.isBrowserError(error)) {
                console.log(`🚨 Critical browser error detected - will trigger requeue with ${allProcessedIds.length} processed IDs`);
                const requeueError = new Error("REQUEUE_NEEDED");
                requeueError.processedInvoiceIds = allProcessedIds;
                throw requeueError;
            }
            // If not a browser error, return a failure result
            return {
                success: false,
                branchId: this.branchId,
                error: error.message,
                emailResults: this.emailResults,
                processedInvoiceIds: allProcessedIds,
            };
        }
    }
}
exports.EmailUnpaidInvoiceProcessor = EmailUnpaidInvoiceProcessor;
