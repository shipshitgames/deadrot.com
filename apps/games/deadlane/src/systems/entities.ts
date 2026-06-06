import * as THREE from "three";
import { CONSTANTS, COLORS } from "../constants";
import { cellToWorld, pathPoints } from "../board";
import type { Creep, GameState, Tower } from "../types";

/**
 * EntitySystem creates and simulates towers, creeps, and projectiles. It mutates
 * GameState (gold, baseHp, lists) and adds/removes meshes from the scene.
 *
 * It exposes `baseHitThisFrame` so the RenderSystem can flash the base on breach.
 */
export class EntitySystem {
  baseHitThisFrame = false;

  private readonly creepGeo = new THREE.BoxGeometry(
    CONSTANTS.creep.radius * 1.7,
    CONSTANTS.creep.radius * 1.7,
    CONSTANTS.creep.radius * 1.7,
  );
  private readonly projGeo = new THREE.SphereGeometry(0.16, 8, 8);

  constructor(private readonly scene: THREE.Scene) {}

  // ---- towers ---------------------------------------------------------------

  buildTower(state: GameState, col: number, row: number): boolean {
    const cost = CONSTANTS.economy.towerCost;
    if (state.gold < cost) return false;

    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.5, 12),
      new THREE.MeshStandardMaterial({
        color: COLORS.gunmetal,
        roughness: 0.6,
        metalness: 0.7,
      }),
    );
    base.position.y = 0.25;
    group.add(base);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.45, 1.0, 12),
      new THREE.MeshStandardMaterial({
        color: COLORS.gunmetal,
        roughness: 0.5,
        metalness: 0.8,
      }),
    );
    column.position.y = 0.9;
    group.add(column);

    // Hellfire emissive top — the firing head. Rotates toward targets.
    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10),
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 1.4,
        roughness: 0.4,
      }),
    );
    turret.position.y = 1.5;
    // lay the barrel flat so it points outward (along +Z by default)
    turret.rotation.x = Math.PI / 2;
    group.add(turret);

    const p = cellToWorld(col, row);
    group.position.set(p.x, 0, p.z);
    this.scene.add(group);

    state.towers.push({ mesh: group, turret, col, row, cooldown: 0 });
    state.gold -= cost;
    return true;
  }

  // ---- creeps ---------------------------------------------------------------

  spawnCreep(state: GameState): void {
    const wave = Math.max(1, state.wave);
    const hp = CONSTANTS.creep.baseHp * CONSTANTS.creep.hpGrowth ** (wave - 1);
    const speed = CONSTANTS.creep.baseSpeed * CONSTANTS.creep.speedGrowth ** (wave - 1);

    const mesh = new THREE.Mesh(
      this.creepGeo,
      new THREE.MeshStandardMaterial({
        color: COLORS.blood,
        emissive: COLORS.toxic, // sickly Scourge bio-glow, sparingly
        emissiveIntensity: 0.25,
        roughness: 0.6,
      }),
    );
    const start = pathPoints[0];
    mesh.position.set(start.x, CONSTANTS.creep.radius, start.z);
    this.scene.add(mesh);

    state.creeps.push({
      mesh,
      hp,
      maxHp: hp,
      speed,
      segment: 0,
      t: 0,
      dead: false,
      reachedBase: false,
    });
  }

  // ---- simulation -----------------------------------------------------------

  update(state: GameState, dt: number, t: number): void {
    this.baseHitThisFrame = false;
    this.moveCreeps(state, dt);
    this.runTowers(state, dt, t);
    this.moveProjectiles(state, dt);
    this.cull(state);
  }

  private moveCreeps(state: GameState, dt: number): void {
    for (const c of state.creeps) {
      if (c.dead) continue;
      let remaining = c.speed * dt;

      while (remaining > 0 && c.segment < pathPoints.length - 1) {
        const a = pathPoints[c.segment];
        const b = pathPoints[c.segment + 1];
        const segLen = a.distanceTo(b);
        const distLeftOnSeg = segLen * (1 - c.t);

        if (remaining < distLeftOnSeg) {
          c.t += remaining / segLen;
          remaining = 0;
        } else {
          remaining -= distLeftOnSeg;
          c.segment++;
          c.t = 0;
        }
      }

      if (c.segment >= pathPoints.length - 1) {
        // reached the base
        c.reachedBase = true;
        c.dead = true;
        state.baseHp = Math.max(0, state.baseHp - 1);
        this.baseHitThisFrame = true;
        continue;
      }

      const a = pathPoints[c.segment];
      const b = pathPoints[c.segment + 1];
      c.mesh.position.lerpVectors(a, b, c.t);
      c.mesh.position.y = CONSTANTS.creep.radius;
      c.mesh.rotation.y += dt * 2.5;
      // tint toward bloodHot as it loses HP
      const frac = c.hp / c.maxHp;
      const mat = c.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(frac > 0.5 ? COLORS.blood : COLORS.bloodHot);
    }
  }

  private runTowers(state: GameState, dt: number, _t: number): void {
    const rangeSq = CONSTANTS.tower.range * CONSTANTS.tower.range;

    for (const tower of state.towers) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);

      const target = this.nearestCreep(state, tower, rangeSq);
      if (target) {
        this.aimTurret(tower, target, dt);
        if (tower.cooldown <= 0) {
          this.fire(state, tower, target);
          tower.cooldown = 1 / CONSTANTS.tower.fireRate;
        }
      }
    }
  }

  private nearestCreep(state: GameState, tower: Tower, rangeSq: number): Creep | null {
    const origin = tower.mesh.position;
    let best: Creep | null = null;
    let bestD = Infinity;
    for (const c of state.creeps) {
      if (c.dead) continue;
      const dx = c.mesh.position.x - origin.x;
      const dz = c.mesh.position.z - origin.z;
      const d = dx * dx + dz * dz;
      if (d <= rangeSq && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private aimTurret(tower: Tower, target: Creep, dt: number): void {
    const dx = target.mesh.position.x - tower.mesh.position.x;
    const dz = target.mesh.position.z - tower.mesh.position.z;
    const wanted = Math.atan2(dx, dz);
    // turret group yaw lives on the parent group's Y; rotate the whole group
    const cur = tower.mesh.rotation.y;
    let diff = wanted - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = CONSTANTS.tower.turnSpeed * dt;
    tower.mesh.rotation.y += Math.max(-step, Math.min(step, diff));
  }

  private fire(state: GameState, tower: Tower, target: Creep): void {
    const mesh = new THREE.Mesh(
      this.projGeo,
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 2.2,
      }),
    );
    // spawn at the turret muzzle
    const muzzle = new THREE.Vector3();
    tower.turret.getWorldPosition(muzzle);
    mesh.position.copy(muzzle);
    this.scene.add(mesh);

    state.projectiles.push({
      mesh,
      target,
      damage: CONSTANTS.tower.damage,
      alive: true,
    });
  }

  private moveProjectiles(state: GameState, dt: number): void {
    const speed = CONSTANTS.tower.projectileSpeed;
    for (const p of state.projectiles) {
      if (!p.alive) continue;
      const target = p.target;
      if (!target || target.dead) {
        p.alive = false;
        continue;
      }
      const dest = target.mesh.position;
      const dir = dest.clone().sub(p.mesh.position);
      const dist = dir.length();
      const step = speed * dt;

      if (dist <= step + CONSTANTS.creep.radius) {
        // hit
        this.damageCreep(state, target, p.damage);
        p.alive = false;
      } else {
        dir.multiplyScalar(step / dist);
        p.mesh.position.add(dir);
      }
    }
  }

  private damageCreep(state: GameState, creep: Creep, dmg: number): void {
    if (creep.dead) return;
    creep.hp -= dmg;
    if (creep.hp <= 0) {
      creep.dead = true;
      state.gold += CONSTANTS.economy.killReward;
    }
  }

  /** Remove dead/finished entities from the scene and the lists. */
  private cull(state: GameState): void {
    state.creeps = state.creeps.filter((c) => {
      if (c.dead) {
        this.scene.remove(c.mesh);
        return false;
      }
      return true;
    });
    state.projectiles = state.projectiles.filter((p) => {
      if (!p.alive) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  /** Tear down all entity meshes (used on reset). */
  clear(state: GameState): void {
    for (const t of state.towers) this.scene.remove(t.mesh);
    for (const c of state.creeps) this.scene.remove(c.mesh);
    for (const p of state.projectiles) this.scene.remove(p.mesh);
    state.towers = [];
    state.creeps = [];
    state.projectiles = [];
  }
}
