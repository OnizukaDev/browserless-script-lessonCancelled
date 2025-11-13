"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentOrdersService = void 0;
// import puppeteer from "puppeteer";
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const script_constants_1 = require("../constants/script.constants");
const send_report_email_utils_1 = require("../utils/send-report-email.utils");
const payment_orders_processor_1 = require("../scripts/payment-orders.processor");
const config_1 = require("../config");
class PaymentOrdersService {
    constructor(supabaseRepository, scriptConfigMapper, browserConfig) {
        this.supabaseRepository = supabaseRepository;
        this.scriptConfigMapper = scriptConfigMapper;
        this.browserConfig = browserConfig;
    }
    async processPaymentOrders(scriptId, branchId) {
        console.log(`🤖 Starting Puppeteer script for payment orders processing`);
        console.log(`💼 Branch ID: ${branchId}`);
        console.log(`🔗 Browserless endpoint: ${this.browserConfig.browserlessEndpoint}`);
        const numericBranchId = Number(branchId);
        const scriptCredentials = await this.supabaseRepository.getCredentials(scriptId, branchId);
        // Check if branch exists in config
        if (!script_constants_1.PAYMENT_ORDERS_SCRIPT_CONFIG.branches[numericBranchId]) {
            throw new Error(`Branch ID ${branchId} not found in configuration`);
        }
        const paymentOrdersScriptConfig = script_constants_1.PAYMENT_ORDERS_SCRIPT_CONFIG.branches[numericBranchId];
        const formattedScriptConfig = this.scriptConfigMapper.mapPaymentOrdersScriptConfig(scriptCredentials, paymentOrdersScriptConfig);
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
            const processor = new payment_orders_processor_1.PaymentOrderProcessor(formattedScriptConfig, numericBranchId, page);
            const result = await processor.processBranch();
            console.log(`Starting payment orders processing for branch ${branchId}`);
            // Run the process
            if (result && result.success) {
                try {
                    await (0, send_report_email_utils_1.sendReportEmail)(scriptId, branchId, result);
                    console.log("Report email sent successfully");
                }
                catch (emailError) {
                    console.error("Failed to send report email:", emailError);
                }
            }
            console.log(`Processing complete for branch ${branchId}`);
            console.log(`Result:`, result);
            return result;
        }
        catch (error) {
            console.error(`❌ Error in payment orders processing:`, error);
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
exports.PaymentOrdersService = PaymentOrdersService;
