"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailUnpaidInvoiceService = void 0;
// import puppeteer from "puppeteer";
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const script_constants_1 = require("../constants/script.constants");
const send_report_email_utils_1 = require("../utils/send-report-email.utils");
const config_1 = require("../config");
const email_unpaid_invoice_processor_1 = require("../scripts/email-unpaid-invoice-processor");
class EmailUnpaidInvoiceService {
    constructor(supabaseRepository, scriptConfigMapper, browserConfig) {
        this.supabaseRepository = supabaseRepository;
        this.scriptConfigMapper = scriptConfigMapper;
        this.browserConfig = browserConfig;
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
    async processEmailUnpaidInvoices(scriptId, branchId, processedInvoiceIds = []) {
        console.log(`🤖 Starting Puppeteer script for email unpaid invoices processing`);
        console.log(`💼 Branch ID: ${branchId}`);
        console.log(`🔗 Browserless endpoint: ${this.browserConfig.browserlessEndpoint}`);
        const numericBranchId = Number(branchId);
        // Fetch active exclusions before processing
        const excludedClients = await this.getActiveExclusions(numericBranchId);
        const scriptCredentials = await this.supabaseRepository.getCredentials(3, branchId);
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
            // Initialize the email processor with browser and page
            console.log(`Starting email unpaid invoice processing for branch ${branchId}`);
            const emailProcessor = new email_unpaid_invoice_processor_1.EmailUnpaidInvoiceProcessor(formattedScriptConfig, numericBranchId, page, excludedClients, processedInvoiceIds);
            // Run the email process - the processor handles determining which invoices need emails
            const result = await emailProcessor.processBranch();
            // Send report email if needed
            if (result && result.success) {
                try {
                    await (0, send_report_email_utils_1.sendReportEmail)(scriptId, branchId, result);
                    console.log("Email report sent successfully");
                }
                catch (emailError) {
                    console.error("Failed to send email report:", emailError);
                }
            }
            console.log(`Email processing complete for branch ${branchId}`);
            console.log(`Result:`, result);
            return result;
        }
        catch (error) {
            console.error(`❌ Error in email unpaid invoice processing:`, error);
            throw error;
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
exports.EmailUnpaidInvoiceService = EmailUnpaidInvoiceService;
