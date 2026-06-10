import * as THREE from "three";
import { audio } from "../../audio/AudioEngine";
import type { GameContext } from "../context";
import {
  BOLT_DMG,
  BOLT_SPEED,
  BOLT_TTL,
  NOVA_DMG,
  NOVA_INTERVAL,
  NOVA_RADIUS,
  ORBIT_DMG,
  ORBIT_HIT_CD,
  ORBIT_HIT_RADIUS,
  ORBIT_RADIUS,
  ORBIT_SPEED,
  type WeaponUpgradeId,
} from "../data/survivors";
import type { Enemy } from "../entities/Enemy";
import { PROJECTILE_SPRITE_TEXTURES } from "../spriteAssets";

export interface AutoWeaponLevels {
  orbit: number;
  bolt: number;
  nova: number;
}

export interface RingCastOptions {
  x: number;
  z: number;
  y: number;
  innerRadius: number;
  segments: number;
  color: number;
  opacity: number;
  ttl: number;
  dmg: number;
  maxR: number;
}

/**
 * Survivors auto-weapons: the orbiting blades, homing bolts, and nova rings
 * (the bastion pulse reuses the nova ring pipeline via {@link castRing}).
 * Owns all auto-weapon runtime state; damage application is delegated back
 * to SurvivorsSystem via the injected `autoDamage` callback.
 */
export class SurvivorsAutoWeapons {
  orbitLevel = 0;
  boltLevel = 0;
  novaLevel = 0;
  // auto-weapon runtime
  orbitGroup!: THREE.Group;
  orbitOrbs: THREE.Sprite[] = [];
  orbitAngle = 0;
  orbitCd = new WeakMap<Enemy, number>();
  bolts: { mesh: THREE.Sprite; vel: THREE.Vector3; dmg: number; age: number; pierce: number }[] = [];
  boltTimer = 0;
  novas: { mesh: THREE.Mesh; age: number; ttl: number; hit: Set<Enemy>; dmg: number; maxR: number }[] = [];
  novaTimer = NOVA_INTERVAL;

  private evolved: Record<WeaponUpgradeId, boolean> = { orbit: false, bolt: false, nova: false };
  private multishot = 0;

  constructor(
    private ctx: GameContext,
    private autoDamage: (enemy: Enemy, dmg: number) => void,
  ) {}

  init() {
    this.orbitGroup = new THREE.Group();
    this.orbitGroup.visible = false;
    this.ctx.scene.add(this.orbitGroup);
  }

  /** Reset the per-run fire timers (called from initSurvivorsRun). */
  resetTimers() {
    this.boltTimer = 0;
    this.novaTimer = NOVA_INTERVAL;
  }

  /** Remove every live auto-weapon entity from the scene. */
  clear() {
    for (const b of this.bolts) {
      this.ctx.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bolts = [];
    for (const n of this.novas) {
      this.ctx.scene.remove(n.mesh);
      n.mesh.geometry.dispose();
      (n.mesh.material as THREE.Material).dispose();
    }
    this.novas = [];
    this.rebuildOrbit(0);
    this.orbitGroup.visible = false;
  }

  /** Re-derive auto-weapon levels / orbit ring from the current build (called from recomputeStats). */
  recompute(levels: AutoWeaponLevels, evolved: Record<WeaponUpgradeId, boolean>, multishot: number) {
    this.evolved = evolved;
    this.multishot = multishot;
    this.orbitLevel = levels.orbit;
    this.boltLevel = levels.bolt;
    this.novaLevel = levels.nova;
    // L1 = 2 blades; Splinter Ignition adds blades; Pyre Cyclone adds 2 more.
    const orbitCount = this.orbitLevel ? this.orbitLevel + 1 + this.multishot + (this.evolved.orbit ? 2 : 0) : 0;
    this.rebuildOrbit(orbitCount);
    if (this.ctx.survivors) this.orbitGroup.visible = this.orbitLevel > 0;
  }

  update(delta: number, clock: number) {
    this.updateOrbit(delta, clock);
    this.updateBolts(delta);
    this.updateNovas(delta);
  }

  rebuildOrbit(count: number) {
    for (const o of this.orbitOrbs) {
      this.orbitGroup.remove(o);
      // Sprites share an internal geometry; only the per-orb material is ours to free
      // (the map is the shared PROJECTILE_SPRITE_TEXTURES.orb and must NOT be disposed).
      (o.material as THREE.Material).dispose();
    }
    this.orbitOrbs = [];
    const evo = this.evolved.orbit;
    const r = evo ? 0.44 : 0.32;
    const color = evo ? 0xffd166 : 0xffffff;
    for (let i = 0; i < count; i++) {
      const orb = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: PROJECTILE_SPRITE_TEXTURES.orb,
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      orb.scale.setScalar(r * 2.4);
      this.orbitGroup.add(orb);
      this.orbitOrbs.push(orb);
    }
  }

  updateOrbit(delta: number, clock: number) {
    if (this.orbitLevel <= 0) {
      this.orbitGroup.visible = false;
      return;
    }
    this.orbitGroup.visible = true;
    this.orbitGroup.position.set(this.ctx.body.position.x, 1.2, this.ctx.body.position.z);
    const evo = this.evolved.orbit; // PYRE CYCLONE: bigger, faster, deadlier
    this.orbitAngle += ORBIT_SPEED * (evo ? 1.6 : 1) * delta;
    const ringR = ORBIT_RADIUS * (evo ? 1.25 : 1);
    const n = this.orbitOrbs.length;
    for (let i = 0; i < n; i++) {
      const ang = this.orbitAngle + (i / n) * Math.PI * 2;
      this.orbitOrbs[i].position.set(Math.cos(ang) * ringR, 0, Math.sin(ang) * ringR);
    }
    const dmg = ORBIT_DMG * (1 + 0.25 * (this.orbitLevel - 1)) * (evo ? 1.6 : 1);
    const hitR = ORBIT_HIT_RADIUS * (evo ? 1.8 : 1);
    const now = clock;
    for (const enemy of this.ctx.enemies) {
      if (!enemy.alive) continue;
      const ep = enemy.position;
      let near = false;
      for (const orb of this.orbitOrbs) {
        const ox = this.orbitGroup.position.x + orb.position.x;
        const oz = this.orbitGroup.position.z + orb.position.z;
        if (Math.hypot(ep.x - ox, ep.z - oz) < hitR + enemy.radius) {
          near = true;
          break;
        }
      }
      if (near && (this.orbitCd.get(enemy) ?? 0) <= now) {
        this.orbitCd.set(enemy, now + ORBIT_HIT_CD);
        this.autoDamage(enemy, dmg);
      }
    }
  }

  updateBolts(delta: number) {
    if (this.boltLevel > 0) {
      this.boltTimer -= delta;
      const evo = this.evolved.bolt; // EMBER STORM: faster, more, piercing
      const interval = Math.max(0.12, (0.9 - 0.08 * (this.boltLevel - 1)) * (evo ? 0.55 : 1));
      if (this.boltTimer <= 0) {
        this.boltTimer = interval;
        const count = 1 + Math.floor((this.boltLevel - 1) / 2) + this.multishot + (evo ? 2 : 0);
        for (let i = 0; i < count; i++) this.fireBolt();
      }
    }
    const eyeY = 1.3;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += delta;
      // light homing toward nearest enemy
      const tgt = this.nearestEnemy(b.mesh.position);
      if (tgt) {
        const dx = tgt.position.x - b.mesh.position.x;
        const dz = tgt.position.z - b.mesh.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const cur = b.vel.length() || BOLT_SPEED;
        b.vel.x += (dx / d) * cur * 2.5 * delta;
        b.vel.z += (dz / d) * cur * 2.5 * delta;
        b.vel.setLength(cur);
      }
      b.mesh.position.addScaledVector(b.vel, delta);
      b.mesh.position.y = eyeY;
      let hitEnemy: Enemy | null = null;
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive) continue;
        if (
          Math.hypot(enemy.position.x - b.mesh.position.x, enemy.position.z - b.mesh.position.z) <
          0.8 + enemy.radius
        ) {
          hitEnemy = enemy;
          break;
        }
      }
      if (hitEnemy) {
        this.autoDamage(hitEnemy, b.dmg);
        b.pierce -= 1;
        if (b.pierce < 0) {
          this.removeBolt(i);
          continue;
        }
      }
      if (b.age > BOLT_TTL || !this.ctx.bounds.containsXZ(b.mesh.position.x, b.mesh.position.z, 1)) {
        this.removeBolt(i);
      }
    }
  }

  fireBolt() {
    const tgt = this.nearestEnemy(this.ctx.body.position);
    if (!tgt) return;
    const mesh = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: PROJECTILE_SPRITE_TEXTURES.bolt,
        color: this.evolved.bolt ? 0xffd166 : 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    mesh.scale.setScalar(this.evolved.bolt ? 1.35 : 1.1);
    mesh.position.set(this.ctx.body.position.x, 1.3, this.ctx.body.position.z);
    const dx = tgt.position.x - mesh.position.x;
    const dz = tgt.position.z - mesh.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const vel = new THREE.Vector3((dx / d) * BOLT_SPEED, 0, (dz / d) * BOLT_SPEED);
    this.ctx.scene.add(mesh);
    const pierce = Math.floor((this.boltLevel - 1) / 2) + (this.evolved.bolt ? 2 : 0);
    this.bolts.push({ mesh, vel, dmg: BOLT_DMG * (1 + 0.18 * (this.boltLevel - 1)), age: 0, pierce });
    audio.sfx("hit");
  }

  removeBolt(i: number) {
    const b = this.bolts[i];
    this.ctx.scene.remove(b.mesh);
    // Sprites share an internal geometry; only the per-bolt material is ours to free
    // (the map texture is shared via PROJECTILE_SPRITE_TEXTURES and must NOT be disposed).
    (b.mesh.material as THREE.Material).dispose();
    this.bolts.splice(i, 1);
  }

  updateNovas(delta: number) {
    if (this.novaLevel > 0) {
      this.novaTimer -= delta;
      // FURNACE HEART: erupts roughly twice as often
      const interval = Math.max(0.9, (NOVA_INTERVAL - 0.22 * (this.novaLevel - 1)) * (this.evolved.nova ? 0.5 : 1));
      if (this.novaTimer <= 0) {
        this.novaTimer = interval;
        this.castNova();
      }
    }
    for (let i = this.novas.length - 1; i >= 0; i--) {
      const nv = this.novas[i];
      nv.age += delta;
      const t = nv.age / nv.ttl;
      const radius = nv.maxR * t;
      nv.mesh.scale.setScalar(Math.max(0.001, radius));
      (nv.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - t));
      // damage enemies the ring has reached (once each)
      for (const enemy of this.ctx.enemies) {
        if (!enemy.alive || nv.hit.has(enemy)) continue;
        const d = Math.hypot(enemy.position.x - nv.mesh.position.x, enemy.position.z - nv.mesh.position.z);
        if (d <= radius) {
          nv.hit.add(enemy);
          this.autoDamage(enemy, nv.dmg);
        }
      }
      if (nv.age >= nv.ttl) {
        this.ctx.scene.remove(nv.mesh);
        nv.mesh.geometry.dispose();
        (nv.mesh.material as THREE.Material).dispose();
        this.novas.splice(i, 1);
      }
    }
  }

  /** Spawn an expanding damage ring (shared by the nova weapon and the bastion pulse). */
  castRing(opts: RingCastOptions) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(opts.innerRadius, 1.0, opts.segments),
      new THREE.MeshBasicMaterial({
        color: opts.color,
        transparent: true,
        opacity: opts.opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(opts.x, opts.y, opts.z);
    ring.scale.setScalar(0.001);
    this.ctx.scene.add(ring);
    this.novas.push({
      mesh: ring,
      age: 0,
      ttl: opts.ttl,
      hit: new Set(),
      dmg: opts.dmg,
      maxR: opts.maxR,
    });
  }

  castNova() {
    this.castRing({
      x: this.ctx.body.position.x,
      z: this.ctx.body.position.z,
      y: 0.2,
      innerRadius: 0.82,
      segments: 40,
      color: 0xff7a3c,
      opacity: 0.6,
      ttl: 0.55,
      dmg: NOVA_DMG * (1 + 0.3 * (this.novaLevel - 1)) * (this.evolved.nova ? 1.4 : 1),
      maxR: NOVA_RADIUS * (1 + 0.12 * (this.novaLevel - 1)) * (this.evolved.nova ? 1.5 : 1),
    });
    audio.sfx("boss");
  }

  nearestEnemy(from: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.ctx.enemies) {
      if (!e.alive) continue;
      const d = (e.position.x - from.x) ** 2 + (e.position.z - from.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
}
