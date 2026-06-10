// Cross-game "war record" — every game banks its best run results into one
// shared localStorage namespace; Warline reads it back as "YOUR WAR RECORD".
//
// Display-only by contract: nothing in here may feed the shared multiplayer
// simulation. The Warline PartyKit server must never depend on a client's
// localStorage.
//
// Same-origin caveat (accepted v1 behavior): localStorage is shared only when
// the games are served same-origin. The hub serves every game under /<slug>/
// in prod, so records aggregate there; dev runs each game on its own port
// (its own origin), so dev records stay per-game.

import { createLocalStore, type LocalStore } from "./storage";

/** Per-game banked bests + run counters. */
export interface WarRecordEntry {
  plays: number;
  victories: number;
  /** Best (highest) run score. */
  bestScore?: number;
  /** Best (fastest) run time — time records are race-style (redline finish). */
  bestTimeMs?: number;
  /** Best (deepest) wave reached. */
  bestWave?: number;
  /** Total bosses felled across runs. */
  bossKills?: number;
  /** Caller-supplied clock (epoch ms) of the last recorded run. */
  updatedAt: number;
}

/** The shared record, keyed by game slug ("redline", "starblight", …). */
export type WarRecord = Record<string, WarRecordEntry>;

/** One finished run, as reported by a game's single run-end path. */
export interface WarResult {
  outcome: "victory" | "defeat";
  /** Run score; the record keeps the maximum. */
  score?: number;
  /** Run time in ms; the record keeps the minimum (fastest). */
  timeMs?: number;
  /** Wave reached; the record keeps the maximum. */
  wave?: number;
  /** Bosses felled this run: `true` counts as one, a number adds that many. */
  bossKill?: boolean | number;
}

export const WAR_RECORD_KEY = "deadrot:war-record";
const WAR_RECORD_VERSION = 1;

function warRecordStore(): LocalStore<WarRecord> {
  return createLocalStore<WarRecord>(WAR_RECORD_KEY, {}, { version: WAR_RECORD_VERSION });
}

/** Finite-number guard for values read back from storage. */
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function counter(value: unknown): number {
  const n = num(value);
  return n === undefined ? 0 : Math.max(0, Math.floor(n));
}

/** Coerce a stored entry into shape; drops anything unrecognizable. */
function sanitizeEntry(raw: unknown): WarRecordEntry | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const e = raw as Record<string, unknown>;
  const plays = counter(e.plays);
  const entry: WarRecordEntry = {
    plays,
    // Clamp so a tampered payload can never render negative losses (W/L math).
    victories: Math.min(counter(e.victories), plays),
    updatedAt: num(e.updatedAt) ?? 0,
  };
  const bestScore = num(e.bestScore);
  if (bestScore !== undefined) entry.bestScore = bestScore;
  const bestTimeMs = num(e.bestTimeMs);
  if (bestTimeMs !== undefined) entry.bestTimeMs = bestTimeMs;
  const bestWave = num(e.bestWave);
  if (bestWave !== undefined) entry.bestWave = bestWave;
  const bossKills = counter(e.bossKills);
  if (bossKills > 0) entry.bossKills = bossKills;
  return entry;
}

/**
 * Pure merge: fold one run into a game's entry — counters increment, bests
 * keep the record (max score/wave, min time). `now` is the caller's clock
 * (epoch ms); game-kit never reads the wall clock itself.
 */
export function mergeWarResult(prev: WarRecordEntry | undefined, result: WarResult, now: number): WarRecordEntry {
  const entry: WarRecordEntry = {
    plays: (prev?.plays ?? 0) + 1,
    victories: (prev?.victories ?? 0) + (result.outcome === "victory" ? 1 : 0),
    updatedAt: now,
  };

  const score = num(result.score);
  const bestScore = prev?.bestScore === undefined ? score : Math.max(prev.bestScore, score ?? prev.bestScore);
  if (bestScore !== undefined) entry.bestScore = bestScore;

  const timeMs = num(result.timeMs);
  const bestTimeMs = prev?.bestTimeMs === undefined ? timeMs : Math.min(prev.bestTimeMs, timeMs ?? prev.bestTimeMs);
  if (bestTimeMs !== undefined) entry.bestTimeMs = bestTimeMs;

  const wave = num(result.wave);
  const bestWave = prev?.bestWave === undefined ? wave : Math.max(prev.bestWave, wave ?? prev.bestWave);
  if (bestWave !== undefined) entry.bestWave = bestWave;

  const felled = typeof result.bossKill === "number" ? counter(result.bossKill) : result.bossKill ? 1 : 0;
  const bossKills = (prev?.bossKills ?? 0) + felled;
  if (bossKills > 0) entry.bossKills = bossKills;

  return entry;
}

/**
 * Bank one finished run for `slug`. Call exactly once per run, from the game's
 * single authoritative run-end path. Returns the updated record. SSR/quota
 * failures degrade silently (the merge still returns, nothing persists).
 */
export function recordWarResult(slug: string, result: WarResult, now: number): WarRecord {
  return warRecordStore().update((current) => ({
    ...current,
    [slug]: mergeWarResult(sanitizeEntry(current[slug]), result, now),
  }));
}

/** Read the shared record (sanitized); `{}` when empty, corrupt, or SSR. */
export function readWarRecord(): WarRecord {
  const raw = warRecordStore().get();
  const record: WarRecord = {};
  for (const [slug, entry] of Object.entries(raw)) {
    const clean = sanitizeEntry(entry);
    if (clean) record[slug] = clean;
  }
  return record;
}
