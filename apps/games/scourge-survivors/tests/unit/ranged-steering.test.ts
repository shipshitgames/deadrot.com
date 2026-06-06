import { type PlanarVec, RectBounds } from "@shipshitgames/engine";
import { describe, expect, it } from "vitest";
import {
  chasePlayerStrategy,
  rangedEngagementBand,
  redirectBlockedRangedRetreat,
} from "../../src/game/entities/ChasePlayerStrategy";

function steerRanged(dist: number, preferredRange = 12): { move: PlanarVec; retreating: boolean } {
  const enemy = {
    ranged: true,
    isBoss: false,
    preferredRange,
    speed: 10,
    strafeSign: 1,
    retreating: false,
    attackRange: 1.7,
  } as Parameters<typeof chasePlayerStrategy.desiredVelocity>[0];
  const move: PlanarVec = { x: 0, z: 0 };

  chasePlayerStrategy.desiredVelocity(enemy, { dist, dirX: 1, dirZ: 0 }, move);

  return { move, retreating: enemy.retreating };
}

describe("ranged enemy steering", () => {
  it("uses a wider engagement band around preferred range", () => {
    expect(rangedEngagementBand(12)).toEqual({ inner: 8.5, outer: 16.5 });
  });

  it("approaches when it is outside the engagement band", () => {
    const { move, retreating } = steerRanged(20);

    expect(move.x).toBeGreaterThan(0);
    expect(move.z).toBeCloseTo(0);
    expect(retreating).toBe(false);
  });

  it("strafes and keeps pressure inside the engagement band", () => {
    const { move, retreating } = steerRanged(9.5);

    expect(move.x).toBeCloseTo(0);
    expect(move.z).toBeGreaterThan(0);
    expect(retreating).toBe(false);
  });

  it("retreats only when danger-close", () => {
    const { move, retreating } = steerRanged(7);

    expect(move.x).toBeLessThan(0);
    expect(move.z).toBeCloseTo(0);
    expect(retreating).toBe(true);
  });

  it("redirects blocked retreats into a sidestep", () => {
    const bounds = RectBounds.square(10);
    const move: PlanarVec = { x: -8, z: 0 };

    const blocked = redirectBlockedRangedRetreat(
      { x: -8.5, z: 0 },
      move,
      { dirX: 1, dirZ: 0 },
      { bounds, delta: 1, margin: 1.5, speed: 10, strafeSign: 1 },
    );

    expect(blocked).toBe(true);
    expect(move.x).toBeCloseTo(0);
    expect(move.z).toBeGreaterThan(0);
    expect(bounds.containsXZ(-8.5 + move.x, move.z, 1.5)).toBe(true);
  });

  it("leaves open retreats unchanged", () => {
    const bounds = RectBounds.square(10);
    const move: PlanarVec = { x: -8, z: 0 };

    const blocked = redirectBlockedRangedRetreat(
      { x: 0, z: 0 },
      move,
      { dirX: 1, dirZ: 0 },
      { bounds, delta: 1, margin: 1.5, speed: 10, strafeSign: 1 },
    );

    expect(blocked).toBe(false);
    expect(move).toEqual({ x: -8, z: 0 });
  });
});
