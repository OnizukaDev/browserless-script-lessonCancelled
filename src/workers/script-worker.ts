// src/workers/script.worker.ts
import { Job } from "bull";
import { scriptsQueue } from "../queues/queue";
import { LessonCancelledService } from "../services/lesson-cancelled.service";

export class ScriptWorker {
  private lessonCancelledService: LessonCancelledService;
  private concurrency: number;
  private requireBrowserless: boolean;

  constructor() {
    this.lessonCancelledService = new LessonCancelledService();
    this.concurrency = 1;
    const local = true;
    console.log(process.env.LOCAL_PUPPETEER);
    this.requireBrowserless = !local;

    this.initializeProcessors();
  }

  private initializeProcessors(): void {
    console.log(`Initializing ScriptWorker with concurrency=${this.concurrency}`);
    scriptsQueue.process("process-script", this.concurrency, this.processScripts.bind(this));

    // Listen for failed jobs (global)
    scriptsQueue.on("failed", this.handleFailedJob.bind(this));
  }

  /**
   * Main processor called by Bull for each job of type "process-script".
   * Expects job.data to contain { jobId, branchId }.
   */
  private async processScripts(job: Job<any>): Promise<any> {
    try {
      console.log(`🏃 Processing script job ${job.id}`);

      // validation of env for browserless usage
      if (this.requireBrowserless) {
        // 🚀 FIX 2
        const endpoint =
            process.env.BROWSER_PLAYWRIGHT_ENDPOINT ||
            process.env.BROWSER_WS_ENDPOINT ||
            process.env.BROWSERLESS_ENDPOINT ||
            process.env.BROWSER_WEBDRIVER_ENDPOINT;

        if (!endpoint) {
          const msg =
              "❌ No Browserless endpoint configured and LOCAL_PUPPETEER is disabled.";
          console.error(msg);
          throw new Error(msg);
        }
      }

      // Extract data from the job
      const { jobId, branchId } = job.data ?? {};

      // Validate inputs
      const jobIdNum = Number(jobId);
      if (!jobId || isNaN(jobIdNum)) {
        const errMsg = `Invalid or missing jobId in job data: ${jobId}`;
        console.error(errMsg);
        throw new Error(errMsg);
      }
      if (branchId === undefined || branchId === null || String(branchId).trim() === "") {
        const errMsg = `Invalid or missing branchId in job data: ${branchId}`;
        console.error(errMsg);
        throw new Error(errMsg);
      }

      console.log(`📋 Script processing data: branchId=${branchId}, jobId=${jobIdNum}`);

      // Start progress
      await job.progress(5);

      // Call the service
      const result = await this.lessonCancelledService.cancelPlannedLessons(jobIdNum, branchId);

      // Update progress during/after
      await job.progress(80);

      console.log(`✅ Successfully processed script job ${job.id}`);
      console.log("Result:", result);

      await job.progress(100);

      // Return result to be stored by Bull
      return {
        ok: true,
        jobId: jobIdNum,
        branchId,
        result,
      };
    } catch (error: any) {
      // Log error clearly
      console.error(`❌ Error processing script job ${job.id}:`, error?.message || error);

      throw error;
    }
  }

  private handleFailedJob(job: Job<any>, error: Error): void {
    console.error(`❌ Script processing job ${job.id} failed permanently:`, error);
  }
}

export function initializeScriptWorker(): ScriptWorker {
  return new ScriptWorker();
}
