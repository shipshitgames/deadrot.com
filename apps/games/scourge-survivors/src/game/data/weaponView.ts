import type { MainWeaponVisualTier } from "./survivors";

/**
 * View-model presentation math for the first-person weapon sprite (#265, follow-up to #279).
 *
 * Every weapon ships ONE horizontal tier SHEET and "powers up" by FX rather than per-tier
 * art: a tint ramp (TIER_GLOW, in WeaponSystem) plus a size ramp (below) so each tier reads
 * as a bigger, hotter gun. The actual cell is UV-selected from the sheet at runtime. The pure
 * helpers here are kept free of three.js so they can be unit-tested without a WebGL context.
 */

/**
 * View-model size multiplier per visual tier. The gun grows as the run's offensive build
 * climbs, but the ramp is an even step so no single tier jumps in size. EVOLVED is dialed
 * back from the original 1.24 — at 1.24 the top-tier gun read as oversized and crowded the
 * viewport (#265) — to a smooth 1.16 that still ends a clear notch above tier-4.
 */
export const MAIN_WEAPON_TIER_VIEW_SCALE: Record<MainWeaponVisualTier, number> = {
  base: 1,
  "tier-2": 1.04,
  "tier-3": 1.08,
  "tier-4": 1.12,
  evolved: 1.16,
};

/** View-model size multiplier for a visual tier (1 at base, growing per tier). */
export function mainWeaponTierViewScale(tier: MainWeaponVisualTier): number {
  return MAIN_WEAPON_TIER_VIEW_SCALE[tier];
}

/** A horizontal UV window into a tier sheet: `offset` is the left edge, `repeat` the width. */
export type TierCellUv = { repeat: number; offset: number };

/**
 * UV window that samples a single tier-sheet cell. The view-model is a horizontal sheet of
 * `cols` equal-width cells; cell `cell` (0-based, left to right) occupies the U range
 * [cell/cols, (cell+1)/cols]. Returns the three.js texture `repeat.x` / `offset.x` that
 * samples exactly that cell. `cols` of 1 (a single-image weapon) is a no-op window [0, 1].
 */
export function weaponTierCellUv(cell: number, cols: number): TierCellUv {
  return { repeat: 1 / cols, offset: cell / cols };
}

/** Dedicated dual art is visible only for a live compatible bonus outside ADS. */
export function dualWeaponViewActive(
  timer: number,
  dualCompatible: boolean,
  hasDualSprite: boolean,
  adsActive = false,
): boolean {
  return timer > 0 && dualCompatible && hasDualSprite && !adsActive;
}
