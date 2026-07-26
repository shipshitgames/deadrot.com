import * as THREE from "three";
import type { GameContext } from "../context";
import type { Pop, Tracer } from "../data/internalTypes";
import {
  CORPSE_PART_SPRITES,
  type CorpsePartSpriteId,
  ENEMY_SPRITE_ANIMATION_TEXTURES,
  ENEMY_SPRITE_SCALES,
  type EnemySpriteKind,
  type EnemySpriteView,
} from "../spriteAssets";
import type { GameSystems } from "../systems";

const CORPSE_PART_SOFT_CAP = 72;
const CORPSE_PART_HARD_CAP = 96;
const CORPSE_PART_FADE_SECONDS = 1.35;
const CORPSE_PART_GRAVITY = 18;
// Death reads as a quick explosion, not a slow ragdoll: blow through all death
// frames in PLAYBACK seconds, then a short FADE — the death-pop ring + particle
// burst carry the "explosion" punch once the corpse sprite is gone.
const DEATH_SPRITE_PLAYBACK_SECONDS = 0.16;
const DEATH_SPRITE_FADE_SECONDS = 0.12;
// Live pops an explosion is willing to add detail on top of. Past this the
// ember/smoke counts scale down rather than the whole effect being dropped: a
// detonation the player cannot see is worse than a cheap one, so the core
// fireball and the radius ring always spawn.
const EXPLOSION_POP_BUDGET = 150;
/** Floor on that scaling — a crowded frame still gets a quarter of the debris. */
const EXPLOSION_MIN_DETAIL = 0.25;
/** Sparks thrown off a surface hit. Small: this fires on every wall shot. */
const IMPACT_SPARKS = 4;
/** Past this many live pops, brass is skipped. Well under the explosion budget —
 *  a detonation is worth crowding the pool for, an ejected case is not. */
const CASING_POP_BUDGET = 90;
// Scratch vectors for the impact tangent basis. Written and consumed inside one
// synchronous spawnImpactSpark call, so a single shared set is safe.
const IMPACT_NORMAL = new THREE.Vector3();
const IMPACT_T1 = new THREE.Vector3();
const IMPACT_T2 = new THREE.Vector3();
const IMPACT_AXIS_X = new THREE.Vector3(1, 0, 0);
const IMPACT_AXIS_Y = new THREE.Vector3(0, 1, 0);
type DeathSpriteKind = EnemySpriteKind;
type DeathSpriteView = EnemySpriteView;

/** Semantic debris profiles keep each host family readable after the kill. */
export const CORPSE_PART_IDS_BY_ENEMY_KIND = {
  melee: ["gib-meat-chunk", "gib-skull-shard", "gib-bone-blade"],
  ranged: ["gib-meat-chunk", "gib-skull-shard", "gib-acid-sac"],
  flying: ["gib-meat-chunk", "gib-claw-limb", "gib-acid-sac", "gib-wing-membrane"],
  hound: ["gib-meat-chunk", "gib-bone-blade", "gib-claw-limb"],
  boss: ["gib-skull-shard", "gib-bone-blade", "gib-claw-limb"],
} as const satisfies Record<EnemySpriteKind, readonly CorpsePartSpriteId[]>;

interface CorpsePart {
  mesh: THREE.Mesh | THREE.Sprite;
  age: number;
  ttl: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  baseOpacity: number;
}

interface DeathSprite {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  kind: DeathSpriteKind;
  view: DeathSpriteView;
  age: number;
  ttl: number;
  holdStart: number;
  baseOpacity: number;
}

/** Transient visual FX: bullet tracers, death pops, muzzle-flash decay, teardown. */
export class FxSystem {
  tracers: Tracer[] = [];
  pops: Pop[] = [];
  corpseParts: CorpsePart[] = [];
  deathSprites: DeathSprite[] = [];
  /** Monotonic count of lethal-headshot kill beats. Test/debug seam — never reset
   *  (clearTransientFx drains the meshes, not this). */
  headshotKillSeq = 0;
  /** Scalar snapshot of the last headshot-kill beat. No Enemy/Object3D refs. */
  lastHeadshotKill: { x: number; z: number; scale: number; boss: boolean; at: number } | null = null;
  private berserkParticleTimer = 0;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  addTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xfff1b5,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    this.ctx.scene.add(line);
    this.tracers.push({ line, age: 0, ttl: 0.07 });
  }

  spawnDeathPop(pos: THREE.Vector3, color: number, scale: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * scale, 12, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.copy(pos);
    mesh.position.y = 1.0 * scale;
    this.ctx.scene.add(mesh);
    this.pops.push({ mesh, age: 0, ttl: 0.35 });

    // A fast, bright outward gut-burst ring for a punchier "splat" read.
    const ring = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 * scale, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.copy(mesh.position);
    this.ctx.scene.add(ring);
    this.pops.push({ mesh: ring, age: 0, ttl: 0.18 });
  }

  /** Brief blood spurt for a non-lethal hit. Headshots throw a brighter, taller burst. */
  spawnBloodHit(pos: THREE.Vector3, headshot = false) {
    const count = headshot ? 8 : 4;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(headshot ? 0.075 : 0.055, 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xff2d55 : 0x9f1024,
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
        }),
      );
      mesh.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const speed = (headshot ? 3.6 : 2.4) + Math.random() * 2.2;
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.22 + Math.random() * 0.18,
        vel: new THREE.Vector3(Math.cos(a) * speed, 1.5 + Math.random() * (headshot ? 3.4 : 1.6), Math.sin(a) * speed),
        baseScale: 0.7,
        growth: headshot ? 0.7 : 0.35,
      });
    }
  }

  /** Death FX: hot pop, blood spray, short-lived floor splatter, and chunky leftovers. */
  spawnEnemyDeath(
    pos: THREE.Vector3,
    opts: {
      headshot?: boolean;
      elite?: boolean;
      scale?: number;
      color?: number;
      spriteKind?: DeathSpriteKind;
      spriteView?: DeathSpriteView;
      spriteFlip?: number;
    } = {},
  ) {
    const scale = opts.scale ?? (opts.elite ? 1.8 : 1);
    const color = opts.color ?? (opts.elite ? 0xff2d55 : 0xc1121f);
    this.spawnEnemyDeathSprite(pos, {
      kind: opts.spriteKind,
      view: opts.spriteView,
      flip: opts.spriteFlip,
      scale,
      elite: opts.elite,
    });
    this.spawnDeathPop(pos, color, opts.elite ? scale * 1.15 : scale);
    this.spawnCorpseParts(pos, {
      headshot: opts.headshot,
      elite: opts.elite,
      scale,
      spriteKind: opts.spriteKind,
    });

    const count = opts.elite ? 28 : opts.headshot ? 18 : 11;
    const origin = pos.clone();
    origin.y = opts.headshot ? 1.75 * scale : 1.05 * scale;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry((0.055 + Math.random() * 0.055) * (opts.elite ? 1.2 : 1), 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 4 === 0 ? 0xff415f : i % 3 === 0 ? 0x5b0614 : 0xb11226,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      mesh.position.copy(origin);
      mesh.position.x += (Math.random() * 2 - 1) * 0.25 * scale;
      mesh.position.z += (Math.random() * 2 - 1) * 0.25 * scale;
      const a = Math.random() * Math.PI * 2;
      const speed = (opts.elite ? 5.8 : opts.headshot ? 4.4 : 3.0) + Math.random() * 3.0;
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.38 + Math.random() * (opts.elite ? 0.45 : 0.28),
        vel: new THREE.Vector3(
          Math.cos(a) * speed,
          2.2 + Math.random() * (opts.elite ? 5.5 : 3.2),
          Math.sin(a) * speed,
        ),
        baseScale: 0.75,
        growth: opts.elite ? 1.0 : 0.55,
      });
    }

    const splats = opts.elite ? 4 : opts.headshot ? 3 : 2;
    for (let i = 0; i < splats; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.5 + Math.random() * 0.45, 14),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x6f0718 : 0xa70f24,
          transparent: true,
          opacity: opts.elite ? 0.44 : 0.34,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.random() * Math.PI;
      mesh.position.set(
        pos.x + (Math.random() * 2 - 1) * 0.7 * scale,
        0.025,
        pos.z + (Math.random() * 2 - 1) * 0.7 * scale,
      );
      mesh.scale.setScalar(0.001);
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 5.5 + Math.random() * 2.5,
        baseScale: 0.08,
        growth: opts.elite ? 2.4 : 1.35,
        peakOpacity: 0.38,
      });
    }
  }

  /** Lethal-headshot kill beat: white skull-pop core + expanding crimson shell +
   *  vertical bone/blood fountain at head height, layered on the normal death FX.
   *  World-space only (no full-screen flash — photosensitivity) and fire-and-forget
   *  on cloned scalars: never holds an Enemy (pooled) and never reads pos.y (the
   *  group is parked at y=-100 by kill() before this runs — Y derives from scale,
   *  matching every other death FX in this file). Camera juice is suppressed for
   *  bosses so their bigger death beat (0.45 shake / 0.06 hitstop) stays authoritative. */
  spawnHeadshotKillFx(pos: THREE.Vector3, opts: { scale?: number; boss?: boolean } = {}) {
    const scale = Math.max(0.8, opts.scale ?? 1);
    this.headshotKillSeq++;
    this.lastHeadshotKill = { x: pos.x, z: pos.z, scale, boss: !!opts.boss, at: this.ctx.time };
    const headY = 1.75 * scale; // same head origin as the existing headshot particle burst (spawnEnemyDeath)

    // 1) White-hot core flash — the instantaneous "skull-pop" read.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * scale, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.position.set(pos.x, headY, pos.z);
    this.ctx.scene.add(core);
    this.pops.push({ mesh: core, age: 0, ttl: 0.12, baseScale: 0.5, growth: 2.2 });

    // 2) Expanding crimson shell — clean contour that reads from any camera angle.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.24 * scale, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff2d55,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    shell.position.set(pos.x, headY, pos.z);
    this.ctx.scene.add(shell);
    this.pops.push({ mesh: shell, age: 0, ttl: 0.22, baseScale: 0.6, growth: 3.2 });

    // 3) Vertical bone/blood fountain off the head — the tall geyser is what
    //    distinguishes a head kill from a body kill at FPS combat distance.
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xe9e3d6 : i % 2 === 0 ? 0xff415f : 0xb11226, // bone / bright blood / deep blood
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.position.set(
        pos.x + (Math.random() * 2 - 1) * 0.15 * scale,
        headY,
        pos.z + (Math.random() * 2 - 1) * 0.15 * scale,
      );
      const a = Math.random() * Math.PI * 2;
      const lateral = 0.6 + Math.random() * 0.9;
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.28 + Math.random() * 0.12,
        vel: new THREE.Vector3(Math.cos(a) * lateral, 4.5 + Math.random() * 3.0, Math.sin(a) * lateral),
        baseScale: 0.7,
        growth: 0.5,
      });
    }

    if (!opts.boss) {
      this.addShake(0.12); // sums with hitscan's existing 0.2 → 0.32, well under the 1.0 clamp
      this.hitstop(0.05); // hitstop() takes MAX not sum
    }
  }

  private spawnCorpseParts(
    pos: THREE.Vector3,
    opts: { headshot?: boolean; elite?: boolean; scale: number; spriteKind?: DeathSpriteKind },
  ) {
    const scale = Math.max(0.72, opts.scale);
    const count = opts.elite ? 14 : opts.headshot ? 6 : 4;
    const originY = opts.headshot ? 1.45 * scale : 1.05 * scale;

    for (let i = 0; i < count; i++) {
      const spriteDef = this.pickCorpsePartSprite(opts, i);
      const material = new THREE.SpriteMaterial({
        map: spriteDef.texture,
        color: 0xffffff,
        transparent: true,
        opacity: opts.elite ? 0.94 : 0.88,
        alphaTest: 0.08,
        depthWrite: true,
        toneMapped: false,
      });
      material.rotation = Math.random() * Math.PI * 2;
      const mesh = new THREE.Sprite(material);
      const spriteScale = spriteDef.scale[0] * scale * (0.72 + Math.random() * (opts.elite ? 0.65 : 0.46));
      mesh.scale.set(spriteScale, spriteScale, 1);
      mesh.renderOrder = 7;

      mesh.position.set(
        pos.x + (Math.random() * 2 - 1) * 0.22 * scale,
        originY + Math.random() * 0.35 * scale,
        pos.z + (Math.random() * 2 - 1) * 0.22 * scale,
      );
      this.ctx.scene.add(mesh);

      const a = Math.random() * Math.PI * 2;
      const speed = (opts.elite ? 5.3 : opts.headshot ? 4.0 : 3.0) + Math.random() * 2.4;
      this.corpseParts.push({
        mesh,
        age: 0,
        ttl: (opts.elite ? 28 : 19) + Math.random() * 7,
        vel: new THREE.Vector3(
          Math.cos(a) * speed,
          2.4 + Math.random() * (opts.elite ? 3.8 : 2.2),
          Math.sin(a) * speed,
        ),
        spin: new THREE.Vector3((Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9),
        baseOpacity: opts.elite ? 0.94 : 0.86,
      });
    }

    this.enforceCorpsePartBudget();
  }

  private pickCorpsePartSprite(
    opts: { headshot?: boolean; elite?: boolean; spriteKind?: DeathSpriteKind },
    index: number,
  ) {
    const kind = opts.spriteKind ?? (opts.elite ? "boss" : "melee");
    const profile = CORPSE_PART_IDS_BY_ENEMY_KIND[kind];
    const id =
      opts.headshot && index === 0
        ? "gib-skull-shard"
        : profile[opts.elite ? index % profile.length : Math.floor(Math.random() * profile.length)];
    const sprite = CORPSE_PART_SPRITES.find((part) => part.id === id);
    if (!sprite) throw new Error(`Missing corpse-part sprite ${id} for ${kind} death FX`);
    return sprite;
  }

  private spawnEnemyDeathSprite(
    pos: THREE.Vector3,
    opts: { kind?: DeathSpriteKind; view?: DeathSpriteView; flip?: number; scale: number; elite?: boolean },
  ) {
    const kind = opts.kind ?? (opts.elite ? "boss" : "melee");
    const view = opts.view ?? "front";
    const frames = ENEMY_SPRITE_ANIMATION_TEXTURES[kind].death[view];
    const firstFrame = frames[0];
    if (!firstFrame) return;

    const material = new THREE.SpriteMaterial({
      map: firstFrame,
      color: 0xffffff,
      transparent: true,
      opacity: opts.elite ? 0.94 : 0.88,
      alphaTest: 0.06,
      depthWrite: true,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    const [baseW, baseH] = ENEMY_SPRITE_SCALES[kind][view];
    const flip = opts.flip && opts.flip < 0 ? -1 : 1;
    sprite.scale.set(baseW * opts.scale * flip, baseH * opts.scale, 1);
    sprite.position.set(pos.x, 0.03, pos.z);
    sprite.renderOrder = 6;
    this.ctx.scene.add(sprite);
    const duration = DEATH_SPRITE_PLAYBACK_SECONDS;
    const baseOpacity = opts.elite ? 0.94 : 0.88;
    this.deathSprites.push({
      sprite,
      material,
      kind,
      view,
      age: 0,
      ttl: duration + DEATH_SPRITE_FADE_SECONDS,
      holdStart: duration,
      baseOpacity,
    });
  }

  private removeDeathSprite(index: number) {
    const death = this.deathSprites[index];
    if (!death) return;
    this.ctx.scene.remove(death.sprite);
    death.material.dispose();
    this.deathSprites.splice(index, 1);
  }

  private enforceCorpsePartBudget() {
    while (this.corpseParts.length > CORPSE_PART_HARD_CAP) this.removeCorpsePart(0);
    const overflow = this.corpseParts.length - CORPSE_PART_SOFT_CAP;
    if (overflow <= 0) return;

    for (let i = 0; i < overflow; i++) {
      const part = this.corpseParts[i];
      part.age = Math.max(part.age, part.ttl - CORPSE_PART_FADE_SECONDS);
    }
  }

  private removeCorpsePart(index: number) {
    const part = this.corpseParts[index];
    if (!part) return;
    this.ctx.scene.remove(part.mesh);
    if (part.mesh instanceof THREE.Mesh) part.mesh.geometry.dispose();
    const mat = part.mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        m.dispose();
      });
    } else mat.dispose();
    this.corpseParts.splice(index, 1);
  }

  /**
   * Bullet impact. The bright core blip is unconditional and cheap — it fires on
   * every hit, flesh or wall.
   *
   * Pass `normal` (world-space, pointing out of the surface) for a hit on
   * geometry and the impact also throws a spark cone and a dust puff back along
   * it. That directionality is the whole point: a flat blip tells the player
   * something was hit, sparks coming off the *face* tell them which way the wall
   * is, which is what makes a corner peek readable.
   */
  spawnImpactSpark(pos: THREE.Vector3, color: number, normal?: THREE.Vector3) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.copy(pos);
    this.ctx.scene.add(mesh);
    this.pops.push({ mesh, age: 0, ttl: 0.12 });

    if (!normal) return;
    // Tangent basis on the surface, so the cone opens across the face rather
    // than along an arbitrary world axis. The seed axis is swapped near the
    // poles, where the cross product would collapse.
    const n = IMPACT_NORMAL.copy(normal).normalize();
    const seed = Math.abs(n.y) > 0.9 ? IMPACT_AXIS_X : IMPACT_AXIS_Y;
    const t1 = IMPACT_T1.crossVectors(n, seed).normalize();
    const t2 = IMPACT_T2.crossVectors(n, t1).normalize();

    for (let i = 0; i < IMPACT_SPARKS; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 4),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spark.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const spread = 0.55 + Math.random() * 0.5;
      const speed = 2.4 + Math.random() * 3.2;
      const vel = new THREE.Vector3()
        .addScaledVector(n, 1)
        .addScaledVector(t1, Math.cos(a) * spread)
        .addScaledVector(t2, Math.sin(a) * spread)
        .multiplyScalar(speed);
      this.ctx.scene.add(spark);
      this.pops.push({
        mesh: spark,
        age: 0,
        ttl: 0.16 + Math.random() * 0.14,
        vel,
        baseScale: 1,
        growth: -0.6, // tapers to a streak-end rather than blooming like an ember
      });
    }

    // Knocked-loose material: dim, non-additive, sat just off the surface so it
    // does not z-fight the wall it came out of.
    const dust = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x6b6259, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    dust.position.copy(pos).addScaledVector(n, 0.05);
    this.ctx.scene.add(dust);
    this.pops.push({
      mesh: dust,
      age: 0,
      ttl: 0.34,
      vel: new THREE.Vector3().addScaledVector(n, 0.9),
      baseScale: 0.6,
      growth: 1.3,
      peakOpacity: 0.3,
    });
  }

  /**
   * Ejected brass. Lit rather than additive on purpose — a casing is the one
   * particle in the game meant to catch the muzzle light and read as metal, and
   * the tumble comes free from the pop pump's gravity and ground bounce.
   *
   * First thing dropped when the frame is busy: nobody misses brass in a fight,
   * and an SMG at full rate is the exact moment the pool is under pressure.
   */
  spawnCasing(origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, scale = 1) {
    if (this.pops.length > CASING_POP_BUDGET) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013 * scale, 0.013 * scale, 0.05 * scale, 6),
      new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        metalness: 0.85,
        roughness: 0.34,
        transparent: true,
      }),
    );
    mesh.position.copy(origin);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.ctx.scene.add(mesh);
    this.pops.push({
      mesh,
      age: 0,
      ttl: 0.9 + Math.random() * 0.4,
      vel: new THREE.Vector3()
        .addScaledVector(right, 2.1 + Math.random() * 1.1)
        .addScaledVector(up, 1.7 + Math.random() * 0.9),
      spin: new THREE.Vector3((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26),
      // Constant size: the pump's default ramp would balloon it into a barrel.
      baseScale: 1,
      growth: 0,
      peakOpacity: 1,
    });
  }

  /** A detonation: cannon splash, boss death, anything that should read as a
   *  blast rather than a hit. Five layers, front to back — white-hot core, fire
   *  shell, a ground ring that ends at exactly `radius` so the player can read
   *  the damage footprint off the FX, ballistic embers, and rising smoke.
   *
   *  Everything goes through `pops`, so updateEffects drives the fade and
   *  clearTransientFx drains it on run teardown; nothing here needs its own
   *  pump. The caller passes the gameplay radius it actually used, which is what
   *  keeps the ring honest when a weapon's splash is retuned. */
  spawnExplosion(
    pos: THREE.Vector3,
    opts: {
      radius?: number;
      /** Fire tint. The core is always white-hot; this colours the shell and embers. */
      color?: number;
      shake?: number;
      hitstop?: number;
    } = {},
  ) {
    const radius = Math.max(0.6, opts.radius ?? 4);
    const color = opts.color ?? 0xff8a3b;
    // Shed particles, never structure: the first three layers are the silhouette.
    const crowding = Math.max(0, this.pops.length - EXPLOSION_POP_BUDGET) / EXPLOSION_POP_BUDGET;
    const detail = Math.max(EXPLOSION_MIN_DETAIL, 1 - crowding);
    const originY = Math.min(1.1, 0.35 + radius * 0.16);

    // 1) White-hot core. Brief and small — the flash frame, not the fireball.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * radius, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfff4d2,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.position.set(pos.x, originY, pos.z);
    this.ctx.scene.add(core);
    this.pops.push({ mesh: core, age: 0, ttl: 0.14, baseScale: 0.35, growth: 1.5 });

    // 2) Fire shell, outliving the core so the blast has a falling-off tail.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 * radius, 14, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    shell.position.set(pos.x, originY, pos.z);
    this.ctx.scene.add(shell);
    this.pops.push({ mesh: shell, age: 0, ttl: 0.34, baseScale: 0.5, growth: 2.1 });

    // 3) Ground shockwave. Unit-radius geometry scaled straight to `radius`, so
    //    the ring stops exactly where the damage does.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.09, pos.z);
    ring.scale.setScalar(0.001);
    this.ctx.scene.add(ring);
    this.pops.push({ mesh: ring, age: 0, ttl: 0.4, baseScale: 0.001, growth: radius, peakOpacity: 0.7 });

    // 4) Embers, thrown along the ground plane so they rake outward instead of
    //    fountaining straight up like a gib burst.
    const embers = Math.round(16 * detail);
    for (let i = 0; i < embers; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.06, 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xfff0b8 : color,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const a = Math.random() * Math.PI * 2;
      mesh.position.set(pos.x + Math.cos(a) * 0.3, originY, pos.z + Math.sin(a) * 0.3);
      this.ctx.scene.add(mesh);
      const speed = radius * (1.6 + Math.random() * 1.5);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.5 + Math.random() * 0.4,
        vel: new THREE.Vector3(Math.cos(a) * speed, 2.2 + Math.random() * 4.4, Math.sin(a) * speed),
        baseScale: 0.8,
        growth: 0.4,
      });
    }

    // 5) Smoke. The one non-additive layer in this file, on purpose: additive
    //    can only brighten, and the blast needs something that dims the ground
    //    behind it once the fire is gone. Half-alpha and deliberately smaller
    //    than the fireball — a plume the player can see the arena through, not a
    //    grey wall dropped over the fight.
    const puffs = Math.round(7 * detail);
    for (let i = 0; i < puffs; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.24 * radius, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0x2b2320,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        }),
      );
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.4;
      mesh.position.set(pos.x + Math.cos(a) * r, originY + Math.random() * 0.5, pos.z + Math.sin(a) * r);
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.8 + Math.random() * 0.5,
        // Drifts up and out slowly; updateEffects' gravity pulls it back down,
        // which is what gives the plume its roll.
        vel: new THREE.Vector3(Math.cos(a) * 0.9, 2.6 + Math.random() * 1.4, Math.sin(a) * 0.9),
        baseScale: 0.5,
        growth: 1.0,
        peakOpacity: 0.45,
      });
    }

    if (opts.shake) this.addShake(opts.shake);
    if (opts.hitstop) this.hitstop(opts.hitstop);
  }

  /** Blood-rage pickup hit: screen shake plus a hot ring and short-lived spray around the player. */
  triggerBerserkBurst() {
    const center = this.ctx.body.position.clone();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.08, 56),
      new THREE.MeshBasicMaterial({
        color: 0xff2a18,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.13, center.z);
    ring.scale.setScalar(0.001);
    this.ctx.scene.add(ring);
    this.pops.push({ mesh: ring, age: 0, ttl: 0.46, baseScale: 0.18, growth: 11.5, peakOpacity: 0.38 });

    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 + Math.random() * 0.05, 6, 4),
        new THREE.MeshBasicMaterial({
          color: i % 4 === 0 ? 0xff8a3b : i % 3 === 0 ? 0x3d0006 : 0xc1121f,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.4;
      mesh.position.set(center.x + Math.cos(a) * r, 0.75 + Math.random() * 1.0, center.z + Math.sin(a) * r);
      this.ctx.scene.add(mesh);
      const speed = 3.8 + Math.random() * 4.6;
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.42 + Math.random() * 0.28,
        vel: new THREE.Vector3(Math.cos(a) * speed, 2.8 + Math.random() * 3.4, Math.sin(a) * speed),
        baseScale: 0.72,
        growth: 0.9,
      });
    }

    this.addShake(0.46);
    this.hitstop(0.045);
  }

  private spawnBerserkWake() {
    const center = this.ctx.body.position;
    const count = Math.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.48 + Math.random() * 0.55;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.032 + Math.random() * 0.04, 5, 4),
        new THREE.MeshBasicMaterial({
          color: Math.random() < 0.28 ? 0xff6a00 : 0xc1121f,
          transparent: true,
          opacity: 0.74,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.position.set(center.x + Math.cos(a) * r, 0.42 + Math.random() * 1.28, center.z + Math.sin(a) * r);
      this.ctx.scene.add(mesh);
      this.pops.push({
        mesh,
        age: 0,
        ttl: 0.28 + Math.random() * 0.18,
        vel: new THREE.Vector3(-Math.cos(a) * 0.65, 1.2 + Math.random() * 1.4, -Math.sin(a) * 0.65),
        baseScale: 0.58,
        growth: 1.1,
      });
    }
  }

  // ---- camera juice: trauma-based screenshake + recoil kick + hitstop ----
  /** Add screenshake trauma (0..1, clamped). Magnitude in render scales trauma². */
  addShake(amount: number) {
    this.ctx.shakeTrauma = Math.min(1, this.ctx.shakeTrauma + amount);
  }

  /** Kick the view pitch up by `amount` radians; springs back in updateEffects. */
  addRecoil(amount: number) {
    this.ctx.camRecoil += amount;
  }

  /** Freeze the sim for `seconds` (tiny — reads as a punch, not lag). */
  hitstop(seconds: number) {
    if (seconds > this.ctx.hitstopTimer) this.ctx.hitstopTimer = seconds;
  }

  /** Register a kill toward the rolling kill-streak combo. */
  registerKill(): number {
    this.ctx.combo++;
    this.ctx.comboTimer = 2.6;
    if (this.ctx.combo > this.ctx.comboBest) this.ctx.comboBest = this.ctx.combo;
    return this.ctx.combo;
  }

  updateEffects(delta: number) {
    // Decay camera juice + combo timer (runs every frame, in or out of play).
    if (this.ctx.damageBoostTimer > 0 && this.ctx.status === "playing") {
      this.berserkParticleTimer -= delta;
      if (this.berserkParticleTimer <= 0) {
        this.berserkParticleTimer = 0.055 + Math.random() * 0.045;
        this.spawnBerserkWake();
      }
      this.ctx.shakeTrauma = Math.min(1, this.ctx.shakeTrauma + delta * 0.035);
    } else {
      this.berserkParticleTimer = 0;
    }
    if (this.ctx.shakeTrauma > 0) this.ctx.shakeTrauma = Math.max(0, this.ctx.shakeTrauma - delta * 1.9);
    if (this.ctx.camRecoil !== 0) this.ctx.camRecoil -= this.ctx.camRecoil * Math.min(1, delta * 16);
    if (this.ctx.comboTimer > 0) {
      this.ctx.comboTimer -= delta;
      if (this.ctx.comboTimer <= 0) this.ctx.combo = 0;
    }

    if (this.ctx.muzzleTimer > 0) {
      this.ctx.muzzleTimer -= delta;
      this.ctx.muzzleLight.intensity = Math.max(0, this.ctx.muzzleLight.intensity - delta * 160);
      if (this.ctx.muzzleTimer <= 0) {
        this.ctx.muzzleFlash.visible = false;
        this.ctx.dualMuzzleFlash.visible = false;
        this.ctx.muzzleLight.intensity = 0;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += delta;
      const k = 1 - t.age / t.ttl;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, k * 0.9);
      if (t.age >= t.ttl) {
        this.ctx.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += delta;
      if (p.vel) {
        p.mesh.position.addScaledVector(p.vel, delta);
        p.vel.y -= 12 * delta;
        if (p.mesh.position.y < 0.04) {
          p.mesh.position.y = 0.04;
          p.vel.multiplyScalar(0.35);
          p.vel.y = 0;
        }
      }
      if (p.spin) {
        p.mesh.rotation.x += p.spin.x * delta;
        p.mesh.rotation.y += p.spin.y * delta;
        p.mesh.rotation.z += p.spin.z * delta;
      }
      const k = p.age / p.ttl;
      p.mesh.scale.setScalar((p.baseScale ?? 0.4) + k * (p.growth ?? 3.0));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.peakOpacity ?? 0.9) * (1 - k));
      if (p.age >= p.ttl) {
        this.ctx.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.pops.splice(i, 1);
      }
    }
    for (let i = this.deathSprites.length - 1; i >= 0; i--) {
      const death = this.deathSprites[i];
      death.age += delta;
      const frames = ENEMY_SPRITE_ANIMATION_TEXTURES[death.kind].death[death.view];
      const frameIndex = Math.floor((death.age / DEATH_SPRITE_PLAYBACK_SECONDS) * frames.length);
      const frame = frames[Math.min(frames.length - 1, frameIndex)];
      if (frame && death.material.map !== frame) {
        death.material.map = frame;
        death.material.needsUpdate = true;
      }

      const fade = Math.max(0, Math.min(1, (death.age - death.holdStart) / DEATH_SPRITE_FADE_SECONDS));
      death.material.opacity = death.baseOpacity * (1 - fade);
      if (death.age >= death.ttl) this.removeDeathSprite(i);
    }
    for (let i = this.corpseParts.length - 1; i >= 0; i--) {
      const part = this.corpseParts[i];
      part.age += delta;
      part.mesh.position.addScaledVector(part.vel, delta);
      part.vel.y -= CORPSE_PART_GRAVITY * delta;

      if (part.mesh.position.y <= 0.075) {
        part.mesh.position.y = 0.075;
        if (Math.abs(part.vel.y) > 1.1) part.vel.y *= -0.14;
        else part.vel.y = 0;
        const drag = Math.max(0, 1 - delta * 5.6);
        part.vel.x *= drag;
        part.vel.z *= drag;
      }

      if (Math.abs(part.vel.y) > 0.02 || Math.hypot(part.vel.x, part.vel.z) > 0.035) {
        if (part.mesh instanceof THREE.Sprite) {
          part.mesh.material.rotation += part.spin.z * delta;
        } else {
          part.mesh.rotation.x += part.spin.x * delta;
          part.mesh.rotation.y += part.spin.y * delta;
          part.mesh.rotation.z += part.spin.z * delta;
        }
      }

      const fadeStart = Math.max(0, part.ttl - CORPSE_PART_FADE_SECONDS);
      const fade = Math.max(0, Math.min(1, (part.age - fadeStart) / CORPSE_PART_FADE_SECONDS));
      const material = part.mesh.material;
      if (Array.isArray(material)) {
        for (const mat of material) mat.opacity = part.baseOpacity * (1 - fade);
      } else material.opacity = part.baseOpacity * (1 - fade);
      if (part.age >= part.ttl) this.removeCorpsePart(i);
    }
  }

  clearTransientFx() {
    for (const t of this.tracers) {
      this.ctx.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    this.tracers = [];
    for (const p of this.pops) {
      this.ctx.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.pops = [];
    while (this.deathSprites.length) this.removeDeathSprite(this.deathSprites.length - 1);
    while (this.corpseParts.length) this.removeCorpsePart(this.corpseParts.length - 1);
    this.sys.projectiles.clearProjectiles();
    while (this.sys.pickups.pickups.length) this.sys.pickups.removePickup(this.sys.pickups.pickups.length - 1);
  }
}
