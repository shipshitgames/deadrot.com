// Pooled one-shot particle bursts (kill pops, pickup sparkles, landing dust) as
// additive THREE.Points. Bursts are preallocated and recycled — zero allocation
// per spawn after warm-up — and particle counts scale with the user's global
// "particles" effect level.

import { getGlobalEffectLevel } from "@shipshitgames/ui";
import * as THREE from "three";

import { type BoundedPool, createBoundedPool } from "../core/pool";

export interface BurstOptions {
  position: { x: number; y: number; z: number };
  color?: THREE.ColorRepresentation;
  /** Particle count before the user's particles-level scaling. Default 14. */
  count?: number;
  /** Initial speed (units/s). Default 4. */
  speed?: number;
  /** Lifetime in seconds. Default 0.45. */
  life?: number;
  /** Downward acceleration (units/s²). Default 0 (e.g. 9 for dust/debris). */
  gravity?: number;
  /** Point size in world units. Default 0.18. */
  size?: number;
  /** Upward bias 0..1 added to the random direction (0 = full sphere). Default 0. */
  upwardBias?: number;
}

interface Burst {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
  life: number;
  maxLife: number;
  gravity: number;
  active: boolean;
}

const MAX_PARTICLES = 64;

export interface ParticleBurstsOptions {
  /** Max simultaneous bursts before the oldest is recycled. Default 24. */
  maxBursts?: number;
  /** Override the density scalar; defaults to the global "particles" effect level. */
  getLevel?: () => number;
}

export class ParticleBursts {
  private readonly pool: BoundedPool<Burst>;
  private readonly getLevel: () => number;

  constructor(
    private readonly scene: THREE.Scene,
    opts: ParticleBurstsOptions = {},
  ) {
    this.getLevel = opts.getLevel ?? (() => getGlobalEffectLevel("particles"));
    // When all bursts are live, recycle the one closest to expiring.
    this.pool = createBoundedPool(opts.maxBursts ?? 24, () => this.create(), {
      isActive: (b) => b.active,
      recyclePriority: (b) => -b.life,
    });
  }

  spawn(opts: BurstOptions) {
    const level = this.getLevel();
    const count = Math.min(MAX_PARTICLES, Math.round((opts.count ?? 14) * level));
    if (count <= 0) return;

    const burst = this.pool.acquire();
    if (!burst) return;

    const speed = opts.speed ?? 4;
    const upwardBias = opts.upwardBias ?? 0;
    burst.count = count;
    burst.maxLife = opts.life ?? 0.45;
    burst.life = burst.maxLife;
    burst.gravity = opts.gravity ?? 0;

    for (let i = 0; i < count; i++) {
      burst.positions[i * 3] = opts.position.x;
      burst.positions[i * 3 + 1] = opts.position.y;
      burst.positions[i * 3 + 2] = opts.position.z;
      // Random direction on the unit sphere with optional upward bias.
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const s = speed * (0.4 + Math.random() * 0.6);
      burst.velocities[i * 3] = Math.cos(theta) * r * s;
      burst.velocities[i * 3 + 1] = (z + upwardBias) * s;
      burst.velocities[i * 3 + 2] = Math.sin(theta) * r * s;
    }

    burst.geometry.setDrawRange(0, count);
    burst.geometry.attributes.position!.needsUpdate = true;
    burst.material.color.set(opts.color ?? 0xff6a00);
    burst.material.size = opts.size ?? 0.18;
    burst.material.opacity = 1;
    burst.points.visible = true;
    burst.active = true;
  }

  update(dt: number) {
    this.pool.forEach((burst) => {
      if (!burst.active) return;
      burst.life -= dt;
      if (burst.life <= 0) {
        burst.active = false;
        burst.points.visible = false;
        return;
      }
      for (let i = 0; i < burst.count; i++) {
        burst.velocities[i * 3 + 1]! -= burst.gravity * dt;
        burst.positions[i * 3]! += burst.velocities[i * 3]! * dt;
        burst.positions[i * 3 + 1]! += burst.velocities[i * 3 + 1]! * dt;
        burst.positions[i * 3 + 2]! += burst.velocities[i * 3 + 2]! * dt;
      }
      burst.material.opacity = burst.life / burst.maxLife;
      burst.geometry.attributes.position!.needsUpdate = true;
    });
  }

  dispose() {
    this.pool.forEach((burst) => {
      this.scene.remove(burst.points);
      burst.geometry.dispose();
      burst.material.dispose();
    });
    this.pool.items.length = 0;
  }

  private create(): Burst {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const velocities = new Float32Array(MAX_PARTICLES * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.18,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.visible = false;
    this.scene.add(points);
    return {
      points,
      geometry,
      material,
      positions,
      velocities,
      count: 0,
      life: 0,
      maxLife: 1,
      gravity: 0,
      active: false,
    };
  }
}
