// spawnExplosion is the only FX primitive in the game whose visual makes a
// gameplay promise: the shockwave ring is drawn at the radius the caller
// actually damaged, so a player can learn the cannon's footprint by watching a
// detonation instead of by walking into one. These tests pin that promise, the
// crowd-scaling that keeps a heavy emitter affordable, and the teardown — the
// effect owns 26 meshes at full detail, so a leak here is a leak per shot.

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { GameContext } from "../../src/game/context";
import { FxSystem } from "../../src/game/entities/FxSystem";
import type { GameSystems } from "../../src/game/systems";

/** Emitter counts at full detail — mirrors the literals in spawnExplosion. */
const EMBERS = 16;
const PUFFS = 7;
/** Core, fire shell, ground ring: the silhouette, never scaled away. */
const STRUCTURAL = 3;
/** Mirrors EXPLOSION_POP_BUDGET / EXPLOSION_MIN_DETAIL. */
const POP_BUDGET = 150;
const MIN_DETAIL = 0.25;

function harness() {
  const ctx = {
    scene: new THREE.Scene(),
    // Camera-juice and timer channels updateEffects decays every frame. Zeroed
    // rather than omitted so an explosion's contribution is the only signal.
    shakeTrauma: 0,
    hitstopTimer: 0,
    camRecoil: 0,
    comboTimer: 0,
    combo: 0,
    muzzleTimer: 0,
    damageBoostTimer: 0,
    status: "playing",
  } as unknown as GameContext;
  // clearTransientFx also drains projectiles and pickups; neither is in scope
  // here, so they are stubbed to no-ops rather than stood up.
  const sys = {
    projectiles: { clearProjectiles: () => {} },
    pickups: { pickups: [], removePickup: () => {} },
  } as unknown as GameSystems;
  return { ctx, fx: new FxSystem(ctx, sys) };
}

/** The ground shockwave, found by the one geometry type only it uses. */
function ringOf(fx: FxSystem): THREE.Mesh {
  const ring = fx.pops.find((p) => p.mesh.geometry instanceof THREE.RingGeometry)?.mesh;
  expect(ring).toBeDefined();
  return ring as THREE.Mesh;
}

/** Smoke is the file's only non-additive layer, which is also how it is told
 *  apart from the embers it shares a geometry type with. */
function puffCount(fx: FxSystem): number {
  return fx.pops.filter((p) => (p.mesh.material as THREE.MeshBasicMaterial).blending === THREE.NormalBlending).length;
}

/** Park `count` inert pops in the pool so the crowd scaling has something to see. */
function floodPops(fx: FxSystem, count: number) {
  for (let i = 0; i < count; i++) {
    fx.pops.push({
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial()),
      age: 0,
      ttl: 99,
    });
  }
}

describe("FxSystem.spawnExplosion — the blast reads its own damage radius", () => {
  it("grows the shockwave ring to exactly the radius it was handed", () => {
    const { fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(3, 0, -7), { radius: 4 });
    const ring = ringOf(fx);

    // Unit-radius geometry: world radius is the scale. Starts at a point...
    expect(ring.scale.x).toBeCloseTo(0.001, 3);

    // ...and ends on the damage boundary. 0.399s of a 0.4s life, so the ring is
    // sampled at full extent one frame before updateEffects retires it.
    fx.updateEffects(0.399);
    expect(ring.scale.x).toBeCloseTo(4, 1);
    expect(ring.position.y).toBeLessThan(0.2); // flat on the ground, not floating
  });

  it("scales the ring with the radius rather than drawing one fixed blast", () => {
    const { fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 2 });
    const small = ringOf(fx);
    fx.updateEffects(0.399);
    const smallExtent = small.scale.x;

    const big = harness();
    big.fx.spawnExplosion(new THREE.Vector3(), { radius: 9 });
    const ring = ringOf(big.fx);
    big.fx.updateEffects(0.399);

    expect(smallExtent).toBeCloseTo(2, 1);
    expect(ring.scale.x).toBeCloseTo(9, 1);
  });

  it("clamps a degenerate radius instead of collapsing the effect", () => {
    const { fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 0 });

    expect(fx.pops).toHaveLength(STRUCTURAL + EMBERS + PUFFS);
    fx.updateEffects(0.399);
    expect(ringOf(fx).scale.x).toBeGreaterThan(0.5);
  });
});

describe("FxSystem.spawnExplosion — crowd scaling", () => {
  it("spawns every layer on a quiet frame", () => {
    const { ctx, fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });

    expect(fx.pops).toHaveLength(STRUCTURAL + EMBERS + PUFFS);
    expect(puffCount(fx)).toBe(PUFFS);
    expect(ctx.scene.children).toHaveLength(STRUCTURAL + EMBERS + PUFFS);
  });

  it("sheds debris on a busy frame but never the silhouette", () => {
    const { fx } = harness();
    floodPops(fx, POP_BUDGET * 3); // crowding 2 → detail clamped to the floor
    const before = fx.pops.length;

    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });
    const added = fx.pops.length - before;

    expect(added).toBe(STRUCTURAL + Math.round(EMBERS * MIN_DETAIL) + Math.round(PUFFS * MIN_DETAIL));
    expect(added).toBeLessThan(STRUCTURAL + EMBERS + PUFFS);
    // The blast is cheaper, not invisible: the ring the player reads is still here.
    expect(ringOf(fx)).toBeDefined();
  });

  it("thins out gradually rather than falling off a cliff at the budget", () => {
    // detail = max(MIN_DETAIL, 1 - (live - BUDGET)/BUDGET). The ramp therefore
    // runs from the budget up to 1.75x it, where MIN_DETAIL takes over — sample
    // INSIDE the ramp to see the slope, not past its floor.
    const addedAt = (parked: number) => {
      const { fx } = harness();
      floodPops(fx, parked);
      const before = fx.pops.length;
      fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });
      return fx.pops.length - before;
    };

    const full = addedAt(0);
    const mid = addedAt(POP_BUDGET * 1.5); // crowding 0.5 → half detail
    const floored = addedAt(POP_BUDGET * 4); // far past the ramp → MIN_DETAIL

    expect(full).toBe(STRUCTURAL + EMBERS + PUFFS);
    expect(mid).toBeLessThan(full);
    expect(mid).toBeGreaterThan(floored);
    // however crowded the frame gets, the silhouette the player reads survives
    expect(floored).toBeGreaterThanOrEqual(STRUCTURAL);
  });

  it("leaves the pool alone — an explosion adds, it never culls live FX", () => {
    const { fx } = harness();
    floodPops(fx, 40);
    const parked = fx.pops.slice();

    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });

    for (const pop of parked) expect(fx.pops).toContain(pop);
  });
});

describe("FxSystem.spawnExplosion — camera juice", () => {
  it("forwards shake and hitstop to the camera when asked", () => {
    const { ctx, fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4, shake: 0.5, hitstop: 0.07 });

    expect(ctx.shakeTrauma).toBeCloseTo(0.5, 6);
    expect(ctx.hitstopTimer).toBeCloseTo(0.07, 6);
  });

  it("stays silent on the camera when it is only spectacle", () => {
    const { ctx, fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });

    expect(ctx.shakeTrauma).toBe(0);
    expect(ctx.hitstopTimer).toBe(0);
  });
});

describe("FxSystem.spawnExplosion — lifetime", () => {
  it("fades out and retires every particle without leaking a mesh", () => {
    const { ctx, fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });
    const disposals = fx.pops.map((p) => vi.spyOn(p.mesh.geometry, "dispose"));

    // Smoke is the longest layer at ttl <= 1.3s. Step it out in frames so the
    // opacity ramp is exercised rather than skipped in one jump.
    for (let frame = 0; frame < 120; frame++) fx.updateEffects(1 / 60);

    expect(fx.pops).toHaveLength(0);
    expect(ctx.scene.children).toHaveLength(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalled();
  });

  it("keeps the smoke translucent so the blast never blacks out the fight", () => {
    const { fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });

    // updateEffects rewrites material.opacity every frame from peakOpacity, so
    // this is the value that actually reaches the renderer — not the one the
    // material was constructed with.
    fx.updateEffects(1 / 60);
    const smoke = fx.pops.filter((p) => (p.mesh.material as THREE.MeshBasicMaterial).blending === THREE.NormalBlending);

    expect(smoke).toHaveLength(PUFFS);
    for (const puff of smoke) {
      expect((puff.mesh.material as THREE.MeshBasicMaterial).opacity).toBeLessThanOrEqual(0.45);
    }
  });

  it("is drained by clearTransientFx when a run tears down mid-blast", () => {
    const { ctx, fx } = harness();
    fx.spawnExplosion(new THREE.Vector3(), { radius: 4 });
    const disposals = fx.pops.map((p) => vi.spyOn(p.mesh.geometry, "dispose"));

    fx.clearTransientFx();

    expect(fx.pops).toHaveLength(0);
    expect(ctx.scene.children).toHaveLength(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalled();
  });
});
