import { sleep } from "./general-utils";

export class BrowserErrorHandler {
  private static readonly CRITICAL_ERROR_PATTERNS = [
    "detached frame",
    "navigating frame was detached",
    "frame got detached",
    "execution context was destroyed",
    "session closed",
    "target closed",
    "navigation failed because browser has disconnected",
    "protocol error",
    "browser has disconnected",
    "browser closed",
  ];

  static handleBrowserError(
    error: any,
    context?: string,
    fallbackValue?: any
  ): any {
    const errorMessage = (error.message || error.toString()).toLowerCase();
    const contextPrefix = context ? `[${context}] ` : "";

    // Log the original error with context
    console.error(`${contextPrefix}Error:`, error.message || error);

    // Check if this is a critical browser error
    const isCriticalError = this.CRITICAL_ERROR_PATTERNS.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase())
    );

    if (isCriticalError) {
      console.error(
        `${contextPrefix}🚨 Critical browser error detected - will trigger requeue`
      );
      throw error; // Always throw critical errors
    }

    // For non-critical errors, return fallback value if provided
    if (fallbackValue !== undefined) {
      console.warn(
        `${contextPrefix}⚠️ Non-critical error, returning fallback value:`,
        fallbackValue
      );
      return fallbackValue;
    }

    // If no fallback value provided, throw the error
    console.error(`${contextPrefix}No fallback value provided, throwing error`);
    throw error;
  }

  static isBrowserError(error: any): boolean {
    const errorMessage = (error.message || error.toString()).toLowerCase();
    return this.CRITICAL_ERROR_PATTERNS.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  public static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 15000,
    silentFail: boolean = false,
    operationName: string = "operation"
  ): Promise<T | undefined> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.log(
          `❌ Attempt ${attempt}/${maxRetries} failed for ${operationName}:`,
          error
        );

        if (attempt < maxRetries) {
          console.log(`⏱️ Waiting ${delayMs / 1000} seconds before retry...`);
          await sleep(delayMs);
        }
      }
    }

    if (silentFail) {
      console.error(
        `❌ All ${maxRetries} retry attempts failed for ${operationName}, continuing execution`
      );
      return undefined;
    } else {
      throw lastError;
    }
  }
}
