/**
 * Logger utility for conditional development logging.
 * Debug and info messages are silenced in production builds.
 * Warn and error messages always appear.
 */

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  info: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.info(`[INFO] ${message}`, data);
    }
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${message}`, data);
  },
  error: (message: string, error?: Error | unknown) => {
    console.error(`[ERROR] ${message}`, error);
  },
};
