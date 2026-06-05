/** Shared types for REDLINE. */

/**
 * Canon front taxonomy (apps/lore/content/Maps.md front-taxonomy). A place in the
 * War-for-the-Lanes is one of these fronts; the Hollow Lanes is a `lane`.
 */
export type Front = "holdout" | "lane" | "breach" | "orbital";

export type Phase = "ready" | "running" | "won" | "dead";

export type RunnerState = "run" | "air" | "dash" | "hit";

/** A solid floor segment. The runner runs on it; gaps between platforms are pits. */
export interface Platform {
  x0: number; // left edge (world X)
  x1: number; // right edge (world X)
  topY: number; // walkable surface Y
}

export type HazardKind = "spike" | "bar";

/**
 * A hazard the runner must clear.
 * - "spike": tall blood creep growth; jump over it. Collide if you touch its body.
 * - "bar":   low blood creep arch; dash-roll under it. Collide if standing tall.
 */
export interface Hazard {
  kind: HazardKind;
  x: number; // center X
  width: number;
  // For "spike": occupies [groundTopY .. groundTopY + height]
  // For "bar":   occupies [groundTopY + clearance .. high], so you can roll under
  baseY: number; // surface Y at the hazard
  height: number; // total visual height above baseY
  clearance: number; // (bar only) open space height under the bar
}

/** A collectible speed ember. */
export interface Ember {
  x: number;
  y: number;
  collected: boolean;
}

/** A gunmetal kicker ramp that converts run speed into a launch. */
export interface Ramp {
  x0: number;
  x1: number;
  baseY: number;
  rise: number;
}

/** The full, generated course. */
export interface Course {
  platforms: Platform[];
  hazards: Hazard[];
  embers: Ember[];
  ramps: Ramp[];
  beaconX: number;
}
