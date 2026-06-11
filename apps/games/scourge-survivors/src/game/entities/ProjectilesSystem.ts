import * as THREE from "three";
import { PROJECTILE_TTL, WALL_THICKNESS } from "../constants";
import type { GameContext } from "../context";
import type { Projectile } from "../data/internalTypes";
import { PROJECTILE_SPRITE_TEXTURES } from "../spriteAssets";
import type { GameSystems } from "../systems";
import type { Enemy, EnemyShot } from "./Enemy";
import { PlayerTargetCombat, type ProjectileCombat } from "./ProjectileCombat";

/** Shape the integrator stuffs into ProjectileView.meta; resolvers narrow to this. */
export interface ProjectileMeta {
  owner: Enemy | null;
  fromBoss: boolean;
}

/** Enemy / boss projectiles: spawn, fly, expire or get blocked; hits resolve through `combat`. */
export class ProjectilesSystem {
  projectiles: Projectile[] = [];
  /** Hit-resolution seam — swap to retarget projectiles; defaults to damaging the player. */
  combat: ProjectileCombat;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {
    this.combat = new PlayerTargetCombat(this.ctx, this.sys);
  }

  spawnProjectile(shot: EnemyShot, owner: Enemy | null = null) {
    const color = shot.fromBoss ? 0xff2d6a : 0xff8a3c;
    const mesh = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: shot.fromBoss ? PROJECTILE_SPRITE_TEXTURES.boss : PROJECTILE_SPRITE_TEXTURES.enemy,
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const baseScale = shot.fromBoss ? 0.9 : 0.58;
    mesh.scale.setScalar(baseScale);
    mesh.position.copy(shot.origin);
    this.ctx.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: shot.dir.clone().multiplyScalar(shot.speed),
      damage: shot.damage,
      age: 0,
      fromBoss: shot.fromBoss,
      baseScale,
      spin: (Math.random() < 0.5 ? -1 : 1) * (shot.fromBoss ? 3.8 : 5.5),
      owner,
      view: {
        position: mesh.position, // live alias — flight is visible to the resolver without copying
        damage: shot.damage,
        meta: { owner, fromBoss: shot.fromBoss } satisfies ProjectileMeta,
      },
    });
  }

  /** Despawn any in-flight projectiles fired by a given enemy (it just died). */
  removeProjectilesFrom(enemy: Enemy) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].owner === enemy) this.removeProjectile(i);
    }
  }

  updateProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.age += delta;
      pr.mesh.position.addScaledVector(pr.vel, delta);
      const pulse = 1 + Math.sin(pr.age * (pr.fromBoss ? 10 : 14)) * 0.12;
      pr.mesh.scale.setScalar(pr.baseScale * pulse);
      (pr.mesh.material as THREE.SpriteMaterial).rotation += delta * pr.spin;
      const p = pr.mesh.position;

      // hit something? (the resolver owns the hit test and its side effects)
      if (this.combat.resolveHit(pr.view)) {
        this.removeProjectileObject(pr);
        continue;
      }
      // expired / out of bounds / into an obstacle?
      if (pr.age >= PROJECTILE_TTL || !this.ctx.bounds.containsXZ(p.x, p.z, WALL_THICKNESS / 2) || p.y < 0.05) {
        this.removeProjectile(i);
        continue;
      }
      let blocked = false;
      for (const box of this.ctx.obstacleBoxes) {
        if (
          p.x > box.min.x - 0.1 &&
          p.x < box.max.x + 0.1 &&
          p.z > box.min.z - 0.1 &&
          p.z < box.max.z + 0.1 &&
          p.y < box.max.y + 0.1
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) this.removeProjectile(i);
    }
  }

  removeProjectile(i: number) {
    const pr = this.projectiles[i];
    if (!pr) return;
    this.ctx.scene.remove(pr.mesh);
    (pr.mesh.material as THREE.Material).dispose();
    this.projectiles.splice(i, 1);
  }

  removeProjectileObject(projectile: Projectile) {
    const i = this.projectiles.indexOf(projectile);
    if (i !== -1) this.removeProjectile(i);
  }

  clearProjectiles() {
    for (const pr of this.projectiles) {
      this.ctx.scene.remove(pr.mesh);
      (pr.mesh.material as THREE.Material).dispose();
    }
    this.projectiles = [];
  }
}
