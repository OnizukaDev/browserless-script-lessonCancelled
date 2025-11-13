"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptsController = void 0;
const script_producer_1 = require("../producers/script.producer");
const producer = new script_producer_1.ScriptProducer();
class ScriptsController {
    constructor() {
        // add handleLessonsCancelledScript
        this.handleInvoiceScript = async (req, res) => {
            try {
                const { branchId } = req.body;
                // Log the incoming webhook data
                console.log("📥 Received invoice processing request:");
                // Validate that we have the necessary data
                if (!branchId) {
                    res.status(400).json({
                        status: "error",
                        message: "Missing required data: branchId is required",
                    });
                    return;
                }
                const scriptPayload = {
                    scriptId: 1,
                    branchId,
                };
                // Use the producer to queue the invoice job
                await producer.produceScriptJob(scriptPayload);
                // Acknowledge receipt of the webhook immediately
                res.status(200).json({
                    message: "Invoice processing job queued successfully",
                });
            }
            catch (error) {
                console.error("❌ Error processing invoice request:", error);
                res.status(500).json({
                    status: "error",
                    message: "Internal server error",
                });
            }
        };
        this.handleRegenerateInvoice = async (req, res) => {
            try {
                const { branchId, clientName, clientId } = req.body;
                // Log the incoming webhook data
                console.log("📥 Received invoice processing request:");
                // Validate that we have the necessary data
                if (!branchId) {
                    res.status(400).json({
                        status: "error",
                        message: "Missing required data: branchId is required",
                    });
                    return;
                }
                // Create payload with clientId instead of email
                const scriptPayload = {
                    scriptId: 1,
                    branchId,
                    clientName,
                    clientId,
                };
                // Use the producer to queue the invoice job
                await producer.produceScriptJob(scriptPayload);
                // Acknowledge receipt of the webhook immediately
                res.status(200).json({
                    message: "Invoice processing job queued successfully",
                });
            }
            catch (error) {
                console.error("❌ Error processing invoice request:", error);
                res.status(500).json({
                    status: "error",
                    message: "Internal server error",
                });
            }
        };
        this.handleUnpaidInvoicesScript = async (req, res) => {
            try {
                const { branchId } = req.body;
                // Log the incoming webhook data
                console.log("📥 Received unpaid invoice processing request:");
                // Validate that we have the necessary data
                if (!branchId) {
                    res.status(400).json({
                        status: "error",
                        message: "Missing required data: branchId is required",
                    });
                    return;
                }
                const scriptPayload = {
                    scriptId: 3,
                    branchId,
                };
                // Use the producer to queue the invoice job
                await producer.produceScriptJob(scriptPayload);
                // Acknowledge receipt of the webhook immediately
                res.status(200).json({
                    message: "Invoice processing job queued successfully",
                });
            }
            catch (error) {
                console.error("❌ Error processing invoice request:", error);
                res.status(500).json({
                    status: "error",
                    message: "Internal server error",
                });
            }
        };
        this.handleEmailUnpaidInvoicesScript = async (req, res) => {
            try {
                const { branchId, processedInvoiceIds = [] } = req.body;
                // Log the incoming webhook data
                console.log("📥 Received email unpaid invoices processing request:");
                // Validate that we have the necessary data
                if (!branchId) {
                    res.status(400).json({
                        status: "error",
                        message: "Missing required data: branchId is required",
                    });
                    return;
                }
                const scriptPayload = {
                    scriptId: 4,
                    branchId,
                    processedInvoiceIds: processedInvoiceIds || [],
                };
                // Use the producer to queue the job
                await producer.produceScriptJob(scriptPayload);
                // Acknowledge receipt of the webhook immediately
                res.status(200).json({
                    message: "Email unpaid invoices processing job queued successfully",
                });
            }
            catch (error) {
                console.error("❌ Error processing email unpaid invoices request:", error);
                res.status(500).json({
                    status: "error",
                    message: "Internal server error",
                });
            }
        };
        this.handlePaymentOrderScript = async (req, res) => {
            try {
                const { branchId } = req.body;
                // Log the incoming webhook data
                console.log("📥 Received payment orders processing request:");
                // Validate that we have the necessary data
                if (!branchId) {
                    res.status(400).json({
                        status: "error",
                        message: "Missing required data: branchId is required",
                    });
                    return;
                }
                const scriptPayload = {
                    scriptId: 2,
                    branchId,
                };
                // Use the producer to queue the invoice job
                await producer.produceScriptJob(scriptPayload);
                console.log("⏳ Waiting 5 seconds before queuing second job...");
                await new Promise((resolve) => setTimeout(resolve, 5000));
                await producer.produceScriptJob(scriptPayload);
                // Acknowledge receipt of the webhook immediately
                res.status(200).json({
                    message: "Invoice processing job queued successfully",
                });
            }
            catch (error) {
                console.error("❌ Error processing invoice request:", error);
                res.status(500).json({
                    status: "error",
                    message: "Internal server error",
                });
            }
        };
    }
}
exports.ScriptsController = ScriptsController;
