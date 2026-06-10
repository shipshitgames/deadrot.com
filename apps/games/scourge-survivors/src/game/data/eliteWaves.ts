// Elite wave planning: small pure helpers so the Survivors director stays
// deterministic and testable. All tunables live in ../constants; an injected
// `random` source (Math.random in-game, seeded in tests) drives every roll.

import {
  ELITE_AFFIX_IDS,
  ELITE_AFFIXES,
  ELITE_SPLIT_COUNT_MAX,
  ELITE_SPLIT_COUNT_MIN,
  ELITE_WAVE_EVERY,
  ELITE_WAVE_FRACTION,
  ELITE_WAVE_MIN_ELITES,
  ELITE_XP_MUL,
  type EliteAffixDef,
} from "../constants";

/** Surge cadence: every Nth breach surge (1-based index) arrives as an ELITE WAVE. */
export function isEliteWave(surgeIndex: number, every: number = ELITE_WAVE_EVERY): boolean {
  return surgeIndex > 0 && every > 0 && surgeIndex % every === 0;
}

export interface SurgePlan {
  /** Enemies this surge can actually field (clamped by spawn headroom). */
  spawnCount: number;
  /** Surge counter after this beat; unchanged when the surge is skipped. */
  nextSurgeIndex: number;
  /** True when this surge lands as an ELITE WAVE. */
  elite: boolean;
}

/**
 * Plan a breach surge from the current cadence counter and spawn headroom.
 * A surge with zero headroom is skipped entirely: it must not announce a wave
 * that fields zero enemies, and it must not consume an elite-cadence slot —
 * the elite lands on the next surge that actually has room.
 */
export function planSurge(
  surgeIndex: number,
  headroom: number,
  batchSize: number,
  every: number = ELITE_WAVE_EVERY,
): SurgePlan {
  const spawnCount = Math.min(batchSize, Math.max(0, headroom));
  if (spawnCount <= 0) return { spawnCount: 0, nextSurgeIndex: surgeIndex, elite: false };
  const nextSurgeIndex = surgeIndex + 1;
  return { spawnCount, nextSurgeIndex, elite: isEliteWave(nextSurgeIndex, every) };
}

/** Roll the single affix shared by an elite batch (deterministic given `random`). */
export function rollEliteAffix(random: () => number): EliteAffixDef {
  const roll = Math.floor(random() * ELITE_AFFIX_IDS.length);
  const index = Math.min(ELITE_AFFIX_IDS.length - 1, Math.max(0, roll));
  return ELITE_AFFIXES[ELITE_AFFIX_IDS[index]];
}

/** How many of a surge's spawns get promoted to elites (~15-20%, never zero on a real surge). */
export function eliteCountForWave(
  spawnCount: number,
  fraction: number = ELITE_WAVE_FRACTION,
  minElites: number = ELITE_WAVE_MIN_ELITES,
): number {
  if (spawnCount <= 0) return 0;
  return Math.min(spawnCount, Math.max(minElites, Math.round(spawnCount * fraction)));
}

/** Children a splitting elite wants to shed on death (deterministic given `random`). */
export function rollEliteSplitCount(random: () => number): number {
  const span = ELITE_SPLIT_COUNT_MAX - ELITE_SPLIT_COUNT_MIN + 1;
  const roll = Math.floor(random() * span);
  return ELITE_SPLIT_COUNT_MIN + Math.min(span - 1, Math.max(0, roll));
}

/** Split-cap math: spend the wave's split budget without ever overdrawing it. */
export function takeSplitAllowance(budget: number, desired: number): { allowed: number; remaining: number } {
  const allowed = Math.max(0, Math.min(budget, desired));
  return { allowed, remaining: Math.max(0, budget - allowed) };
}

/** Elite gem payout: bonus XP over the archetype's standard gem value. */
export function eliteXpValue(baseXp: number, mul: number = ELITE_XP_MUL): number {
  return Math.max(1, Math.round(baseXp * mul));
}
