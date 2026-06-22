// #82's point-based enemy spawn seam: maps that author `breachSpawn` anchors
// feed enemies in at fixed mouths instead of the v1 uniform scatter. The RNG is
// injectable, so the mouth selection, jitter, bounds clamp, and blocked-fallback
// are all checked deterministically here — no renderer, no engine scatter.

import { makeBounds, type WorldBounds } from "@shipshitgames/engine";
import { describe, expect, it } from "vitest";
import { createBreachSpawnProvider } from "../../src/game/entities/breachSpawn";

const BOUNDS: WorldBounds = makeBounds({ kind: "square", half: 40 });

describe("createBreachSpawnProvider", () => {
  it("returns the sole mouth verbatim when a map authors a single breach", () => {
    const provider = createBreachSpawnProvider({
      points: [{ x: 12, z: -7 }],
      bounds: () => BOUNDS,
      jitter: 0,
      rng: () => 0.5,
    });
    expect(provider.next({})).toEqual({ x: 12, z: -7 });
  });

  it("picks the mouth FARTHEST from the avoided player, so enemies flank", () => {
    const provider = createBreachSpawnProvider({
      points: [
        { x: -30, z: 0 }, // near the player
        { x: 30, z: 0 }, // across the arena
      ],
      bounds: () => BOUNDS,
      jitter: 0,
      rng: () => 0, // no jitter, no tie-break wobble
    });
    expect(provider.next({ avoidX: -30, avoidZ: 0 })).toEqual({ x: 30, z: 0 });
    expect(provider.next({ avoidX: 30, avoidZ: 0 })).toEqual({ x: -30, z: 0 });
  });

  it("actually applies the jitter offset around an interior mouth", () => {
    // Interior mouth so the clamp is a no-op and the assertion isolates the jitter
    // term itself: a regression that zeroed or flipped the offset would NOT land here.
    const provider = createBreachSpawnProvider({
      points: [{ x: 0, z: 0 }],
      bounds: () => BOUNDS,
      jitter: 10,
      rng: () => 0.9, // offset = (0.9*2-1)*10 = +8, well inside [-39, 39]
    });
    const p = provider.next({});
    expect(p.x).toBeCloseTo(8);
    expect(p.z).toBeCloseTo(8);
  });

  it("clamps an overshooting jitter back to the UPPER bound", () => {
    // Mouth pressed against the arena edge with a jitter big enough to overshoot
    // the wall — the clamp must reel it back to one metre inside the bounds.
    const provider = createBreachSpawnProvider({
      points: [{ x: 39, z: 39 }],
      bounds: () => BOUNDS,
      jitter: 10,
      rng: () => 0.9, // offset = (0.9*2-1)*10 = +8 → 47, clamps to maxX-1 = 39
    });
    const p = provider.next({});
    expect(p.x).toBe(39);
    expect(p.z).toBe(39);
  });

  it("clamps an overshooting jitter back to the LOWER bound", () => {
    const provider = createBreachSpawnProvider({
      points: [{ x: -39, z: -39 }],
      bounds: () => BOUNDS,
      jitter: 10,
      rng: () => 0.1, // offset = (0.1*2-1)*10 = -8 → -47, clamps to minX+1 = -39
    });
    const p = provider.next({});
    expect(p.x).toBe(-39);
    expect(p.z).toBe(-39);
  });

  it("falls back to the bare mouth when every jittered try is blocked", () => {
    let calls = 0;
    const provider = createBreachSpawnProvider({
      points: [{ x: 4, z: 4 }],
      bounds: () => BOUNDS,
      jitter: 3,
      attempts: 5,
      blocked: () => {
        calls++;
        return true; // the whole footprint is obstructed
      },
      rng: () => 0.3,
    });
    expect(provider.next({})).toEqual({ x: 4, z: 4 });
    expect(calls).toBe(5); // exhausted the attempt budget before giving up
  });

  it("indexes into the mouths by RNG when there is no player to avoid", () => {
    const provider = createBreachSpawnProvider({
      points: [
        { x: 1, z: 1 },
        { x: 2, z: 2 },
        { x: 3, z: 3 },
      ],
      bounds: () => BOUNDS,
      jitter: 0,
      rng: () => 0.99, // floor(0.99 * 3) = 2 → the last mouth
    });
    expect(provider.next({})).toEqual({ x: 3, z: 3 });
  });
});
