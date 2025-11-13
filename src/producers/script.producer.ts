import { scriptsQueue } from "../queues/queue";

export class ScriptProducer {
  constructor() {}

  public async produceScriptJob(scriptPayload: {
    jobId: number;
    branchId: string | number;
  }): Promise<string | number> {
    try {
      const { jobId, branchId } = scriptPayload;

      const job = await scriptsQueue.add(
        "process-script",
        {
          branchId,
          jobId,
          receivedAt: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 400,
          removeOnFail: 500,
        }
      );

      console.log(
        `✅ Script processing job queued: ${job.id} for branch: ${scriptPayload.branchId} with job id: ${scriptPayload.jobId}`
      );
      return job.id;
    } catch (error) {
      console.error("❌ Error producing processing job:", error);
      throw error;
    }
  }
}
