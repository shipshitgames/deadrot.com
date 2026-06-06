import type { PlanarVec, SteerView, SteeringStrategy } from "@shipshitgames/engine";
import type { Enemy } from "./Enemy";

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
      // kite: hold preferred range, strafe around the player
      if (dist > e.preferredRange + 1.5) {
        out.x += dirX * e.speed;
        out.z += dirZ * e.speed;
      } else if (dist < e.preferredRange - 2) {
        out.x -= dirX * e.speed * 0.8;
        out.z -= dirZ * e.speed * 0.8;
        e.retreating = true;
      } else {
        // strafe perpendicular to the player direction
        out.x += -dirZ * e.strafeSign * e.speed * 0.7;
        out.z += dirX * e.strafeSign * e.speed * 0.7;
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
