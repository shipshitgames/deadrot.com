// Issue #91 — ProjectileCombat seam: integrator (flight/TTL/bounds/obstacles/dispose) vs injected hit resolver.
// ProjectilesSystem statically imports spriteAssets (module-scope THREE.TextureLoader → document.createElementNS),
// so we shim that single DOM hook in beforeAll and dynamic-import the system, as in enemy-death-fx.test.ts.
import * as THREE from "three";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PROJECTILE_HIT_RADIUS, PROJECTILE_TTL, WALL_THICKNESS } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import type { Enemy, EnemyShot } from "../../src/game/entities/Enemy";
import type { ProjectileView } from "../../src/game/entities/ProjectileCombat";
import type { ProjectileMeta } from "../../src/game/entities/ProjectilesSystem";
import type { GameSystems } from "../../src/game/systems";

type ProjectilesModule = typeof import("../../src/game/entities/ProjectilesSystem");

let ProjectilesSystem: ProjectilesModule["ProjectilesSystem"];

beforeAll(async () => {
  if (typeof (globalThis as { document?: unknown }).document === "undefined") {
    // Minimal stand-in for THREE's ImageLoader: it only ever calls
    // document.createElementNS('...','img') and then add/removeEventListener +
    // sets crossOrigin/src on the returned element.
    (globalThis as { document?: unknown }).document = {
      createElementNS() {
        return {
          addEventListener() {},
          removeEventListener() {},
          set crossOrigin(_value: string) {},
          set src(_value: string) {},
        };
      },
    };
  }

  ProjectilesSystem = (await import("../../src/game/entities/ProjectilesSystem")).ProjectilesSystem;
});

function makeHarness(opts: { playerPos?: [number, number, number]; boxes?: THREE.Box3[] } = {}) {
  const scene = new THREE.Scene();
  const body = new THREE.Object3D();
  body.position.set(...(opts.playerPos ?? [0, 1.8, 0]));
  const damagePlayer = vi.fn();
  const containsXZ = vi.fn(() => true);
  const ctx = { scene, body, bounds: { containsXZ }, obstacleBoxes: opts.boxes ?? [] } as unknown as GameContext;
  const sys = { player: { damagePlayer } } as unknown as GameSystems;
  return { scene, body, damagePlayer, containsXZ, ctx, sys, system: new ProjectilesSystem(ctx, sys) };
}

function makeShot(overrides: Partial<EnemyShot> = {}): EnemyShot {
  return {
    origin: new THREE.Vector3(20, 1.8, 0),
    dir: new THREE.Vector3(0, 0, 1),
    damage: 8,
    speed: 0.001,
    fromBoss: false,
    ...overrides,
  };
}

describe("PlayerTargetCombat (default combat)", () => {
  it("a projectile inside PROJECTILE_HIT_RADIUS is consumed: removed from the array/scene, material disposed, damagePlayer called once with its damage", () => {
    const h = makeHarness();
    h.system.spawnProjectile(makeShot({ origin: h.body.position.clone() }));
    const dispose = vi.spyOn(h.system.projectiles[0].mesh.material, "dispose");
    h.system.updateProjectiles(0.016);
    expect(h.damagePlayer).toHaveBeenCalledTimes(1);
    expect(h.damagePlayer).toHaveBeenCalledWith(8);
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.scene.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("a projectile outside the radius is not consumed and keeps flying", () => {
    const h = makeHarness();
    h.system.spawnProjectile(makeShot());
    h.system.updateProjectiles(0.016);
    expect(h.system.projectiles).toHaveLength(1);
    expect(h.scene.children).toHaveLength(1);
    expect(h.damagePlayer).not.toHaveBeenCalled();
  });

  it("the hit test is full 3D distance to ctx.body.position, not XZ", () => {
    // Both spawns share the player's XZ; only the y offset decides the hit.
    expect(1.2).toBeGreaterThan(PROJECTILE_HIT_RADIUS);
    expect(0.5).toBeLessThan(PROJECTILE_HIT_RADIUS);

    const miss = makeHarness();
    miss.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(0, 1.8 + 1.2, 0) }));
    miss.system.updateProjectiles(0.016);
    expect(miss.damagePlayer).not.toHaveBeenCalled();
    expect(miss.system.projectiles).toHaveLength(1);

    const hit = makeHarness();
    hit.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(0, 1.8 + 0.5, 0) }));
    hit.system.updateProjectiles(0.016);
    expect(hit.damagePlayer).toHaveBeenCalledTimes(1);
    expect(hit.system.projectiles).toHaveLength(0);
  });

  it("two hits in one frame damage once per projectile (no batching)", () => {
    const h = makeHarness();
    h.system.spawnProjectile(makeShot({ origin: h.body.position.clone() }));
    h.system.spawnProjectile(makeShot({ origin: h.body.position.clone(), damage: 5 }));
    h.system.updateProjectiles(0.016);
    expect(h.damagePlayer).toHaveBeenCalledTimes(2);
    expect(h.damagePlayer).toHaveBeenCalledWith(8);
    expect(h.damagePlayer).toHaveBeenCalledWith(5);
    expect(h.system.projectiles).toHaveLength(0);
  });

  it("a hit wins over simultaneous TTL expiry", () => {
    const h = makeHarness();
    h.system.spawnProjectile(makeShot({ origin: h.body.position.clone() }));
    h.system.updateProjectiles(PROJECTILE_TTL + 1);
    expect(h.damagePlayer).toHaveBeenCalledTimes(1);
    expect(h.system.projectiles).toHaveLength(0);
  });

  it("a hit inside an obstacle's inflation zone still damages the player", () => {
    const box = new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 3, 2));
    const h = makeHarness({ boxes: [box] });
    h.system.spawnProjectile(makeShot({ origin: h.body.position.clone() }));
    h.system.updateProjectiles(0.016);
    expect(h.damagePlayer).toHaveBeenCalledTimes(1);
    expect(h.system.projectiles).toHaveLength(0);
  });

  it("TTL expiry, out-of-bounds, and floor removals never damage", () => {
    const ttl = makeHarness();
    ttl.system.spawnProjectile(makeShot());
    const ttlDispose = vi.spyOn(ttl.system.projectiles[0].mesh.material, "dispose");
    ttl.system.updateProjectiles(PROJECTILE_TTL + 1);
    expect(ttl.system.projectiles).toHaveLength(0);
    expect(ttl.damagePlayer).not.toHaveBeenCalled();
    expect(ttlDispose).toHaveBeenCalledTimes(1);

    const oob = makeHarness();
    oob.containsXZ.mockReturnValue(false);
    oob.system.spawnProjectile(makeShot());
    const oobDispose = vi.spyOn(oob.system.projectiles[0].mesh.material, "dispose");
    oob.system.updateProjectiles(0.016);
    expect(oob.system.projectiles).toHaveLength(0);
    expect(oob.damagePlayer).not.toHaveBeenCalled();
    expect(oobDispose).toHaveBeenCalledTimes(1);
    expect(oob.containsXZ.mock.calls[0][2]).toBe(WALL_THICKNESS / 2);

    const floor = makeHarness();
    floor.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(20, 0.04, 0) }));
    const floorDispose = vi.spyOn(floor.system.projectiles[0].mesh.material, "dispose");
    floor.system.updateProjectiles(0.016);
    expect(floor.system.projectiles).toHaveLength(0);
    expect(floor.damagePlayer).not.toHaveBeenCalled();
    expect(floorDispose).toHaveBeenCalledTimes(1);
  });

  it("an obstacle block removes the projectile without damage", () => {
    const box = new THREE.Box3(new THREE.Vector3(19, 0, -1), new THREE.Vector3(21, 3, 1));
    const h = makeHarness({ boxes: [box] });
    h.system.spawnProjectile(makeShot());
    h.system.updateProjectiles(0.016);
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.scene.children).toHaveLength(0);
    expect(h.damagePlayer).not.toHaveBeenCalled();
  });
});

describe("injected combat (seam)", () => {
  it("a consuming fake combat removes + disposes the projectile and bypasses the default resolver", () => {
    const h = makeHarness();
    h.damagePlayer.mockImplementation(() => {
      throw new Error("default resolver must be bypassed");
    });
    h.system.combat = { resolveHit: () => true };
    h.system.spawnProjectile(makeShot());
    const dispose = vi.spyOn(h.system.projectiles[0].mesh.material, "dispose");
    h.system.updateProjectiles(0.016);
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.scene.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("consuming every projectile in one frame removes all of them", () => {
    const h = makeHarness();
    h.system.combat = { resolveHit: () => true };
    h.system.spawnProjectile(makeShot());
    h.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(-20, 1.8, 0) }));
    h.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(0, 1.8, 20) }));
    h.system.updateProjectiles(0.016);
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.scene.children).toHaveLength(0);
  });

  it("a declining fake combat leaves flight and TTL to the integrator", () => {
    const h = makeHarness();
    const resolveHit = vi.fn(() => false);
    h.system.combat = { resolveHit };
    h.system.spawnProjectile(makeShot());
    const view = h.system.projectiles[0].view;
    h.system.updateProjectiles(0.016);
    expect(resolveHit).toHaveBeenCalledTimes(1);
    expect(resolveHit).toHaveBeenCalledWith(view);
    expect(h.system.projectiles).toHaveLength(1);
    h.system.updateProjectiles(PROJECTILE_TTL + 1);
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.damagePlayer).not.toHaveBeenCalled();
  });

  it("the view carries damage, live position, and opaque meta (owner + fromBoss) to the resolver", () => {
    const h = makeHarness();
    const seen: ProjectileView[] = [];
    h.system.combat = {
      resolveHit: (view) => {
        seen.push(view);
        return false;
      },
    };
    const enemyA = {} as Enemy;
    h.system.spawnProjectile(makeShot({ origin: new THREE.Vector3(0, 1.8, 0), speed: 10, fromBoss: true }), enemyA);
    h.system.updateProjectiles(0.5);
    expect(seen).toHaveLength(1);
    const view = seen[0];
    expect(view.damage).toBe(8);
    const meta = view.meta as ProjectileMeta;
    expect(meta).toEqual({ owner: enemyA, fromBoss: true });
    expect(meta.owner).toBe(enemyA);
    // Live alias: the very vector the integrator moves, already integrated (z = 10 * 0.5).
    expect(view.position).toBe(h.system.projectiles[0].mesh.position);
    expect(view.position.z).toBeCloseTo(5);
  });
});

describe("integrator lifecycle (unchanged)", () => {
  it("removeProjectilesFrom despawns only that owner's projectiles", () => {
    const h = makeHarness();
    const ownerA = {} as Enemy;
    const ownerB = {} as Enemy;
    h.system.spawnProjectile(makeShot(), ownerA);
    h.system.spawnProjectile(makeShot(), ownerB);
    h.system.spawnProjectile(makeShot(), ownerA);
    const disposes = h.system.projectiles.map((pr) => vi.spyOn(pr.mesh.material, "dispose"));
    h.system.removeProjectilesFrom(ownerA);
    expect(h.system.projectiles).toHaveLength(1);
    expect(h.system.projectiles[0].owner).toBe(ownerB);
    expect(h.scene.children).toHaveLength(1);
    expect(disposes[0]).toHaveBeenCalledTimes(1);
    expect(disposes[1]).not.toHaveBeenCalled();
    expect(disposes[2]).toHaveBeenCalledTimes(1);
  });

  it("clearProjectiles empties the array and disposes every material but never the shared texture", () => {
    const h = makeHarness();
    h.system.spawnProjectile(makeShot());
    h.system.spawnProjectile(makeShot());
    const materials = h.system.projectiles.map((pr) => pr.mesh.material);
    const materialDisposes = materials.map((material) => vi.spyOn(material, "dispose"));
    const texture = materials[0].map as THREE.Texture; // shared PROJECTILE_SPRITE_TEXTURES.enemy
    const textureDispose = vi.spyOn(texture, "dispose");
    h.system.clearProjectiles();
    expect(h.system.projectiles).toHaveLength(0);
    expect(h.scene.children).toHaveLength(0);
    for (const dispose of materialDisposes) expect(dispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).not.toHaveBeenCalled();
    textureDispose.mockRestore();
  });
});
