"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptWorker = void 0;
exports.initializeScriptWorker = initializeScriptWorker;
const queue_1 = require("../queues/queue");
const di_container_1 = require("../core/di-container");
class ScriptWorker {
    constructor() {
        // Get all services from the DI container
        this.invoiceService = di_container_1.container.get("invoiceService");
        this.unpaidInvoiceSerivce = di_container_1.container.get("unpaidInvoiceService");
        this.paymentOrdersService = di_container_1.container.get("paymentOrdersService");
        this.regenerateInvoiceService = di_container_1.container.get("regenerateInvoiceService");
        this.emailUnpaidInvoiceService = di_container_1.container.get("emailUnpaidInvoiceService");
        this.initializeProcessors();
    }
    initializeProcessors() {
        // Set up the processor for the invoice processing queue
        queue_1.scriptsQueue.process("process-script", this.processScripts.bind(this));
        // Listen for failed jobs
        queue_1.scriptsQueue.on("failed", this.handleFailedJob.bind(this));
    }
    async processScripts(job) {
        try {
            console.log(`🏃 Processing script job ${job.id}`);
            // Extract data from the job
            const { scriptId, branchId, clientName, clientId } = job.data;
            console.log("SCRIPT ID", scriptId);
            console.log("BRANCH ID", branchId);
            console.log("CLIENT NAME", clientName);
            const hasClientName = clientName &&
                clientName !== "" &&
                clientName !== null &&
                clientName !== undefined;
            if (hasClientName) {
                await this.regenerateInvoiceService.regenerateInvoice(scriptId, branchId, clientName, clientId);
            }
            if (!hasClientName) {
                switch (scriptId) {
                    case 1:
                        await this.invoiceService.processInvoices(scriptId, branchId);
                        break;
                    case 2:
                        await this.paymentOrdersService.processPaymentOrders(scriptId, branchId);
                        break;
                    case 3:
                        await this.unpaidInvoiceSerivce.processUnpaidInvoices(scriptId, branchId);
                        break;
                    case 4:
                        const { processedInvoiceIds = [] } = job.data;
                        await this.emailUnpaidInvoiceService.processEmailUnpaidInvoices(scriptId, branchId, processedInvoiceIds);
                        break;
                }
            }
            // Log processing information
            console.log(`📋 Script processing data: branchId ${branchId}, scriptId ${scriptId}`);
            console.log(`✅ Successfully processed invoice job ${job.id}`);
        }
        catch (error) {
            if (error.message === "REQUEUE_NEEDED") {
                const currentAttempt = (job.data.attempt || 0) + 1;
                const MAX_ATTEMPTS = 7;
                // Check if we've exceeded max attempts
                if (currentAttempt > MAX_ATTEMPTS) {
                    console.log(`❌ Job for branch ${job.data.branchId} failed after ${MAX_ATTEMPTS} attempts`);
                    // Let the job fail permanently
                    throw new Error(`Job failed after ${MAX_ATTEMPTS} attempts: ${error.message}`);
                }
                // Get processed IDs from the error object
                const processedInvoiceIds = error.processedInvoiceIds || [];
                if (processedInvoiceIds.length > 0) {
                    console.log(`Requeuing with ${processedInvoiceIds.length} already processed invoice IDs`);
                }
                // Requeue the job with increasing delay
                const delay = currentAttempt * 30 * 60 * 1000; // 30 mins * attempt number
                await queue_1.scriptsQueue.add("process-script", {
                    ...job.data,
                    attempt: currentAttempt,
                    processedInvoiceIds,
                }, {
                    delay: delay, // Exponential backoff
                    attempts: 1, // Don't use Bull's retry mechanism
                });
                console.log(`🔄 Job requeued for branch ${job.data.branchId} (attempt ${currentAttempt}/${MAX_ATTEMPTS})`);
                console.log(`⏰ Will retry in ${delay / 1000 / 60} minutes`);
                return {
                    status: "requeued",
                    attempt: currentAttempt,
                    maxAttempts: MAX_ATTEMPTS,
                };
            }
        }
    }
    handleFailedJob(job, error) {
        console.error(`❌ Invoice processing job ${job.id} failed permanently:`, error);
    }
}
exports.ScriptWorker = ScriptWorker;
function initializeScriptWorker() {
    return new ScriptWorker();
}
