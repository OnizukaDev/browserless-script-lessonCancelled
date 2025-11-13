"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptProducer = void 0;
const queue_1 = require("../queues/queue");
class ScriptProducer {
    constructor() { }
    async produceScriptJob(scriptPayload) {
        try {
            const { scriptId, branchId, clientName, clientId } = scriptPayload;
            const job = await queue_1.scriptsQueue.add("process-script", {
                branchId,
                scriptId,
                clientName,
                clientId,
                receivedAt: new Date().toISOString(),
            }, {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: 400,
                removeOnFail: 500,
            });
            console.log(`✅ Script processing job queued: ${job.id} for branch: ${scriptPayload.branchId}`);
            return job.id;
        }
        catch (error) {
            console.error("❌ Error producing invoice processing job:", error);
            throw error;
        }
    }
}
exports.ScriptProducer = ScriptProducer;
