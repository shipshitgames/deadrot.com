import * as THREE from "three";
import { cellToWorld, mobPathPoints } from "../board";
import { COLORS, CONSTANTS } from "../constants";
import type { Creep, CreepKind, GameState, KillEvent, Projectile, Tower, TowerKind } from "../types";
import { creepStatsForWave } from "../waves";

/**
 * EntitySystem creates and simulates towers, creeps, and projectiles. It mutates
 * GameState (gold, baseHp, lists) and adds/removes meshes from the scene.
 *
 * Gameplay events (kills, breach damage) accumulate in `events` per update so
 * the Game can drive juice + audio without the simulation knowing about either.
 */

/** Per-archetype look: body/turret colors and silhouette tweaks. */
const TOWER_LOOKS: Record<TowerKind, { body: number; head: number; headScale: number; baseScale: number }> = {
  ember: { body: COLORS.gunmetal, head: COLORS.hellfire, headScale: 1, baseScale: 1 },
  stasis: { body: COLORS.iron, head: COLORS.bone, headScale: 0.8, baseScale: 0.85 },
  mortar: { body: COLORS.rust, head: COLORS.bloodHot, headScale: 1.35, baseScale: 1.25 },
};

const PROJECTILE_LOOKS: Record<TowerKind, { color: number; size: number }> = {
  ember: { color: COLORS.hellfire, size: 0.16 },
  stasis: { color: COLORS.bone, size: 0.12 },
  mortar: { color: COLORS.bloodHot, size: 0.3 },
};

export class EntitySystem {
  /** Gameplay events from the most recent update() — read then merged by the Game. */
  readonly events = {
    kills: [] as KillEvent[],
    breachDamage: 0,
  };

  private readonly creepGeo = new THREE.BoxGeometry(
    CONSTANTS.creeps.shambler.radius * 1.7,
    CONSTANTS.creeps.shambler.radius * 1.7,
    CONSTANTS.creeps.shambler.radius * 1.7,
  );
  private readonly projGeos: Record<TowerKind, THREE.SphereGeometry> = {
    ember: new THREE.SphereGeometry(PROJECTILE_LOOKS.ember.size, 8, 8),
    stasis: new THREE.SphereGeometry(PROJECTILE_LOOKS.stasis.size, 8, 8),
    mortar: new THREE.SphereGeometry(PROJECTILE_LOOKS.mortar.size, 8, 8),
  };

  constructor(private readonly scene: THREE.Scene) {}

  // ---- towers ---------------------------------------------------------------

  buildTower(state: GameState, col: number, row: number, kind: TowerKind): boolean {
    const def = CONSTANTS.towers[kind];
    if (state.gold < def.cost) return false;

    const look = TOWER_LOOKS[kind];
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55 * look.baseScale, 0.7 * look.baseScale, 0.5, 12),
      new THREE.MeshStandardMaterial({
        color: look.body,
        roughness: 0.6,
        metalness: 0.7,
      }),
    );
    base.position.y = 0.25;
    group.add(base);

    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38 * look.baseScale, 0.45 * look.baseScale, 1.0, 12),
      new THREE.MeshStandardMaterial({
        color: look.body,
        roughness: 0.5,
        metalness: 0.8,
      }),
    );
    column.position.y = 0.9;
    group.add(column);

    // Emissive firing head. Rotates toward targets.
    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * look.headScale, 0.28 * look.headScale, 0.7 * look.headScale, 10),
      new THREE.MeshStandardMaterial({
        color: look.head,
        emissive: look.head,
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

    state.towers.push({ mesh: group, turret, kind, col, row, cooldown: 0 });
    state.gold -= def.cost;
    return true;
  }

  // ---- creeps ---------------------------------------------------------------

  spawnCreep(state: GameState, kind: CreepKind): void {
    const def = CONSTANTS.creeps[kind];
    const { hp, speed } = creepStatsForWave(kind, state.wave);

    const mesh = new THREE.Mesh(
      this.creepGeo,
      new THREE.MeshStandardMaterial({
        color: COLORS.blood,
        emissive: COLORS.toxic, // sickly Scourge bio-glow, sparingly
        emissiveIntensity: kind === "boss" ? 0.55 : 0.25,
        roughness: 0.6,
      }),
    );
    // One shared geometry; archetype size comes from scale.
    mesh.scale.setScalar(def.radius / CONSTANTS.creeps.shambler.radius);
    const start = mobPathPoints[0];
    mesh.position.set(start.x, def.radius, start.z);
    this.scene.add(mesh);

    state.creeps.push({
      mesh,
      kind,
      hp,
      maxHp: hp,
      speed,
      slowTimer: 0,
      segment: 0,
      t: 0,
      dead: false,
      reachedBase: false,
    });
  }

  // ---- simulation -----------------------------------------------------------

  update(state: GameState, dt: number, t: number): void {
    this.events.kills.length = 0;
    this.events.breachDamage = 0;
    this.moveCreeps(state, dt);
    this.runTowers(state, dt, t);
    this.moveProjectiles(state, dt);
    this.cull(state);
  }

  private moveCreeps(state: GameState, dt: number): void {
    const slowFactor = CONSTANTS.towers.stasis.slowFactor;
    for (const c of state.creeps) {
      if (c.dead) continue;
      const slowed = c.slowTimer > 0;
      if (slowed) c.slowTimer = Math.max(0, c.slowTimer - dt);
      let remaining = c.speed * (slowed ? 1 - slowFactor : 1) * dt;

      while (remaining > 0 && c.segment < mobPathPoints.length - 1) {
        const a = mobPathPoints[c.segment];
        const b = mobPathPoints[c.segment + 1];
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

      if (c.segment >= mobPathPoints.length - 1) {
        // reached the base
        const damage = CONSTANTS.creeps[c.kind].breachDamage;
        c.reachedBase = true;
        c.dead = true;
        state.baseHp = Math.max(0, state.baseHp - damage);
        this.events.breachDamage += damage;
        continue;
      }

      const a = mobPathPoints[c.segment];
      const b = mobPathPoints[c.segment + 1];
      c.mesh.position.lerpVectors(a, b, c.t);
      c.mesh.position.y = CONSTANTS.creeps[c.kind].radius;
      c.mesh.rotation.y += dt * (slowed ? 1.1 : 2.5);
      // tint toward bloodHot as it loses HP; stasis chills the bio-glow
      const frac = c.hp / c.maxHp;
      const mat = c.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(frac > 0.5 ? COLORS.blood : COLORS.bloodHot);
      mat.emissive.setHex(slowed ? COLORS.bone : COLORS.toxic);
    }
  }

  private runTowers(state: GameState, dt: number, _t: number): void {
    for (const tower of state.towers) {
      const def = CONSTANTS.towers[tower.kind];
      tower.cooldown = Math.max(0, tower.cooldown - dt);

      const target = this.nearestCreep(state, tower, def.range * def.range);
      if (target) {
        this.aimTurret(tower, target, dt, def.turnSpeed);
        if (tower.cooldown <= 0) {
          this.fire(state, tower, target);
          tower.cooldown = 1 / def.fireRate;
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

  private aimTurret(tower: Tower, target: Creep, dt: number, turnSpeed: number): void {
    const dx = target.mesh.position.x - tower.mesh.position.x;
    const dz = target.mesh.position.z - tower.mesh.position.z;
    const wanted = Math.atan2(dx, dz);
    // turret group yaw lives on the parent group's Y; rotate the whole group
    const cur = tower.mesh.rotation.y;
    let diff = wanted - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = turnSpeed * dt;
    tower.mesh.rotation.y += Math.max(-step, Math.min(step, diff));
  }

  private fire(state: GameState, tower: Tower, target: Creep): void {
    const look = PROJECTILE_LOOKS[tower.kind];
    const mesh = new THREE.Mesh(
      this.projGeos[tower.kind],
      new THREE.MeshStandardMaterial({
        color: look.color,
        emissive: look.color,
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
      kind: tower.kind,
      target,
      damage: CONSTANTS.towers[tower.kind].damage,
      alive: true,
    });
  }

  private moveProjectiles(state: GameState, dt: number): void {
    for (const p of state.projectiles) {
      if (!p.alive) continue;
      const def = CONSTANTS.towers[p.kind];
      const target = p.target;
      if (!target || target.dead) {
        p.alive = false;
        continue;
      }
      const dest = target.mesh.position;
      const dir = dest.clone().sub(p.mesh.position);
      const dist = dir.length();
      const step = def.projectileSpeed * dt;

      if (dist <= step + CONSTANTS.creeps[target.kind].radius) {
        this.impact(state, p, target);
        p.alive = false;
      } else {
        dir.multiplyScalar(step / dist);
        p.mesh.position.add(dir);
      }
    }
  }

  /** Apply the archetype's on-hit effects: direct damage, stasis slow, mortar splash. */
  private impact(state: GameState, p: Projectile, target: Creep): void {
    const def = CONSTANTS.towers[p.kind];

    if (def.aoeRadius > 0) {
      const impactAt = target.mesh.position;
      const radiusSq = def.aoeRadius * def.aoeRadius;
      for (const c of state.creeps) {
        if (c.dead) continue;
        const dx = c.mesh.position.x - impactAt.x;
        const dz = c.mesh.position.z - impactAt.z;
        if (dx * dx + dz * dz <= radiusSq) this.damageCreep(state, c, p.damage);
      }
      return;
    }

    this.damageCreep(state, target, p.damage);
    if (def.slowDuration > 0 && !target.dead) {
      target.slowTimer = Math.max(target.slowTimer, def.slowDuration);
    }
  }

  private damageCreep(state: GameState, creep: Creep, dmg: number): void {
    if (creep.dead) return;
    creep.hp -= dmg;
    if (creep.hp <= 0) {
      creep.dead = true;
      state.gold += CONSTANTS.creeps[creep.kind].reward;
      this.events.kills.push({
        x: creep.mesh.position.x,
        z: creep.mesh.position.z,
        kind: creep.kind,
      });
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
