// #82 splits the collider set in two: obstacleBoxes still push the player out,
// but the new surfaceBoxes (raised room floors, platforms, ramp steps) are only
// read by the ground-snap pass — so the player can STAND ON and CLIMB them
// without being shoved off. These tests drive PlayerSystem.resolveCollisions
// directly to pin that contract, plus the v1 (empty surfaceBoxes) identity.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GameContext } from "../../src/game/context";
import { PlayerSystem } from "../../src/game/entities/PlayerSystem";
import type { GameSystems } from "../../src/game/systems";

const PLAYER_HEIGHT = 1.8;
const GROUND_SNAP_DOWN = 0.42; // snap window when airborne (canJump === false)

// Build an axis-aligned collider from min/max corners.
function box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
  return new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
}

function makeCollisionHarness(opts: {
  footY?: number;
  x?: number;
  z?: number;
  canJump?: boolean;
  velocityY?: number;
  obstacleBoxes?: THREE.Box3[];
  surfaceBoxes?: THREE.Box3[];
}) {
  const footY = opts.footY ?? 0;
  const position = new THREE.Vector3(opts.x ?? 0, footY + PLAYER_HEIGHT, opts.z ?? 0);
  const ctx = {
    body: { position },
    bounds: { clampXZ: () => {} }, // isolate obstacle/surface logic from the wall clamp
    canJump: opts.canJump ?? false,
    groundY: 0,
    obstacleBoxes: opts.obstacleBoxes ?? [],
    stanceHeight: PLAYER_HEIGHT,
    surfaceBoxes: opts.surfaceBoxes ?? [],
    velocity: new THREE.Vector3(0, opts.velocityY ?? 0, 0),
  } as unknown as GameContext;

  return { ctx, system: new PlayerSystem(ctx, {} as GameSystems) };
}

describe("PlayerSystem.resolveCollisions — v2 walkable surfaces", () => {
  it("snaps the player up onto a raised surface (groundUnder reads surfaceBoxes)", () => {
    const { ctx, system } = makeCollisionHarness({
      footY: 0,
      surfaceBoxes: [box(-3, 0, -3, 3, 0.4, 3)], // a 0.4m-high walkable slab over the origin
    });
    system.resolveCollisions();
    expect(ctx.groundY).toBeCloseTo(0.4);
    expect(ctx.body.position.y).toBeCloseTo(0.4 + PLAYER_HEIGHT); // standing on the slab
    expect(ctx.canJump).toBe(true);
  });

  it("does NOT push the player out of a surface box (ramps/platforms stay climbable)", () => {
    const footprint = box(-5, 0, -5, 5, 3, 5);
    const { ctx, system } = makeCollisionHarness({ x: 3, z: 1, surfaceBoxes: [footprint] });
    system.resolveCollisions();
    // surfaceBoxes are walkable, so the horizontal position is untouched
    expect(ctx.body.position.x).toBeCloseTo(3);
    expect(ctx.body.position.z).toBeCloseTo(1);
  });

  it("STILL pushes the player out of an obstacle box at the same footprint", () => {
    const footprint = box(-5, 0, -5, 5, 3, 5);
    const { ctx, system } = makeCollisionHarness({ x: 3, z: 1, obstacleBoxes: [footprint] });
    system.resolveCollisions();
    // nearest edge is +X (dr smallest), so the player is ejected to the wall + radius
    expect(ctx.body.position.x).toBeCloseTo(5.5);
    expect(ctx.body.position.z).toBeCloseTo(1);
  });

  it("holds the player on a high deck without teleporting them off it", () => {
    const { ctx, system } = makeCollisionHarness({
      footY: 3,
      canJump: true,
      surfaceBoxes: [box(-10, 0, -10, 10, 3, 10)], // mezzanine deck, top at y=3
    });
    system.resolveCollisions();
    expect(ctx.groundY).toBeCloseTo(3);
    expect(ctx.body.position.y).toBeCloseTo(3 + PLAYER_HEIGHT); // unchanged — no yank
  });

  it("climbs consecutive ramp steps, each within the step budget", () => {
    const steps = [box(-3, 0, -3, 3, 0.4286, 3), box(-3, 0, -3, 3, 0.857, 3)];
    // grounded on the first step (footY at its top), already canJump → snap is the
    // full step height, so the +0.4286 rise to the next step is reachable.
    const { ctx, system } = makeCollisionHarness({ footY: 0.4286, canJump: true, surfaceBoxes: steps });
    system.resolveCollisions();
    expect(ctx.groundY).toBeCloseTo(0.857);
    expect(ctx.body.position.y).toBeCloseTo(0.857 + PLAYER_HEIGHT);
  });

  it("refuses to teleport onto a ledge taller than the snap window", () => {
    const { ctx, system } = makeCollisionHarness({
      footY: 0,
      canJump: false, // airborne snap window is only GROUND_SNAP_DOWN (0.42)
      surfaceBoxes: [box(-3, 0, -3, 3, 0.5, 3)], // 0.5m > 0.42, so out of reach
    });
    system.resolveCollisions();
    expect(GROUND_SNAP_DOWN).toBeLessThan(0.5);
    expect(ctx.groundY).toBe(0);
    expect(ctx.body.position.y).toBeCloseTo(PLAYER_HEIGHT); // dropped to the floor, not the ledge
  });
});

describe("PlayerSystem.resolveCollisions — v1 identity", () => {
  it("ground-snaps exactly as before when there are no surface boxes", () => {
    const { ctx, system } = makeCollisionHarness({ footY: 0.1 }); // both box sets empty (v1 flat map)
    system.resolveCollisions();
    expect(ctx.groundY).toBe(0);
    expect(ctx.body.position.y).toBeCloseTo(PLAYER_HEIGHT); // snapped to the arena floor
    expect(ctx.canJump).toBe(true);
  });
});
