// Canonical cross-game run completion. This is deliberately kept beside the
// Warline reporter rather than in `core`: recording the local war record and
// reporting to the shared front are separate primitives with separate trust
// boundaries, while this module is the one high-level game lifecycle seam that
// coordinates both.

import type { GameSlug } from "@shipshitgames/warline";
import { recordWarResult, type WarRecord, type WarResult } from "../core";
import {
  reportWarlineOperation,
  type WarlineReporterOptions,
  type WarlineReportOutcome,
  type WarlineRunInput,
} from "./reporter";

/** One finished run, expressed once for both the local record and Warline. */
export interface CompleteRunInput extends WarResult {
  /**
   * A fresh, stable key generated at run start. Calls with the same game and
   * nonce are ignored after the first completion, both locally and remotely.
   * The same nonce is also sent to Warline for server-side idempotency.
   */
  nonce: string;
  /** Optional Warline-only fields; they never enter the local display record. */
  faction?: WarlineRunInput["faction"];
  player?: string;
  targetId?: string;
  contributed?: number;
}

/** The canonical shapes handed to the independently testable lower-level APIs. */
export interface NormalizedRunCompletion {
  local: WarResult;
  remote: WarlineRunInput;
}

/**
 * Purely map one game result to its local-record and remote-report forms.
 * `recordWarResult` and `reportWarlineOperation` retain responsibility for
 * their own storage and wire-level validation respectively.
 */
export function normalizeRunCompletion(input: CompleteRunInput): NormalizedRunCompletion {
  const local: WarResult = {
    outcome: input.outcome,
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(input.timeMs === undefined ? {} : { timeMs: input.timeMs }),
    ...(input.wave === undefined ? {} : { wave: input.wave }),
    ...(input.bossKill === undefined ? {} : { bossKill: input.bossKill }),
  };
  const remote: WarlineRunInput = {
    outcome: input.outcome,
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(input.faction === undefined ? {} : { faction: input.faction }),
    ...(input.player === undefined ? {} : { player: input.player }),
    nonce: input.nonce,
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    ...(input.contributed === undefined ? {} : { contributed: input.contributed }),
  };
  return { local, remote };
}

/** Result returned synchronously so callers never need to await game-over handling. */
export interface RunCompletionOutcome {
  completed: boolean;
  nonce: string;
  record?: WarRecord;
  /** Always resolves, including when a custom test transport rejects. */
  reporting?: Promise<WarlineReportOutcome>;
}

export interface CompleteRunOptions extends WarlineReporterOptions {
  /** Supply a deterministic clock for tests; defaults to `Date.now()`. */
  now?: number;
  /** Test seam; production uses the standalone local-record primitive. */
  record?: (slug: string, result: WarResult, now: number) => WarRecord;
  /** Test seam; production uses the standalone offline-safe reporter primitive. */
  report?: (game: GameSlug, run: WarlineRunInput, options?: WarlineReporterOptions) => Promise<WarlineReportOutcome>;
}

let nonceSequence = 0;
const completedRunKeys = new Set<string>();
const COMPLETED_NONCE_LIMIT = 4_096;

/** Create a unique nonce once at a game's run-start boundary. */
export function createRunNonce(game: GameSlug): string {
  nonceSequence += 1;
  const random = globalThis.crypto?.randomUUID?.();
  return `${game}:${random ?? `${Date.now().toString(36)}:${nonceSequence.toString(36)}`}`;
}

function claimRunNonce(game: GameSlug, requestedNonce: string): string | undefined {
  // A non-empty caller nonce is what ties re-entrant completion paths together.
  // Fall back to a new nonce for defensive JS callers, but TypeScript consumers
  // should always use createRunNonce() at run start for idempotency.
  const nonce = requestedNonce.trim() || createRunNonce(game);
  const key = `${game}:${nonce}`;
  if (completedRunKeys.has(key)) return undefined;
  completedRunKeys.add(key);
  // Keep this process-local guard bounded. A fresh nonce per run makes eviction
  // harmless in practice while preventing a marathon session from retaining all
  // historical runs forever.
  if (completedRunKeys.size > COMPLETED_NONCE_LIMIT) {
    const oldest = completedRunKeys.values().next().value;
    if (oldest) completedRunKeys.delete(oldest);
  }
  return nonce;
}

function failedReport(error: unknown): WarlineReportOutcome {
  return { reported: false, status: "error", error: String(error) };
}

/**
 * Complete a run exactly once for its `(game, nonce)` pair: persist the local
 * record synchronously, then start one offline-safe Warline report. It never
 * awaits the network, so a missing, failing, or stalled host cannot disturb a
 * game loop. Re-entrant calls with the same nonce do neither operation.
 */
export function completeRun(
  game: GameSlug,
  input: CompleteRunInput,
  options?: CompleteRunOptions,
): RunCompletionOutcome {
  const nonce = claimRunNonce(game, input.nonce);
  if (!nonce) return { completed: false, nonce: input.nonce.trim() };

  const normalized = normalizeRunCompletion({ ...input, nonce });
  const now = options?.now ?? Date.now();
  const record = (options?.record ?? recordWarResult)(game, normalized.local, now);
  const report = options?.report ?? reportWarlineOperation;
  // The production reporter already never rejects. Catch here as a final guard
  // for custom transports and future implementations so completion stays safe.
  let reporting: Promise<WarlineReportOutcome>;
  try {
    reporting = Promise.resolve(report(game, normalized.remote, options)).catch(failedReport);
  } catch (error) {
    reporting = Promise.resolve(failedReport(error));
  }

  return { completed: true, nonce, record, reporting };
}
