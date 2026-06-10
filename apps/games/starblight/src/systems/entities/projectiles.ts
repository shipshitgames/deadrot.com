import { createPool, type Pool } from "@deadrot/game-kit/core";
import * as THREE from "three";
import { COLORS, SPITTER } from "../../game/constants";
import { lerpAngle } from "../../game/math";
import type { Bullet, Enemy, EnemyBullet } from "../../game/types";
import type { RenderSystem } from "../RenderSystem";
import { sweep } from "./sweep";

// Player homing bolts (seeker + wingmates) and enemy globs, pooled.
export class Projectiles {
  bullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];

  private boltGeom = new THREE.BoxGeometry(0.42, 1.5, 0.42);
  private boltMat = new THREE.MeshBasicMaterial({ color: COLORS.hellfire });
  private enemyBoltGeom = new THREE.SphereGeometry(0.5, 8, 8);
  private enemyBoltMat = new THREE.MeshBasicMaterial({ color: COLORS.toxic });

  private allBolts: THREE.Mesh[] = [];
  private allEnemyBolts: THREE.Mesh[] = [];
  private boltPool: Pool<THREE.Mesh>;
  private enemyBoltPool: Pool<THREE.Mesh>;

  /** `nearestEnemy` lets homing bolts retarget without owning the enemy list. */
  constructor(
    private readonly render: RenderSystem,
    private readonly nearestEnemy: (x: number, y: number) => Enemy | null,
  ) {
    this.boltPool = createPool<THREE.Mesh>(
      () => {
        const mesh = new THREE.Mesh(this.boltGeom, this.boltMat);
        this.render.add(mesh);
        this.allBolts.push(mesh);
        return mesh;
      },
      (m) => {
        m.visible = false;
      },
    );
    this.enemyBoltPool = createPool<THREE.Mesh>(
      () => {
        const mesh = new THREE.Mesh(this.enemyBoltGeom, this.enemyBoltMat);
        this.render.add(mesh);
        this.allEnemyBolts.push(mesh);
        return mesh;
      },
      (m) => {
        m.visible = false;
      },
    );
  }

  // --- player bolts (homing) ----------------------------------------------

  spawnBolt(x: number, y: number, target: Enemy | null, dmg: number, pierce: number, speed: number, turn: number) {
    const mesh = this.boltPool.acquire();
    mesh.visible = true;
    mesh.position.set(x, y, 0);
    let vx = 0;
    let vy = speed;
    if (target && !target.dead) {
      const dx = target.mesh.position.x - x;
      const dy = target.mesh.position.y - y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * speed;
      vy = (dy / d) * speed;
    }
    mesh.rotation.z = Math.atan2(vy, vx) - Math.PI / 2;
    this.bullets.push({
      mesh,
      vx,
      vy,
      damage: dmg,
      pierce,
      homing: true,
      turnRate: turn,
      target,
      hit: [],
      life: 2.2,
      dead: false,
    });
  }

  updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.homing) {
        if (!b.target || b.target.dead) b.target = this.nearestEnemy(b.mesh.position.x, b.mesh.position.y);
        if (b.target && !b.target.dead) {
          const dx = b.target.mesh.position.x - b.mesh.position.x;
          const dy = b.target.mesh.position.y - b.mesh.position.y;
          const speed = Math.hypot(b.vx, b.vy) || 1;
          const want = Math.atan2(dy, dx);
          const cur = Math.atan2(b.vy, b.vx);
          const na = lerpAngle(cur, want, Math.min(1, b.turnRate * dt));
          b.vx = Math.cos(na) * speed;
          b.vy = Math.sin(na) * speed;
        }
      }
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.rotation.z = Math.atan2(b.vy, b.vx) - Math.PI / 2;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    sweep(
      this.bullets,
      (b) => b.dead,
      (b) => this.boltPool.release(b.mesh),
    );
  }

  // --- enemy globs ---------------------------------------------------------

  spawnEnemyBullet(x: number, y: number, ux: number, uy: number) {
    const mesh = this.enemyBoltPool.acquire();
    mesh.visible = true;
    mesh.position.set(x, y, 0);
    this.enemyBullets.push({
      mesh,
      vx: ux * SPITTER.bulletSpeed,
      vy: uy * SPITTER.bulletSpeed,
      damage: SPITTER.bulletDmg,
      life: 4,
      dead: false,
    });
  }

  /** A generic glob (boss patterns) at an explicit velocity + damage. */
  spawnGlob(x: number, y: number, vx: number, vy: number, dmg: number) {
    const mesh = this.enemyBoltPool.acquire();
    mesh.visible = true;
    mesh.position.set(x, y, 0);
    this.enemyBullets.push({ mesh, vx, vy, damage: dmg, life: 6, dead: false });
  }

  updateEnemyBullets(dt: number) {
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    sweep(
      this.enemyBullets,
      (b) => b.dead,
      (b) => this.enemyBoltPool.release(b.mesh),
    );
  }

  clear() {
    for (const b of this.bullets) this.boltPool.release(b.mesh);
    this.bullets.length = 0;
    for (const b of this.enemyBullets) this.enemyBoltPool.release(b.mesh);
    this.enemyBullets.length = 0;
  }

  dispose() {
    // Every mesh ever created (active + pooled) shares the static geom/mats.
    for (const m of this.allBolts) this.render.remove(m);
    for (const m of this.allEnemyBolts) this.render.remove(m);
    this.boltGeom.dispose();
    this.enemyBoltGeom.dispose();
    this.boltMat.dispose();
    this.enemyBoltMat.dispose();
  }
}
