// src/services/lesson-cancelled.service.ts
import puppeteer from "puppeteer-core";
import { config } from "../config";
import { BrowserErrorHandler } from "../utils/error-handler.utils";
import { TutorCruncherClient } from "../clients/tutor-cruncher.client";
import { LessonCancelledProcessor } from "../scripts/lesson-cancelled-processor";
import { APPT_SCRIPT_CONFIG } from "../constants/script.constants";

export class LessonCancelledService {
    private browserlessEndpoint: string;

    constructor() {
        // prefer env var then fallback to app config
        this.browserlessEndpoint = process.env.BROWSERLESS_ENDPOINT || config?.browserlessEndpoint || "";
    }

    /**
     * Cancel planned lessons for a given jobId and branchId.
     * - Retrieves appointment UI URLs from TutorCruncher API via TutorCruncherClient
     * - Launches/Connects Puppeteer
     * - Instantiates LessonCancelledProcessor and runs processAppointments(...)
     */
    public async cancelPlannedLessons(jobId: number, branchId: string | number): Promise<any> {
        console.log(`🤖 Starting lesson-cancelled job for jobId=${jobId}, branchId=${branchId}`);

        // 1) get appointment UI urls via TC client
        const tcClient = new TutorCruncherClient(branchId);
        let appointmentUrls: string[] = [];

        try {
            appointmentUrls = await tcClient.getAppointmentUrls(jobId);
        } catch (err: any) {
            console.error(`❌ Failed to fetch appointment URLs for job ${jobId}:`, err?.message || err);
            throw err;
        }

        if (!appointmentUrls || appointmentUrls.length === 0) {
            console.log(`⚠️ No planned appointments found for job ${jobId}. Nothing to do.`);
            return { success: true, jobId, processed: 0, details: "No planned appointments" };
        }

        console.log(`🔗 Will process ${appointmentUrls.length} appointment(s)`);

        // 2) prepare Puppeteer browser (connect to Browserless or launch local for debug)
        let browser: any = null;
        const localDebug = process.env.LOCAL_PUPPETEER === "true" || process.env.LOCAL_PUPPETEER === "1";

        try {
            if (localDebug) {
                console.log("⚙️ LOCAL_PUPPETEER enabled — launching local Chrome (headful) for debugging");
                browser = await (puppeteer as any).launch({
                    headless: false,
                    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                    defaultViewport: null,
                });
            } else {
                if (!this.browserlessEndpoint) {
                    throw new Error("No browserless endpoint configured (BROWSERLESS_ENDPOINT or config.browserlessEndpoint)");
                }
                console.log(`🔗 Connecting to Browserless at ${this.browserlessEndpoint}`);
                browser = await puppeteer.connect({
                    browserWSEndpoint: this.browserlessEndpoint,
                    protocolTimeout: config?.puppeteer?.protocolTimeout ?? 30000,
                });
            }

            console.log("✅ Browser ready");

            // 3) create a new page
            const page = await browser.newPage();
            // optional: set user agent / viewport
            await page.setViewport({ width: 1280, height: 900 });

            // 4) get branch config if available
            const numericBranchId = Number(branchId);
            const branchConfig = (APPT_SCRIPT_CONFIG && APPT_SCRIPT_CONFIG.branches && APPT_SCRIPT_CONFIG.branches[numericBranchId]) || {};

            // 5) instantiate processor and run
            const processor = new LessonCancelledProcessor(branchConfig, numericBranchId, page);

            console.log("🔐 Logging into TutorCruncher via processor...");
            await processor.handleLogin();

            console.log("▶️ Starting appointments processing via processor...");
            const processingResult = await processor.processAppointments(appointmentUrls, { delayMs: 500, retries: 2 });

            console.log("✅ Appointments processing finished:", processingResult);

            // attempt logout
            try {
                await processor.logout();
            } catch (logoutErr) {
                console.warn("⚠️ Logout failed:", logoutErr);
            }

            return {
                success: true,
                jobId,
                branchId: numericBranchId,
                processed: processingResult.cancelled.length,
                skipped: processingResult.skipped.length,
                failed: processingResult.failed,
                raw: processingResult,
            };
        } catch (error: any) {
            console.error("❌ Error in cancelPlannedLessons:", error?.message || error);
            BrowserErrorHandler.handleBrowserError(error, `cancelPlannedLessons-${jobId}`);
            // bubble up or return structured failure
            return { success: false, jobId, branchId, error: error?.message || error };
        } finally {
            if (browser) {
                try {
                    await browser.close();
                    console.log("Browser closed");
                } catch (closeErr) {
                    console.error("Error closing browser:", closeErr);
                }
            }
        }
    }
}
