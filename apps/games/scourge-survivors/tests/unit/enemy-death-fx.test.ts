import { RectBounds } from "@shipshitgames/engine";
import * as THREE from "three";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { GameContext } from "../../src/game/context";
import type { EnemyDeathSnapshot } from "../../src/game/entities/Enemy";
import { CORPSE_PART_IDS_BY_ENEMY_KIND, FxSystem } from "../../src/game/entities/FxSystem";
import type { GameSystems } from "../../src/game/systems";

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
// Living enemies are articulated rigs, so `death` is the only sprite animation
// state the combat preload pulls (see spriteAssets ENEMY_ANIMATION_STATES).
const ANIMATION_STATES = ["death"] as const;
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
/** Mirrors CORPSE_BODY_* and DEATH_SPRITE_FADE_SECONDS in FxSystem. */
const CORPSE_SETTLE = 0.85;
const CORPSE_LINGER = 5.5;
const CORPSE_FADE = 1.1;
const CORPSE_TTL = CORPSE_SETTLE + CORPSE_LINGER + CORPSE_FADE;
const CORPSE_SOFT_CAP = 8;
const CORPSE_HARD_CAP = 12;
const DEATH_SPRITE_FADE = 0.12;
/** writeDeath's end-of-clip root tilt (enemyAnimation.ts): the hound face-plants
 *  shallower than a biped, so the corpse pose must be kind-aware. */
const DEATH_ROOT_TILT = { biped: 1.34, hound: 0.72 };
/** Where kill() parks a body so its raycast targets stop catching bullets. */
const UNDERGROUND_Y = -100;

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
  it("exposes every enemy kind with exactly the rendered animation states", () => {
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

    const first = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.death.front[0];
    const last = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.death.front[FRAMES_PER_ACTION - 1];
    expect(first.source).toBe(last.source);
    expect(first.userData.scourgeAnimation).toEqual({
      entity: "host-grunt",
      action: "death",
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
    const grunt = ENEMY_SPRITE_ANIMATION_TEXTURES.melee.death.front[0];
    const boss = ENEMY_SPRITE_ANIMATION_TEXTURES.boss.death.front[0];

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

  it("assigns a distinct, host-readable debris profile to every enemy kind (#22)", () => {
    expect(CORPSE_PART_IDS_BY_ENEMY_KIND).toEqual({
      melee: ["gib-meat-chunk", "gib-skull-shard", "gib-bone-blade"],
      ranged: ["gib-meat-chunk", "gib-skull-shard", "gib-acid-sac"],
      flying: ["gib-meat-chunk", "gib-claw-limb", "gib-acid-sac", "gib-wing-membrane"],
      hound: ["gib-meat-chunk", "gib-bone-blade", "gib-claw-limb"],
      boss: ["gib-skull-shard", "gib-bone-blade", "gib-claw-limb"],
    });

    const profiles = Object.values(CORPSE_PART_IDS_BY_ENEMY_KIND);
    expect(new Set(profiles.map((ids) => ids.join("|"))).size).toBe(ENEMY_SPRITE_KINDS.length);
    for (const ids of profiles) {
      for (const id of ids) expect(EXPECTED_GIB_IDS).toContain(id);
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

// The pool in PveDirectorSystem hands the first !alive Enemy straight to the next
// spawn, and Enemy.update() returns early once alive is false — so a dying rig can
// neither keep the scene nor advance a clip. kill() therefore hands FxSystem a
// snapshot and FxSystem stands up a separate corpse rig. These two describes pin
// both halves of that handoff.
describe("Enemy.kill() death snapshot (#19 death animation)", () => {
  it("captures where and how the enemy died, then parks the body underground", () => {
    const enemy = new Enemy();
    enemy.spawnAt(6, -4, { groundHeight: 3, scale: 1.7 });
    enemy.group.rotation.y = 0.9;
    const diedAt = enemy.group.position.clone();

    enemy.kill();

    expect(enemy.alive).toBe(false);
    const corpse = enemy.deathFx().corpse;
    expect(corpse.kind).toBe("melee");
    expect(corpse.x).toBeCloseTo(diedAt.x);
    expect(corpse.y).toBeCloseTo(diedAt.y);
    expect(corpse.z).toBeCloseTo(diedAt.z);
    expect(corpse.groundY).toBeCloseTo(3);
    expect(corpse.yaw).toBeCloseTo(0.9);
    expect(corpse.scale).toBeCloseTo(1.7);

    // The hit meshes stay in ctx.raycastTargets for the pool's whole lifetime and
    // THREE's raycaster ignores `visible`, so hiding alone would leave a dead
    // enemy soaking bullets. Both the flag and the park have to hold.
    expect(enemy.group.visible).toBe(false);
    expect(enemy.group.position.y).toBe(UNDERGROUND_Y);
  });

  it("keeps a winged host's death height apart from the floor it will fall to", () => {
    const enemy = new Enemy();
    enemy.spawnAt(0, 0, { flying: true, hoverHeight: 4.5, groundHeight: 2 });
    enemy.kill();

    const corpse = enemy.deathFx().corpse;
    expect(corpse.kind).toBe("flying");
    expect(corpse.y).toBeCloseTo(6.5);
    expect(corpse.groundY).toBeCloseTo(2);
    // Without both numbers the corpse would either snap to the floor or hang in
    // the air; FxSystem eases between them over the settle.
    expect(corpse.y).toBeGreaterThan(corpse.groundY);
  });

  it("drops the impact flash before snapshotting so the corpse is not white-hot", () => {
    const spawn = () => {
      const enemy = new Enemy();
      enemy.spawnAt(0, 0, { maxHealth: 200, color: 0xff5a3c });
      return enemy;
    };
    const bounds = RectBounds.square(50);
    const player = new THREE.Vector3(0, 0, 12);

    // Clean reference: an enemy killed without ever being flashed.
    const untouched = spawn();
    untouched.kill();

    const flashed = spawn();
    flashed.takeDamage(10, false);
    // One tick is what pushes the white-hot RGB into the palette materials.
    flashed.update(1 / 60, 1, player, [], new THREE.Quaternion(), bounds);
    expect(flashed.hitFlash).toBeGreaterThan(0);
    expect(flashed.deathFx().corpse.palette.body.color.r).toBeGreaterThan(1);

    // takeDamage sets hitFlash on the lethal hit too, so without the reset in
    // kill() every multi-hit kill would leave a glowing white body on the floor.
    flashed.takeDamage(500, false);
    expect(flashed.alive).toBe(false);
    expect(flashed.hitFlash).toBe(0);
    expect(flashed.deathFx().corpse.palette.body.color.toArray()).toEqual(
      untouched.deathFx().corpse.palette.body.color.toArray(),
    );
  });
});

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

/** A snapshot with its own palette, so a test can prove copy-not-share. */
function snapshot(overrides: Partial<EnemyDeathSnapshot> = {}): EnemyDeathSnapshot {
  const enemy = new Enemy();
  enemy.spawnAt(overrides.x ?? 0, overrides.z ?? 0, {});
  enemy.kill();
  return { ...enemy.deathFx().corpse, ...overrides };
}

/** Advance the FX clock in 60Hz steps, the way the game loop does. */
function tick(fx: FxSystem, seconds: number) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) fx.updateEffects(step);
}

describe("FxSystem corpse lifecycle (#19 death animation)", () => {
  it("stands a body up where the enemy fell", () => {
    const { ctx, fx } = harness();
    fx.spawnEnemyCorpse(snapshot({ x: 5, y: 1.05, z: -3, groundY: 0, yaw: 1.2, scale: 1.4 }));

    expect(fx.corpses).toHaveLength(1);
    const corpse = fx.corpses[0];
    expect(ctx.scene.children).toContain(corpse.holder);
    expect(corpse.holder.position.toArray()).toEqual([5, 1.05, -3]);
    expect(corpse.holder.rotation.y).toBeCloseTo(1.2);
    expect(corpse.holder.scale.x).toBeCloseTo(1.4);
    // World placement has to sit on a wrapper: writeDeath drives rig.root's own
    // offset and rotation, so the rig root cannot also carry the spawn transform.
    expect(corpse.rig.root.parent).toBe(corpse.holder);
  });

  it("copies the dead enemy's look instead of sharing its materials", () => {
    const { fx } = harness();
    const snap = snapshot();
    snap.palette.body.color.setRGB(0.1, 0.8, 0.3);
    fx.spawnEnemyCorpse(snap);

    const body = fx.corpses[0].rig.palette.body;
    expect(body.color.toArray().map((c) => Number(c.toFixed(4)))).toEqual([0.1, 0.8, 0.3]);
    expect(body).not.toBe(snap.palette.body);

    // The pool restyles the dead enemy's own materials for the next spawn. A
    // shared reference would recolour every corpse still on the floor.
    snap.palette.body.color.setRGB(1, 0, 0);
    expect(fx.corpses[0].rig.palette.body.color.g).toBeCloseTo(0.8);
  });

  it("drives the authored ragdoll and eases an airborne body down to the floor", () => {
    const { fx } = harness();
    fx.spawnEnemyCorpse(snapshot({ y: 6, groundY: 1 }));
    const corpse = fx.corpses[0];
    expect(corpse.rig.root.rotation.x).toBeCloseTo(0);

    tick(fx, CORPSE_SETTLE / 2);
    // Mid-clip the ragdoll is genuinely part-way through, not snapped to either end.
    expect(corpse.rig.root.rotation.x).toBeGreaterThan(0.05);
    expect(corpse.rig.root.rotation.x).toBeLessThan(DEATH_ROOT_TILT.biped - 0.05);
    expect(corpse.holder.position.y).toBeGreaterThan(1);
    expect(corpse.holder.position.y).toBeLessThan(6);

    tick(fx, CORPSE_SETTLE / 2 + 0.1);
    expect(corpse.settled).toBe(true);
    expect(corpse.rig.root.rotation.x).toBeCloseTo(DEATH_ROOT_TILT.biped, 2);
    expect(corpse.holder.position.y).toBeCloseTo(1);
  });

  it("tilts a hound shallower than a biped, per its authored clip", () => {
    const { fx } = harness();
    fx.spawnEnemyCorpse(snapshot({ kind: "hound" }));
    tick(fx, CORPSE_SETTLE + 0.1);

    expect(fx.corpses[0].rig.root.rotation.x).toBeCloseTo(DEATH_ROOT_TILT.hound, 2);
  });

  it("fades the body out and releases it, recycling the rig for the next kill", () => {
    const { ctx, fx } = harness();
    fx.spawnEnemyCorpse(snapshot());
    const first = fx.corpses[0];
    const rig = first.rig;
    const holder = first.holder;

    tick(fx, CORPSE_SETTLE + CORPSE_LINGER);
    // Fully opaque right up to the fade window; a body that dissolved while the
    // player was still looking at it would read as a pop-out, not a corpse.
    for (const material of rig.materials) expect(material.opacity).toBeCloseTo(1, 1);

    tick(fx, CORPSE_FADE / 2);
    for (const material of rig.materials) {
      expect(material.opacity).toBeGreaterThan(0);
      expect(material.opacity).toBeLessThan(1);
      expect(material.transparent).toBe(true);
    }

    tick(fx, CORPSE_FADE);
    expect(fx.corpses).toHaveLength(0);
    expect(ctx.scene.children).not.toContain(holder);

    // A run kills hundreds of hosts; rebuilding a 28-mesh rig each time is waste.
    fx.spawnEnemyCorpse(snapshot());
    expect(fx.corpses[0].rig).toBe(rig);
    expect(fx.corpses[0].holder).toBe(holder);
    // The recycled rig comes back opaque, not stuck at the opacity it faded to.
    for (const material of fx.corpses[0].rig.materials) expect(material.opacity).toBe(1);
  });

  it("pushes the oldest bodies into an early fade past the soft cap", () => {
    const { fx } = harness();
    for (let i = 0; i < CORPSE_SOFT_CAP; i++) fx.spawnEnemyCorpse(snapshot());
    expect(fx.corpses.every((corpse) => corpse.age === 0)).toBe(true);

    fx.spawnEnemyCorpse(snapshot());
    expect(fx.corpses).toHaveLength(CORPSE_SOFT_CAP + 1);
    expect(fx.corpses[0].age).toBeCloseTo(CORPSE_TTL - CORPSE_FADE);
    expect(fx.corpses[1].age).toBe(0);
  });

  it("drops the oldest outright when a swell outruns the hard cap", () => {
    const { ctx, fx } = harness();
    for (let i = 0; i < CORPSE_HARD_CAP + 3; i++) fx.spawnEnemyCorpse(snapshot());

    // Bodies are the most expensive leftover in the game, so the ceiling is hard:
    // the three eldest leave the floor outright rather than fading out.
    expect(fx.corpses).toHaveLength(CORPSE_HARD_CAP);
    // Holders are identity-recycled through the free list, so the check that
    // matters is that the scene holds nothing beyond the living corpses — a drop
    // that removed the entry but leaked its group would show up right here.
    expect(ctx.scene.children).toHaveLength(CORPSE_HARD_CAP);
    for (const corpse of fx.corpses) expect(ctx.scene.children).toContain(corpse.holder);
  });

  it("forwards the snapshot from spawnEnemyDeath and drains on teardown", () => {
    const { ctx, fx } = harness();
    fx.spawnEnemyDeath(new THREE.Vector3(2, 0, 2), { spriteKind: "melee", corpse: snapshot({ x: 2, z: 2 }) });
    expect(fx.corpses).toHaveLength(1);
    const holder = fx.corpses[0].holder;

    fx.clearTransientFx();
    expect(fx.corpses).toHaveLength(0);
    expect(ctx.scene.children).not.toContain(holder);
  });
});

describe("death sprite playback (#19 death animation)", () => {
  it("plays the flat death puff over the clip length the manifest authored", () => {
    const { ENEMY_SPRITE_ANIMATION_META } = spriteAssets;
    const { fx } = harness();

    for (const kind of ENEMY_SPRITE_KINDS) {
      fx.spawnEnemyDeath(new THREE.Vector3(), { spriteKind: kind });
      const death = fx.deathSprites[fx.deathSprites.length - 1];
      const meta = ENEMY_SPRITE_ANIMATION_META[kind].death;
      const authored = meta.frameCount / meta.fps;

      // The old fixed 0.16s blew all six frames in a subliminal flicker; the clip
      // length has to come from the manifest so a re-timed pack retimes the FX.
      expect(death.playback, `${kind} playback`).toBeCloseTo(authored);
      expect(death.holdStart, `${kind} hold`).toBeCloseTo(authored);
      expect(death.ttl, `${kind} ttl`).toBeCloseTo(authored + DEATH_SPRITE_FADE);
    }
  });

  it("gives the breach boss the slower clip its pack authors", () => {
    const { ENEMY_SPRITE_ANIMATION_META } = spriteAssets;
    const boss = ENEMY_SPRITE_ANIMATION_META.boss.death;
    const grunt = ENEMY_SPRITE_ANIMATION_META.melee.death;

    expect(grunt.frameCount / grunt.fps).toBeCloseTo(0.6);
    expect(boss.frameCount / boss.fps).toBeCloseTo(0.75);
  });

  it("walks every authored frame in order instead of flickering past them", () => {
    const { fx } = harness();
    fx.spawnEnemyDeath(new THREE.Vector3(), { spriteKind: "melee" });
    const death = fx.deathSprites[0];
    const seen: number[] = [];

    // Sample three times per authored frame across the hold window.
    const step = death.playback / (FRAMES_PER_ACTION * 3);
    for (let i = 0; i < FRAMES_PER_ACTION * 3; i++) {
      fx.updateEffects(step);
      const frame = death.material.map?.userData.scourgeAnimation.frame as number;
      if (seen[seen.length - 1] !== frame) seen.push(frame);
    }

    // Every frame, once, ascending — the old 0.16s window skipped most of them.
    expect(seen).toEqual([...Array(FRAMES_PER_ACTION).keys()]);
  });
});
