// Cross-game Warline operation reporting — every Ship Shit Game banks the
// result of a finished run into the shared "War for the Lanes" front.
//
// This is the connective tissue the warline README has long promised: games
// report results via `WarlineClient.reportOperation()` from
// `@shipshitgames/warline/client`. Call `reportWarlineOperation(slug, run)`
// once per run, beside the game's existing `recordWarResult(...)` site.
//
// Reporting is CONFIG-GATED and offline-graceful: with no host configured the
// call is a silent no-op, and a network/server failure never throws into the
// game loop. The host/token come (in order) from an explicit per-call option,
// a process-wide `configureWarlineReporter()` call, a runtime
// `globalThis.__warlineReporter` override (handy for tests/e2e), or the build
// env (`VITE_WARLINE_HOST` / `VITE_WARLINE_TOKEN`).
//
// Boundary note: this is deliberately separate from `core/warRecord`, which is
// display-only localStorage and must never feed the shared simulation. This
// module is the one path that *does* feed the shared front.

import type { GameSlug, HumanFaction, OperationResult, WarEffortBonus, WorldState } from "@shipshitgames/warline";
import { NEUTRAL_WAR_EFFORT, warEffortBonus } from "@shipshitgames/warline";
import { WarlineClient } from "@shipshitgames/warline/client";

// Re-export the shared war-effort bonus shape so a consuming game can type the
// value `fetchWarEffortBonus` hands back without reaching past this gateway into
// `@shipshitgames/warline` directly (it isn't a game's direct dependency).
export type { WarEffortBonus } from "@shipshitgames/warline";

/** localStorage key shared with the Warline hub store (apps/games/warline). */
const FACTION_KEY = "warline.faction";

/** Where to send reports. An empty/missing host disables reporting. */
export interface WarlineReporterConfig {
  /** PartyKit host, e.g. "warline.example.partykit.dev". Empty/undefined disables reporting. */
  host?: string;
  /** Bearer token for trusted reports (the server gates on `WARLINE_TOKEN`). */
  token?: string;
}

/** What a game knows about a finished run. */
export interface WarlineRunInput {
  outcome: "victory" | "defeat";
  /** Run magnitude (score / wave / tier / distance). Coerced to a finite, >= 0 number. */
  score?: number;
  /** Override the reporting faction; defaults to the shared `warline.faction` (else "wardens"). */
  faction?: HumanFaction;
  /** Optional player handle. */
  player?: string;
  /** Optional idempotency key. */
  nonce?: string;
  /** Optional explicit target region/lane/breach id; otherwise the server picks one. */
  targetId?: string;
  /**
   * War-resource units the player looted this run, banked into the shared pool
   * (#280). Coerced to a finite, >= 0 number; the server clamps it. Omitted/zero
   * banks nothing. See `WAR_RESOURCE` for which resource each game drops.
   */
  contributed?: number;
}

/** A minimal slice of `WarlineClient` so tests can inject a fake. */
export interface WarlineReportClient {
  reportOperation: (result: OperationResult) => Promise<{ ok: boolean; error?: string }>;
}

/** A minimal slice of `WarlineClient` for *reading* the shared world (#280). */
export interface WarlineStateClient {
  fetchState: () => Promise<WorldState>;
}

export interface WarlineReporterOptions extends WarlineReporterConfig {
  /** Inject a client (tests / custom transports). Bypasses host/token resolution. */
  client?: WarlineReportClient;
}

export interface WarEffortOptions extends WarlineReporterConfig {
  /** Inject a state client (tests / custom transports). Bypasses host/token resolution. */
  client?: WarlineStateClient;
  /**
   * Upper bound (ms) on the read before it falls back to the neutral bonus, so a
   * *slow* (reachable-but-stalled) front can never delay a run start, not just a
   * dead one. Defaults to {@link DEFAULT_WAR_EFFORT_TIMEOUT_MS} (5s).
   */
  timeoutMs?: number;
}

export type WarlineReportStatus = "ok" | "disabled" | "error";

export interface WarlineReportOutcome {
  /** True only when the server accepted the report. */
  reported: boolean;
  status: WarlineReportStatus;
  /** The OperationResult that was sent (or would have been, when disabled). */
  result?: OperationResult;
  /** Failure detail when `status === "error"`. */
  error?: string;
}

// ---- process-wide config (set once at app bootstrap) ----

let moduleConfig: WarlineReporterConfig = {};

/** Set the process-wide reporter config. Later calls merge over earlier ones. */
export function configureWarlineReporter(config: WarlineReporterConfig): void {
  moduleConfig = { ...moduleConfig, ...config };
}

/** Reset the process-wide config (primarily for tests). */
export function resetWarlineReporterConfig(): void {
  moduleConfig = {};
}

// ---- config resolution ----

function readEnv(key: string): string | undefined {
  // game-kit has no Vite client types, so reach `import.meta.env` via a cast.
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const fromMeta = meta.env?.[key];
    if (typeof fromMeta === "string") return fromMeta;
  } catch {
    // import.meta.env unavailable in this runtime — ignore.
  }
  // Fall back to process.env (Bun/Node). Reached via globalThis (not the bare
  // `process` global) so this module type-checks in game consumers that compile
  // game-kit's source without pulling in @types/node.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProc = proc?.env?.[key];
  return typeof fromProc === "string" ? fromProc : undefined;
}

function runtimeOverride(): WarlineReporterConfig | undefined {
  const g = globalThis as unknown as { __warlineReporter?: WarlineReporterConfig };
  return g.__warlineReporter;
}

/** Merge config from (highest priority first): options, module, runtime, env. */
export function resolveWarlineConfig(options?: WarlineReporterConfig): WarlineReporterConfig {
  const override = runtimeOverride();
  // Trim the host so a whitespace-only value (e.g. a misconfigured
  // `VITE_WARLINE_HOST=" "`) collapses to "" and reads as disabled, rather than
  // sailing past the no-op gate into a doomed request to a malformed URL.
  const host = (options?.host ?? moduleConfig.host ?? override?.host ?? readEnv("VITE_WARLINE_HOST") ?? "").trim();
  const token = options?.token ?? moduleConfig.token ?? override?.token ?? readEnv("VITE_WARLINE_TOKEN");
  return token ? { host, token } : { host };
}

// ---- faction + result building ----

/** The shared allegiance the player picked in the Warline hub; "wardens" by default. */
export function readSharedFaction(): HumanFaction {
  try {
    if (typeof localStorage === "undefined") return "wardens";
    const stored = localStorage.getItem(FACTION_KEY);
    return stored === "pyre" || stored === "wardens" ? stored : "wardens";
  } catch {
    return "wardens";
  }
}

function clampScore(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Pure builder: fold a game's run into a wire-ready `OperationResult`. Exported
 * so the mapping (faction default, score clamp) is unit-testable without a network.
 */
export function buildOperationResult(game: GameSlug, run: WarlineRunInput): OperationResult {
  const result: OperationResult = {
    game,
    faction: run.faction ?? readSharedFaction(),
    outcome: run.outcome,
    score: clampScore(run.score),
  };
  if (run.player) result.player = run.player;
  if (run.nonce) result.nonce = run.nonce;
  if (run.targetId) result.targetId = run.targetId;
  const contributed = clampScore(run.contributed);
  if (contributed > 0) result.contributed = contributed;
  return result;
}

// ---- the call games make ----

/**
 * Report one finished run to the shared Warline front. Call exactly once per
 * run, beside the game's `recordWarResult(...)` site. Never throws and never
 * rejects: returns a `disabled` outcome when no host is configured and an
 * `error` outcome when the report fails, so a dead/missing server can never
 * disturb the game loop. Safe to call fire-and-forget (`void report...`).
 */
export async function reportWarlineOperation(
  game: GameSlug,
  run: WarlineRunInput,
  options?: WarlineReporterOptions,
): Promise<WarlineReportOutcome> {
  const result = buildOperationResult(game, run);

  const config = resolveWarlineConfig(options);
  if (!options?.client && !config.host) {
    return { reported: false, status: "disabled", result };
  }

  try {
    const client: WarlineReportClient =
      options?.client ?? new WarlineClient({ host: config.host as string, token: config.token });
    const response = await client.reportOperation(result);
    if (response.ok) return { reported: true, status: "ok", result };
    return { reported: false, status: "error", result, error: response.error ?? "report rejected" };
  } catch (error) {
    return { reported: false, status: "error", result, error: String(error) };
  }
}

// ---- reading the shared war-effort buff (#280) ----

/** Default upper bound (ms) on the war-effort read; see {@link WarEffortOptions.timeoutMs}. */
export const DEFAULT_WAR_EFFORT_TIMEOUT_MS = 5_000;

/**
 * Settle with `promise`, or reject once `ms` elapses — whichever is first — so a
 * stalled (reachable-but-slow) front can never leave the read pending forever.
 * The timeout rejection is caught by {@link fetchWarEffortBonus} and mapped to
 * the neutral bonus; the underlying request is abandoned, not awaited.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => reject(new Error("warline read timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Read the current shared War-Effort bonus from the front (#280): the global
 * damage multiplier the pooled war resources unlock for *every* game. Call once
 * at run start to scale the run. Like {@link reportWarlineOperation}, this is
 * config-gated and offline-graceful — it never throws and never rejects.
 * Returns the NEUTRAL bonus (1x, tier 0) when no host is configured, or when the
 * server is unreachable, errors, OR is merely slow (the read is bounded by
 * `options.timeoutMs`, default 5s) — so neither a dead nor a stalled front can
 * delay a run start. An offline player simply fights without the buff.
 */
export async function fetchWarEffortBonus(options?: WarEffortOptions): Promise<WarEffortBonus> {
  const config = resolveWarlineConfig(options);
  if (!options?.client && !config.host) {
    return NEUTRAL_WAR_EFFORT;
  }
  try {
    const client: WarlineStateClient =
      options?.client ?? new WarlineClient({ host: config.host as string, token: config.token });
    const state = await withTimeout(client.fetchState(), options?.timeoutMs ?? DEFAULT_WAR_EFFORT_TIMEOUT_MS);
    return warEffortBonus(state);
  } catch {
    return NEUTRAL_WAR_EFFORT;
  }
}
