import * as THREE from "three";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * HUD cleanup + death FX (#23). The integrity/shield math lives in HUD.tsx (JSX),
 * so this file instead locks down the death-animation/gib sprite data that #124
 * authored and we wired into the runtime catalog, plus the pure death-FX
 * selection on the Enemy entity.
 *
 * The sprite module must remain safe to import in node and at the title menu.
 * Combat preload is explicit; TextureLoader is stubbed only for that boundary.
 */

type SpriteAssetsModule = typeof import("../../src/game/spriteAssets");
type EnemyModule = typeof import("../../src/game/entities/Enemy");

const ENEMY_SPRITE_KINDS = ["melee", "ranged", "flying", "hound", "boss"] as const;
const SPRITE_VIEWS = ["front", "side", "back"] as const;
const ANIMATION_STATES = ["move", "attack", "death"] as const;
const EXPECTED_GIB_IDS = [
  "gib-meat-chunk",
  "gib-skull-shard",
  "gib-bone-blade",
  "gib-claw-limb",
  "gib-acid-sac",
  "gib-wing-membrane",
] as const;
// The animation pack authors 6 frames per action (animation-pack.json framesPerAction).
const FRAMES_PER_ACTION = 6;

let spriteAssets: SpriteAssetsModule;
let Enemy: EnemyModule["Enemy"];
let textureLoadCalls = 0;

beforeAll(async () => {
  vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async (url) => {
    textureLoadCalls++;
    const texture = new THREE.Texture();
    texture.name = String(url);
    return texture;
  });

  spriteAssets = await import("../../src/game/spriteAssets");
  expect(textureLoadCalls, "import must not instantiate/load THREE textures").toBe(0);
  await spriteAssets.preloadCombatAssets();
  Enemy = (await import("../../src/game/entities/Enemy")).Enemy;
});

describe("enemy death animation textures (#23 death FX)", () => {
  it("exposes every enemy kind with move/attack/death animation states", () => {
    const { ENEMY_SPRITE_ANIMATION_TEXTURES } = spriteAssets;
    expect(Object.keys(ENEMY_SPRITE_ANIMATION_TEXTURES).sort()).toEqual([...ENEMY_SPRITE_KINDS].sort());

    for (const kind of ENEMY_SPRITE_KINDS) {
      const states = ENEMY_SPRITE_ANIMATION_TEXTURES[kind];
      expect(Object.keys(states).sort(), kind).toEqual([...ANIMATION_STATES].sort());
    }
  });

  it("gives every enemy kind a death state with a full frame strip per view", () => {
    const { ENEMY_SPRITE_ANIMATION_TEXTURES } = spriteAssets;

    for (const kind of ENEMY_SPRITE_KINDS) {
      const death = ENEMY_SPRITE_ANIMATION_TEXTURES[kind].death;
      expect(Object.keys(death).sort(), `${kind} death views`).toEqual([...SPRITE_VIEWS].sort());

      for (const view of SPRITE_VIEWS) {
        const frames = death[view];
        expect(Array.isArray(frames), `${kind}/${view} death frames is array`).toBe(true);
        expect(frames.length, `${kind}/${view} death frame count`).toBe(FRAMES_PER_ACTION);
        for (const [frame, texture] of frames.entries()) {
          // Each frame is a real THREE.Texture instance with the catalog's
          // per-entity manifest filter applied at load time.
          expect(texture, `${kind}/${view} death frame ${frame}`).toBeTruthy();
          expect(texture.isTexture, `${kind}/${view} death frame ${frame} is THREE.Texture`).toBe(true);
        }
      }
    }
  });

  it("samples one shared atlas source with stable per-frame debug metadata", () => {
    const { ENEMY_SPRITE_ANIMATION_TEXTURES } = spriteAssets;
    const allFrames = ENEMY_SPRITE_KINDS.flatMap((kind) =>
      ANIMATION_STATES.flatMap((state) =>
        SPRITE_VIEWS.flatMap((view) => ENEMY_SPRITE_ANIMATION_TEXTURES[kind][state][view]),
      ),
    );
    expect(new Set(allFrames.map((texture) => texture.source)).size).toBe(1);

    const first = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.move.front[0];
    const last = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.move.front[FRAMES_PER_ACTION - 1];
    expect(first.source).toBe(last.source);
    expect(first.userData.scourgeAnimation).toEqual({
      entity: "host-grunt",
      action: "walk",
      view: "front",
      frame: 0,
      source: "atlas",
    });
    expect(last.userData.scourgeAnimation.frame).toBe(FRAMES_PER_ACTION - 1);
    expect(first.repeat.x).toBeLessThan(1);
    expect(first.repeat.y).toBeLessThan(1);
  });

  it("keeps rank-and-file atlas frames crisp while smoothing the comic Breach-Boss", () => {
    const { ENEMY_SPRITE_ANIMATION_TEXTURES } = spriteAssets;
    const grunt = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.move.front[0];
    const boss = ENEMY_SPRITE_ANIMATION_TEXTURES.boss.move.front[0];

    expect(grunt.minFilter).toBe(THREE.NearestFilter);
    expect(grunt.magFilter).toBe(THREE.NearestFilter);
    expect(boss.minFilter).toBe(THREE.LinearFilter);
    expect(boss.magFilter).toBe(THREE.LinearFilter);
    expect(boss.source).toBe(grunt.source);
  });

  it("caches the completed combat preload", async () => {
    const callsAfterFirstPreload = textureLoadCalls;
    await Promise.all([spriteAssets.preloadCombatAssets(), spriteAssets.preloadCombatAssets()]);
    expect(textureLoadCalls).toBe(callsAfterFirstPreload);
  });
});

describe("enemy death animation meta (#23 death FX)", () => {
  it("describes a death clip for every kind with fps/loop/frameCount", () => {
    const { ENEMY_SPRITE_ANIMATION_META } = spriteAssets;
    expect(Object.keys(ENEMY_SPRITE_ANIMATION_META).sort()).toEqual([...ENEMY_SPRITE_KINDS].sort());

    for (const kind of ENEMY_SPRITE_KINDS) {
      const death = ENEMY_SPRITE_ANIMATION_META[kind].death;
      expect(death, `${kind} death meta`).toMatchObject({
        fps: expect.any(Number),
        loop: expect.any(Boolean),
        frameCount: expect.any(Number),
      });
      expect(death.fps, `${kind} death fps`).toBeGreaterThan(0);
      expect(death.frameCount, `${kind} death frameCount`).toBe(FRAMES_PER_ACTION);
    }
  });

  it("keeps the death clip frameCount in lockstep with the actual frame textures", () => {
    const { ENEMY_SPRITE_ANIMATION_META, ENEMY_SPRITE_ANIMATION_TEXTURES } = spriteAssets;

    for (const kind of ENEMY_SPRITE_KINDS) {
      const meta = ENEMY_SPRITE_ANIMATION_META[kind].death;
      for (const view of SPRITE_VIEWS) {
        expect(
          ENEMY_SPRITE_ANIMATION_TEXTURES[kind].death[view].length,
          `${kind}/${view} death strip length matches meta.frameCount`,
        ).toBe(meta.frameCount);
      }
    }
  });

  it("treats every kind's death clip as a one-shot (non-looping) animation", () => {
    const { ENEMY_SPRITE_ANIMATION_META } = spriteAssets;
    // A death animation that looped would never settle on a corpse frame; the
    // runtime clamps to the final frame, which only reads correctly when loop is
    // false. Guard that intent here.
    for (const kind of ENEMY_SPRITE_KINDS) {
      expect(ENEMY_SPRITE_ANIMATION_META[kind].death.loop, `${kind} death loop`).toBe(false);
    }
  });
});

describe("corpse gib sprites (#23 death FX)", () => {
  it("ships exactly the six authored gib ids", () => {
    const { CORPSE_PART_SPRITES } = spriteAssets;
    expect(CORPSE_PART_SPRITES).toHaveLength(EXPECTED_GIB_IDS.length);
    expect(CORPSE_PART_SPRITES.map((part) => part.id)).toEqual([...EXPECTED_GIB_IDS]);
    // No duplicate gib ids slipped into the catalog.
    expect(new Set(CORPSE_PART_SPRITES.map((part) => part.id)).size).toBe(EXPECTED_GIB_IDS.length);
  });

  it("gives each gib a real texture and a positive 2D scale", () => {
    const { CORPSE_PART_SPRITES } = spriteAssets;

    for (const part of CORPSE_PART_SPRITES) {
      expect(part.texture, `${part.id} texture`).toBeTruthy();
      expect(part.texture.isTexture, `${part.id} texture is THREE.Texture`).toBe(true);

      expect(part.scale, `${part.id} scale`).toHaveLength(2);
      const [width, height] = part.scale;
      expect(width, `${part.id} scale width`).toBeGreaterThan(0);
      expect(height, `${part.id} scale height`).toBeGreaterThan(0);
    }
  });
});

describe("Enemy.deathFx() selection (#23 death FX)", () => {
  function spawnKind(cfg: Parameters<InstanceType<EnemyModule["Enemy"]>["spawnAt"]>[2]) {
    const enemy = new Enemy();
    enemy.spawnAt(0, 0, cfg);
    return enemy;
  }

  it("reports the boss sprite kind for boss spawns", () => {
    const boss = spawnKind({ isBoss: true, scale: 2.6 });
    const fx = boss.deathFx();
    expect(fx.kind).toBe("boss");
    expect(boss.radius).toBeCloseTo(2.574);
    expect(spawnKind({ isBoss: true, scale: 4.2 }).radius).toBe(3);
  });

  it("reports flying before ranged before melee", () => {
    // A boss takes priority over every flag.
    expect(spawnKind({ isBoss: true, flying: true, ranged: true }).deathFx().kind).toBe("boss");
    // Flying outranks ranged for a non-boss.
    expect(spawnKind({ flying: true, ranged: true }).deathFx().kind).toBe("flying");
    // Ranged when not flying.
    expect(spawnKind({ ranged: true }).deathFx().kind).toBe("ranged");
    // Plain grunt falls through to melee.
    expect(spawnKind({}).deathFx().kind).toBe("melee");
  });

  it("returns a death-FX descriptor whose kind is a real animated sprite kind", () => {
    const { ENEMY_SPRITE_ANIMATION_META } = spriteAssets;
    const fx = spawnKind({}).deathFx();

    // The selected kind must have a death clip to play; this ties the entity's
    // death-FX selection back to the sprite catalog the FX consumes.
    expect(ENEMY_SPRITE_KINDS).toContain(fx.kind);
    expect(ENEMY_SPRITE_ANIMATION_META[fx.kind].death.frameCount).toBe(FRAMES_PER_ACTION);
    expect(SPRITE_VIEWS).toContain(fx.view);
    expect(typeof fx.flip).toBe("number");
  });
});
