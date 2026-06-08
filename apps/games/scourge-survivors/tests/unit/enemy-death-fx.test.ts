import { beforeAll, describe, expect, it } from "vitest";

/**
 * HUD cleanup + death FX (#23). The integrity/shield math lives in HUD.tsx (JSX),
 * so this file instead locks down the death-animation/gib sprite data that #124
 * authored and we wired into the runtime catalog, plus the pure death-FX
 * selection on the Enemy entity.
 *
 * Loading these modules eagerly constructs THREE textures via
 * `THREE.TextureLoader().load(...)`, which calls `document.createElementNS`.
 * vitest runs in node here (no jsdom/happy-dom installed in this workspace), so
 * we stub the single DOM hook THREE's ImageLoader needs, then dynamic-import the
 * modules under test. This keeps us from modifying any source or vitest config.
 */

type SpriteAssetsModule = typeof import("../../src/game/spriteAssets");
type EnemyModule = typeof import("../../src/game/entities/Enemy");

const ENEMY_SPRITE_KINDS = ["melee", "ranged", "flying", "boss"] as const;
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

  spriteAssets = await import("../../src/game/spriteAssets");
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
          // nearest-filter pixel-art config applied at load time.
          expect(texture, `${kind}/${view} death frame ${frame}`).toBeTruthy();
          expect(texture.isTexture, `${kind}/${view} death frame ${frame} is THREE.Texture`).toBe(true);
        }
      }
    }
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
    const fx = spawnKind({ isBoss: true }).deathFx();
    expect(fx.kind).toBe("boss");
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
