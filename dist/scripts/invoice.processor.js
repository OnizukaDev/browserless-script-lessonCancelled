"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceProcessor = void 0;
const config_1 = require("../config");
const template_constants_1 = require("../constants/template.constants");
const error_handler_utils_1 = require("../utils/error-handler.utils");
class InvoiceProcessor {
    constructor(config, branchId, page) {
        this.page = page;
        this.username = config.username;
        this.password = config.password;
        this.totalProcessedAmount = 0;
        this.branchId = branchId;
        this.isOrthophonieBranch = branchId == 14409;
        this.loginPageUrl = config.integration_url;
        this.branchLoginSelectorId = config.branchLoginSelectorId;
        this.invoicesPageUrl = config.invoicesPageUrl;
        this.minFilter = config.minFilter;
        this.maxFilter = config.maxFilter;
        this.adhocAmounts = config.adhocAmounts;
        this.globalTimeout = config_1.config.puppeteer.globalTimeout;
        this.requestTimeout = 1000;
    }
    async logout() {
        try {
            console.log("Starting logout process...");
            // Make direct POST request to logout endpoint with CSRF token
            const logoutResult = await this.page.evaluate(async () => {
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
                try {
                    const response = await fetch("/logout/", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "X-CSRFToken": csrfToken,
                        },
                        credentials: "same-origin",
                    });
                    return {
                        success: response.ok,
                        status: response.status,
                    };
                }
                catch (fetchError) {
                    return { success: false, error: fetchError.toString() };
                }
            });
            if (logoutResult.success) {
                await this.page.goto(this.loginPageUrl);
                console.log("Navigated to login page");
            }
            console.log("Logout process completed");
        }
        catch (error) {
            console.error("Error during logout:", error.message);
        }
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
        // Simple approach: wait for buttons to appear
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
    async updateInvoiceTemplate(template) {
        try {
            console.log("Updating invoice template for Orthophonie branch...");
            // Navigate to template edit page
            const templateEditUrl = `${this.loginPageUrl}setup/template/edit/379/content/`;
            await this.page.goto(templateEditUrl, {
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            // Wait for the textarea to load
            await this.page.waitForSelector("#id_code", {
                timeout: this.globalTimeout,
            });
            // Clear and replace template content
            await this.page.evaluate((newTemplate) => {
                const codeMirrorElement = document.querySelector(".CodeMirror");
                if (codeMirrorElement && codeMirrorElement.CodeMirror) {
                    const cm = codeMirrorElement.CodeMirror;
                    // Set the new template
                    cm.setValue(newTemplate);
                    // Save to underlying textarea
                    cm.save();
                    return { success: true };
                }
                return { success: false };
            }, template);
            // Save the template
            await this.page.click('input[type="submit"][value="Save"]');
            // Wait for save to complete
            await this.page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            console.log("Invoice template updated successfully");
        }
        catch (error) {
            console.error("Error updating invoice template:", error);
            return error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `updateInvoiceTemplate`);
        }
    }
    async navigateToInvoicesPage() {
        console.log(`Navigating to invoices page: ${this.invoicesPageUrl}`);
        await this.page.goto(this.invoicesPageUrl);
        await this.page.waitForSelector("body", { timeout: this.globalTimeout });
        // Wait for the gross amount element to be present
        await this.page.waitForSelector(".detail-item .one-line.detail-info", {
            timeout: this.globalTimeout,
        });
        console.log("Invoices page loaded with gross amount information");
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
    async getInvoiceIds() {
        const { regularInvoices, adhocInvoices } = await this.page.evaluate(({ minAmount, maxAmount, adhocAmounts, }) => {
            // Find draft invoices card
            const draftCardTitle = Array.from(document.querySelectorAll(".card-title")).find((element) => element.textContent.toLowerCase().includes("draft"));
            if (!draftCardTitle) {
                console.log("Draft invoices section not found");
                return { regularInvoices: [], adhocInvoices: [] };
            }
            const draftCard = draftCardTitle.closest(".card-custom");
            const invoiceItems = draftCard.querySelectorAll("span[item]");
            const itemsArray = Array.from(invoiceItems);
            // Create sets for efficient lookup of ad hoc amounts
            const adhocAmountsSet = new Set(adhocAmounts.map((amount) => parseFloat(amount)));
            const regularInvoices = [];
            const adhocInvoices = [];
            for (let i = 0; i < itemsArray.length; i++) {
                const item = itemsArray[i];
                const listItem = item.closest(".list-group-item");
                const amountElement = listItem.querySelector("span.float-right");
                // Get just the text and remove all non-essential characters
                const amountText = amountElement.textContent.trim();
                // Extract just the numeric part with a regex
                const amountMatch = amountText.match(/\$?(\d+[.,]?\d*)/);
                const amount = amountMatch
                    ? parseFloat(amountMatch[1].replace(",", ""))
                    : NaN;
                const invoiceId = item.getAttribute("item");
                // Check for client name with "INSTIT"
                const clientLinkElement = item.querySelector('a[href^="/accounting/invoices/"]');
                let clientHasInstitMention = false;
                if (clientLinkElement) {
                    const clientNameText = clientLinkElement.textContent
                        .trim()
                        .toLowerCase();
                    clientHasInstitMention = clientNameText.includes("instit");
                }
                if (clientHasInstitMention) {
                    console.log(`Including invoice ${invoiceId} for client with INSTIT mention regardless of amount: $${amount}`);
                    regularInvoices.push({
                        id: invoiceId,
                        amount: amount,
                    });
                    continue;
                }
                // Skip invoices outside the min/max range
                if (amount < minAmount || amount > maxAmount) {
                    continue;
                }
                // Check if it's an ad hoc amount or regular
                if (adhocAmountsSet.has(amount)) {
                    adhocInvoices.push({
                        id: invoiceId,
                        amount: amount,
                    });
                }
                else {
                    regularInvoices.push({
                        id: invoiceId,
                        amount: amount,
                    });
                }
            }
            return { regularInvoices, adhocInvoices };
        }, {
            minAmount: this.minFilter,
            maxAmount: this.maxFilter,
            adhocAmounts: this.adhocAmounts,
        });
        console.log(`Found ${regularInvoices.length} regular invoices within range`);
        console.log(`Found ${adhocInvoices.length} ad hoc invoices that need verification`);
        return { regularInvoices, adhocInvoices };
    }
    async processInvoice(invoiceId) {
        try {
            console.log(`Processing invoice: ${invoiceId}`);
            // Base URL
            const baseUrl = this.loginPageUrl;
            // Do everything in a single this.page.evaluate
            const result = await this.page.evaluate(async (invoiceId, baseUrl) => {
                // Step 1: Fetch and parse invoice page
                const invoiceUrl = `${baseUrl}accounting/invoices/${invoiceId}/`;
                console.log(`Fetching invoice page: ${invoiceUrl}`);
                let resp = await fetch(invoiceUrl, { method: "GET" });
                if (!resp.ok) {
                    console.error(`HTTP error fetching invoice page: ${resp.status}`);
                    return { success: false, reason: "Failed to fetch invoice page" };
                }
                let htmlText = await resp.text();
                let parser = new DOMParser();
                let doc = parser.parseFromString(htmlText, "text/html");
                // Extract client ID
                const clientLink = doc.querySelector("a[href*='/clients/']");
                if (!clientLink) {
                    return { success: false, reason: "No client link found" };
                }
                const clientHref = clientLink.getAttribute("href");
                const clientParts = clientHref
                    .split("/")
                    .filter((part) => part.length > 0);
                const clientsIndex = clientParts.indexOf("clients");
                if (clientsIndex === -1 || clientsIndex + 1 >= clientParts.length) {
                    return {
                        success: false,
                        reason: `Could not extract client ID from href: ${clientHref}`,
                    };
                }
                const clientId = clientParts[clientsIndex + 1];
                console.log(`Found client ID: ${clientId}`);
                // Step 2: Fetch and parse client activity page
                const clientActivityUrl = `${baseUrl}clients/${clientId}/activity/`;
                console.log(`Fetching client activity page: ${clientActivityUrl}`);
                resp = await fetch(clientActivityUrl, { method: "GET" });
                if (!resp.ok) {
                    return {
                        success: false,
                        reason: "Failed to fetch client activity page",
                    };
                }
                htmlText = await resp.text();
                parser = new DOMParser();
                doc = parser.parseFromString(htmlText, "text/html");
                // Extract service ID
                const serviceLink = doc.querySelector("a[href*='/cal/service/']");
                if (!serviceLink) {
                    return {
                        success: false,
                        reason: "No services for this client",
                    };
                }
                const serviceHref = serviceLink.getAttribute("href");
                const serviceParts = serviceHref
                    .split("/")
                    .filter((part) => part.length > 0);
                const serviceIndex = serviceParts.indexOf("service");
                if (serviceIndex === -1 || serviceIndex + 1 >= serviceParts.length) {
                    return {
                        success: false,
                        reason: `Could not extract service ID from href: ${serviceHref}`,
                    };
                }
                const serviceId = serviceParts[serviceIndex + 1];
                console.log(`Found service ID: ${serviceId}`);
                // Step 3: Fetch service activity page
                const serviceUrl = `${baseUrl}cal/service/${serviceId}/activity/`;
                console.log(`Fetching service activity page: ${serviceUrl}`);
                resp = await fetch(serviceUrl, { method: "GET" });
                if (!resp.ok) {
                    return {
                        success: false,
                        reason: "Failed to fetch service activity page",
                    };
                }
                htmlText = await resp.text();
                parser = new DOMParser();
                doc = parser.parseFromString(htmlText, "text/html");
                const appointmentItems = doc.querySelectorAll("li.list-group-item");
                if (!appointmentItems || appointmentItems.length === 0) {
                    return {
                        success: false,
                        reason: "No appointments found for this service",
                        hasPlannedAppointments: false,
                    };
                }
                // Check each appointment for "Planned" status
                let hasPlannedAppointments = false;
                let plannedAppointmentsCount = 0;
                for (const item of appointmentItems) {
                    const statusBadge = item.querySelector("span.apt-planned");
                    if (statusBadge) {
                        hasPlannedAppointments = true;
                        plannedAppointmentsCount++;
                    }
                }
                // Return the result with the planned appointments flag
                return {
                    success: true,
                    clientId: clientId,
                    serviceId: serviceId,
                    hasPlannedAppointments: hasPlannedAppointments,
                    plannedAppointmentsCount: plannedAppointmentsCount,
                };
            }, invoiceId, baseUrl);
            // Process the result outside the this.page.evaluate
            if (!result.success) {
                console.log(`Invoice ${invoiceId} processing failed: ${result.reason}`);
                return false;
            }
            // Check if the service has at least one planned appointment
            if (!result.hasPlannedAppointments) {
                console.log(`Invoice ${invoiceId} has no planned appointments, skipping`);
                return false;
            }
            console.log(`Successfully processed invoice ${invoiceId}`);
            console.log(`- Client ID: ${result.clientId}`);
            console.log(`- Service ID: ${result.serviceId}`);
            console.log(`- Planned appointments: ${result.plannedAppointmentsCount}`);
            return true;
        }
        catch (error) {
            return error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processInvoice-${invoiceId}`, false);
        }
    }
    async processBatch(invoiceObjects, batchIndex, batchSize) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, invoiceObjects.length);
        const batchItems = invoiceObjects.slice(startIndex, endIndex);
        console.log(`Processing batch ${batchIndex + 1}: ${startIndex}-${endIndex - 1} (${batchItems.length} invoices)`);
        // Process invoices sequentially with timeout between them
        const successfulIds = [];
        for (let i = 0; i < batchItems.length; i++) {
            const item = batchItems[i];
            console.log(`Processing invoice ${i + 1}/${batchItems.length}: ${item.id}`);
            // Process the current invoice
            const success = await this.processInvoice(item.id);
            if (success) {
                successfulIds.push(item.id);
            }
            // Add timeout before next invoice (except for the last one)
            if (i < batchItems.length - 1) {
                console.log(`Waiting ${this.requestTimeout}ms before next invoice...`);
                await new Promise((resolve) => setTimeout(resolve, this.requestTimeout));
            }
        }
        console.log(`Batch ${batchIndex + 1} complete: ${successfulIds.length}/${batchItems.length} successful`);
        return successfulIds;
    }
    async stageInvoices(invoiceIds, stagingBatchSize = 700) {
        try {
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
            console.error("Error in staging process:", error);
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
    async processInvoices(batchSize = 700) {
        console.log("Starting invoice processing...");
        // Get all invoice IDs that match our criteria, split into regular and adhoc
        const { regularInvoices, adhocInvoices } = await this.getInvoiceIds();
        // For regular invoices, no additional processing is needed, they go directly to staging
        console.log(`${regularInvoices.length} regular invoices will be staged directly`);
        // Now we only need to process ad hoc invoices to check for planned lessons
        console.log(`Processing ${adhocInvoices.length} ad hoc invoices to check for planned lessons`);
        if (adhocInvoices.length === 0) {
            console.log("No ad hoc invoices to process, skipping processing step.");
            return { regularInvoices, validAdhocInvoices: [] };
        }
        // Calculate the number of batches needed for ad hoc invoices
        const batchCount = Math.ceil(adhocInvoices.length / batchSize);
        console.log(`Processing ad hoc invoices in ${batchCount} batches of up to ${batchSize} invoices each`);
        // Process all batches sequentially
        console.time("Ad hoc invoice processing");
        let validAdhocIds = [];
        for (let i = 0; i < batchCount; i++) {
            const batchResults = await this.processBatch(adhocInvoices, i, batchSize);
            validAdhocIds = validAdhocIds.concat(batchResults);
        }
        console.timeEnd("Ad hoc invoice processing");
        // Log the results for ad hoc invoices
        console.log(`Ad hoc invoice processing complete.`);
        console.log(`- Total ad hoc invoices processed: ${adhocInvoices.length}`);
        console.log(`- Ad hoc invoices with planned lessons: ${validAdhocIds.length}`);
        console.log(`- Ad hoc invoices filtered out: ${adhocInvoices.length - validAdhocIds.length}`);
        // Create a filtered array of ad hoc invoice objects that have valid IDs
        const validAdhocInvoices = adhocInvoices.filter((invoice) => validAdhocIds.includes(invoice.id));
        // Return both sets of invoice objects with their amounts
        return { regularInvoices, validAdhocInvoices };
    }
    async stageAndRaiseInBatches(invoiceObjects) {
        console.log(`Starting batched staging and raising process for ${invoiceObjects.length} invoices...`);
        if (invoiceObjects.length === 0) {
            console.log("No invoices to process, ending.");
            return 0;
        }
        const RAISE_BATCH_SIZE = 900;
        const totalBatches = Math.ceil(invoiceObjects.length / RAISE_BATCH_SIZE);
        console.log(`Processing in ${totalBatches} batches of up to ${RAISE_BATCH_SIZE} invoices each`);
        let totalProcessed = 0;
        for (let i = 0; i < totalBatches; i++) {
            const batchStartIndex = i * RAISE_BATCH_SIZE;
            const batchEndIndex = Math.min(batchStartIndex + RAISE_BATCH_SIZE, invoiceObjects.length);
            const currentBatchObjects = invoiceObjects.slice(batchStartIndex, batchEndIndex);
            // Extract just the IDs for staging
            const currentBatchIds = currentBatchObjects.map((obj) => obj.id);
            console.log(`\n--- Processing batch ${i + 1}/${totalBatches} ---`);
            console.log(`Batch size: ${currentBatchIds.length} invoices`);
            // Stage this batch of invoices
            const stagedCount = await this.stageBatch(currentBatchIds);
            if (stagedCount > 0) {
                // Raise just this batch of staged invoices
                const raiseResult = await this.raiseInvoices();
                if (raiseResult) {
                    totalProcessed += stagedCount;
                    // Add the amounts of successfully processed invoices to our tracker
                    for (const invoiceObj of currentBatchObjects) {
                        this.totalProcessedAmount += invoiceObj.amount;
                    }
                    console.log(`Successfully raised batch ${i + 1} with ${stagedCount} invoices`);
                    console.log(`Running total processed amount: $${this.totalProcessedAmount.toFixed(2)}`);
                }
                else {
                    console.log(`Failed to raise batch ${i + 1}`);
                }
            }
            else {
                console.log(`No invoices were staged in batch ${i + 1}`);
            }
            // If there are more batches to process, navigate back to the invoices page
            if (i + 1 < totalBatches) {
                console.log("Navigating back to invoices page for next batch...");
                await this.navigateToInvoicesPage();
            }
        }
        console.log(`\nBatched processing complete: Successfully processed ${totalProcessed}/${invoiceObjects.length} invoices`);
        return totalProcessed;
    }
    async processBranch() {
        try {
            console.log(`\n========================================`);
            console.log(`STARTING PROCESSING FOR BRANCH ID: ${this.branchId}`);
            console.log(`----------------------------------------`);
            console.log(`Min Amount: ${this.minFilter}`);
            console.log(`Max Amount: ${this.maxFilter}`);
            console.log(`Ad Hoc Amounts: ${this.adhocAmounts.join(", ")}`);
            console.log(`----------------------------------------`);
            // Reset our tracking property at the start of processing a branch
            this.totalProcessedAmount = 0;
            await this.handleLogin();
            if (this.isOrthophonieBranch) {
                await this.updateInvoiceTemplate(template_constants_1.INVOICE_TEMPLATES.ORTHOPHONIE);
            }
            await this.navigateToInvoicesPage();
            // Generate Invoices
            await this.generateInvoices();
            // Process invoices to get objects of all eligible invoices (with amounts)
            const { regularInvoices, validAdhocInvoices } = await this.processInvoices();
            // Combine both sets of invoice objects for staging and raising
            const allInvoiceObjects = [...regularInvoices, ...validAdhocInvoices];
            if (allInvoiceObjects.length === 0) {
                console.log("No eligible invoices found after processing, ending process");
                return {
                    success: true,
                    branchId: this.branchId,
                    processedCount: 0,
                    message: "No eligible invoices found",
                };
            }
            const processedCount = await this.stageAndRaiseInBatches(allInvoiceObjects);
            // Use our tracked amount instead of calculating from before/after values
            const processedGrossAmount = this.totalProcessedAmount;
            if (this.isOrthophonieBranch) {
                await this.updateInvoiceTemplate(template_constants_1.INVOICE_TEMPLATES.ORIGINAL);
            }
            console.log(`\n=== BRANCH ${this.branchId} COMPLETE ===`);
            console.log(`Successfully processed ${processedCount}/${allInvoiceObjects.length} invoices`);
            console.log(`Total processed amount: $${processedGrossAmount.toFixed(2)}`);
            console.log(`========================================\n`);
            await this.logout();
            return {
                success: true,
                branchId: this.branchId,
                regularCount: regularInvoices.length,
                adhocCount: validAdhocInvoices.length,
                processedCount: processedCount,
                totalEligibleCount: allInvoiceObjects.length,
                processedGrossAmount: processedGrossAmount,
                message: `Successfully processed ${processedCount}/${allInvoiceObjects.length} invoices`,
            };
        }
        catch (error) {
            console.error(`Error processing branch ${this.branchId}:`, error);
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processBranch-${this.branchId}`);
            return {
                success: false,
                branchId: this.branchId,
                error: error.message,
                message: "Failed to process invoices",
            };
        }
    }
}
exports.InvoiceProcessor = InvoiceProcessor;
