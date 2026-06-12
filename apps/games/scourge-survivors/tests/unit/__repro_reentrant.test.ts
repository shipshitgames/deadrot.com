// Scratch repro for the claimed reentrant-removal bug. DO NOT COMMIT.
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
    origin: new THREE.Vector3(0, 1.8, 0),
    dir: new THREE.Vector3(0, 0, 1),
    damage: 8,
    speed: 0.001,
    fromBoss: false,
    ...overrides,
  };
}

describe("reentrant removal via damagePlayer (simulated retaliate kill of the owner)", () => {
  it("single projectile: removeProjectile(i) after reentrant splice", () => {
    const scene = new THREE.Scene();
    const body = new THREE.Object3D();
    body.position.set(0, 1.8, 0);
    const owner = {} as Enemy;
    const ctx = {
      scene,
      body,
      bounds: { containsXZ: () => true },
      obstacleBoxes: [],
    } as unknown as GameContext;
    // damagePlayer reenters exactly like the real chain:
    // damagePlayer -> survivors.onPlayerDamaged -> retaliate kill -> pve.onEnemyDeath
    // -> projectiles.removeProjectilesFrom(owner)
    const sys = {
      player: {
        damagePlayer: vi.fn(() => {
          system.removeProjectilesFrom(owner);
        }),
      },
    } as unknown as GameSystems;
    const system = new ProjectilesSystem(ctx, sys);
    system.spawnProjectile(makeShot(), owner); // spawned at the player -> immediate hit
    expect(() => system.updateProjectiles(0.016)).not.toThrow();
  });

  it("several projectiles: wrong projectile removed after reentrant splice", () => {
    const scene = new THREE.Scene();
    const body = new THREE.Object3D();
    body.position.set(0, 1.8, 0);
    const ownerA = {} as Enemy; // shoots the hitting projectile
    const ownerB = {} as Enemy; // innocent bystander projectile
    const ctx = {
      scene,
      body,
      bounds: { containsXZ: () => true },
      obstacleBoxes: [],
    } as unknown as GameContext;
    const sys = {
      player: {
        damagePlayer: vi.fn(() => {
          system.removeProjectilesFrom(ownerA);
        }),
      },
    } as unknown as GameSystems;
    const system = new ProjectilesSystem(ctx, sys);
    // index 0: ownerA's projectile AT the player (will hit, processed last in the backwards loop)
    system.spawnProjectile(makeShot(), ownerA);
    // index 1: ownerB's projectile far away (should keep flying)
    system.spawnProjectile(makeShot({ origin: new THREE.Vector3(50, 1.8, 0) }), ownerB);
    system.updateProjectiles(0.016);
    // ownerB's projectile must survive the frame
    expect(system.projectiles).toHaveLength(1);
    expect(system.projectiles[0]?.owner).toBe(ownerB);
  });
});
