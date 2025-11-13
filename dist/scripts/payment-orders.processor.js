"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentOrderProcessor = void 0;
const config_1 = require("../config");
const error_handler_utils_1 = require("../utils/error-handler.utils");
class PaymentOrderProcessor {
    constructor(config, branchId, page) {
        this.page = page;
        this.username = config.username;
        this.password = config.password;
        this.totalProcessedAmount = 0;
        this.branchId = branchId;
        this.loginPageUrl = config.integration_url;
        this.branchLoginSelectorId = config.branchLoginSelectorId;
        this.posPageUrl = config.posPageUrl;
        this.minAmount = config.minFilter;
        this.globalTimeout = config_1.config.puppeteer.globalTimeout;
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
                    return { success: false, error: "CSRF token not found" };
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
    async navigateToPaymentOrdersPage() {
        console.log(`Navigating to payment orders page: ${this.posPageUrl}`);
        await this.page.goto(this.posPageUrl);
        await this.page.waitForSelector("body", { timeout: this.globalTimeout });
        // Wait for the pos amount element to be present
        await this.page.waitForSelector(".detail-item .one-line.detail-info", {
            timeout: this.globalTimeout,
        });
        console.log("Payment orders page loaded");
    }
    async generatePaymentOrders() {
        console.log("Waiting for Generate Payment Orders button...");
        await this.page.waitForSelector('a[href="/accounting/pos/generate/"]', {
            timeout: this.globalTimeout,
        });
        console.log("Clicking Generate Payment Orders button...");
        await this.page.click('a[href="/accounting/pos/generate/"]');
        // Wait for modal to appear
        console.log("Waiting for modal to appear...");
        await this.page.waitForSelector("#id_pos_no_invoice", {
            timeout: this.globalTimeout,
        });
        // Check the checkbox for generating POs without invoices
        console.log("Checking 'Generate Payment Orders including items not associated with a paid Invoice' checkbox...");
        await this.page.click("#id_pos_no_invoice");
        // Click the Regenerate button
        console.log("Clicking Regenerate button...");
        await this.page.click("a.submit-modal");
        // Wait for regeneration to complete
        console.log("Waiting for regeneration to complete...");
        await this.page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: this.globalTimeout,
        });
        // Wait for the card titles to appear
        console.log("Waiting for Draft Payment Orders to load...");
        await this.page.waitForSelector(".card-title", {
            timeout: this.globalTimeout,
        });
        // Wait for the specific card title with Draft Payment Orders
        await this.page.waitForFunction(() => {
            const cardTitles = document.querySelectorAll(".card-title");
            return Array.from(cardTitles).some((title) => title.textContent.includes("Draft Payment Orders"));
        }, { timeout: this.globalTimeout });
        console.log("Payment orders have been generated and loaded");
    }
    async getPaymentOrders() {
        console.log("Finding payment orders with amount >= $" + this.minAmount);
        const paymentOrders = await this.page.evaluate((minAmount) => {
            // Find draft payment orders card
            const draftCardTitle = Array.from(document.querySelectorAll(".card-title")).find((element) => element.textContent.includes("Draft Payment Orders"));
            if (!draftCardTitle) {
                console.log("Draft payment orders section not found");
                return [];
            }
            const draftCard = draftCardTitle.closest(".card-custom");
            const paymentOrderItems = draftCard.querySelectorAll("span[item]");
            const itemsArray = Array.from(paymentOrderItems);
            console.log(`Found ${itemsArray.length} draft payment orders`);
            const eligibleOrders = [];
            for (let i = 0; i < itemsArray.length; i++) {
                const item = itemsArray[i];
                const amountElement = item
                    .closest(".list-group-item")
                    .querySelector("span.float-right");
                // Get just the text and remove all non-essential characters
                const amountText = amountElement.textContent.trim();
                // Extract just the numeric part with a regex
                const amountMatch = amountText.match(/\$?(\d+[.,]?\d*)/);
                const amount = amountMatch
                    ? parseFloat(amountMatch[1].replace(",", ""))
                    : NaN;
                // Check if amount meets minimum requirement
                if (amount >= minAmount) {
                    eligibleOrders.push({
                        id: item.getAttribute("item"),
                        amount: amount,
                    });
                }
            }
            console.log(`Found ${eligibleOrders.length} payment orders with amount >= ${minAmount}`);
            return eligibleOrders;
        }, this.minAmount);
        console.log(`Eligible payment orders: ${paymentOrders.length}`);
        return paymentOrders;
    }
    async confirmPaymentOrders(paymentOrders, batchSize = 700) {
        if (paymentOrders.length === 0) {
            console.log("No payment orders to confirm");
            return 0;
        }
        let totalConfirmed = 0;
        // Split the payment orders into batches
        const batches = [];
        for (let i = 0; i < paymentOrders.length; i += batchSize) {
            batches.push(paymentOrders.slice(i, i + batchSize));
        }
        console.log(`Processing ${paymentOrders.length} payment orders in ${batches.length} batches`);
        // Process each batch
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Confirming batch ${i + 1}/${batches.length} with ${batch.length} payment orders...`);
            try {
                // Extract just the IDs for submission
                const batchIds = batch.map((order) => order.id);
                // Submit the form with this batch of payment order IDs
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
                    // Create and submit form
                    const form = document.createElement("form");
                    form.method = "POST";
                    form.action = window.location.pathname;
                    form.style.display = "none";
                    // Add CSRF token
                    const csrfInput = document.createElement("input");
                    csrfInput.type = "hidden";
                    csrfInput.name = "csrfmiddlewaretoken";
                    csrfInput.value = csrfToken;
                    form.appendChild(csrfInput);
                    // Add payment order IDs to the form
                    ids.forEach((id) => {
                        const idInput = document.createElement("input");
                        idInput.type = "hidden";
                        idInput.name = "to_stage";
                        idInput.value = id;
                        form.appendChild(idInput);
                    });
                    // Add the form to the document and submit it
                    document.body.appendChild(form);
                    console.log(`Submitting form with ${ids.length} payment orders`);
                    form.submit();
                    return ids.length;
                }, batchIds);
                // Wait for navigation to complete after form submission
                console.log("Waiting for batch confirmation to complete...");
                await this.page.waitForNavigation({
                    waitUntil: "networkidle2",
                    timeout: this.globalTimeout,
                });
                console.log(`Successfully confirmed batch of ${batch.length} payment orders`);
                // Add the amounts of confirmed orders to our tracker
                for (const order of batch) {
                    this.totalProcessedAmount += order.amount;
                }
                totalConfirmed += batch.length;
            }
            catch (error) {
                error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, "confirmPaymentOrders");
            }
        }
        console.log(`Total payment orders confirmed: ${totalConfirmed}`);
        return totalConfirmed;
    }
    async raisePaymentOrders() {
        try {
            console.log("Waiting for 'Raise Confirmed Payment Order(s)' button to become enabled...");
            // Wait for the button to become enabled (not disabled)
            await this.page.waitForFunction(() => {
                const button = document.querySelector('a[href="/accounting/pos/raise/"]');
                return button && !button.classList.contains("disabled");
            }, { timeout: this.globalTimeout });
            console.log("Clicking 'Raise Confirmed Payment Order(s)' button...");
            await this.page.click('a[href="/accounting/pos/raise/"]');
            // Wait for modal to appear
            console.log("Waiting for raise modal to appear...");
            await this.page.waitForSelector(".modal-footer .submit-modal", {
                timeout: this.globalTimeout,
            });
            // Click the confirm button in the modal
            console.log("Clicking confirm button in modal...");
            await this.page.click(".modal-footer .submit-modal");
            // Wait for raising to complete
            console.log("Waiting for raising payment orders to complete...");
            await this.page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: this.globalTimeout,
            });
            console.log("Successfully raised confirmed payment orders");
            return true;
        }
        catch (error) {
            console.error("Error raising payment orders:", error);
            // If the button is disabled, it might mean there are no payment orders to raise
            if (error.message.includes("disabled")) {
                console.log("No confirmed payment orders to raise");
            }
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, "raisePaymentOrders");
        }
    }
    async processPaymentOrdersInBatches(allPaymentOrders) {
        const RAISE_BATCH_SIZE = 1400;
        const totalOrders = allPaymentOrders.length;
        let processedCount = 0;
        let totalConfirmedCount = 0;
        console.log(`Found ${totalOrders} eligible payment orders. Processing in batches of ${RAISE_BATCH_SIZE}...`);
        // Split into batches for raising
        for (let i = 0; i < allPaymentOrders.length; i += RAISE_BATCH_SIZE) {
            const batchNumber = Math.floor(i / RAISE_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allPaymentOrders.length / RAISE_BATCH_SIZE);
            console.log(`\n--- Processing batch ${batchNumber}/${totalBatches} ---`);
            // Get current batch of payment orders
            const batchOrders = allPaymentOrders.slice(i, i + RAISE_BATCH_SIZE);
            console.log(`Batch size: ${batchOrders.length} payment orders`);
            // Confirm only this batch of payment orders
            const confirmedCount = await this.confirmPaymentOrders(batchOrders);
            totalConfirmedCount += confirmedCount;
            if (confirmedCount > 0) {
                // Raise just this batch of confirmed payment orders
                const raiseResult = await this.raisePaymentOrders();
                if (raiseResult) {
                    processedCount += confirmedCount;
                    console.log(`Successfully raised batch ${batchNumber} with ${confirmedCount} payment orders`);
                    console.log(`Running total processed amount: $${this.totalProcessedAmount.toFixed(2)}`);
                }
                else {
                    console.log(`Failed to raise batch ${batchNumber}`);
                }
            }
            else {
                console.log(`No payment orders were confirmed in batch ${batchNumber}`);
            }
            // If there are more batches to process, we need to navigate back to the payment orders page
            if (i + RAISE_BATCH_SIZE < allPaymentOrders.length) {
                console.log("Navigating back to payment orders page for next batch...");
                await this.navigateToPaymentOrdersPage();
            }
        }
        return {
            totalConfirmedCount,
            processedCount,
            totalEligibleOrders: totalOrders,
        };
    }
    async processBranch() {
        try {
            console.log(`\n========================================`);
            console.log(`STARTING PROCESSING FOR BRANCH ID: ${this.branchId}`);
            console.log(`----------------------------------------`);
            // Reset our tracking property at the start of processing
            this.totalProcessedAmount = 0;
            await this.handleLogin();
            await this.navigateToPaymentOrdersPage();
            // Generate Payment Orders
            await this.generatePaymentOrders();
            // Get eligible payment orders (with amounts)
            const allPaymentOrders = await this.getPaymentOrders();
            if (allPaymentOrders.length === 0) {
                console.log("No eligible payment orders found, ending process");
                return {
                    success: true,
                    branchId: this.branchId,
                    confirmedCount: 0,
                    message: "No eligible payment orders found",
                };
            }
            // Process payment orders in batches
            const result = await this.processPaymentOrdersInBatches(allPaymentOrders);
            // Use our tracked amount directly
            const processedPosAmount = this.totalProcessedAmount;
            console.log(`\n=== BRANCH ${this.branchId} COMPLETE ===`);
            console.log(`Successfully processed ${result.processedCount}/${result.totalEligibleOrders} payment orders`);
            console.log(`Total processed amount: $${processedPosAmount.toFixed(2)}`);
            console.log(`========================================\n`);
            await this.logout();
            return {
                success: true,
                branchId: this.branchId,
                confirmedCount: result.totalConfirmedCount,
                processedCount: result.processedCount,
                totalEligibleOrders: result.totalEligibleOrders,
                processedGrossAmount: processedPosAmount,
                message: `Successfully processed ${result.processedCount}/${result.totalEligibleOrders} payment orders`,
            };
        }
        catch (error) {
            console.error(`Error processing branch ${this.branchId}:`, error);
            error_handler_utils_1.BrowserErrorHandler.handleBrowserError(error, `processBranch-${this.branchId}`);
            return {
                success: false,
                branchId: this.branchId,
                error: error.message,
                message: "Failed to process payment orders",
            };
        }
    }
}
exports.PaymentOrderProcessor = PaymentOrderProcessor;
