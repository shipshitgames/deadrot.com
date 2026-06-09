import { createPool, type Pool } from "@deadrot/game-kit/core";
import * as THREE from "three";
import { COLORS, CONSTANTS } from "../../game/constants";
import { clamp } from "../../game/math";
import type { Gem } from "../../game/types";
import type { RenderSystem } from "../RenderSystem";
import type { Particles } from "./particles";
import { type SpriteTextures, spriteMaterial, spritePlane } from "./sprites";
import { sweep } from "./sweep";

// Salvage gems: magnet pickup with lifetime/blink, pooled meshes.
export class Gems {
  gems: Gem[] = [];

  private gemGeom = spritePlane("salvage", 1);
  private gemMat: THREE.MeshBasicMaterial;
  private gemBigMat: THREE.MeshBasicMaterial;
  private all: THREE.Mesh[] = [];
  private pool: Pool<THREE.Mesh>;

  constructor(
    private readonly render: RenderSystem,
    private readonly particles: Particles,
    private readonly ship: () => THREE.Group,
    textures: SpriteTextures,
  ) {
    this.gemMat = spriteMaterial(textures, "salvage");
    this.gemBigMat = spriteMaterial(textures, "salvage");
    this.pool = createPool<THREE.Mesh>(
      () => {
        const mesh = new THREE.Mesh(this.gemGeom, this.gemMat);
        this.render.add(mesh);
        this.all.push(mesh);
        return mesh;
      },
      (m) => {
        m.visible = false;
      },
    );
  }

  spawn(x: number, y: number, value: number) {
    // Enforce the live-gem cap by auto-collecting the oldest: drop it on the
    // ship so the next update credits its value rather than discarding it.
    const ship = this.ship();
    if (this.gems.length >= CONSTANTS.xp.gemCap) {
      const old = this.gems[0];
      old.mesh.position.set(ship.position.x, ship.position.y, 0);
      old.homing = true;
    }
    const big = value >= 8;
    const mesh = this.pool.acquire();
    mesh.visible = true;
    mesh.material = big ? this.gemBigMat : this.gemMat;
    mesh.position.set(x, y, 0);
    mesh.scale.setScalar(0.01);
    this.gems.push({ mesh, value, age: 0, homing: false, spawn: 0, dead: false });
  }

  /** Magnet + pickup. Returns total raw gem value collected this frame. */
  update(dt: number, magnetRadius: number, vacuum: boolean): number {
    const ship = this.ship();
    const sx = ship.position.x;
    const sy = ship.position.y;
    const xp = CONSTANTS.xp;
    let collected = 0;
    for (const g of this.gems) {
      if (g.dead) continue;
      g.age += dt;
      if (g.spawn < 1) {
        g.spawn = Math.min(1, g.spawn + dt * 5);
        g.mesh.scale.setScalar(0.2 + g.spawn * (g.value >= 8 ? 1.0 : 0.7));
      }
      g.mesh.rotation.y += dt * 3;
      const dx = sx - g.mesh.position.x;
      const dy = sy - g.mesh.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (vacuum) g.homing = true;
      if (!g.homing && dist < magnetRadius) g.homing = true;
      // Up close: the fast vacuum slurp. Far away: a gentle gravity-well drift so
      // the whole field always funnels toward the ship (weapons kill at range, so
      // gems would otherwise scatter unreachably across the arena).
      let speed = xp.globalPull;
      if (g.homing) {
        const near = clamp(1 - dist / Math.max(magnetRadius, 8), 0, 1);
        speed = xp.gemSpeedFar + (xp.gemSpeedNear - xp.gemSpeedFar) * near;
      }
      g.mesh.position.x += (dx / dist) * speed * dt;
      g.mesh.position.y += (dy / dist) * speed * dt;
      if (dist < xp.pickupDist) {
        collected += g.value;
        g.dead = true;
        this.particles.pop(g.mesh.position.x, g.mesh.position.y, COLORS.ember, 4);
        continue;
      }
      // Lifetime + blink warning.
      if (g.age > xp.gemLifetime) g.dead = true;
      else if (g.age > xp.gemBlink) g.mesh.visible = Math.floor(g.age * 8) % 2 === 0;
    }
    sweep(
      this.gems,
      (g) => g.dead,
      (g) => this.pool.release(g.mesh),
    );
    return collected;
  }

  clear() {
    for (const g of this.gems) this.pool.release(g.mesh);
    this.gems.length = 0;
  }

  dispose() {
    for (const m of this.all) this.render.remove(m);
    this.gemGeom.dispose();
    this.gemMat.dispose();
    this.gemBigMat.dispose();
  }
}
