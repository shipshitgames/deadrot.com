// Regression coverage for the live chain:
// resolveHit -> damagePlayer -> onPlayerDamaged (retaliate) -> onEnemyDeath
// -> sys.projectiles.removeProjectilesFrom(owner), re-entrant during updateProjectiles.
import * as THREE from "three";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { GameContext } from "../../src/game/context";
import type { Enemy, EnemyShot } from "../../src/game/entities/Enemy";
import type { GameSystems } from "../../src/game/systems";

type ProjectilesModule = typeof import("../../src/game/entities/ProjectilesSystem");
let ProjectilesSystem: ProjectilesModule["ProjectilesSystem"];

beforeAll(async () => {
  if (typeof (globalThis as { document?: unknown }).document === "undefined") {
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

function makeShot(overrides: Partial<EnemyShot> = {}): EnemyShot {
  return {
    origin: new THREE.Vector3(0, 1.8, 0), // on the player => immediate hit
    dir: new THREE.Vector3(0, 0, 1),
    damage: 8,
    speed: 0.001,
    fromBoss: false,
    ...overrides,
  };
}

describe("re-entrant removeProjectilesFrom during resolveHit", () => {
  it("single projectile: damagePlayer killing the shooter (retaliate) does not crash the frame", () => {
    const scene = new THREE.Scene();
    const body = new THREE.Object3D();
    body.position.set(0, 1.8, 0);
    const ctx = {
      scene,
      body,
      bounds: { containsXZ: () => true },
      obstacleBoxes: [],
    } as unknown as GameContext;
    const shooter = {} as Enemy;
    // damagePlayer does what the live path does: retaliate kills the shooter,
    // onEnemyDeath fizzles the dead mob's in-flight projectiles.
    const sys = {
      player: {
        damagePlayer: () => {
          system.removeProjectilesFrom(shooter); // PveDirectorSystem.ts:172
        },
      },
    } as unknown as GameSystems;
    const system = new ProjectilesSystem(ctx, sys);
    system.spawnProjectile(makeShot(), shooter); // PveDirectorSystem.ts:314
    expect(() => system.updateProjectiles(0.016)).not.toThrow();
  });

  it("two projectiles: re-entrant removal preserves an unrelated live projectile", () => {
    const scene = new THREE.Scene();
    const body = new THREE.Object3D();
    body.position.set(0, 1.8, 0);
    const ctx = {
      scene,
      body,
      bounds: { containsXZ: () => true },
      obstacleBoxes: [],
    } as unknown as GameContext;
    const shooter = {} as Enemy;
    const bystander = {} as Enemy;
    const sys = {
      player: {
        damagePlayer: () => {
          system.removeProjectilesFrom(shooter);
        },
      },
    } as unknown as GameSystems;
    const system = new ProjectilesSystem(ctx, sys);
    // index 0: bystander's projectile far away (no hit, plenty of TTL)
    system.spawnProjectile(makeShot({ origin: new THREE.Vector3(40, 1.8, 0) }), bystander);
    // index 1: shooter's projectile on the player (hit). Reverse loop visits it first at i=1.
    system.spawnProjectile(makeShot(), shooter);
    const bystanderDispose = vi.spyOn(system.projectiles[0].mesh.material, "dispose");
    system.updateProjectiles(0.016);
    // The bystander's far-away projectile should still be flying — is it?
    expect(system.projectiles).toHaveLength(1);
    expect(system.projectiles[0]?.owner).toBe(bystander);
    expect(bystanderDispose).not.toHaveBeenCalled();
  });
});
