"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegenerateInvoiceService = void 0;
// import puppeteer from "puppeteer";
const script_constants_1 = require("../constants/script.constants");
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const regenerate_invoice_processor_1 = require("../scripts/regenerate-invoice.processor");
const config_1 = require("../config");
class RegenerateInvoiceService {
    constructor(supabaseRepository, scriptConfigMapper, browserConfig) {
        this.supabaseRepository = supabaseRepository;
        this.scriptConfigMapper = scriptConfigMapper;
        this.browserConfig = browserConfig;
    }
    async regenerateInvoice(scriptId, branchId, clientName, clientId) {
        console.log(`🤖 Starting Puppeteer script for invoice regeneration`);
        console.log(`💼 Branch ID: ${branchId}`);
        console.log(`👤 Client Name: ${clientName}`);
        console.log(`🔗 Browserless endpoint: ${this.browserConfig.browserlessEndpoint}`);
        const numericBranchId = Number(branchId);
        const scriptCredentials = await this.supabaseRepository.getCredentials(scriptId, branchId);
        // Check if branch exists in config
        if (!script_constants_1.INVOICE_SCRIPT_CONFIG.branches[numericBranchId]) {
            throw new Error(`Branch ID ${branchId} not found in configuration`);
        }
        const invoiceScriptConfig = script_constants_1.INVOICE_SCRIPT_CONFIG.branches[numericBranchId];
        const formattedScriptConfig = this.scriptConfigMapper.mapRegenerateInvoicesScriptConfig(scriptCredentials, invoiceScriptConfig);
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
            const processor = new regenerate_invoice_processor_1.RegenerateInvoiceProcessor(formattedScriptConfig, numericBranchId, page, clientName, clientId);
            console.log(`Starting invoice regeneration for client "${clientName}" in branch ${branchId}`);
            // Run the process
            const result = await processor.processBranch();
            console.log(`Regeneration complete for branch ${branchId}`);
            console.log(`Result:`, result);
            return result;
        }
        catch (error) {
            console.error(`❌ Error in invoice regeneration:`, error);
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
exports.RegenerateInvoiceService = RegenerateInvoiceService;
