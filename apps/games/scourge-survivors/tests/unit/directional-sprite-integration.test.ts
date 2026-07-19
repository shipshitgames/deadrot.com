import { RectBounds, type SteeringStrategy } from "@shipshitgames/engine";
import * as THREE from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Enemy as EnemyType } from "../../src/game/entities/Enemy";

vi.mock("../../src/game/spriteAssets", async () => {
  const { Texture } = await import("three");
  const texture = (name: string) => {
    const value = new Texture();
    value.name = name;
    return value;
  };
  const views = (prefix: string) => ({
    front: texture(`${prefix}-front`),
    side: texture(`${prefix}-side`),
    back: texture(`${prefix}-back`),
  });
  const animationViews = (prefix: string, state: string) => ({
    front: [texture(`${prefix}-${state}-front`)],
    side: [texture(`${prefix}-${state}-side`)],
    back: [texture(`${prefix}-${state}-back`)],
  });
  const animations = (prefix: string) => ({
    move: animationViews(prefix, "move"),
    attack: animationViews(prefix, "attack"),
    death: animationViews(prefix, "death"),
  });
  const animationMeta = () => ({
    move: { fps: 8, loop: true, frameCount: 1 },
    attack: { fps: 8, loop: true, frameCount: 1 },
    death: { fps: 8, loop: false, frameCount: 1 },
  });
  const scales = () => ({
    front: [1, 2] as [number, number],
    side: [1.2, 2] as [number, number],
    back: [1, 2] as [number, number],
  });

  return {
    ENEMY_SPRITE_TEXTURES: {
      melee: views("enemy-melee"),
      ranged: views("enemy-ranged"),
      flying: views("enemy-flying"),
      hound: views("enemy-hound"),
      boss: views("enemy-boss"),
    },
    ENEMY_SPRITE_ANIMATION_TEXTURES: {
      melee: animations("enemy-melee"),
      ranged: animations("enemy-ranged"),
      flying: animations("enemy-flying"),
      hound: animations("enemy-hound"),
      boss: animations("enemy-boss"),
    },
    ENEMY_SPRITE_ANIMATION_META: {
      melee: animationMeta(),
      ranged: animationMeta(),
      flying: animationMeta(),
      hound: animationMeta(),
      boss: animationMeta(),
    },
    ENEMY_SPRITE_SCALES: {
      melee: scales(),
      ranged: scales(),
      flying: scales(),
      hound: scales(),
      boss: scales(),
    },
    PLAYER_AVATAR_SPRITES: {
      ranger: views("player-ranger"),
      heavy: views("player-heavy"),
      scout: views("player-scout"),
      medic: views("player-medic"),
    },
    PLAYER_AVATAR_SCALES: {
      ranger: scales(),
      heavy: scales(),
      scout: scales(),
      medic: scales(),
    },
  };
});

type EnemyModule = typeof import("../../src/game/entities/Enemy");
type RemoteAvatarModule = typeof import("../../src/net/RemoteAvatar");

let Enemy: EnemyModule["Enemy"];
let RemoteAvatar: RemoteAvatarModule["RemoteAvatar"];

beforeAll(async () => {
  const context = {
    clearRect: vi.fn(),
    fillText: vi.fn(),
    measureText: (value: string) => ({ width: value.length * 10 }),
    strokeText: vi.fn(),
    fillStyle: "",
    font: "",
    lineWidth: 0,
    strokeStyle: "",
    textAlign: "center",
    textBaseline: "middle",
  };
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => context,
    }),
    fonts: { ready: Promise.resolve() },
  });

  Enemy = (await import("../../src/game/entities/Enemy")).Enemy;
  RemoteAvatar = (await import("../../src/net/RemoteAvatar")).RemoteAvatar;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("directional sprite runtime integration", () => {
  it("changes enemy movement and attack art without changing raycast targets", () => {
    const enemy = new Enemy();
    enemy.spawnAt(0, 0, { speed: 4 });
    const internals = enemy as unknown as {
      sprite: THREE.Sprite;
      spriteMat: THREE.SpriteMaterial;
      spriteAnimationState: string;
      steering: SteeringStrategy<EnemyType>;
    };
    const hitMeshes = [...enemy.hitMeshes];
    const hitGeometry = hitMeshes.map((mesh) => mesh.geometry);
    const hitScales = hitMeshes.map((mesh) => mesh.scale.clone());
    const bounds = RectBounds.square(50);
    const cameraQuat = new THREE.Quaternion();
    const player = new THREE.Vector3(0, 0, 10);

    internals.steering = {
      desiredVelocity: (_enemy, _target, move) => {
        move.x += 4;
      },
    };
    enemy.update(1 / 60, 1, player, [], cameraQuat, bounds);

    expect(internals.spriteMat.map?.name).toBe("enemy-melee-move-side");
    expect(internals.sprite.scale.x).toBeLessThan(0);

    internals.steering = {
      desiredVelocity: (_enemy, _target, move) => {
        move.x -= 4;
      },
    };
    enemy.update(1 / 60, 2, player, [], cameraQuat, bounds);

    expect(internals.spriteMat.map?.name).toBe("enemy-melee-move-side");
    expect(internals.sprite.scale.x).toBeGreaterThan(0);

    internals.steering = { desiredVelocity: () => {} };
    enemy.group.position.set(0, 0, 0);
    const closePlayer = new THREE.Vector3(0, 0, 1);
    enemy.update(2, 3, closePlayer, [], cameraQuat, bounds);
    enemy.update(1 / 60, 4, closePlayer, [], cameraQuat, bounds);

    expect(internals.spriteAnimationState).toBe("attack");
    expect(internals.spriteMat.map?.name).toBe("enemy-melee-attack-front");
    expect(enemy.hitMeshes).toHaveLength(hitMeshes.length);
    expect(enemy.hitMeshes).not.toContain(internals.sprite);
    for (const [index, mesh] of enemy.hitMeshes.entries()) {
      expect(mesh).toBe(hitMeshes[index]);
      expect(mesh.geometry).toBe(hitGeometry[index]);
      expect(mesh.scale.toArray()).toEqual(hitScales[index].toArray());
      expect(mesh.userData.enemy).toBe(enemy);
      expect(["body", "head"]).toContain(mesh.userData.part);
    }
  });

  it("selects remote-player frames from camera-relative yaw while hitboxes stay independent", () => {
    const avatar = new RemoteAvatar({
      id: "peer-1",
      name: "Vector",
      avatar: "scout",
      slot: 2,
      x: 0,
      y: 1.8,
      z: 0,
      yaw: 0,
      health: 100,
      kills: 0,
    });
    const internals = avatar as unknown as {
      sprite: THREE.Sprite;
      spriteMat: THREE.SpriteMaterial;
    };
    const hitMeshes = [...avatar.hitMeshes];
    const hitGeometry = hitMeshes.map((mesh) => mesh.geometry);
    const hitScales = hitMeshes.map((mesh) => mesh.scale.clone());
    const cameraQuat = new THREE.Quaternion();

    avatar.update(1 / 60, cameraQuat, new THREE.Vector3(0, 0, -10));
    expect(internals.spriteMat.map?.name).toBe("player-scout-front");

    avatar.update(1 / 60, cameraQuat, new THREE.Vector3(10, 0, 0));
    expect(internals.spriteMat.map?.name).toBe("player-scout-side");
    expect(internals.sprite.scale.x).toBeGreaterThan(0);

    avatar.update(1 / 60, cameraQuat, new THREE.Vector3(-10, 0, 0));
    expect(internals.spriteMat.map?.name).toBe("player-scout-side");
    expect(internals.sprite.scale.x).toBeLessThan(0);

    avatar.update(1 / 60, cameraQuat, new THREE.Vector3(0, 0, 10));
    expect(internals.spriteMat.map?.name).toBe("player-scout-back");
    expect(avatar.hitMeshes).toHaveLength(hitMeshes.length);
    expect(avatar.hitMeshes).not.toContain(internals.sprite);
    for (const [index, mesh] of avatar.hitMeshes.entries()) {
      expect(mesh).toBe(hitMeshes[index]);
      expect(mesh.geometry).toBe(hitGeometry[index]);
      expect(mesh.scale.toArray()).toEqual(hitScales[index].toArray());
      expect(mesh.userData.remoteId).toBe("peer-1");
      expect(["body", "head"]).toContain(mesh.userData.part);
    }

    avatar.dispose();
  });
});
