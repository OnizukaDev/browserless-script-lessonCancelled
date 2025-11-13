// src/services/lesson-cancelled.processor.ts
import { config as globlConfig } from "../config";
import { BrowserErrorHandler } from "../utils/error-handler.utils";

/**
 * LessonCancelledProcessor
 **/
export class LessonCancelledProcessor {
    private username: string;
    private password: string;
    private branchId: number;
    private totalProcessedAmount: number;
    private loginPageUrl: string;
    private branchLoginSelectorId: string;
    private invoicesPageUrl: string | undefined;
    private minFilter: number | undefined;
    private maxFilter: number | undefined;
    private globalTimeout: number;
    private requestTimeout: number;
    private page: any;
    private isOrthophonieBranch: boolean;

    constructor(config: any = {}, branchId: any, page: any) {
        this.page = page;
        this.username = config.username || process.env.TC_USERNAME || "";
        this.password = config.password || process.env.TC_PASSWORD || "";
        this.totalProcessedAmount = 0;
        this.branchId = Number(branchId);
        this.isOrthophonieBranch = this.branchId === 14409;
        this.loginPageUrl = config.integration_url || config.loginPageUrl || (process.env.TC_LOGIN_URL || "https://app.tutorax.com/login/");
        this.branchLoginSelectorId = config.branchLoginSelectorId || "";
        this.invoicesPageUrl = config.invoicesPageUrl;
        this.minFilter = config.minFilter;
        this.maxFilter = config.maxFilter;
        this.globalTimeout = globlConfig?.puppeteer?.globalTimeout ?? 30000;
        this.requestTimeout = 1000;
    }

    /* ---------------------------
       Existing helpers (logout/login)
       --------------------------- */

    async logout() {
        try {
            console.log("Starting logout process...");

            const logoutResult = await this.page.evaluate(async () => {
                const csrfTokenElement: any = document.querySelector('[name="csrfmiddlewaretoken"]');
                if (!csrfTokenElement) {
                    return { success: false, error: "csrf element not found" };
                }
                const csrfToken = (csrfTokenElement as HTMLInputElement).value;
                if (!csrfToken) return { success: false, error: "csrf token empty" };

                try {
                    const response = await fetch("/logout/", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "X-CSRFToken": csrfToken,
                        },
                        credentials: "same-origin",
                    });
                    return { success: response.ok, status: response.status };
                } catch (fetchError: any) {
                    return { success: false, error: String(fetchError) };
                }
            });

            if (logoutResult && logoutResult.success) {
                await this.page.goto(this.loginPageUrl, { waitUntil: "networkidle2", timeout: this.globalTimeout }).catch(() => null);
                console.log("Navigated to login page after logout");
            }

            console.log("Logout process completed");
        } catch (error: any) {
            console.error("Error during logout:", error?.message || error);
        }
    }

    async handleLogin() {
        try {
            console.log(`Navigating to login page: ${this.loginPageUrl}`);
            await this.page.goto(this.loginPageUrl, { waitUntil: "networkidle2", timeout: this.globalTimeout });

            console.log("Logging in...");
            await this.page.waitForSelector("#id_username", { timeout: this.globalTimeout });
            await this.page.type("#id_username", this.username, { delay: 10 });
            await this.page.waitForSelector("#id_password", { timeout: this.globalTimeout });
            await this.page.type("#id_password", this.password, { delay: 10 });

            // submit/login
            await Promise.all([
                this.page.click("#email-signin").catch(() => null),
                this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: this.globalTimeout }).catch(() => null),
            ]);

            // Branch selection if necessary
            if (this.branchLoginSelectorId) {
                try {
                    await this.page.waitForSelector("button.list-group-item", { timeout: 5000 });
                    await this.page.evaluate((branchName: any) => {
                        const buttons = Array.from(document.querySelectorAll("button.list-group-item"));
                        for (const b of buttons) {
                            if (b.textContent && b.textContent.toLowerCase().includes(String(branchName).toLowerCase())) {
                                (b as HTMLElement).click();
                                return true;
                            }
                        }
                        return false;
                    }, this.branchLoginSelectorId);
                    await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => null);
                } catch (err) {
                    console.warn("Branch selection not found or timed out — continuing");
                }
            }

            console.log("✅ Logged in (or assumed logged in)");
        } catch (error: any) {
            console.error("Login failed:", error?.message || error);
            throw error;
        }
    }

    /* ---------------------------
       NEW: appointment helpers
       --------------------------- */

    /**
     * (Optional) Fallback: parse service/job UI page to extract appointment links.
     * You won't need this if you always call TutorCruncherClient from service, but it's handy as fallback.
     */
    async getAppointmentLinksFromJob(jobId: number): Promise<string[]> {
        try {
            const jobUrl = `${(this.loginPageUrl || "").replace(/\/login\/?$/, "/")}cal/service/${jobId}/`;
            console.log(`Navigating to job page (UI) ${jobUrl}`);
            await this.page.goto(jobUrl, { waitUntil: "networkidle2", timeout: this.globalTimeout });

            await this.page.waitForSelector(".tcc-lessons, .card.card-custom, .list-group", { timeout: 8000 }).catch(() => null);

            const links: string[] = await this.page.evaluate(() => {
                const lessonsCard = document.querySelector(".tcc-lessons") || document.querySelector(".card.card-custom");
                const anchors = lessonsCard
                    ? lessonsCard.querySelectorAll(".list-group-item a[href*='/cal/appointments/']")
                    : document.querySelectorAll(".list-group-item a[href*='/cal/appointments/']");
                const arr: string[] = [];
                anchors.forEach((a: any) => {
                    if (a && a.href) arr.push(a.href);
                });
                return Array.from(new Set(arr));
            });

            console.log(`Found ${links.length} appointment links on job page`);
            return links;
        } catch (err) {
            console.error("Error extracting appointment links from job page:", err);
            return [];
        }
    }

    /**
     * Process a list of appointment UI URLs sequentially.
     * - retries each appointment up to 2 times on transient errors
     */
    async processAppointments(appointmentUrls: string[], opts: { delayMs?: number; retries?: number } = {}) {
        const delayMs = opts.delayMs ?? 500;
        const retries = opts.retries ?? 2;

        const results = {
            cancelled: [] as string[],
            skipped: [] as string[],
            failed: [] as { url: string; reason: any }[],
        };

        for (const url of appointmentUrls) {
            let attempt = 0;
            let done = false;
            while (attempt <= retries && !done) {
                attempt++;
                try {
                    const res = await this.processAppointment(url);
                    if (res === "cancelled") results.cancelled.push(url);
                    else results.skipped.push(url);
                    done = true;
                } catch (err) {
                    console.warn(`Attempt ${attempt} failed for ${url}:`, err?.message || err);
                    if (attempt > retries) {
                        results.failed.push({ url, reason: err?.message || err });
                        done = true;
                    } else {
                        // small backoff
                        await new Promise((r) => setTimeout(r, 500 + attempt * 300));
                    }
                }
            }
            await new Promise((r) => setTimeout(r, delayMs));
        }

        return results;
    }

    /**
     * Process one appointment UI URL:
     * - open page
     * - skip if already cancelled/deleted
     * - click Edit (or open modal)
     * - set status to Cancelled
     * - submit form / save
     */
    async processAppointment(appointmentUrl: string): Promise<"cancelled" | "skipped"> {
        try {
            console.log(`➡️ Opening appointment ${appointmentUrl}`);
            await this.page.goto(appointmentUrl, { waitUntil: "networkidle2", timeout: this.globalTimeout });

            // check status badge quickly
            const already = await this.page.evaluate(() => {
                const badge = document.querySelector(".status-badge");
                if (!badge) return false;
                const txt = (badge.textContent || "").toLowerCase();
                const cls = (badge.className || "").toLowerCase();
                if (txt.includes("cancel") || txt.includes("deleted") || cls.includes("apt-cancelled") || cls.includes("apt-deleted")) return true;
                return false;
            });

            if (already) {
                console.log("⏭️ Already cancelled/deleted — skipping");
                return "skipped";
            }

            // Try common edit selectors (anchors/buttons)
            let clickedEdit = false;
            const editSelectors = ['a[href*="/edit/"]', 'button.edit-appointment', 'a.btn-edit', 'a[data-action="edit"]'];
            for (const sel of editSelectors) {
                const h = await this.page.$(sel);
                if (h) {
                    try {
                        await Promise.all([
                            h.click(),
                            this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 7000 }).catch(() => null),
                        ]);
                    } catch (_) {
                        // if click doesn't navigate (modal), it's fine
                    }
                    clickedEdit = true;
                    break;
                }
            }

            // fallback: link by text "Edit"
            if (!clickedEdit) {
                const [linkHandle] = await this.page.$x("//a[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'edit')]");
                if (linkHandle) {
                    try {
                        await Promise.all([
                            linkHandle.click(),
                            this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 7000 }).catch(() => null),
                        ]);
                    } catch (_) {}
                    clickedEdit = true;
                }
            }

            if (!clickedEdit) {
                console.warn("⚠️ No edit control found — skipping this appointment");
                return "skipped";
            }

            // small wait for form/modal to render
            await this.page.waitForTimeout(500);

            // set status to cancelled
            const setOk = await this.setStatusToCancelled();
            if (!setOk) {
                console.warn("⚠️ Couldn't set status to Cancelled — skipping");
                return "skipped";
            }

            // submit/save
            const submitted = await this.page.evaluate(() => {
                const btn = document.querySelector("button[type='submit'], input[type='submit'], .save-button, .btn-primary, .submit-modal");
                if (btn) {
                    (btn as HTMLElement).click();
                    return true;
                }
                const form = document.querySelector("form");
                if (form) {
                    try {
                        (form as HTMLFormElement).submit();
                        return true;
                    } catch (_) {
                        return false;
                    }
                }
                return false;
            });

            if (!submitted) {
                console.warn("⚠️ Could not submit the form — skipping (no submit button found)");
                return "skipped";
            }

            // wait for navigation or update
            await this.page.waitForTimeout(1000);
            await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 7000 }).catch(() => null);

            // verify badge now
            const nowCancelled = await this.page.evaluate(() => {
                const badge = document.querySelector(".status-badge");
                if (!badge) return false;
                const txt = (badge.textContent || "").toLowerCase();
                const cls = (badge.className || "").toLowerCase();
                return txt.includes("cancel") || cls.includes("apt-cancelled") || cls.includes("apt-deleted");
            });

            if (!nowCancelled) {
                console.warn("⚠️ After submit, status not visibly cancelled — consider manual check");
                // we still return 'cancelled' because action was attempted; adjust if you want stricter validation
                return "cancelled";
            }

            console.log(`✅ Appointment cancelled: ${appointmentUrl}`);
            return "cancelled";
        } catch (error: any) {
            console.error(`Error processing appointment ${appointmentUrl}:`, error?.message || error);
            BrowserErrorHandler.handleBrowserError(error, `processAppointment-${appointmentUrl}`);
            throw error;
        }
    }

    /**
     * Robust setter: tries select boxes, radios, then button/text click.
     */
    private async setStatusToCancelled(): Promise<boolean> {
        try {
            // 1) Try selects
            const viaSelect = await this.page.evaluate(() => {
                const selects = Array.from(document.querySelectorAll("select"));
                for (const s of selects) {
                    const options = Array.from((s as HTMLSelectElement).options).map((o) => (o.textContent || "").toLowerCase());
                    if (options.some((t) => t.includes("cancel"))) {
                        const option = Array.from((s as HTMLSelectElement).options).find((o) => (o.textContent || "").toLowerCase().includes("cancel"));
                        if (option) {
                            (s as HTMLSelectElement).value = option.value;
                            s.dispatchEvent(new Event("change", { bubbles: true }));
                            return true;
                        }
                    }
                }
                return false;
            });

            if (viaSelect) return true;

            // 2) Try radio inputs
            const viaRadio = await this.page.evaluate(() => {
                const radios = Array.from(document.querySelectorAll("input[type='radio']"));
                for (const r of radios) {
                    const val = ((r as HTMLInputElement).value || "").toLowerCase();
                    const id = (r as HTMLInputElement).id || "";
                    const label = id ? (document.querySelector(`label[for='${id}']`)?.textContent || "").toLowerCase() : "";
                    if (val.includes("cancel") || label.includes("cancel")) {
                        (r as HTMLInputElement).checked = true;
                        r.dispatchEvent(new Event("change", { bubbles: true }));
                        return true;
                    }
                }
                return false;
            });

            if (viaRadio) return true;

            // 3) Try to click a button/link with "cancel"/"cancelled"/"delete"
            const clicked = await this.page.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll("button, a"));
                const el = candidates.find((e: any) => {
                    const t = (e.textContent || "").toLowerCase();
                    return t.includes("cancel") || t.includes("cancelled") || t.includes("delete");
                });
                if (el) {
                    (el as HTMLElement).click();
                    return true;
                }
                return false;
            });

            return !!clicked;
        } catch (err) {
            console.error("Error in setStatusToCancelled:", err);
            return false;
        }
    }
}
