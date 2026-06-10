import { createPool, type Pool } from "@deadrot/game-kit/core";
import * as THREE from "three";
import { COLORS, CONSTANTS } from "../../game/constants";
import { TAU } from "../../game/math";
import type { Particle } from "../../game/types";
import type { RenderSystem } from "../RenderSystem";
import { sweep } from "./sweep";

export interface ParticleSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

// Burst pops + thruster-trail quads, pooled.
export class Particles {
  particles: Particle[] = [];

  private particleGeom = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  readonly trailGeom = new THREE.PlaneGeometry(0.9, 0.9);
  private all: ParticleSlot[] = [];
  private pool: Pool<ParticleSlot>;

  constructor(private readonly render: RenderSystem) {
    this.pool = createPool<ParticleSlot>(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: COLORS.hellfire, transparent: true });
        const mesh = new THREE.Mesh(this.particleGeom, mat);
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

  acquire(): ParticleSlot {
    const slot = this.pool.acquire();
    slot.mesh.visible = true;
    return slot;
  }

  pop(x: number, y: number, color: number, count: number = CONSTANTS.fx.particlePerPop) {
    for (let i = 0; i < count; i++) {
      const { mesh, mat } = this.acquire();
      mat.color.setHex(color);
      mat.opacity = 1;
      mat.blending = THREE.NormalBlending;
      mesh.geometry = this.particleGeom;
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(1);
      const a = Math.random() * TAU;
      const spd = CONSTANTS.fx.particleSpeed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        mesh,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: CONSTANTS.fx.particleLife,
        maxLife: CONSTANTS.fx.particleLife,
      });
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const t = Math.max(0, p.life / p.maxLife);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      p.mesh.scale.setScalar(0.3 + t);
    }
    sweep(
      this.particles,
      (p) => p.life <= 0,
      (p) => this.release(p.mesh),
    );
  }

  clear() {
    for (const p of this.particles) this.release(p.mesh);
    this.particles.length = 0;
  }

  private release(mesh: THREE.Mesh) {
    this.pool.release({ mesh, mat: mesh.material as THREE.MeshBasicMaterial });
  }

  dispose() {
    // Every slot ever created (active + pooled): remove + per-instance material.
    for (const s of this.all) {
      this.render.remove(s.mesh);
      s.mat.dispose();
    }
    this.particleGeom.dispose();
    this.trailGeom.dispose();
  }
}
