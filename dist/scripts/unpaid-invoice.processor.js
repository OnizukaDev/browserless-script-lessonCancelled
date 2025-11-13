"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpaidInvoiceProcessor = void 0;
const config_1 = require("../config");
const error_handler_utils_1 = require("../utils/error-handler.utils");
class UnpaidInvoiceProcessor {
    constructor(config, branchId, page, excludedClients = []) {
        this.page = page;
        this.username = config.username;
        this.password = config.password;
        this.branchId = branchId;
        this.loginPageUrl = config.integration_url;
        this.branchLoginSelectorId = config.branchLoginSelectorId;
        this.unpaidInvoicesUrl = config.unpaidInvoicesUrl;
        this.globalTimeout = config_1.config.puppeteer.globalTimeout;
        this.excludedClients = excludedClients;
        this.paymentResults = {
            success: 0,
            failure: 0,
            noCard: 0,
            total: 0,
        };
        this.unsuccessfulInvoiceIds = [];
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
        // Verify we're on the correct page
        const onCorrectPage = await this.page.evaluate((pageNum) => {
            const activePageLink = document.querySelector(".pagination .page-item.active .page-link");
            return (activePageLink &&
                activePageLink.textContent.trim().startsWith(pageNum.toString()));
        }, pageNumber);
        if (!onCorrectPage) {
            // Alternative: try direct navigation
            await this.page.goto(`${this.unpaidInvoicesUrl}&page=${pageNumber}`);
            await this.page.waitForSelector("table tbody", {
                timeout: this.globalTimeout,
            });
        }
        console.log(`Successfully navigated to page ${pageNumber}`);
        return true;
    }
    async processPayment(invoiceId) {
        const baseUrl = this.loginPageUrl.replace(/\/$/, "");
        const paymentUrl = `${baseUrl}/stripe/payments/invoices/${invoiceId}/pay-card/`;
        console.log(`\n==== Processing invoice #${invoiceId} ====`);
        console.log(`Navigating to payment URL: ${paymentUrl}`);
        try {
            await this.page.goto(paymentUrl, {
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            // Check if the payment page loaded properly
            const pageTitle = await this.page.title();
            if (pageTitle.includes("Page not found") || pageTitle.includes("Error")) {
                console.error(`Error: Payment page for invoice #${invoiceId} not found`);
                return { success: false, reason: "page_not_found" };
            }
            // Check if user has any cards available
            const cardOptions = await this.page.evaluate(() => {
                // Find all radio inputs for card selection
                const radioInputs = Array.from(document.querySelectorAll('input[type="radio"][name="card_choice"]'));
                if (!radioInputs.length)
                    return [];
                return radioInputs.map((input) => {
                    // Get card details
                    const label = input.closest("label");
                    const cardText = label ? label.textContent.trim() : "Unknown card";
                    const cardId = input.value;
                    return {
                        id: cardId,
                        text: cardText,
                    };
                });
            });
            if (!cardOptions.length) {
                console.log(`Invoice #${invoiceId}: No credit cards available for this client`);
                this.paymentResults.noCard++;
                this.unsuccessfulInvoiceIds.push(invoiceId);
                return { success: false, reason: "no_cards" };
            }
            console.log(`Invoice #${invoiceId}: Found ${cardOptions.length} credit card(s)`);
            // Try each card until success or all fail
            for (let i = 0; i < cardOptions.length; i++) {
                const card = cardOptions[i];
                console.log(`Selecting card ${i + 1}/${cardOptions.length}`);
                await this.page.evaluate((cardId) => {
                    const radioInput = document.querySelector(`input[type="radio"][name="card_choice"][value="${cardId}"]`);
                    if (radioInput) {
                        // Force select it even if it appears to be selected
                        radioInput.checked = true;
                        // Trigger a click event to ensure any event handlers run
                        radioInput.click();
                    }
                }, card.id);
                // Click the pay button
                await this.page.waitForSelector("#pay", {
                    visible: true,
                    timeout: this.globalTimeout,
                });
                await this.page.click("#pay");
                try {
                    // Wait for either a redirect or an error message
                    await Promise.race([
                        this.page.waitForNavigation({
                            timeout: 1800000, // 30 minutes
                            waitUntil: "networkidle0",
                        }),
                        this.page.waitForSelector(".alert-danger", {
                            visible: true,
                            timeout: 1800000, // 30 minutes
                        }),
                    ]);
                    // Check if we got an error message
                    const hasError = await this.page.evaluate(() => {
                        return !!document.querySelector(".alert-danger");
                    });
                    if (hasError) {
                        const errorMessage = await this.page.evaluate(() => {
                            const errorElement = document.querySelector(".alert-danger");
                            return errorElement ? errorElement?.textContent?.trim() : null;
                        });
                        console.error(`Payment failed with card ${i + 1}/${cardOptions.length}: ${errorMessage}`);
                        // If this is the last card, record the failure
                        if (i === cardOptions.length - 1) {
                            console.log(`All ${cardOptions.length} cards have failed. Moving to next invoice.`);
                            this.paymentResults.failure++;
                            this.unsuccessfulInvoiceIds.push(invoiceId);
                            return {
                                success: false,
                                reason: "payment_error",
                                message: errorMessage,
                            };
                        }
                        // Otherwise continue to the next card
                        continue;
                    }
                    // If no error and we navigated, assume success
                    console.log(`Payment successful for invoice #${invoiceId} with card ${i + 1}/${cardOptions.length}`);
                    this.paymentResults.success++;
                    return { success: true };
                }
                catch (navError) {
                    console.error(`Navigation error during payment: ${navError.message}`);
                    if (error_handler_utils_1.BrowserErrorHandler.isBrowserError(navError)) {
                        throw navError;
                    }
                    // If this is the last card, record the failure
                    if (i === cardOptions.length - 1) {
                        console.log(`All ${cardOptions.length} cards have failed. Moving to next invoice.`);
                        this.paymentResults.failure++;
                        return {
                            success: false,
                            reason: "navigation_error",
                            message: navError.message,
                        };
                    }
                    // Otherwise, reload the page and try the next card
                    console.log(`Reloading payment page to try next card...`);
                    await this.page.goto(paymentUrl, {
                        waitUntil: "networkidle2",
                        timeout: this.globalTimeout,
                    });
                }
            }
            // This should only execute if there's some logic error above
            console.error(`Unexpected end of card loop for invoice #${invoiceId}`);
            this.paymentResults.failure++;
            return { success: false, reason: "unexpected_error" };
        }
        catch (error) {
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processPayment-${invoiceId}`);
            console.error(`Error processing invoice #${invoiceId}:`, error);
            this.paymentResults.failure++;
            return { success: false, reason: "exception", message: error.message };
        }
    }
    async getUnpaidInvoiceIds() {
        console.log("Collecting all unpaid invoice IDs...");
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
            allInvoiceIds = [...allInvoiceIds, ...pageInvoiceIds];
            console.log(`Total invoice IDs collected so far: ${allInvoiceIds.length}`);
        }
        console.log(`Completed collection of ${allInvoiceIds.length} unpaid invoice IDs`);
        return allInvoiceIds;
    }
    async processInvoicePayments(invoiceIds) {
        console.log("\n======== STARTING PAYMENT PROCESSING ========");
        this.paymentResults.total = invoiceIds.length;
        for (let i = 0; i < invoiceIds.length; i++) {
            const invoiceId = invoiceIds[i];
            console.log(`Processing invoice ${i + 1}/${invoiceIds.length} (ID: ${invoiceId})`);
            // Process the payment
            const result = await this.processPayment(invoiceId);
            // Log the result
            if (result.success) {
                console.log(`✅ Invoice #${invoiceId}: Payment successful`);
            }
            else {
                console.log(`❌ Invoice #${invoiceId}: Payment failed - ${result.reason}`);
            }
        }
        // Print summary
        console.log("\n======== PAYMENT PROCESSING COMPLETED ========");
        console.log(`Total invoices processed: ${this.paymentResults.total}`);
        console.log(`Successful payments: ${this.paymentResults.success}`);
        console.log(`Failed payments: ${this.paymentResults.failure}`);
        console.log(`Invoices with no card: ${this.paymentResults.noCard}`);
        console.log("=============================================\n");
    }
    async processBranch() {
        console.log("\n========================================");
        console.log(`STARTING INVOICE PROCESSING FOR BRANCH ID: ${this.branchId}`);
        console.log(`PROCESSING ALL UNPAID INVOICES`);
        console.log("========================================");
        try {
            await this.handleLogin();
            await this.navigateToUnpaidInvoicesPage();
            // Collect all unpaid invoice IDs
            const allInvoiceIds = await this.getUnpaidInvoiceIds();
            console.log("\n======== SCRAPING COMPLETED ========");
            console.log(`Successfully scraped ${allInvoiceIds.length} unpaid invoice IDs`);
            console.log("====================================\n");
            // Process payments for all invoices
            await this.processInvoicePayments(allInvoiceIds);
            return {
                success: true,
                branchId: this.branchId,
                totalInvoices: allInvoiceIds.length,
                invoiceIds: allInvoiceIds,
                paymentResults: this.paymentResults,
                unsuccessfulInvoiceIds: this.unsuccessfulInvoiceIds,
            };
        }
        catch (error) {
            console.error(`Error processing invoices for branch ${this.branchId}:`, error);
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processBranch-${this.branchId}`);
            return {
                success: false,
                branchId: this.branchId,
                error: error.message,
                paymentResults: this.paymentResults,
                unsuccessfulInvoiceIds: this.unsuccessfulInvoiceIds,
            };
        }
    }
}
exports.UnpaidInvoiceProcessor = UnpaidInvoiceProcessor;
