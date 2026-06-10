import type { Charger, Spitter } from "./types";

// Pure enemy state machines. All tunables are injected (Game passes values from
// CONSTANTS) so these stay deterministic, data-driven, and unit-testable with
// no Three.js or DOM in sight.

// ---------------------------------------------------------------------------
// Charger: patrol → charge (hero on its row) → stunned (wall hit) → patrol.
// ---------------------------------------------------------------------------

export interface ChargerTuning {
  patrolSpeed: number;
  chargeSpeed: number;
  triggerRange: number; // horizontal engage distance
  rowTolerance: number; // vertical band that counts as "same row"
  stunTime: number; // seconds of wall-impact stun
}

export type ChargerEvent = "charged" | "stunned" | "recovered" | null;

export function updateCharger(
  c: Charger,
  heroX: number,
  heroY: number,
  dt: number,
  tuning: ChargerTuning,
): ChargerEvent {
  if (!c.alive) {
    if (c.popTimer > 0) c.popTimer -= dt;
    return null;
  }

  if (c.state === "stunned") {
    c.stunTimer -= dt;
    if (c.stunTimer <= 0) {
      // Recover patrolling away from the wall it just slammed.
      c.stunTimer = 0;
      c.state = "patrol";
      c.facing = -c.facing;
      c.vx = c.facing * tuning.patrolSpeed;
      return "recovered";
    }
    return null;
  }

  if (c.state === "patrol") {
    c.x += c.vx * dt;
    if (c.x <= c.minX) {
      c.x = c.minX;
      c.vx = Math.abs(c.vx);
    } else if (c.x >= c.maxX) {
      c.x = c.maxX;
      c.vx = -Math.abs(c.vx);
    }
    if (c.vx !== 0) c.facing = Math.sign(c.vx);

    const sameRow = Math.abs(heroY - c.y) <= tuning.rowTolerance;
    const inRange = Math.abs(heroX - c.x) <= tuning.triggerRange;
    if (sameRow && inRange) {
      c.state = "charge";
      c.facing = heroX >= c.x ? 1 : -1;
      c.vx = c.facing * tuning.chargeSpeed;
      return "charged";
    }
    return null;
  }

  // charging — barrel until a wall (the traversal bound) stuns it.
  c.x += c.vx * dt;
  if (c.x <= c.minX || c.x >= c.maxX) {
    c.x = Math.max(c.minX, Math.min(c.maxX, c.x));
    c.vx = 0;
    c.state = "stunned";
    c.stunTimer = tuning.stunTime;
    return "stunned";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Spitter: stationary lobber on a cooldown, fires only when the hero is close.
// ---------------------------------------------------------------------------

export interface SpitterTuning {
  range: number; // engage distance
  cooldown: number; // seconds between lobs
}

/** Ticks the spitter; returns true exactly when it lobs a glob this step. */
export function updateSpitter(sp: Spitter, heroX: number, heroY: number, dt: number, tuning: SpitterTuning): boolean {
  if (!sp.alive) {
    if (sp.popTimer > 0) sp.popTimer -= dt;
    return false;
  }
  if (sp.cooldown > 0) sp.cooldown -= dt;
  const inRange = Math.hypot(heroX - sp.x, heroY - sp.y) <= tuning.range;
  if (inRange && sp.cooldown <= 0) {
    sp.cooldown = tuning.cooldown;
    return true;
  }
  return false;
}

/**
 * Ballistic launch velocity so a glob under `gravity` lands on (toX, toY)
 * after exactly `arcTime` seconds — a readable, dodgeable lob.
 */
export function globLaunchVelocity(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  arcTime: number,
  gravity: number,
): { vx: number; vy: number } {
  const t = Math.max(0.2, arcTime);
  return {
    vx: (toX - fromX) / t,
    vy: (toY - fromY) / t + 0.5 * gravity * t,
  };
}
