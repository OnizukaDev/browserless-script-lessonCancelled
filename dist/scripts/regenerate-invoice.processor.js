"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegenerateInvoiceProcessor = void 0;
const config_1 = require("../config");
const error_handler_utils_1 = require("../utils/error-handler.utils");
class RegenerateInvoiceProcessor {
    constructor(config, branchId, page, clientName, clientId) {
        this.page = page;
        this.username = config.username;
        this.password = config.password;
        this.branchId = branchId;
        this.clientName = clientName.toLowerCase();
        this.clientId = clientId;
        this.loginPageUrl = config.integration_url;
        this.branchLoginSelectorId = config.branchLoginSelectorId;
        this.invoicesPageUrl = config.invoicesPageUrl;
        this.maxFilter = config.maxFilter;
        this.globalTimeout = config_1.config.puppeteer.globalTimeout;
    }
    async handleLogin() {
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
        console.log("Selecting branch ...");
        // Wait for buttons to appear
        await this.page.waitForSelector("button.list-group-item", {
            timeout: this.globalTimeout,
        });
        // Get button text contents and click the matching one
        const branchButtonHandle = await this.page.evaluateHandle((branchName) => {
            const buttons = document.querySelectorAll("button.list-group-item");
            for (const button of buttons) {
                if (button.textContent.toLowerCase().includes(branchName.toLowerCase())) {
                    return button;
                }
            }
            return null;
        }, this.branchLoginSelectorId);
        // Click the button if found
        if (!branchButtonHandle) {
            throw new Error(`Branch button with text containing "${this.branchLoginSelectorId}" not found`);
        }
        await branchButtonHandle.click();
        await this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
    }
    async navigateToInvoicesPage() {
        await this.page.goto(this.invoicesPageUrl, {
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        await this.page.waitForSelector("body", { timeout: this.globalTimeout });
    }
    async generateInvoices() {
        console.log("Waiting for Generate Invoices button...");
        await this.page.waitForSelector('a[href="/accounting/invoices/generate/"]', {
            timeout: this.globalTimeout,
        });
        console.log("Clicking Generate Invoices button...");
        await this.page.click('a[href="/accounting/invoices/generate/"]');
        // Wait for modal to fully appear with more specific selectors
        console.log("Waiting for modal to appear...");
        await this.page.waitForSelector(".modal-content", {
            visible: true,
            timeout: this.globalTimeout,
        });
        await this.page.waitForSelector(".modal-title", {
            visible: true,
            timeout: this.globalTimeout,
        });
        // Ensure the Regenerate button is fully loaded and visible
        console.log("Waiting for Regenerate button to be available...");
        await this.page.waitForSelector(".modal-footer .submit-modal", {
            visible: true,
            timeout: this.globalTimeout,
        });
        // Click the Regenerate button with a more precise selector
        console.log("Clicking Regenerate button...");
        await this.page.click(".modal-footer .submit-modal");
        // Wait for regeneration to complete
        console.log("Waiting for regeneration to complete...");
        await this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        // Wait for the card titles to appear
        console.log("Waiting for Draft Invoices to load...");
        await this.page.waitForSelector(".card-title", {
            timeout: this.globalTimeout,
        });
        // Wait for the specific card title with Draft Invoices
        await this.page.waitForFunction(() => {
            const cardTitles = document.querySelectorAll(".card-title");
            return Array.from(cardTitles).some((title) => title.textContent.toLowerCase().includes("draft"));
        }, { timeout: this.globalTimeout });
        console.log("Invoices have been generated and loaded");
    }
    async raiseInvoices() {
        try {
            console.log("Waiting for 'Raise Confirmed Invoice(s)' button to become enabled...");
            // Wait for the button to become enabled (not disabled)
            await this.page.waitForFunction(() => {
                const button = document.querySelector('a[href="/accounting/invoices/raise/"]');
                return button && !button.classList.contains("disabled");
            }, { timeout: this.globalTimeout });
            console.log("Clicking 'Raise Confirmed Invoice(s)' button...");
            await this.page.click('a[href="/accounting/invoices/raise/"]');
            // Wait for modal to appear
            console.log("Waiting for raise modal to appear...");
            await this.page.waitForSelector(".modal-footer .submit-modal", {
                timeout: this.globalTimeout,
            });
            // Click the confirm button in the modal
            console.log("Clicking confirm button in modal...");
            await this.page.click(".modal-footer .submit-modal");
            // Wait for raising to complete
            console.log("Waiting for raising invoices to complete...");
            await this.page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            console.log("Successfully raised confirmed invoices");
            return true;
        }
        catch (error) {
            console.error("Error raising invoices:", error);
            // If the button is disabled, it might mean there are no invoices to raise
            if (error.message.includes("disabled")) {
                console.log("No confirmed invoices to raise");
            }
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, "raiseInvoices");
        }
    }
    async stageInvoices(invoices, stagingBatchSize = 800) {
        try {
            const invoiceIds = invoices.map((invoice) => invoice.id);
            console.log(`Starting staging process for ${invoiceIds.length} invoices...`);
            if (invoiceIds.length === 0) {
                console.log("No invoices to stage, ending.");
                return 0;
            }
            // Calculate the number of staging batches needed
            const batchCount = Math.ceil(invoiceIds.length / stagingBatchSize);
            console.log(`Staging in ${batchCount} batches of up to ${stagingBatchSize} invoices each`);
            // Process all staging batches
            console.time("Invoice staging");
            let totalStaged = 0;
            for (let i = 0; i < batchCount; i++) {
                const startIndex = i * stagingBatchSize;
                const endIndex = Math.min(startIndex + stagingBatchSize, invoiceIds.length);
                const batchIds = invoiceIds.slice(startIndex, endIndex);
                console.log(`Staging batch ${i + 1}/${batchCount}: ${startIndex}-${endIndex - 1} (${batchIds.length} invoices)`);
                // Perform the staging for this batch
                const stagedCount = await this.stageBatch(batchIds);
                totalStaged += stagedCount;
                console.log(`Batch ${i + 1} staged: ${stagedCount} invoices`);
            }
            console.timeEnd("Invoice staging");
            console.log(`Staging complete. Total invoices staged: ${totalStaged}`);
            return totalStaged;
        }
        catch (error) {
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, "stageInvoice");
            return 0;
        }
    }
    async stageBatch(batchIds) {
        try {
            await this.page.evaluate((ids) => {
                // Get fresh CSRF token
                const csrfTokenElement = document.querySelector('[name="csrfmiddlewaretoken"]');
                if (!csrfTokenElement) {
                    throw new Error("CSRF token element not found");
                }
                const csrfToken = csrfTokenElement.value;
                if (!csrfToken) {
                    console.error("CSRF token not found on page");
                    return 0;
                }
                // Create and submit form for this batch
                const form = document.createElement("form");
                form.method = "POST";
                form.action = "/accounting/invoices/staging/";
                form.style.display = "none";
                // Add CSRF token
                const csrfInput = document.createElement("input");
                csrfInput.type = "hidden";
                csrfInput.name = "csrfmiddlewaretoken";
                csrfInput.value = csrfToken;
                form.appendChild(csrfInput);
                // Add batch invoice IDs to the form
                ids.forEach((id) => {
                    const idInput = document.createElement("input");
                    idInput.type = "hidden";
                    idInput.name = "to_stage";
                    idInput.value = id;
                    form.appendChild(idInput);
                });
                // Add the form to the document and submit it
                document.body.appendChild(form);
                console.log(`Submitting batch with ${ids.length} invoices`);
                form.submit();
                return ids.length;
            }, batchIds);
            // Wait for navigation to complete after form submission
            await this.page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            return batchIds.length;
        }
        catch (error) {
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, "stageBatch");
        }
    }
    async getClientIdFromInvoice(invoiceId) {
        try {
            const result = await this.page.evaluate(async (invoiceId, baseUrl) => {
                // Fetch and parse invoice page
                const invoiceUrl = `${baseUrl}accounting/invoices/${invoiceId}/`;
                console.log(`Fetching invoice page: ${invoiceUrl}`);
                let resp = await fetch(invoiceUrl, { method: "GET" });
                if (!resp.ok) {
                    console.error(`HTTP error fetching invoice page: ${resp.status}`);
                    return null;
                }
                let htmlText = await resp.text();
                let parser = new DOMParser();
                let doc = parser.parseFromString(htmlText, "text/html");
                // Extract client ID
                const clientLink = doc.querySelector("a[href*='/clients/']");
                if (!clientLink) {
                    return null;
                }
                const clientHref = clientLink.getAttribute("href");
                const clientParts = clientHref
                    .split("/")
                    .filter((part) => part.length > 0);
                const clientsIndex = clientParts.indexOf("clients");
                if (clientsIndex === -1 || clientsIndex + 1 >= clientParts.length) {
                    return null;
                }
                return clientParts[clientsIndex + 1];
            }, invoiceId, this.loginPageUrl);
            return result;
        }
        catch (error) {
            console.error(`Error getting client ID for invoice ${invoiceId}:`, error);
            return null;
        }
    }
    async getMatchingInvoiceIds() {
        // Get all invoices matching the client name and max amount first
        const nameMatchingInvoices = await this.page.evaluate(({ maxAmount, clientName }) => {
            // Find draft invoices card
            const draftCardTitle = Array.from(document.querySelectorAll(".card-title")).find((element) => element.textContent.toLowerCase().includes("draft"));
            if (!draftCardTitle) {
                console.log("Draft invoices section not found");
                return [];
            }
            const draftCard = draftCardTitle.closest(".card-custom");
            const invoiceItems = draftCard.querySelectorAll("span[item]");
            const matchingInvoices = [];
            for (let i = 0; i < invoiceItems.length; i++) {
                const item = invoiceItems[i];
                const listItem = item.closest(".list-group-item");
                // Get amount
                const amountElement = listItem.querySelector("span.float-right");
                const amountText = amountElement.textContent.trim();
                const amountMatch = amountText.match(/\$?(\d+[.,]?\d*)/);
                const amount = amountMatch
                    ? parseFloat(amountMatch[1].replace(",", ""))
                    : NaN;
                // Get client name - find the link with specific accounting/invoices href pattern
                const clientLinkElement = item.querySelector('a[href^="/accounting/invoices/"]');
                if (!clientLinkElement)
                    continue;
                const clientNameText = clientLinkElement.textContent
                    .trim()
                    .toLowerCase();
                // Match both conditions: amount <= maxAmount AND client name contains search string
                if (clientNameText.includes(clientName)) {
                    const invoiceId = item.getAttribute("item");
                    matchingInvoices.push({
                        id: invoiceId,
                        clientName: clientLinkElement.textContent.trim(),
                        amount: amount,
                    });
                }
            }
            return matchingInvoices;
        }, {
            maxAmount: this.maxFilter,
            clientName: this.clientName,
        });
        console.log(`Found ${nameMatchingInvoices.length} invoices matching client name '${this.clientName}'`);
        // If no clientId filter or no matching invoices, return the name matches
        if (!this.clientId || nameMatchingInvoices.length === 0) {
            nameMatchingInvoices.forEach((invoice) => {
                console.log(`- Invoice ID: ${invoice.id}, Client: ${invoice.clientName}, Amount: ${invoice.amount}`);
            });
            return nameMatchingInvoices;
        }
        // If clientId is provided, filter by client ID
        console.log(`Client ID filter provided: ${this.clientId}. Checking client IDs...`);
        const idMatchingInvoices = [];
        // Process each invoice to check the client ID
        for (const invoice of nameMatchingInvoices) {
            console.log(`Checking client ID for invoice ${invoice.id}...`);
            const clientId = await this.getClientIdFromInvoice(invoice.id);
            if (clientId == this.clientId) {
                console.log(`✅ Client ID match found for invoice ${invoice.id}: ${clientId}`);
                idMatchingInvoices.push(invoice);
            }
            else {
                console.log(`❌ Client ID mismatch for invoice ${invoice.id}: ${clientId || "not found"} (expected: ${this.clientId})`);
            }
            // If we found a match, we can stop checking
            if (idMatchingInvoices.length > 0) {
                console.log(`Found matching invoice with client ID ${this.clientId}, stopping search.`);
                break;
            }
        }
        console.log(`Found ${idMatchingInvoices.length} invoices matching both client name '${this.clientName}' and ID '${this.clientId}'`);
        idMatchingInvoices.forEach((invoice) => {
            console.log(`- Invoice ID: ${invoice.id}, Client: ${invoice.clientName}, Amount: ${invoice.amount}`);
        });
        return idMatchingInvoices;
    }
    async processBranch() {
        try {
            console.log(`\n========================================`);
            console.log(`STARTING PROCESSING FOR BRANCH ID: ${this.branchId}`);
            console.log(`CLIENT NAME FILTER: ${this.clientName}`);
            console.log(`MAX AMOUNT FILTER: ${this.maxFilter}`);
            console.log(`----------------------------------------`);
            await this.handleLogin();
            await this.navigateToInvoicesPage();
            await this.generateInvoices();
            // Get matching invoices (both client name and max amount)
            const matchingInvoices = await this.getMatchingInvoiceIds();
            // Stage the matching invoices
            const stagedCount = await this.stageInvoices(matchingInvoices);
            if (stagedCount > 0) {
                // Raise the confirmed invoices
                await this.raiseInvoices();
            }
            console.log(`\n=== BRANCH ${this.branchId} COMPLETE ===`);
            console.log(`Successfully staged ${stagedCount} invoices`);
            console.log(`========================================\n`);
            return {
                success: true,
                branchId: this.branchId,
                clientName: this.clientName,
                matchedInvoices: matchingInvoices.length,
                stagedInvoices: stagedCount,
            };
        }
        catch (error) {
            console.error(`Error processing branch ${this.branchId}:`, error);
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processBranch-${this.branchId}`);
            return {
                success: false,
                branchId: this.branchId,
                clientName: this.clientName,
                error: error.message,
            };
        }
    }
}
exports.RegenerateInvoiceProcessor = RegenerateInvoiceProcessor;
