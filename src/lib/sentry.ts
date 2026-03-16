import * as Sentry from "@sentry/bun";

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || "development";

export function initSentry() {
  if (!SENTRY_DSN) {
    if (NODE_ENV === "production") {
      console.warn("WARNING: SENTRY_DSN not set in production!");
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    tracesSampleRate: NODE_ENV === "production" ? 0.1 : 1.0,
    ignoreErrors: [
      "Validation error",
      "Invalid signature",
      "Session expired",
      "Agent not found",
    ],
  });
}

export { Sentry };
