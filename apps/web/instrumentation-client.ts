import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_DEADROT_RELEASE ?? process.env.SENTRY_RELEASE,
    replaysOnErrorSampleRate: 1,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  });
}

// NOTE (#384): the feature-flag layer (lib/flags.ts) evaluates flags server-side
// via PostHog's stateless decide endpoint (raw fetch, no SDK), so there is no
// posthog-js client init here. Keeping the browser bundle free of the SDK is what
// makes the layer vendor-agnostic — call sites import only from lib/flags.

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
