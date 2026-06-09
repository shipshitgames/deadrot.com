import * as THREE from "three";
import { COLORS, CONSTANTS, type Team } from "../constants";
import type { Game } from "../Game";
import type { Entity } from "../types";

// Q/W/E ability system. All costs/cooldowns/damage live in CONSTANTS.abilities;
// the pure math (cooldown/mana gates, line-skillshot hits, slow application) is
// exported for unit tests, and AbilitySystem wires it into the live sim:
//   Q "Cinder Lance" — line nuke that strikes the first enemy along the aim.
//   W "Pact Brand"   — ground zone that slows ~40% and ticks light damage.
//   E "Vault"        — short repositioning dash.
// The Warden AI casts a telegraphed Q on cooldown so duels stay dodge-able.

export type AbilityKey = "q" | "w" | "e";

export const ABILITY_KEYS: readonly AbilityKey[] = ["q", "w", "e"] as const;

export interface AbilitySpec {
  cooldown: number;
  manaCost: number;
}

export type AbilitySpecs = Record<AbilityKey, AbilitySpec>;

export function specsFromConstants(): AbilitySpecs {
  const a = CONSTANTS.abilities;
  return {
    q: { cooldown: a.q.cooldown, manaCost: a.q.manaCost },
    w: { cooldown: a.w.cooldown, manaCost: a.w.manaCost },
    e: { cooldown: a.e.cooldown, manaCost: a.e.manaCost },
  };
}

/** Cooldown + mana gate for one champion's three ability slots. Pure logic. */
export class AbilityCaster {
  readonly cooldowns: Record<AbilityKey, number> = { q: 0, w: 0, e: 0 };

  constructor(private readonly specs: AbilitySpecs) {}

  tick(dt: number): void {
    for (const key of ABILITY_KEYS) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }
  }

  ready(key: AbilityKey): boolean {
    return this.cooldowns[key] <= 0;
  }

  manaCost(key: AbilityKey): number {
    return this.specs[key].manaCost;
  }

  canCast(key: AbilityKey, mana: number): boolean {
    return this.ready(key) && mana >= this.specs[key].manaCost;
  }

  /** Pay for a cast: returns the remaining mana, or null when not castable. */
  cast(key: AbilityKey, mana: number): number | null {
    if (!this.canCast(key, mana)) return null;
    this.cooldowns[key] = this.specs[key].cooldown;
    return mana - this.specs[key].manaCost;
  }

  reset(): void {
    for (const key of ABILITY_KEYS) this.cooldowns[key] = 0;
  }
}

/** Mana regeneration, clamped at the pool cap. */
export function regenMana(current: number, max: number, regen: number, dt: number): number {
  return Math.min(max, current + regen * dt);
}

/** Movement speed under the Pact Brand slow (active while slowTimer > 0). */
export function slowedSpeed(base: number, slowTimer: number, slowFactor: number): number {
  return slowTimer > 0 ? base * slowFactor : base;
}

export interface FlatPoint {
  x: number;
  z: number;
}

/**
 * Distance along a line (origin + normalized dir, corridor `width` wide,
 * length `range`) at which a circular target is struck — or null on a miss.
 */
export function lineHitDistance(
  origin: FlatPoint,
  dir: FlatPoint,
  target: FlatPoint,
  targetRadius: number,
  range: number,
  width: number,
): number | null {
  const rx = target.x - origin.x;
  const rz = target.z - origin.z;
  const along = rx * dir.x + rz * dir.z;
  if (along < 0 || along > range + targetRadius) return null;
  const lateral = Math.abs(rx * dir.z - rz * dir.x);
  if (lateral > width / 2 + targetRadius) return null;
  return along;
}

export interface LineTarget {
  pos: FlatPoint;
  radius: number;
}

/** The nearest target struck by the line, MOBA skillshot style (bodies block). */
export function firstLineHit<T extends LineTarget>(
  origin: FlatPoint,
  dir: FlatPoint,
  targets: readonly T[],
  range: number,
  width: number,
): { target: T; distance: number } | null {
  let best: T | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const t of targets) {
    const d = lineHitDistance(origin, dir, t.pos, t.radius, range, width);
    if (d !== null && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ? { target: best, distance: bestD } : null;
}

// ---- live system -------------------------------------------------------------

export interface AbilityEvents {
  playerCasts: AbilityKey[];
  enemyCasts: AbilityKey[];
  dryfire: boolean; // the player tried a cast that was on cooldown / out of mana
}

interface BrandZone {
  x: number;
  z: number;
  timeLeft: number;
  tickIn: number;
  team: Team;
  dealer: Entity;
  mesh: THREE.Mesh;
}

interface PendingShot {
  x: number;
  z: number;
  dir: FlatPoint;
  timer: number;
  windup: number;
  team: Team;
  dealer: Entity;
  mesh: THREE.Mesh;
}

export class AbilitySystem {
  readonly player = new AbilityCaster(specsFromConstants());
  readonly enemy = new AbilityCaster(specsFromConstants());
  readonly events: AbilityEvents = { playerCasts: [], enemyCasts: [], dryfire: false };

  private zones: BrandZone[] = [];
  private shots: PendingShot[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    for (const zone of this.zones) this.disposeMesh(zone.mesh);
    for (const shot of this.shots) this.disposeMesh(shot.mesh);
    this.zones = [];
    this.shots = [];
    this.player.reset();
    this.enemy.reset();
    this.clearEvents();
  }

  clearEvents(): void {
    this.events.playerCasts.length = 0;
    this.events.enemyCasts.length = 0;
    this.events.dryfire = false;
  }

  update(dt: number): void {
    this.player.tick(dt);
    this.enemy.tick(dt);

    const ent = this.game.entities;
    for (const c of [ent.champion, ent.enemyChampion]) {
      if (c.alive) c.mana = regenMana(c.mana, c.maxMana, CONSTANTS.champion.manaRegen, dt);
    }

    this.handlePlayerCasts();
    this.updateEnemyAI();
    this.tickShots(dt);
    this.tickZones(dt);
  }

  // ---- player casts ----------------------------------------------------------

  private handlePlayerCasts(): void {
    const presses = this.game.input.takeAbilities();
    if (presses.length === 0) return;
    const c = this.game.entities.champion;
    if (!c.alive) return;

    for (const key of presses) {
      const remaining = this.player.cast(key, c.mana);
      if (remaining === null) {
        this.events.dryfire = true;
        continue;
      }
      c.mana = remaining;
      if (key === "q") this.castQ(c, this.aimDir(c), true);
      else if (key === "w") this.castW(c, this.brandPoint(c));
      else this.castE(c, this.dashDir(c));
      this.events.playerCasts.push(key);
    }
  }

  /** Q aim: toward the cursor's ground point, falling back to lane facing. */
  private aimDir(c: Entity): FlatPoint {
    const aim = this.game.input.aimPoint();
    if (aim) {
      const dx = aim.x - c.pos.x;
      const dz = aim.z - c.pos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.3) return { x: dx / len, z: dz / len };
    }
    const f = this.game.entities.playerFacing;
    return { x: f.x, z: f.y };
  }

  /** W target: the cursor's ground point clamped to cast range, else at the feet. */
  private brandPoint(c: Entity): FlatPoint {
    const aim = this.game.input.aimPoint();
    if (!aim) return { x: c.pos.x, z: c.pos.z };
    const dx = aim.x - c.pos.x;
    const dz = aim.z - c.pos.z;
    const dist = Math.hypot(dx, dz);
    const max = CONSTANTS.abilities.w.castRange;
    if (dist <= max || dist < 0.001) return { x: aim.x, z: aim.z };
    return { x: c.pos.x + (dx / dist) * max, z: c.pos.z + (dz / dist) * max };
  }

  /** E direction: keyboard move first, then cursor, then lane facing. */
  private dashDir(c: Entity): FlatPoint {
    const input = this.game.input;
    if (input.hasKeyboardMove) return { x: input.move.x, z: input.move.y };
    return this.aimDir(c);
  }

  // ---- the three casts (public so tests can drive them directly) --------------

  /** Cinder Lance: instant ray, strikes the first enemy body along the line. */
  castQ(caster: Entity, dir: FlatPoint, byPlayer: boolean): void {
    const spec = CONSTANTS.abilities.q;
    const ent = this.game.entities;
    const targets: Entity[] = ent.unitsHostileTo(caster.team as Team);
    // The player's lance can also spear the neutral Scourge — a buff steal tool.
    if (byPlayer && ent.scourge.alive) targets.push(ent.scourge);

    const origin = { x: caster.pos.x, z: caster.pos.z };
    const hit = firstLineHit(origin, dir, targets, spec.range, spec.width);
    const reach = hit ? hit.distance : spec.range;
    const end = new THREE.Vector3(origin.x + dir.x * reach, 1, origin.z + dir.z * reach);
    ent.beam(caster.pos, end, byPlayer ? COLORS.hellfire : COLORS.bloodHot, 0.32, 2.2);
    if (hit) ent.damage(hit.target, spec.damage, { dealer: caster, ability: true });
  }

  /** Pact Brand: drop a slowing, ticking ground zone. */
  castW(caster: Entity, point: FlatPoint): void {
    const spec = CONSTANTS.abilities.w;
    const team = caster.team as Team;
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(spec.radius, 28),
      new THREE.MeshBasicMaterial({
        color: team === "pyre" ? COLORS.hellfire : COLORS.blood,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(point.x, 0.06, point.z);
    this.game.render.add(mesh);
    this.zones.push({
      x: point.x,
      z: point.z,
      timeLeft: spec.duration,
      tickIn: spec.tickInterval * 0.4, // first tick lands fast so the cast reads
      team,
      dealer: caster,
      mesh,
    });
  }

  /** Vault: instant dash, clamped to the legal lane area. */
  castE(caster: Entity, dir: FlatPoint): void {
    const spec = CONSTANTS.abilities.e;
    const len = Math.hypot(dir.x, dir.z) || 1;
    caster.pos.x += (dir.x / len) * spec.distance;
    caster.pos.z += (dir.z / len) * spec.distance;
    const clamp = CONSTANTS.arena.laneClamp;
    caster.pos.x = THREE.MathUtils.clamp(caster.pos.x, -clamp, clamp);
    caster.pos.z = THREE.MathUtils.clamp(caster.pos.z, CONSTANTS.champion.retreatZ, CONSTANTS.base.enemyZ - 1);
  }

  // ---- Warden AI ---------------------------------------------------------------

  /** Simple deterministic caster: telegraph Q at the player whenever it's up. */
  private updateEnemyAI(): void {
    const ent = this.game.entities;
    const ai = ent.enemyChampion;
    const player = ent.champion;
    if (!ai.alive || !player.alive) return;
    if (this.shots.some((s) => s.team === "warden")) return; // one telegraph at a time

    const spec = CONSTANTS.abilities.q;
    const dist = Math.hypot(player.pos.x - ai.pos.x, player.pos.z - ai.pos.z);
    if (dist > spec.range * CONSTANTS.ai.qRangeFactor || dist < 0.001) return;

    const remaining = this.enemy.cast("q", ai.mana);
    if (remaining === null) return;
    ai.mana = remaining;

    const dir = { x: (player.pos.x - ai.pos.x) / dist, z: (player.pos.z - ai.pos.z) / dist };
    this.shots.push({
      x: ai.pos.x,
      z: ai.pos.z,
      dir,
      timer: CONSTANTS.ai.qWindup,
      windup: CONSTANTS.ai.qWindup,
      team: "warden",
      dealer: ai,
      mesh: this.makeTelegraph(ai.pos, dir, spec.range),
    });
    this.events.enemyCasts.push("q");
  }

  private makeTelegraph(from: THREE.Vector3, dir: FlatPoint, range: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.05, range),
      new THREE.MeshBasicMaterial({ color: COLORS.bloodHot, transparent: true, opacity: 0.25 }),
    );
    mesh.position.set(from.x + (dir.x * range) / 2, 0.06, from.z + (dir.z * range) / 2);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.game.render.add(mesh);
    return mesh;
  }

  /** Locked, telegraphed shots: the player dodges by leaving the line. */
  private tickShots(dt: number): void {
    const ent = this.game.entities;
    const spec = CONSTANTS.abilities.q;
    for (const shot of this.shots) {
      shot.timer -= dt;
      // The aim line burns brighter as the shot is about to fire.
      const mat = shot.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + 0.5 * (1 - Math.max(0, shot.timer) / shot.windup);
      if (shot.timer > 0) continue;

      this.disposeMesh(shot.mesh);
      const targets = ent.unitsHostileTo(shot.team);
      const hit = firstLineHit({ x: shot.x, z: shot.z }, shot.dir, targets, spec.range, spec.width);
      const reach = hit ? hit.distance : spec.range;
      const from = new THREE.Vector3(shot.x, 1.1, shot.z);
      const end = new THREE.Vector3(shot.x + shot.dir.x * reach, 1, shot.z + shot.dir.z * reach);
      ent.beam(from, end, COLORS.bloodHot, 0.32, 2.2);
      if (hit) ent.damage(hit.target, spec.damage, { dealer: shot.dealer, ability: true });
    }
    this.shots = this.shots.filter((s) => s.timer > 0);
  }

  // ---- brand zones ---------------------------------------------------------------

  private tickZones(dt: number): void {
    const ent = this.game.entities;
    const spec = CONSTANTS.abilities.w;
    for (const zone of this.zones) {
      zone.timeLeft -= dt;
      if (zone.timeLeft <= 0) {
        this.disposeMesh(zone.mesh);
        continue;
      }

      // Pulse the sigil so the zone reads as live danger.
      const mat = zone.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + 0.14 * Math.abs(Math.sin(zone.timeLeft * 6));

      const foes = ent.unitsHostileTo(zone.team);
      zone.tickIn -= dt;
      const ticking = zone.tickIn <= 0;
      if (ticking) zone.tickIn += spec.tickInterval;

      for (const foe of foes) {
        const inside = Math.hypot(foe.pos.x - zone.x, foe.pos.z - zone.z) <= spec.radius + foe.radius;
        if (!inside) continue;
        foe.slowTimer = Math.max(foe.slowTimer, spec.slowLinger);
        if (ticking) ent.damage(foe, spec.tickDamage, { dealer: zone.dealer, ability: true });
      }
    }
    this.zones = this.zones.filter((z) => z.timeLeft > 0);
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    this.game.render.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
}
