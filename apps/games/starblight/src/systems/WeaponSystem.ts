import * as THREE from "three";
import { COLORS, CONSTANTS } from "../game/constants";
import { TAU } from "../game/math";
import type { Enemy } from "../game/types";
import { atLevel, type Stats, type UpgradeId, WEAPONS } from "../game/upgrades";
import type { EntitySystem } from "./EntitySystem";
import type { RenderSystem } from "./RenderSystem";

const SEEKER_RANGE = 28; // seeker only locks the Scourge once they're near/in view

export type DamageFn = (e: Enemy, dmg: number, allowCrit?: boolean) => void;

interface Nova {
  mesh: THREE.Mesh;
  age: number;
  ttl: number;
  maxR: number;
  dmg: number;
  knock: number;
  hit: Set<Enemy>;
}
interface Mine {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  dmg: number;
  blast: number;
  arm: number;
  life: number;
  dead: boolean;
}

// Owns the auto-firing, auto-aiming arsenal. Every weapon reads the drafted
// loadout (levels + folded passive Stats) and fires on its own cadence; the
// hands stay on flight. Damage routes through a single DamageFn the Game owns
// (so kills, gems, score, and shake stay centralized).
export class WeaponSystem {
  damageEnemy: DamageFn = () => {};
  /** Fired once per bolt volley/shot so the Game can voice (throttled) fire SFX. */
  onFire: () => void = () => {};
  private levels = new Map<UpgradeId, number>();
  private stats!: Stats;

  // timers
  private seekerT = 0;
  private novaT = 0;
  private wakeT = 0;

  // drones (orbit contact)
  private droneGroup = new THREE.Group();
  private drones: THREE.Mesh[] = [];
  private droneAngle = 0;
  private droneCd = new WeakMap<Enemy, number>();

  // wingmates (trail + fire)
  private wings: { mesh: THREE.Mesh; fireT: number; ox: number; oy: number }[] = [];

  // nova rings + lingering scorch
  private novas: Nova[] = [];
  private scorch: { mesh: THREE.Mesh; age: number; ttl: number; r: number; dps: number }[] = [];

  // beams (re-aiming)
  private beams: THREE.Mesh[] = [];

  // mines
  private mines: Mine[] = [];

  // shared assets
  private droneGeom = new THREE.SphereGeometry(0.5, 12, 10);
  private droneMat = new THREE.MeshBasicMaterial({ color: COLORS.ember });
  private wingGeom = new THREE.ConeGeometry(0.6, 1.4, 4);
  private wingMat = new THREE.MeshBasicMaterial({ color: COLORS.bone });
  private ringGeom = new THREE.RingGeometry(0.86, 1.0, 40);
  private novaMat = new THREE.MeshBasicMaterial({
    color: COLORS.hellfire,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private scorchMat = new THREE.MeshBasicMaterial({
    color: COLORS.hellfire,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private beamGeom = new THREE.PlaneGeometry(1, 1);
  private beamMat = new THREE.MeshBasicMaterial({
    color: COLORS.bloodHot,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private mineGeom = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  private mineMat = new THREE.MeshBasicMaterial({ color: COLORS.hellfire });

  constructor(
    private readonly render: RenderSystem,
    private readonly entities: EntitySystem,
  ) {
    this.droneGroup.visible = false;
    this.render.add(this.droneGroup);
  }

  private lv(id: UpgradeId): number {
    return this.levels.get(id) ?? 0;
  }

  /** Re-read the loadout after a draft and reconcile pooled visuals. */
  setLoadout(levels: Map<UpgradeId, number>, stats: Stats) {
    this.levels = levels;
    this.stats = stats;
    this.reconcileDrones();
    this.reconcileWings();
    this.reconcileBeams();
  }

  reset() {
    this.seekerT = 0;
    this.novaT = 0;
    this.wakeT = 0;
    this.droneAngle = 0;
    for (const n of this.novas) {
      this.render.remove(n.mesh);
      (n.mesh.material as THREE.Material).dispose();
    }
    this.novas.length = 0;
    for (const s of this.scorch) {
      this.render.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    this.scorch.length = 0;
    for (const m of this.mines) {
      this.render.remove(m.mesh);
      (m.mesh.material as THREE.Material).dispose();
    }
    this.mines.length = 0;
    for (const b of this.beams) b.visible = false;
  }

  update(dt: number, clock: number) {
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    this.updateSeeker(dt, sx, sy);
    this.updateDrones(dt, clock, sx, sy);
    this.updateWings(dt, sx, sy);
    this.updateNova(dt, sx, sy);
    this.updateBeams(dt, sx, sy);
    this.updateMines(dt);
  }

  // --- SEEKER BOLTS ------------------------------------------------------
  private updateSeeker(dt: number, sx: number, sy: number) {
    const lv = this.lv("seeker");
    if (lv <= 0) return;
    this.seekerT -= dt;
    if (this.seekerT > 0) return;
    // Only engage the Scourge once they're in/near view — otherwise the swarm
    // gets sniped off-screen and never closes (kills the survivors fantasy).
    const lead = this.entities.nearestEnemy(sx, sy, SEEKER_RANGE);
    if (!lead) {
      this.seekerT = 0.08; // recheck soon
      return;
    }
    const w = WEAPONS.seeker;
    this.seekerT = atLevel(w.interval, lv, 0.6) / this.stats.fireRateMul;
    const count = atLevel(w.count, lv, 1);
    const dmg = atLevel(w.damage, lv, 10);
    const pierce = atLevel(w.pierce, lv, 0);
    const picked: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const t = this.nearestExcluding(sx, sy, picked);
      if (t) picked.push(t);
      this.entities.spawnBolt(sx, sy, t, dmg, pierce, 34, 4);
    }
    this.onFire();
  }

  private nearestExcluding(x: number, y: number, exclude: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.entities.enemies) {
      if (e.dead || exclude.includes(e)) continue;
      const d = (e.mesh.position.x - x) ** 2 + (e.mesh.position.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    // Null when every live enemy is already picked — callers must NOT re-target
    // an already-chosen enemy (a spare bolt fires straight; a spare beam hides).
    return best;
  }

  // --- PHALANX DRONES ----------------------------------------------------
  private reconcileDrones() {
    const lv = this.lv("phalanx");
    const want = lv > 0 ? atLevel(WEAPONS.phalanx.count, lv, 2) : 0;
    while (this.drones.length < want) {
      const d = new THREE.Mesh(this.droneGeom, this.droneMat);
      this.droneGroup.add(d);
      this.drones.push(d);
    }
    while (this.drones.length > want) {
      const d = this.drones.pop()!;
      this.droneGroup.remove(d);
    }
    this.droneGroup.visible = want > 0;
  }

  private updateDrones(dt: number, clock: number, sx: number, sy: number) {
    const lv = this.lv("phalanx");
    if (lv <= 0 || this.drones.length === 0) return;
    const w = WEAPONS.phalanx;
    const radius = atLevel(w.radius, lv, 4) * this.stats.areaMul;
    const dmg = atLevel(w.damage, lv, 6);
    const spin = 2.4 + 0.16 * (lv - 1);
    this.droneAngle += spin * dt;
    this.droneGroup.position.set(sx, sy, 0);
    const n = this.drones.length;
    const hitR = 1.1;
    for (let i = 0; i < n; i++) {
      const ang = this.droneAngle + (i / n) * TAU;
      const dx = Math.cos(ang) * radius;
      const dy = Math.sin(ang) * radius;
      this.drones[i].position.set(dx, dy, 0);
      const wx = sx + dx;
      const wy = sy + dy;
      for (const e of this.entities.enemies) {
        if (e.dead) continue;
        const dd = (e.mesh.position.x - wx) ** 2 + (e.mesh.position.y - wy) ** 2;
        const rr = hitR + e.radius;
        if (dd < rr * rr && (this.droneCd.get(e) ?? 0) <= clock) {
          this.droneCd.set(e, clock + 0.25);
          this.damageEnemy(e, dmg);
        }
      }
    }
  }

  // --- WINGMATE FIGHTERS -------------------------------------------------
  private reconcileWings() {
    const lv = this.lv("wing");
    const want = lv > 0 ? atLevel(WEAPONS.wing.count, lv, 1) : 0;
    while (this.wings.length < want) {
      const mesh = new THREE.Mesh(this.wingGeom, this.wingMat);
      this.render.add(mesh);
      this.wings.push({ mesh, fireT: 0, ox: 0, oy: 0 });
    }
    while (this.wings.length > want) {
      const wgt = this.wings.pop()!;
      this.render.remove(wgt.mesh);
    }
    // Formation offsets (spread off the wings).
    const slots = [
      [-3.2, -1.5],
      [3.2, -1.5],
      [0, -3.4],
    ];
    for (let i = 0; i < this.wings.length; i++) {
      this.wings[i].ox = slots[i][0];
      this.wings[i].oy = slots[i][1];
    }
  }

  private updateWings(dt: number, sx: number, sy: number) {
    const lv = this.lv("wing");
    if (lv <= 0 || this.wings.length === 0) return;
    const w = WEAPONS.wing;
    const interval = atLevel(w.interval, lv, 0.8) / this.stats.fireRateMul;
    const dmg = atLevel(w.damage, lv, 7);
    const pierce = atLevel(w.pierce, lv, 0);
    for (const wgt of this.wings) {
      const tx = sx + wgt.ox;
      const ty = sy + wgt.oy;
      wgt.mesh.position.x += (tx - wgt.mesh.position.x) * Math.min(1, dt * 6);
      wgt.mesh.position.y += (ty - wgt.mesh.position.y) * Math.min(1, dt * 6);
      wgt.fireT -= dt;
      if (wgt.fireT <= 0) {
        const t = this.entities.nearestEnemy(wgt.mesh.position.x, wgt.mesh.position.y, 22);
        if (t) {
          wgt.fireT = interval;
          this.entities.spawnBolt(wgt.mesh.position.x, wgt.mesh.position.y, t, dmg, pierce, 36, 3);
          this.onFire();
        }
      }
    }
  }

  // --- PYRE NOVA ---------------------------------------------------------
  private updateNova(dt: number, sx: number, sy: number) {
    const lv = this.lv("nova");
    if (lv > 0) {
      this.novaT -= dt;
      if (this.novaT <= 0) {
        const w = WEAPONS.nova;
        this.novaT = atLevel(w.interval, lv, 3.2) / this.stats.fireRateMul;
        this.castNova(sx, sy, lv);
      }
    }
    // expanding rings
    for (let i = this.novas.length - 1; i >= 0; i--) {
      const nv = this.novas[i];
      nv.age += dt;
      const t = nv.age / nv.ttl;
      const r = nv.maxR * t;
      nv.mesh.position.set(sx, sy, -0.4); // ride the hull
      nv.mesh.scale.setScalar(Math.max(0.001, r));
      (nv.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - t));
      for (const e of this.entities.enemies) {
        if (e.dead || nv.hit.has(e)) continue;
        const d = Math.hypot(e.mesh.position.x - sx, e.mesh.position.y - sy);
        if (d <= r) {
          nv.hit.add(e);
          this.damageEnemy(e, nv.dmg);
          this.entities.knockback(e, sx, sy, nv.knock);
        }
      }
      if (nv.age >= nv.ttl) {
        this.render.remove(nv.mesh);
        (nv.mesh.material as THREE.Material).dispose();
        this.novas.splice(i, 1);
      }
    }
    // lingering scorch (nova L5)
    for (let i = this.scorch.length - 1; i >= 0; i--) {
      const s = this.scorch[i];
      s.age += dt;
      s.mesh.position.set(sx, sy, -0.45);
      s.mesh.scale.setScalar(s.r);
      for (const e of this.entities.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.mesh.position.x - sx, e.mesh.position.y - sy);
        if (d <= s.r) this.damageEnemy(e, s.dps * dt, false);
      }
      if (s.age >= s.ttl) {
        this.render.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.scorch.splice(i, 1);
      }
    }
  }

  private castNova(sx: number, sy: number, lv: number) {
    const w = WEAPONS.nova;
    const maxR = atLevel(w.radius, lv, 7) * this.stats.areaMul;
    const dmg = atLevel(w.damage, lv, 14);
    const knock = atLevel(w.knockback, lv, 6);
    const mesh = new THREE.Mesh(this.ringGeom, this.novaMat.clone());
    mesh.rotation.x = 0;
    mesh.position.set(sx, sy, -0.4);
    mesh.scale.setScalar(0.001);
    this.render.add(mesh);
    this.novas.push({ mesh, age: 0, ttl: 0.5, maxR, dmg, knock, hit: new Set() });
    this.entities.pop(sx, sy, COLORS.hellfire, 8);
    this.render.addShake(CONSTANTS.fx.shake.novaDetonate);
    if (lv >= 5) {
      // A lingering scorch disc you stand inside (the SUPERNOVA evolution).
      const sm = new THREE.Mesh(new THREE.CircleGeometry(1, 32), this.scorchMat.clone());
      sm.position.set(sx, sy, -0.45);
      this.render.add(sm);
      this.scorch.push({ mesh: sm, age: 0, ttl: 1.5, r: maxR * 0.8, dps: dmg * 0.5 });
    }
  }

  // --- WARDEN LANCE (beam) ----------------------------------------------
  private reconcileBeams() {
    const lv = this.lv("lance");
    const want = lv > 0 ? atLevel(WEAPONS.lance.count, lv, 1) : 0;
    while (this.beams.length < want) {
      const b = new THREE.Mesh(this.beamGeom, this.beamMat);
      b.visible = false;
      this.render.add(b);
      this.beams.push(b);
    }
    while (this.beams.length > want) {
      const b = this.beams.pop()!;
      this.render.remove(b);
    }
  }

  private updateBeams(dt: number, sx: number, sy: number) {
    const lv = this.lv("lance");
    if (lv <= 0 || this.beams.length === 0) return;
    const w = WEAPONS.lance;
    const dps = atLevel(w.damage, lv, 22);
    const length = atLevel(w.length, lv, 18);
    const width = atLevel(w.width, lv, 1.2) * this.stats.areaMul;
    const picked: Enemy[] = [];
    for (const beam of this.beams) {
      const target = this.nearestExcluding(sx, sy, picked);
      if (!target) {
        beam.visible = false;
        continue;
      }
      picked.push(target);
      const ang = Math.atan2(target.mesh.position.y - sy, target.mesh.position.x - sx);
      const ex = sx + Math.cos(ang) * length;
      const ey = sy + Math.sin(ang) * length;
      beam.visible = true;
      beam.position.set((sx + ex) / 2, (sy + ey) / 2, -0.3);
      beam.rotation.z = ang;
      beam.scale.set(length, width, 1);
      // damage all enemies along the segment
      for (const e of this.entities.enemies) {
        if (e.dead) continue;
        const d = pointSegDist(e.mesh.position.x, e.mesh.position.y, sx, sy, ex, ey);
        if (d < width / 2 + e.radius) this.damageEnemy(e, dps * dt, false);
      }
    }
  }

  // --- CINDER WAKE (mines) ----------------------------------------------
  private updateMines(dt: number) {
    const lv = this.lv("wake");
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    if (lv > 0) {
      this.wakeT -= dt;
      const w = WEAPONS.wake;
      const maxAlive = atLevel(w.count, lv, 4);
      if (this.wakeT <= 0 && this.mines.length < maxAlive) {
        this.wakeT = atLevel(w.interval, lv, 1.1) / this.stats.fireRateMul;
        this.dropMine(sx, sy, atLevel(w.damage, lv, 20), atLevel(w.radius, lv, 3) * this.stats.areaMul);
      }
    }
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.life -= dt;
      if (m.arm > 0) m.arm -= dt;
      m.mesh.position.x += m.vx * dt;
      m.mesh.position.y += m.vy * dt;
      m.vx *= 0.02 ** dt;
      m.vy *= 0.02 ** dt;
      const armed = m.arm <= 0;
      m.mesh.rotation.z += dt * (armed ? 6 : 1.5);
      (m.mesh.material as THREE.MeshBasicMaterial).color.setHex(armed ? COLORS.bloodHot : COLORS.hellfire);
      // proximity trigger
      let trigger = m.life <= 0;
      if (armed && !trigger) {
        for (const e of this.entities.enemies) {
          if (e.dead) continue;
          const dd = Math.hypot(e.mesh.position.x - m.mesh.position.x, e.mesh.position.y - m.mesh.position.y);
          if (dd < m.blast * 0.55 + e.radius) {
            trigger = true;
            break;
          }
        }
      }
      if (trigger && armed) {
        this.detonateMine(m, lv >= 5);
        this.removeMine(i);
      } else if (m.life <= 0) {
        this.removeMine(i);
      }
    }
  }

  private dropMine(x: number, y: number, dmg: number, blast: number) {
    const mesh = new THREE.Mesh(this.mineGeom, this.mineMat.clone());
    mesh.position.set(x, y, -0.2);
    this.render.add(mesh);
    // Dropped in the wake — it stays put (with a little drift) as you fly off.
    this.mines.push({
      mesh,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      dmg,
      blast,
      arm: 0.5,
      life: 6,
      dead: false,
    });
  }

  private removeMine(i: number) {
    const m = this.mines[i];
    this.render.remove(m.mesh);
    (m.mesh.material as THREE.Material).dispose();
    this.mines.splice(i, 1);
  }

  private detonateMine(m: Mine, chain: boolean) {
    const mx = m.mesh.position.x;
    const my = m.mesh.position.y;
    for (const e of this.entities.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.mesh.position.x - mx, e.mesh.position.y - my);
      if (d < m.blast + e.radius) {
        this.damageEnemy(e, m.dmg);
        this.entities.knockback(e, mx, my, 5);
      }
    }
    this.entities.pop(mx, my, COLORS.hellfire, 14);
    this.render.addShake(CONSTANTS.fx.shake.mineDetonate);
    if (chain) {
      for (const other of this.mines) {
        if (other === m || other.dead) continue;
        const d = Math.hypot(other.mesh.position.x - mx, other.mesh.position.y - my);
        if (d < m.blast * 1.4) other.arm = -1; // force-arm so it triggers next frame
      }
    }
  }

  /** Free every GPU resource this system owns (called on teardown / HMR). */
  dispose() {
    this.reset(); // clears live novas/scorch/mines + their cloned materials
    this.render.remove(this.droneGroup);
    for (const w of this.wings) this.render.remove(w.mesh);
    for (const b of this.beams) this.render.remove(b);
    this.droneGeom.dispose();
    this.droneMat.dispose();
    this.wingGeom.dispose();
    this.wingMat.dispose();
    this.ringGeom.dispose();
    this.novaMat.dispose();
    this.scorchMat.dispose();
    this.beamGeom.dispose();
    this.beamMat.dispose();
    this.mineGeom.dispose();
    this.mineMat.dispose();
  }
}

// Distance from point P to segment AB.
function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}
