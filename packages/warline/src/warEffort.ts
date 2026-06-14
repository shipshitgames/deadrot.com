/**
 * @shipshitgames/warline — collective war-effort bonus (#280).
 *
 * The shared resource pool (the Pact war chest every game's looted contributions
 * flow into) funds a single global bonus every game can read and apply: as the
 * pool grows, the Pact's damage output rises in legible, bounded steps.
 *
 * Pure + deterministic: derived only from `state.resources`, no clock, no deps.
 * Tier 0 (an empty pool) is exactly 1× so an unconfigured/offline front leaves
 * gameplay untouched.
 */

import type { ResourceBag, WorldState } from "./types";
import { WAR_EFFORT } from "./types";

export interface WarEffortBonus {
  /** Total pooled war resources funding the bonus (scrap+biomass+fuel+intel). */
  total: number;
  /** Discrete war-effort tier reached (0..WAR_EFFORT.maxTier). */
  tier: number;
  /** Global damage multiplier (>= 1) the war effort grants every game. */
  damageMult: number;
  /** Fraction (0..1) toward the next tier, for progress UI. 1 at the cap. */
  progress: number;
}

/** The funded pool: the sum of every shared war resource. Never negative. */
export function warEffortPool(resources: ResourceBag): number {
  const total = resources.scrap + resources.biomass + resources.fuel + resources.intel;
  return total > 0 ? total : 0;
}

/**
 * Derive the collective war-effort bonus from a world's shared pool. Accepts a
 * full WorldState or just `{ resources }` so callers can pass a summary slice.
 */
export function warEffortBonus(state: Pick<WorldState, "resources">): WarEffortBonus {
  const total = warEffortPool(state.resources);
  const rawTier = Math.floor(total / WAR_EFFORT.unitPerTier);
  const tier = Math.min(WAR_EFFORT.maxTier, rawTier);
  const damageMult = 1 + tier * WAR_EFFORT.perTier;
  const progress = tier >= WAR_EFFORT.maxTier ? 1 : (total % WAR_EFFORT.unitPerTier) / WAR_EFFORT.unitPerTier;
  return { total, tier, damageMult, progress };
}

/** The neutral bonus (no war effort): identity multiplier, used as the offline default. */
export const NEUTRAL_WAR_EFFORT: WarEffortBonus = { total: 0, tier: 0, damageMult: 1, progress: 0 };
