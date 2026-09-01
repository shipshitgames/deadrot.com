// The two FX primitives that fire on ordinary shots rather than on kills:
// bullet impacts and ejected brass. Both are cheap by design, and both are easy
// to get subtly wrong against the pop pump — an impact that ignores the surface
// normal stops telling the player where the wall is, and a casing that leaves
// the pump's scale defaults alone inflates a 5cm shell into a barrel. These
// tests pin the directionality, the pump contract, and the budget.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GameContext } from "../../src/game/context";
import { FxSystem } from "../../src/game/entities/FxSystem";
import type { GameSystems } from "../../src/game/systems";

/** Mirrors IMPACT_SPARKS / CASING_POP_BUDGET in FxSystem. */
const SPARKS = 4;
const CASING_BUDGET = 90;
/** Core blip + spark cone + one dust puff. */
const DIRECTED_POPS = 1 + SPARKS + 1;

function harness() {
  const ctx = {
    scene: new THREE.Scene(),
    // The scalar channels updateEffects decays unconditionally each frame.
    shakeTrauma: 0,
    hitstopTimer: 0,
    camRecoil: 0,
    comboTimer: 0,
    combo: 0,
    muzzleTimer: 0,
    damageBoostTimer: 0,
    status: "playing",
  } as unknown as GameContext;
  const sys = {
    projectiles: { clearProjectiles: () => {} },
    pickups: { pickups: [], removePickup: () => {} },
  } as unknown as GameSystems;
  return { ctx, fx: new FxSystem(ctx, sys) };
}

/** Park `count` inert pops so a budget check has something to see. */
function floodPops(fx: FxSystem, count: number) {
  for (let i = 0; i < count; i++) {
    fx.pops.push({
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial()),
      age: 0,
      ttl: 99,
    });
  }
}

describe("FxSystem.spawnImpactSpark", () => {
  it("stays a single cheap blip when no surface normal is known", () => {
    const { ctx, fx } = harness();
    // The enemy-hit call site deliberately omits the normal: blood already
    // carries the direction cue, and this fires on every pellet of a shotgun.
    fx.spawnImpactSpark(new THREE.Vector3(1, 2, 3), 0xfff1b5);

    expect(fx.pops).toHaveLength(1);
    expect(ctx.scene.children).toHaveLength(1);
    expect(fx.pops[0]?.mesh.position.toArray()).toEqual([1, 2, 3]);
  });

  it("throws sparks off the face when the surface normal is supplied", () => {
    const { fx } = harness();
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(1, 0, 0));

    expect(fx.pops).toHaveLength(DIRECTED_POPS);
    // Every moving particle leaves along the normal, never into the wall.
    const moving = fx.pops.filter((p) => p.vel);
    expect(moving).toHaveLength(SPARKS + 1);
    for (const pop of moving) expect(pop.vel!.x).toBeGreaterThan(0);
  });

  it("builds its cone off a tangent basis, so a floor hit sprays sideways too", () => {
    const { fx } = harness();
    // Straight up is the pole case where a naive cross product collapses; the
    // seed axis swap is what keeps the spread from degenerating to a line.
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(0, 1, 0));

    const sparks = fx.pops.filter((p) => p.vel && p.growth === -0.6);
    expect(sparks).toHaveLength(SPARKS);
    const lateral = sparks.map((p) => Math.hypot(p.vel!.x, p.vel!.z));
    for (const spread of lateral) expect(spread).toBeGreaterThan(0);
    expect(Math.max(...lateral)).toBeGreaterThan(0.5);
  });

  it("normalises whatever normal it is handed rather than trusting the caller", () => {
    const { fx } = harness();
    // A raycast normal pushed through a scaled object's normal matrix is not
    // guaranteed unit-length, so the spread must not scale with its magnitude.
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(40, 0, 0));

    const dust = fx.pops.find((p) => p.peakOpacity === 0.3);
    expect(dust).toBeDefined();
    // Dust sits a fixed 5cm off the surface it came out of, not 2 metres.
    expect(dust!.mesh.position.x).toBeCloseTo(0.05, 6);
  });

  it("sits the dust just off the wall and keeps it dim and non-additive", () => {
    const { fx } = harness();
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(0, 0, 1));
    const dust = fx.pops.find((p) => p.peakOpacity === 0.3);

    expect(dust).toBeDefined();
    const mat = dust!.mesh.material as THREE.MeshBasicMaterial;
    // Knocked-loose material, not a spark: lit like smoke, never blown out.
    expect(mat.blending).toBe(THREE.NormalBlending);
    expect(mat.depthWrite).toBe(false);
    expect(dust!.mesh.position.z).toBeCloseTo(0.05, 6);
  });

  it("tapers its sparks instead of blooming them like embers", () => {
    const { fx } = harness();
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(1, 0, 0));
    const spark = fx.pops.find((p) => p.growth === -0.6);
    expect(spark).toBeDefined();

    fx.updateEffects(spark!.ttl * 0.5);
    // baseScale 1 + 0.5 * -0.6 — shrinking toward a streak end, never inverted.
    expect(spark!.mesh.scale.x).toBeCloseTo(0.7, 2);
    expect(spark!.mesh.scale.x).toBeGreaterThan(0);
  });

  it("retires everything it spawned without leaking a mesh", () => {
    const { ctx, fx } = harness();
    fx.spawnImpactSpark(new THREE.Vector3(), 0xffd9a0, new THREE.Vector3(0, 1, 0));

    for (let frame = 0; frame < 60; frame++) fx.updateEffects(1 / 60);

    expect(fx.pops).toHaveLength(0);
    expect(ctx.scene.children).toHaveLength(0);
  });
});

describe("FxSystem.spawnCasing", () => {
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);

  it("throws the case out to the shooter's right and up", () => {
    const { ctx, fx } = harness();
    fx.spawnCasing(new THREE.Vector3(0.3, 1.4, -0.2), right, up);

    expect(fx.pops).toHaveLength(1);
    expect(ctx.scene.children).toHaveLength(1);
    const pop = fx.pops[0]!;
    expect(pop.mesh.position.toArray()).toEqual([0.3, 1.4, -0.2]);
    expect(pop.vel!.x).toBeGreaterThan(0);
    expect(pop.vel!.y).toBeGreaterThan(0);
  });

  it("holds a constant size — the pump's default ramp would balloon it", () => {
    const { fx } = harness();
    fx.spawnCasing(new THREE.Vector3(), right, up);
    const pop = fx.pops[0]!;

    fx.updateEffects(0.4);
    // baseScale 1, growth 0: a 5cm shell stays a 5cm shell for its whole life.
    expect(pop.mesh.scale.x).toBeCloseTo(1, 6);
  });

  it("is lit metal rather than an additive spark, so the muzzle light glints", () => {
    const { fx } = harness();
    fx.spawnCasing(new THREE.Vector3(), right, up);
    const mat = fx.pops[0]!.mesh.material as THREE.MeshStandardMaterial;

    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.metalness).toBeGreaterThan(0.5);
  });

  it("tumbles and settles on the floor instead of sinking through it", () => {
    const { fx } = harness();
    fx.spawnCasing(new THREE.Vector3(0, 1.2, 0), right, up);
    const pop = fx.pops[0]!;
    expect(pop.spin).toBeDefined();
    const startRotation = pop.mesh.rotation.y;

    // Long enough for gravity to win and the ground bounce to clamp it.
    for (let frame = 0; frame < 40; frame++) fx.updateEffects(1 / 60);

    expect(pop.mesh.rotation.y).not.toBeCloseTo(startRotation, 3);
    expect(pop.mesh.position.y).toBeGreaterThanOrEqual(0.04);
  });

  it("scales the shell with the weapon that threw it", () => {
    const small = harness();
    small.fx.spawnCasing(new THREE.Vector3(), right, up, 1);
    const big = harness();
    big.fx.spawnCasing(new THREE.Vector3(), right, up, 2.5);

    const radiusOf = (fx: FxSystem) => (fx.pops[0]!.mesh.geometry as THREE.CylinderGeometry).parameters.radiusTop;
    expect(radiusOf(big.fx)).toBeCloseTo(radiusOf(small.fx) * 2.5, 6);
  });

  it("is the first thing dropped when the frame is already busy", () => {
    const { fx } = harness();
    floodPops(fx, CASING_BUDGET + 1);
    const before = fx.pops.length;

    fx.spawnCasing(new THREE.Vector3(), right, up);

    // Nobody misses brass mid-fight, and an SMG at full rate is exactly when
    // the pool is under pressure — so brass is skipped outright, not thinned.
    expect(fx.pops).toHaveLength(before);
  });

  it("still ejects while the pool is merely busy", () => {
    const { fx } = harness();
    floodPops(fx, CASING_BUDGET - 10);
    const before = fx.pops.length;

    fx.spawnCasing(new THREE.Vector3(), right, up);

    expect(fx.pops).toHaveLength(before + 1);
  });

  it("retires without leaking a mesh", () => {
    const { ctx, fx } = harness();
    fx.spawnCasing(new THREE.Vector3(), right, up);

    // ttl tops out at 1.3s.
    for (let frame = 0; frame < 90; frame++) fx.updateEffects(1 / 60);

    expect(fx.pops).toHaveLength(0);
    expect(ctx.scene.children).toHaveLength(0);
  });
});
