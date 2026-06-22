import {
  type BalanceTelemetrySink,
  configureBalanceTelemetry,
  createPostHogTelemetrySink,
  createSentryBreadcrumbSink,
  type PostHogLike,
  type SentryLike,
} from "./index";

export type DeadrotBrowserTelemetryEnv = Record<string, string | boolean | undefined>;

export interface DeadrotBrowserTelemetryOptions {
  game: string;
  env?: DeadrotBrowserTelemetryEnv;
  release?: string;
  tuningVersion?: string;
}

export interface DeadrotBrowserTelemetryRuntime {
  posthog: PostHogLike | null;
  sentry: SentryLike | null;
  sinks: BalanceTelemetrySink[];
}

export async function initDeadrotBrowserTelemetry(
  options: DeadrotBrowserTelemetryOptions,
): Promise<DeadrotBrowserTelemetryRuntime> {
  const env = options.env ?? {};
  const release = options.release ?? envString(env, "VITE_DEADROT_RELEASE") ?? envString(env, "VITE_APP_VERSION");
  const tuningVersion = options.tuningVersion ?? envString(env, "VITE_DEADROT_TUNING_VERSION");
  const sinks: BalanceTelemetrySink[] = [];

  const posthog = await initPostHog(options.game, env);
  if (posthog) sinks.push(createPostHogTelemetrySink(posthog));

  const sentry = await initSentry(options.game, env, release, tuningVersion);
  if (sentry) {
    sinks.push(
      createSentryBreadcrumbSink(sentry, {
        includeEvents: ["run_end", "boss_phase"],
      }),
    );
  }

  configureBalanceTelemetry({
    sinks,
    sampleRate: envNumber(env, "VITE_BALANCE_TELEMETRY_SAMPLE_RATE", 1),
    localBuffer: envBool(env, "VITE_BALANCE_TELEMETRY_LOCAL_BUFFER", true),
    debug: envBool(env, "VITE_BALANCE_TELEMETRY_DEBUG", false),
    build: release,
    tuningVersion,
  });

  return { posthog, sentry, sinks };
}

async function initPostHog(game: string, env: DeadrotBrowserTelemetryEnv): Promise<PostHogLike | null> {
  const token = envString(env, "VITE_POSTHOG_KEY");
  if (!token) return null;

  const { default: posthog } = await import("posthog-js");
  posthog.init(token, {
    api_host: envString(env, "VITE_POSTHOG_HOST") ?? "https://eu.i.posthog.com",
    autocapture: envBool(env, "VITE_POSTHOG_AUTOCAPTURE", false),
    capture_pageview: envBool(env, "VITE_POSTHOG_CAPTURE_PAGEVIEW", false),
    capture_exceptions: envBool(env, "VITE_POSTHOG_CAPTURE_EXCEPTIONS", false),
    disable_session_recording: !envBool(env, "VITE_POSTHOG_SESSION_REPLAY", false),
    loaded: (client) => {
      client.register({ app: "deadrot", game });
      if (envBool(env, "VITE_POSTHOG_CAPTURE_PAGEVIEW", false)) client.capture("$pageview", { game });
    },
  });

  return posthog;
}

async function initSentry(
  game: string,
  env: DeadrotBrowserTelemetryEnv,
  release: string | undefined,
  tuningVersion: string | undefined,
): Promise<SentryLike | null> {
  const dsn = envString(env, "VITE_SENTRY_DSN");
  if (!dsn) return null;

  const Sentry = await import("@sentry/browser");
  const tracesSampleRate = envNumber(env, "VITE_SENTRY_TRACES_SAMPLE_RATE", 0.05);
  const replaysSessionSampleRate = envNumber(env, "VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE", 0);
  const replaysOnErrorSampleRate = envNumber(env, "VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE", 1);
  const integrations: NonNullable<Parameters<typeof Sentry.init>[0]>["integrations"] = [];

  if (tracesSampleRate > 0) integrations.push(Sentry.browserTracingIntegration());
  if (replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0) integrations.push(Sentry.replayIntegration());

  Sentry.init({
    dsn,
    release,
    environment: envString(env, "VITE_SENTRY_ENVIRONMENT") ?? envString(env, "MODE"),
    integrations,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    sendDefaultPii: false,
  });
  Sentry.setTag("app", "deadrot");
  Sentry.setTag("game", game);
  if (tuningVersion) Sentry.setTag("tuning_version", tuningVersion);
  Sentry.setContext("deadrot", { game, tuningVersion });

  return Sentry;
}

function envString(env: DeadrotBrowserTelemetryEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function envBool(env: DeadrotBrowserTelemetryEnv, key: string, fallback: boolean): boolean {
  const value = env[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function envNumber(env: DeadrotBrowserTelemetryEnv, key: string, fallback: number): number {
  const value = envString(env, key);
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
