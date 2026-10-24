// #82 splits the collider set in two: obstacleBoxes still push the player out,
// but the new surfaceBoxes (raised room floors, platforms, ramp steps) are only
// read by the ground-snap pass — so the player can STAND ON and CLIMB them
// without being shoved off. Enterable buildings add a third set, deckBoxes
// (storey floors and roofs): walkable like surfaceBoxes, but kept apart so the
// enemy pathing pass can ignore what only the player may climb. These tests
// drive PlayerSystem.resolveCollisions directly to pin that contract, plus the
// v1 (no raised geometry at all) identity.

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
  deckBoxes?: THREE.Box3[];
  obstacleBoxes?: THREE.Box3[];
  surfaceBoxes?: THREE.Box3[];
}) {
  const footY = opts.footY ?? 0;
  const position = new THREE.Vector3(opts.x ?? 0, footY + PLAYER_HEIGHT, opts.z ?? 0);
  const ctx = {
    body: { position },
    bounds: { clampXZ: () => {} }, // isolate obstacle/surface logic from the wall clamp
    canJump: opts.canJump ?? false,
    deckBoxes: opts.deckBoxes ?? [],
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

describe("PlayerSystem.resolveCollisions — building decks", () => {
  const DECK_Y = 3.4; // first-storey floor: a full storey above the yard

  it("leaves a player on the ground floor under the deck, never on top of it", () => {
    const { ctx, system } = makeCollisionHarness({
      footY: 0,
      canJump: true, // grounded, so the wider of the two snap windows is in play
      deckBoxes: [box(-4, DECK_Y - 0.2, -4, 4, DECK_Y, 4)],
    });
    system.resolveCollisions();
    // Decks are walkable, but the lift is step-clamped: a storey is not a step.
    expect(ctx.groundY).toBe(0);
    expect(ctx.body.position.y).toBeCloseTo(PLAYER_HEIGHT);
  });

  it("catches a player who is already upstairs on the deck surface", () => {
    const { ctx, system } = makeCollisionHarness({
      footY: DECK_Y + 0.3, // stepped off the stair head, falling the last few cm
      canJump: false,
      deckBoxes: [box(-4, DECK_Y - 0.2, -4, 4, DECK_Y, 4)],
    });
    system.resolveCollisions();
    expect(ctx.groundY).toBeCloseTo(DECK_Y);
    expect(ctx.body.position.y).toBeCloseTo(DECK_Y + PLAYER_HEIGHT);
    expect(ctx.canJump).toBe(true);
  });

  it("is read by the ground pass only — a deck never shoves the player sideways", () => {
    // Tall enough to engulf the player, so the same AABB as an obstacle WOULD push.
    const slab = box(-4, DECK_Y - 0.2, -4, 4, DECK_Y + 1.6, 4);

    const onDeck = makeCollisionHarness({ footY: DECK_Y, x: 1, z: 2, deckBoxes: [slab] });
    onDeck.system.resolveCollisions();
    expect(onDeck.ctx.body.position.x).toBeCloseTo(1);
    expect(onDeck.ctx.body.position.z).toBeCloseTo(2);

    const inWall = makeCollisionHarness({ footY: DECK_Y, x: 1, z: 2, obstacleBoxes: [slab] });
    inWall.system.resolveCollisions();
    expect(Math.hypot(inWall.ctx.body.position.x - 1, inWall.ctx.body.position.z - 2)).toBeGreaterThan(0);
  });
});

// Buildings put colliders ABOVE and BELOW the body for the first time: a door
// lintel hangs over the opening, a storey slab sits under the player's boots.
// The push-out pass only shoves bodies out of boxes their own vertical span
// actually overlaps — without that gate a lintel is an invisible wall in every
// doorway, which is what stopped enemies following the player inside.
describe("PlayerSystem push-out — vertical span gate", () => {
  const LINTEL_BOTTOM = 2.1; // top of a door's clear cut

  it("walks the player under a door lintel instead of shoving them out of the opening", () => {
    const lintel = box(-1, LINTEL_BOTTOM, 3.9, 1, 3.4, 4.1);
    const { ctx, system } = makeCollisionHarness({ footY: 0, z: 4, obstacleBoxes: [lintel] });
    system.resolveCollisions();
    // Head at 1.8, lintel starts at 2.1 — nothing to collide with.
    expect(PLAYER_HEIGHT).toBeLessThan(LINTEL_BOTTOM);
    expect(ctx.body.position.z).toBeCloseTo(4);
  });

  it("still stops the player at the door panel filling that same opening", () => {
    const panel = box(-1, 0, 3.9, 1, 2.1, 4.1);
    const { ctx, system } = makeCollisionHarness({ footY: 0, z: 4, obstacleBoxes: [panel] });
    system.resolveCollisions();
    expect(Math.abs(ctx.body.position.z - 4)).toBeGreaterThan(0);
  });

  it("does not shove a player standing on top of an obstacle sideways off it", () => {
    const crate = box(-2, 0, -2, 2, 1.2, 2);
    const { ctx, system } = makeCollisionHarness({ footY: 1.2, x: 0.5, z: 0.5, obstacleBoxes: [crate] });
    system.resolveCollisions();
    expect(ctx.body.position.x).toBeCloseTo(0.5);
    expect(ctx.body.position.z).toBeCloseTo(0.5);
  });
});

// pushOutOfObstacles is the enemy-facing half of the same pass: PveDirectorSystem
// calls it with a spawned enemy's FOOT position and its measured body height, so
// the gate has to work off an arbitrary span rather than the player's stance.
describe("PlayerSystem.pushOutOfObstacles — enemy bodies", () => {
  const ENEMY_HEIGHT = 1.8;

  function enemyAt(x: number, z: number, footY: number, boxes: THREE.Box3[]) {
    const { ctx, system } = makeCollisionHarness({ obstacleBoxes: boxes });
    const pos = new THREE.Vector3(x, footY, z);
    system.pushOutOfObstacles(pos, 0.6, ENEMY_HEIGHT);
    void ctx;
    return pos;
  }

  it("lets an enemy walk through a doorway under its lintel", () => {
    const lintel = box(-1, 2.1, 3.9, 1, 3.4, 4.1);
    const pos = enemyAt(0, 4, 0, [lintel]);
    expect(pos.z).toBeCloseTo(4);
    expect(pos.x).toBeCloseTo(0);
  });

  it("still stops an enemy at the wall beside that doorway", () => {
    const wall = box(1, 0, 3.9, 6, 3.4, 4.1);
    const pos = enemyAt(2, 4, 0, [wall]);
    expect(Math.abs(pos.z - 4)).toBeGreaterThan(0);
  });

  it("does not shove an enemy standing on a storey slab that is also an obstacle", () => {
    const slab = box(-4, 3.2, -4, 4, 3.4, 4);
    const pos = enemyAt(1, 1, 3.4, [slab]);
    expect(pos.x).toBeCloseTo(1);
    expect(pos.z).toBeCloseTo(1);
  });

  it("pushes an upstairs enemy out of an upstairs wall, not a downstairs one", () => {
    const groundWall = box(-1, 0, -0.2, 1, 3, 0.2);
    const upstairsWall = box(-1, 3.4, -0.2, 1, 6.4, 0.2);
    const upstairs = enemyAt(0, 0, 3.4, [groundWall, upstairsWall]);
    expect(Math.abs(upstairs.z)).toBeGreaterThan(0);

    const alsoUpstairs = enemyAt(0, 0, 3.4, [groundWall]);
    expect(alsoUpstairs.z).toBeCloseTo(0); // the ground-floor wall is below its feet
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
