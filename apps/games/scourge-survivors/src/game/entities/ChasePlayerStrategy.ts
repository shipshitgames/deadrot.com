import type { PlanarVec, SteeringStrategy, SteerView, WorldBounds } from "@shipshitgames/engine";
import type { Enemy } from "./Enemy";

const RANGED_INNER_BAND_OFFSET = 3.5;
const RANGED_OUTER_BAND_OFFSET = 4.5;
const RANGED_MIN_RETREAT_RANGE = 6;
const RANGED_STRAFE_SPEED = 0.7;
const RANGED_RETREAT_SPEED = 0.78;

export function rangedEngagementBand(preferredRange: number): { inner: number; outer: number } {
  return {
    inner: Math.max(RANGED_MIN_RETREAT_RANGE, preferredRange - RANGED_INNER_BAND_OFFSET),
    outer: preferredRange + RANGED_OUTER_BAND_OFFSET,
  };
}

export function redirectBlockedRangedRetreat(
  pos: { x: number; z: number },
  move: PlanarVec,
  view: Pick<SteerView, "dirX" | "dirZ">,
  opts: {
    bounds: WorldBounds;
    delta: number;
    margin: number;
    speed: number;
    strafeSign: number;
  },
): boolean {
  const nextX = pos.x + move.x * opts.delta;
  const nextZ = pos.z + move.z * opts.delta;
  if (opts.bounds.containsXZ(nextX, nextZ, opts.margin)) return false;

  const strafeX = -view.dirZ * opts.strafeSign * opts.speed * RANGED_STRAFE_SPEED;
  const strafeZ = view.dirX * opts.strafeSign * opts.speed * RANGED_STRAFE_SPEED;
  if (opts.bounds.containsXZ(pos.x + strafeX * opts.delta, pos.z + strafeZ * opts.delta, opts.margin)) {
    move.x = strafeX;
    move.z = strafeZ;
    return true;
  }

  const flippedStrafeX = -strafeX;
  const flippedStrafeZ = -strafeZ;
  if (opts.bounds.containsXZ(pos.x + flippedStrafeX * opts.delta, pos.z + flippedStrafeZ * opts.delta, opts.margin)) {
    move.x = flippedStrafeX;
    move.z = flippedStrafeZ;
    return true;
  }

  move.x = 0;
  move.z = 0;
  return true;
}

/**
 * The Scourge melee-chase / ranged-kite steering — the FPS half of the agent
 * seam. Melee bots (and the boss) close straight in; ranged bots hold their
 * preferred range and strafe around the player, backing off when crowded.
 *
 * Genre-specific, so it stays game-side: the engine only owns the kinematic
 * Agent + the SteeringStrategy seam this plugs into. A tower-defense would swap
 * in a `LaneToCoreStrategy` against the same Agent base.
 */
class ChasePlayerStrategy implements SteeringStrategy<Enemy> {
  desiredVelocity(e: Enemy, view: SteerView, out: PlanarVec): void {
    const { dist, dirX, dirZ } = view;
    e.retreating = false;
    if (e.ranged && !e.isBoss) {
      const band = rangedEngagementBand(e.preferredRange);
      if (dist > band.outer) {
        out.x += dirX * e.speed;
        out.z += dirZ * e.speed;
      } else if (dist < band.inner) {
        out.x -= dirX * e.speed * RANGED_RETREAT_SPEED;
        out.z -= dirZ * e.speed * RANGED_RETREAT_SPEED;
        e.retreating = true;
      } else {
        out.x += -dirZ * e.strafeSign * e.speed * RANGED_STRAFE_SPEED;
        out.z += dirX * e.strafeSign * e.speed * RANGED_STRAFE_SPEED;
      }
    } else {
      const closing = dist > e.attackRange * 0.85 ? 1 : 0;
      out.x += dirX * e.speed * closing;
      out.z += dirZ * e.speed * closing;
    }
  }
}

/** Shared stateless instance — every Scourge enemy steers the same way. */
export const chasePlayerStrategy = new ChasePlayerStrategy();
