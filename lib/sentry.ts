import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
  initialized = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  initSentry();
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error(error, context);
  }
}
