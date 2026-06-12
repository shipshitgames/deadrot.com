import { createLocalStore } from "../core/storage";

export type TelemetryPrimitive = string | number | boolean | null;
export type TelemetryValue = TelemetryPrimitive | TelemetryValue[] | { [key: string]: TelemetryValue };
export type TelemetryProperties = Record<string, TelemetryValue>;

export type BalanceEventName =
  | "run_start"
  | "checkpoint"
  | "enemy_spawned"
  | "enemy_killed"
  | "damage_rollup"
  | "choice_offered"
  | "choice_picked"
  | "pickup_collected"
  | "pickup_expired"
  | "boss_phase"
  | "run_end"
  | (string & {});

export interface BalanceEvent {
  schema: "deadrot.balance.v1";
  event: BalanceEventName;
  eventId: string;
  sessionId: string;
  game: string;
  ts: number;
  properties: TelemetryProperties;
  runId?: string;
  mode?: string;
  build?: string;
  tuningVersion?: string;
  elapsedSec?: number;
}

export interface BalanceTelemetrySink {
  capture(event: BalanceEvent): void;
  flush?(): void;
}

export interface BalanceTelemetryGlobalConfig {
  enabled?: boolean;
  sampleRate?: number;
  localBuffer?: boolean;
  debug?: boolean;
  sinks?: BalanceTelemetrySink[];
  build?: string;
  tuningVersion?: string;
}

export interface BalanceTelemetryOptions extends BalanceTelemetryGlobalConfig {
  game: string;
  mode?: string;
  sessionId?: string;
  runId?: string;
  now?: () => number;
  random?: () => number;
}

export interface BalanceTelemetryClient {
  readonly sessionId: string;
  readonly runId: string | null;
  startRun(properties?: Record<string, unknown>): string;
  capture(
    event: BalanceEventName,
    properties?: Record<string, unknown>,
    options?: { elapsedSec?: number; runId?: string; mode?: string },
  ): BalanceEvent | null;
  checkpoint(properties?: Record<string, unknown>, elapsedSec?: number): BalanceEvent | null;
  endRun(properties?: Record<string, unknown>, elapsedSec?: number): BalanceEvent | null;
  flush(): void;
}

export interface PostHogLike {
  capture(event: string, properties?: Record<string, unknown>): void;
}

export interface SentryLike {
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: "info" | "warning" | "error" | "debug";
    data?: Record<string, unknown>;
  }): void;
}

export const BALANCE_TELEMETRY_KEY = "deadrot:balance-telemetry:v1";
export const BALANCE_SESSION_KEY = "deadrot:balance-session";

const LOCAL_EVENT_LIMIT = 500;

let globalConfig: Required<Pick<BalanceTelemetryGlobalConfig, "enabled" | "sampleRate" | "localBuffer" | "debug">> &
  Pick<BalanceTelemetryGlobalConfig, "sinks" | "build" | "tuningVersion"> = {
  enabled: true,
  sampleRate: 1,
  localBuffer: true,
  debug: false,
  sinks: [],
};

export function configureBalanceTelemetry(config: BalanceTelemetryGlobalConfig): void {
  globalConfig = {
    ...globalConfig,
    ...config,
    sinks: config.sinks ?? globalConfig.sinks,
  };
}

export function resetBalanceTelemetryConfigForTests(): void {
  globalConfig = {
    enabled: true,
    sampleRate: 1,
    localBuffer: true,
    debug: false,
    sinks: [],
  };
}

export function createBalanceTelemetry(options: BalanceTelemetryOptions): BalanceTelemetryClient {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const enabled = options.enabled ?? globalConfig.enabled;
  const sampleRate = clamp01(options.sampleRate ?? globalConfig.sampleRate);
  const sampled = enabled && (sampleRate >= 1 || random() < sampleRate);
  const sessionId = options.sessionId ?? readOrCreateSessionId(now, random);
  let runId = options.runId ?? null;
  let mode = options.mode;

  const sinks = [
    ...((options.localBuffer ?? globalConfig.localBuffer) ? [createLocalTelemetrySink()] : []),
    ...(globalConfig.sinks ?? []),
    ...(options.sinks ?? []),
    ...((options.debug ?? globalConfig.debug) ? [createConsoleTelemetrySink()] : []),
  ];

  const emit = (
    eventName: BalanceEventName,
    properties: Record<string, unknown> = {},
    eventOptions: { elapsedSec?: number; runId?: string; mode?: string } = {},
  ): BalanceEvent | null => {
    if (!sampled) return null;

    const resolvedRunId = eventOptions.runId ?? runId ?? undefined;
    const resolvedMode = eventOptions.mode ?? mode;
    const event: BalanceEvent = {
      schema: "deadrot.balance.v1",
      event: eventName,
      eventId: makeId("evt", now(), random),
      sessionId,
      game: options.game,
      ts: now(),
      properties: sanitizeProperties(properties),
    };

    if (resolvedRunId) event.runId = resolvedRunId;
    if (resolvedMode) event.mode = resolvedMode;
    const build = options.build ?? globalConfig.build;
    if (build) event.build = build;
    const tuningVersion = options.tuningVersion ?? globalConfig.tuningVersion;
    if (tuningVersion) event.tuningVersion = tuningVersion;
    if (typeof eventOptions.elapsedSec === "number" && Number.isFinite(eventOptions.elapsedSec)) {
      event.elapsedSec = Math.max(0, eventOptions.elapsedSec);
    }

    for (const sink of sinks) {
      try {
        sink.capture(event);
      } catch {
        // Analytics must never break the game loop.
      }
    }

    return event;
  };

  return {
    sessionId,
    get runId() {
      return runId;
    },
    startRun(properties: Record<string, unknown> = {}) {
      runId = stringProp(properties.runId) ?? makeId("run", now(), random);
      mode = stringProp(properties.mode) ?? mode;
      emit("run_start", properties, { runId, mode });
      return runId;
    },
    capture: emit,
    checkpoint(properties: Record<string, unknown> = {}, elapsedSec?: number) {
      return emit("checkpoint", properties, { elapsedSec });
    },
    endRun(properties: Record<string, unknown> = {}, elapsedSec?: number) {
      if (!runId) runId = stringProp(properties.runId) ?? makeId("run", now(), random);
      mode = stringProp(properties.mode) ?? mode;
      return emit("run_end", properties, { elapsedSec, runId, mode });
    },
    flush() {
      for (const sink of sinks) {
        try {
          sink.flush?.();
        } catch {
          // Analytics must never break teardown.
        }
      }
    },
  };
}

export function recordBalanceRunEnd(
  game: string,
  properties: Record<string, unknown>,
  now: number = Date.now(),
): BalanceEvent | null {
  return createBalanceTelemetry({ game, now: () => now }).endRun(properties);
}

export function createLocalTelemetrySink(limit = LOCAL_EVENT_LIMIT): BalanceTelemetrySink {
  return {
    capture(event) {
      const store = localEventStore();
      const next = [...readLocalBalanceEvents(), event].slice(-Math.max(1, Math.floor(limit)));
      store.set(next);
    },
  };
}

export function readLocalBalanceEvents(): BalanceEvent[] {
  return localEventStore()
    .get()
    .filter((event): event is BalanceEvent => isBalanceEvent(event));
}

export function clearLocalBalanceEvents(): void {
  localEventStore().set([]);
}

export function createConsoleTelemetrySink(): BalanceTelemetrySink {
  return {
    capture(event) {
      console.info("[deadrot:balance]", event.event, event);
    },
  };
}

export function createPostHogTelemetrySink(
  posthog: PostHogLike,
  options: { prefix?: string } = {},
): BalanceTelemetrySink {
  const prefix = options.prefix ?? "deadrot_balance";
  return {
    capture(event) {
      posthog.capture(`${prefix}_${event.event}`, flattenEvent(event));
    },
  };
}

export function createSentryBreadcrumbSink(
  sentry: SentryLike,
  options: { category?: string; includeEvents?: readonly BalanceEventName[] } = {},
): BalanceTelemetrySink {
  const category = options.category ?? "game.balance";
  const include = options.includeEvents ? new Set<BalanceEventName>(options.includeEvents) : null;
  return {
    capture(event) {
      if (include && !include.has(event.event)) return;
      sentry.addBreadcrumb({
        category,
        message: event.event,
        level: "info",
        data: flattenEvent(event),
      });
    },
  };
}

function localEventStore() {
  return createLocalStore<BalanceEvent[]>(BALANCE_TELEMETRY_KEY, [], { version: 1 });
}

function readOrCreateSessionId(now: () => number, random: () => number): string {
  if (typeof window === "undefined") return makeId("sess", now(), random);
  try {
    const existing = window.localStorage.getItem(BALANCE_SESSION_KEY);
    if (existing) return existing;
    const created = makeId("sess", now(), random);
    window.localStorage.setItem(BALANCE_SESSION_KEY, created);
    return created;
  } catch {
    return makeId("sess", now(), random);
  }
}

function makeId(prefix: string, now: number, random: () => number): string {
  return `${prefix}_${Math.floor(now).toString(36)}_${Math.floor(random() * 0x100000000).toString(36)}`;
}

function sanitizeProperties(input: Record<string, unknown>): TelemetryProperties {
  const out: TelemetryProperties = {};
  for (const [key, value] of Object.entries(input)) {
    const clean = sanitizeValue(value);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

function sanitizeValue(value: unknown): TelemetryValue | undefined {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const arr: TelemetryValue[] = [];
    for (const item of value) {
      const clean = sanitizeValue(item);
      if (clean !== undefined) arr.push(clean);
    }
    return arr;
  }
  if (isPlainObject(value)) {
    const out: { [key: string]: TelemetryValue } = {};
    for (const [key, item] of Object.entries(value)) {
      const clean = sanitizeValue(item);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function isBalanceEvent(value: unknown): value is BalanceEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<BalanceEvent>;
  return (
    event.schema === "deadrot.balance.v1" &&
    typeof event.event === "string" &&
    typeof event.eventId === "string" &&
    typeof event.sessionId === "string" &&
    typeof event.game === "string" &&
    typeof event.ts === "number" &&
    isPlainObject(event.properties)
  );
}

function flattenEvent(event: BalanceEvent): Record<string, unknown> {
  return {
    schema: event.schema,
    event_id: event.eventId,
    session_id: event.sessionId,
    run_id: event.runId,
    game: event.game,
    mode: event.mode,
    build: event.build,
    tuning_version: event.tuningVersion,
    ts: event.ts,
    elapsed_sec: event.elapsedSec,
    ...event.properties,
  };
}

function stringProp(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
