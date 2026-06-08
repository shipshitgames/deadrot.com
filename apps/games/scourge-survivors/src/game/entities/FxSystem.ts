import * as THREE from "three";
import type { GameContext } from "../context";
import type { Pop, Tracer } from "../data/internalTypes";
import {
  CORPSE_PART_SPRITES,
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
type DeathSpriteKind = EnemySpriteKind;
type DeathSpriteView = EnemySpriteView;

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
    this.spawnCorpseParts(pos, { headshot: opts.headshot, elite: opts.elite, scale });

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
        floor: true,
      });
    }
  }

  private spawnCorpseParts(pos: THREE.Vector3, opts: { headshot?: boolean; elite?: boolean; scale: number }) {
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

  private pickCorpsePartSprite(opts: { headshot?: boolean; elite?: boolean }, index: number) {
    if (opts.headshot && index === 0) return CORPSE_PART_SPRITES[1];
    if (opts.elite && index % 5 === 0) return CORPSE_PART_SPRITES[3];
    if (opts.elite && index % 7 === 0) return CORPSE_PART_SPRITES[5];
    return CORPSE_PART_SPRITES[Math.floor(Math.random() * CORPSE_PART_SPRITES.length)];
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

  /** Tiny bright spark at a bullet impact point (enemy or wall). Cheap, per-hit. */
  spawnImpactSpark(pos: THREE.Vector3, color: number) {
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
    this.pops.push({ mesh: ring, age: 0, ttl: 0.46, baseScale: 0.18, growth: 11.5, floor: true });

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
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.floor ? 0.38 : 0.9) * (1 - k));
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
