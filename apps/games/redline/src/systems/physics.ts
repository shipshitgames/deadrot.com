/**
 * Physics system. Resolves the runner against the course each step:
 *   - finds the floor under the runner (platforms), or lets them fall into pits
 *   - launches them off ramps
 *   - tests hazard collisions (spike = jump it, bar = roll under it)
 *   - collects embers
 *   - reports outcomes (won / fell) back to the caller
 */

import { COURSE, EMBER, RUNNER, WORLD } from "../constants";
import type { Runner } from "../entities/runner";
import type { Course } from "../types";

export interface StepResult {
  collectedEmbers: number; // count grabbed this step (for juice)
  hitHazard: boolean; // a fresh hazard hit landed this step
  reachedBeacon: boolean;
  fellInPit: boolean;
}

export class Physics {
  /** Surface Y at world X, or null if over a pit (no floor). */
  private surfaceAt(course: Course, x: number): number | null {
    // Ramps take priority: while on a ramp, the surface rises linearly.
    for (const r of course.ramps) {
      if (x >= r.x0 && x <= r.x1) {
        const t = (x - r.x0) / (r.x1 - r.x0);
        return r.baseY + t * r.rise;
      }
    }
    for (const p of course.platforms) {
      if (x >= p.x0 && x <= p.x1) return p.topY;
    }
    return null;
  }

  step(dt: number, runner: Runner, course: Course): StepResult {
    const result: StepResult = {
      collectedEmbers: 0,
      hitHazard: false,
      reachedBeacon: false,
      fellInPit: false,
    };

    const surface = this.surfaceAt(course, runner.x);

    // --- Vertical resolution -------------------------------------------------
    if (surface === null) {
      // Over a pit: always airborne, integrate gravity.
      runner.leaveGround();
      runner.integrateGravity(dt);
    } else {
      const feetY = surface + RUNNER.radius;
      if (runner.onGround) {
        // Stick to the (possibly rising) surface while grounded.
        runner.y = feetY;
        runner.vy = 0;
      } else {
        runner.integrateGravity(dt);
        if (runner.vy <= 0 && runner.y <= feetY) {
          // Landing — but a ramp's downhill exit should fling, not stick.
          runner.land(surface);
        }
      }

      // Ramp launch: leaving the top of a ramp converts speed into lift.
      for (const r of course.ramps) {
        const justPastTop = runner.x >= r.x1 - 0.05 && runner.x <= r.x1 + 0.6;
        if (justPastTop && runner.onGround) {
          // Steeper + faster = bigger pop.
          const slope = r.rise / (r.x1 - r.x0);
          const power = Math.min(34, runner.vx * slope * 1.15 + 6);
          runner.launch(power);
        }
      }
    }

    // --- Fell off the world (deep pit) --------------------------------------
    if (runner.y < WORLD.groundY - 8) {
      result.fellInPit = true;
    }

    // --- Hazards -------------------------------------------------------------
    if (runner.invuln <= 0) {
      for (const h of course.hazards) {
        const halfW = h.width / 2 + RUNNER.radius * 0.6;
        if (runner.x < h.x - halfW || runner.x > h.x + halfW) continue;

        const feet = runner.y - RUNNER.radius * runner.crouch;
        const head = runner.y + RUNNER.radius * runner.crouch;

        if (h.kind === "spike") {
          // Solid from baseY up to baseY+height. Safe only if your feet clear it.
          const top = h.baseY + h.height;
          if (feet < top) {
            runner.hit();
            result.hitHazard = true;
            break;
          }
        } else {
          // bar: open space [baseY .. baseY+clearance]; solid above.
          // Your head height already reflects the crouch posture, so rolling
          // (runner.isLow) lowers `head` below the bar and clears it.
          const barBottom = h.baseY + h.clearance;
          if (head > barBottom) {
            runner.hit();
            result.hitHazard = true;
            break;
          }
        }
      }
    }

    // --- Embers --------------------------------------------------------------
    const er2 = (EMBER.radius + RUNNER.radius) * (EMBER.radius + RUNNER.radius);
    for (const e of course.embers) {
      if (e.collected) continue;
      const dx = e.x - runner.x;
      const dy = e.y - runner.y;
      if (dx * dx + dy * dy <= er2) {
        e.collected = true;
        runner.collectEmber(EMBER.speedBonus);
        result.collectedEmbers++;
      }
    }

    // --- Beacon --------------------------------------------------------------
    if (runner.x >= course.beaconX) {
      result.reachedBeacon = true;
    }

    return result;
  }

  /** Total horizontal progress 0..1 toward the beacon. */
  progress(runner: Runner, course: Course): number {
    const span = course.beaconX - WORLD.startX;
    return Math.min(1, Math.max(0, (runner.x - WORLD.startX) / span));
  }

  /** Distance run in meters (1 unit == 1 m for HUD purposes). */
  distance(runner: Runner): number {
    return Math.max(0, runner.x - WORLD.startX);
  }

  /** Convenience: the safe runway length before the first hazard. */
  get runway(): number {
    return COURSE.firstObstacleX;
  }
}
