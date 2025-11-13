"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpaidInvoiceService = void 0;
// import puppeteer from "puppeteer";
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const script_constants_1 = require("../constants/script.constants");
const send_report_email_utils_1 = require("../utils/send-report-email.utils");
const unpaid_invoice_processor_1 = require("../scripts/unpaid-invoice.processor");
const config_1 = require("../config");
class UnpaidInvoiceService {
    constructor(supabaseRepository, scriptConfigMapper, browserConfig, scriptProducer) {
        this.supabaseRepository = supabaseRepository;
        this.scriptConfigMapper = scriptConfigMapper;
        this.browserConfig = browserConfig;
        this.scriptProducer = scriptProducer;
    }
    async getActiveExclusions(branchId) {
        try {
            // Fetch active exclusions from database
            const activeExclusions = await this.supabaseRepository.fetchActiveExclusions(branchId);
            // Get current date for filtering
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            // Filter exclusions by end date
            const validExclusions = activeExclusions.filter((exclusion) => {
                const endDate = new Date(exclusion.exclusion_end_date);
                endDate.setHours(23, 59, 59, 999); // Set to end of day
                return endDate >= currentDate;
            });
            // Extract just the client names
            const excludedClientNames = validExclusions.map((exclusion) => exclusion.client_name);
            console.log(`Found ${excludedClientNames.length} active exclusions for branch ${branchId}`);
            console.log("Excluded clients:", excludedClientNames);
            return excludedClientNames;
        }
        catch (error) {
            console.error("Error fetching active exclusions:", error);
            return [];
        }
    }
    async processUnpaidInvoices(scriptId, branchId) {
        console.log(`🤖 Starting Puppeteer script for unpaid invoices processing`);
        console.log(`💼 Branch ID: ${branchId}`);
        console.log(`🔗 Browserless endpoint: ${this.browserConfig.browserlessEndpoint}`);
        const numericBranchId = Number(branchId);
        // Fetch active exclusions before processing
        const excludedClients = await this.getActiveExclusions(numericBranchId);
        const scriptCredentials = await this.supabaseRepository.getCredentials(scriptId, branchId);
        // Check if branch exists in config
        if (!script_constants_1.UNPAID_INVOICE_SCRIPT_CONFIG.branches[numericBranchId]) {
            throw new Error(`Branch ID ${branchId} not found in configuration`);
        }
        const unpaidInvoiceScriptConfig = script_constants_1.UNPAID_INVOICE_SCRIPT_CONFIG.branches[numericBranchId];
        const formattedScriptConfig = this.scriptConfigMapper.mapUnpaidInvoicesScriptConfig(scriptCredentials, unpaidInvoiceScriptConfig);
        let browser;
        try {
            // Connect to the Browserless instance
            console.log(`Connecting to Browserless...`);
            // browser = await puppeteer.launch({
            //   headless: false,
            //   args: [
            //     "--no-sandbox",
            //     "--disable-setuid-sandbox",
            //     "--disable-dev-shm-usage",
            //     "--disable-gpu",
            //   ],
            //   defaultViewport: null,
            // });
            browser = await puppeteer_core_1.default.connect({
                browserWSEndpoint: this.browserConfig.browserlessEndpoint,
                protocolTimeout: config_1.config.puppeteer.protocolTimeout,
            });
            console.log(`Connected to Browserless successfully`);
            // Create a new page
            const page = await browser.newPage();
            console.log(`Created new page`);
            // Initialize the processor with browser and page
            const processor = new unpaid_invoice_processor_1.UnpaidInvoiceProcessor(formattedScriptConfig, numericBranchId, page, excludedClients);
            console.log(`Starting unpaid invoice processing for branch ${branchId}`);
            // Run the process
            const result = await processor.processBranch();
            if (result && result.success) {
                try {
                    await (0, send_report_email_utils_1.sendReportEmail)(scriptId, branchId, result);
                    console.log("Report email sent successfully");
                }
                catch (emailError) {
                    console.error("Failed to send report email:", emailError);
                }
            }
            if (result.unsuccessfulInvoiceIds &&
                result.unsuccessfulInvoiceIds.length > 0) {
                console.log(`\n=== Found ${result.unsuccessfulInvoiceIds.length} unsuccessful invoices ===`);
                console.log(`Queueing email processing job for branch ${branchId}`);
                await this.scriptProducer.produceScriptJob({
                    scriptId: 4,
                    branchId: numericBranchId,
                });
                console.log(`Email processing job queued successfully`);
            }
            else {
                console.log(`No unsuccessful invoices to process for email sending`);
            }
            console.log(`Processing complete for branch ${branchId}`);
            console.log(`Result:`, result);
            return result;
        }
        catch (error) {
            console.error(`❌ Error in unpaid invoice processing:`, error);
            throw new Error("REQUEUE_NEEDED");
        }
        finally {
            // Always close the browser to prevent leaks
            if (browser) {
                try {
                    await browser.close();
                    console.log(`Browser closed successfully`);
                }
                catch (closeError) {
                    console.error(`Error closing browser:`, closeError);
                }
            }
        }
    }
}
exports.UnpaidInvoiceService = UnpaidInvoiceService;
