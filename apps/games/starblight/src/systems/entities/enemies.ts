import { createPool, type Pool } from "@deadrot/game-kit/core";
import * as THREE from "three";
import { COLORS, CONSTANTS, ENEMIES, type EnemyType, SPITTER } from "../../game/constants";
import { clamp, TAU } from "../../game/math";
import type { Enemy } from "../../game/types";
import type { RenderSystem } from "../RenderSystem";
import type { Projectiles } from "./projectiles";
import { ENEMY_SPRITES, type SpriteTextures, spriteMaterial, spritePlane } from "./sprites";
import { sweep } from "./sweep";

const HIT_FLASH = 0.09;

interface EnemySlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

// The Scourge: pooled per type with chase/weave/spit AI. The boss enemy record
// also lives in `enemies` (shared damage/collision contracts) but is steered
// and rendered by BossEncounter — updateEnemies skips it via `skip`.
export class Enemies {
  enemies: Enemy[] = [];

  private enemyGeom: Record<EnemyType, THREE.PlaneGeometry> = {
    grunt: spritePlane("grunt", ENEMIES.grunt.size * 1.65),
    swarmling: spritePlane("swarmling", ENEMIES.swarmling.size * 1.65),
    weaver: spritePlane("weaver", ENEMIES.weaver.size * 1.65),
    spitter: spritePlane("spitter", ENEMIES.spitter.size * 1.65),
    elite: spritePlane("elite", ENEMIES.elite.size * 1.65),
  };
  private all: EnemySlot[] = [];
  private pools = {} as Record<EnemyType, Pool<EnemySlot>>;

  constructor(
    private readonly render: RenderSystem,
    private readonly projectiles: Projectiles,
    private readonly ship: () => THREE.Group,
    private readonly textures: SpriteTextures,
  ) {
    for (const type of Object.keys(ENEMIES) as EnemyType[]) {
      this.pools[type] = createPool<EnemySlot>(
        () => {
          const mat = spriteMaterial(this.textures, ENEMY_SPRITES[type]);
          const mesh = new THREE.Mesh(this.enemyGeom[type], mat);
          this.render.add(mesh);
          const slot = { mesh, mat };
          this.all.push(slot);
          return slot;
        },
        (slot) => {
          slot.mesh.visible = false;
        },
      );
    }
  }

  spawn(type: EnemyType, x: number, y: number, hpMul: number, speedMul: number): Enemy {
    const def = ENEMIES[type];
    const isElite = type === "elite";
    const { mesh, mat } = this.pools[type].acquire();
    mesh.visible = true;
    mesh.position.set(x, y, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    mat.color.setHex(0xffffff);
    mat.opacity = 1;

    const maxHealth = def.baseHP * hpMul * (isElite ? CONSTANTS.director.eliteHpMul : 1);
    const enemy: Enemy = {
      mesh,
      material: mat,
      type,
      health: maxHealth,
      maxHealth,
      speed: def.speed * speedMul,
      gemValue: def.gem,
      contactDmg: def.contactDmg,
      radius: def.size * 0.7,
      flash: 0,
      telegraph: 0,
      phase: Math.random() * TAU,
      fireCooldown: SPITTER.fireEvery * (0.4 + Math.random() * 0.8),
      vx: 0,
      vy: 0,
      knockbackImmune: isElite,
      boss: false,
      dead: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  /** THE BLIGHT-MAW: prototype label for the Orbital Breach Carrier encounter.
   *  A bespoke big enemy the BossEncounter steers (skips chase AI), but
   *  takes damage through the normal weapon/bolt paths. */
  spawnBoss(x: number, y: number, hp: number, contactDmg: number, size: number): Enemy {
    const mat = spriteMaterial(this.textures, "boss");
    const mesh = new THREE.Mesh(spritePlane("boss", size * 2.2), mat);
    mesh.position.set(x, y, 0);
    this.render.add(mesh);
    const boss: Enemy = {
      mesh,
      material: mat,
      type: "elite",
      health: hp,
      maxHealth: hp,
      speed: 0,
      gemValue: 0,
      contactDmg,
      radius: size,
      flash: 0,
      telegraph: 0,
      phase: 0,
      fireCooldown: 0,
      vx: 0,
      vy: 0,
      knockbackImmune: true,
      boss: true,
      dead: false,
    };
    this.enemies.push(boss);
    return boss;
  }

  /** `skip` excludes the boss (steered + rendered by its encounter). */
  update(dt: number, time: number, skip: Enemy | null) {
    const ship = this.ship();
    const sx = ship.position.x;
    const sy = ship.position.y;
    for (const e of this.enemies) {
      if (e.dead || e === skip) continue;
      const def = ENEMIES[e.type];
      const dx = sx - e.mesh.position.x;
      const dy = sy - e.mesh.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      if (def.behavior === "spit") {
        // Hold range and lob globs at the ship.
        let mv = 0;
        if (dist > SPITTER.range + 1) mv = e.speed;
        else if (dist < SPITTER.range - 1) mv = -e.speed * 0.6;
        e.mesh.position.x += ux * mv * dt;
        e.mesh.position.y += uy * mv * dt;
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < SPITTER.range + 6) {
          e.fireCooldown = SPITTER.fireEvery;
          this.projectiles.spawnEnemyBullet(e.mesh.position.x, e.mesh.position.y, ux, uy);
        }
      } else if (def.behavior === "weave") {
        // Strafe-weave toward the ship.
        const weave = Math.sin(time * 3 + e.phase) * 0.7;
        const px = -uy;
        const py = ux;
        e.mesh.position.x += (ux + px * weave) * e.speed * dt;
        e.mesh.position.y += (uy + py * weave) * e.speed * dt;
      } else {
        // Straight chase.
        e.mesh.position.x += ux * e.speed * dt;
        e.mesh.position.y += uy * e.speed * dt;
      }

      // Knockback drift.
      if (e.vx !== 0 || e.vy !== 0) {
        e.mesh.position.x += e.vx * dt;
        e.mesh.position.y += e.vy * dt;
        const decay = 0.001 ** dt;
        e.vx *= decay;
        e.vy *= decay;
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
        if (Math.abs(e.vy) < 0.05) e.vy = 0;
      }

      e.mesh.rotation.z = Math.atan2(uy, ux) + Math.PI / 2;
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt);
        const t = clamp(e.flash / HIT_FLASH, 0, 1);
        e.material.color.setHex(0xffffff).lerp(BONE, t);
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.phase);
        e.material.color.setHex(0xffffff);
        e.material.opacity = 0.93 + pulse * 0.07;
      }
    }
  }

  hitFlash(e: Enemy) {
    e.flash = HIT_FLASH;
  }

  knockback(e: Enemy, fromX: number, fromY: number, force: number) {
    if (e.knockbackImmune) return;
    const dx = e.mesh.position.x - fromX;
    const dy = e.mesh.position.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.vx += (dx / d) * force;
    e.vy += (dy / d) * force;
  }

  /** Pooled enemies only — the boss mesh is torn down by its encounter. */
  kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.pools[e.type].release({ mesh: e.mesh, mat: e.material });
  }

  /** Sweep dead enemies out of the active array (swap-remove). */
  sweepDead() {
    sweep(this.enemies, (e) => e.dead);
  }

  clear() {
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.kill(e);
    }
    this.enemies.length = 0;
  }

  nearest(x: number, y: number, maxRange = Infinity): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.mesh.position.x - x) ** 2 + (e.mesh.position.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  dispose() {
    // Every pooled slot ever created (active + free): remove + per-instance material.
    for (const s of this.all) {
      this.render.remove(s.mesh);
      s.mat.dispose();
    }
    for (const g of Object.values(this.enemyGeom)) g.dispose();
  }
}

// Scratch color (avoid `new THREE.Color` in hot loops).
const BONE = new THREE.Color(COLORS.bone);
