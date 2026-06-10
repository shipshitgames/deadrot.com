import * as THREE from "three";
import { audio } from "../audio";
import type { EntitySystem } from "../systems/EntitySystem";
import type { RenderSystem } from "../systems/RenderSystem";
import {
  type BossPhase,
  beamPlan,
  bossPhaseFor,
  pointSegDist,
  radialBurstAngles,
  ringBurstPlan,
  ringOffset,
} from "./bossPatterns";
import { COLORS, CONSTANTS, type EnemyType } from "./constants";
import { clamp, TAU } from "./math";
import type { Enemy } from "./types";

const HIT_FLASH = 0.09;

/** What the encounter needs from the Game: scaled spawns and run-state hooks. */
export interface BossEncounterHost {
  ringPoint(): { x: number; y: number };
  spawnAt(type: EnemyType, x: number, y: number): void;
  /** Beam damage routes through the Game (it owns integrity + i-frames). */
  hitPlayer(dmg: number): void;
  /** Run-state on defeat: count the kill, vacuum the field, enter victory. */
  onDefeated(): void;
}

// THE BLIGHT-MAW (Orbital Breach Carrier): owns the boss state machine —
// trigger, orbit/dash movement, burst/summon/spiral attacks, the telegraphed
// ring volleys + beam (bossPatterns.ts owns the math), visuals on the bespoke
// mesh, defeat rewards, and mesh teardown. The boss stays an Enemy record
// inside EntitySystem.enemies for shared damage/collision contracts.
export class BossEncounter {
  private boss: Enemy | null = null;
  private triggered = false;
  private burstT = 0;
  private dashT = 0;
  private spiralT = 0;
  private summonT = 0;
  private orbit = 0;
  private dashState: "none" | "telegraph" | "charge" = "none";
  private dashTime = 0;
  private dashX = 0;
  private dashY = 0;
  private phaseSeen: BossPhase = 1;

  // Telegraphed radial ring volley (bossPatterns.ts owns the math).
  private ringState: "idle" | "windup" | "volley" = "idle";
  private ringT = 0; // cooldown until the next volley may start
  private ringTime = 0; // timer inside the current windup/volley
  private ringIndex = 0; // next ring to fire within the volley
  private ringCount = 1; // rings in the current volley
  private ringAngle = 0; // base rotation of the current volley

  // Telegraphed beam (warning line -> burn along the locked path).
  private beamState: "idle" | "warn" | "fire" = "idle";
  private beamT = 0;
  private beamTime = 0;
  private beamX1 = 0;
  private beamY1 = 0;
  private beamX2 = 0;
  private beamY2 = 0;

  constructor(
    private readonly entities: EntitySystem,
    private readonly render: RenderSystem,
    private readonly host: BossEncounterHost,
  ) {}

  /** The active boss Enemy record (for collision exclusion), or null. */
  enemy(): Enemy | null {
    return this.boss;
  }

  isActive(): boolean {
    return this.boss !== null && !this.boss.dead;
  }

  /** Boss health 0..1 for the HUD, or null when no live boss. */
  hp01(): number | null {
    return this.boss && !this.boss.dead ? Math.max(0, this.boss.health / this.boss.maxHealth) : null;
  }

  /** Director: the boss counts itself out of the alive-cap. */
  aliveAdjustment(): number {
    return this.boss ? 1 : 0;
  }

  /** Director: spawns slow down so the fight reads as a duel. */
  spawnIntervalMul(): number {
    return this.boss ? 3 : 1;
  }

  /** Director trigger: spawn once the run clock crosses the threshold. */
  maybeTrigger(clock: number) {
    if (!this.triggered && clock >= CONSTANTS.boss.spawnAt) this.spawn();
  }

  /** Is this enemy the boss? (damage path routes its death here) */
  owns(e: Enemy): boolean {
    return e === this.boss;
  }

  private spawn() {
    this.triggered = true;
    const b = CONSTANTS.boss;
    const p = this.host.ringPoint();
    this.boss = this.entities.spawnBoss(p.x, p.y, b.baseHP, b.contactDmg, 5);
    this.burstT = 1.5;
    this.dashT = b.dashEvery;
    this.spiralT = 0;
    this.summonT = b.summonEvery;
    this.orbit = Math.random() * TAU;
    this.dashState = "none";
    this.resetAttacks();
    this.ringT = b.ring.firstDelay;
    this.beamT = b.beam.firstDelay;
    audio.sfx("boss");
    this.render.addShake(CONSTANTS.fx.shake.bossSpawn);
    this.entities.pop(p.x, p.y, COLORS.toxicHot, 40);
  }

  private phase(): BossPhase {
    if (!this.boss) return 1;
    return bossPhaseFor(this.boss.health / this.boss.maxHealth);
  }

  update(dt: number, time: number) {
    const boss = this.boss;
    if (!boss || boss.dead) return;
    const b = CONSTANTS.boss;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const phase = this.phase();

    // Phase transition: vents blow, the attack mix changes.
    if (phase > this.phaseSeen) {
      this.phaseSeen = phase;
      audio.sfx("boss");
      audio.sfx("explosion", { pitch: 0.8 });
      this.render.addShake(CONSTANTS.fx.shake.bossPhase);
      this.burst(boss.mesh.position.x, boss.mesh.position.y, COLORS.toxicHot, CONSTANTS.fx.burst.bossPhase);
    }

    // Movement: orbit the ship, unless dashing.
    if (this.dashState === "charge") {
      boss.mesh.position.x += this.dashX * dt;
      boss.mesh.position.y += this.dashY * dt;
      this.dashTime -= dt;
      if (this.dashTime <= 0) this.dashState = "none";
    } else {
      this.orbit += b.orbitSpeed * dt;
      const tx = sx + Math.cos(this.orbit) * b.orbitR;
      const ty = sy + Math.sin(this.orbit) * b.orbitR;
      boss.mesh.position.x += (tx - boss.mesh.position.x) * Math.min(1, dt * 1.4);
      boss.mesh.position.y += (ty - boss.mesh.position.y) * Math.min(1, dt * 1.4);
    }
    const bx = boss.mesh.position.x;
    const by = boss.mesh.position.y;

    // Visuals: face the ship; windup glow, else hit-flash, else a menace pulse.
    boss.mesh.rotation.z = Math.atan2(sy - by, sx - bx) + Math.PI / 2;
    if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt);
    if (boss.telegraph > 0) {
      // Attack-windup glow: blink toward hot toxic so the ring volley
      // reads clearly before it fires (overrides the hit flash).
      const blink = 0.55 + 0.45 * Math.sin(time * 16);
      boss.material.color.setHex(0xffffff).lerp(TOXIC_HOT, clamp(boss.telegraph, 0, 1) * blink);
      boss.material.opacity = 1;
    } else if (boss.flash > 0) {
      const t = clamp(boss.flash / HIT_FLASH, 0, 1);
      boss.material.color.setHex(0xffffff).lerp(BONE, t);
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + boss.phase);
      boss.material.color.setHex(0xffffff);
      boss.material.opacity = 0.94 + pulse * 0.06;
    }

    // Radial spore bursts (all phases, faster later).
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = b.burstEvery * (phase === 1 ? 1 : phase === 2 ? 0.75 : 0.55);
      boss.flash = 0.12;
      const off = Math.random() * TAU;
      for (let i = 0; i < b.burstCount; i++) {
        const a = off + (i / b.burstCount) * TAU;
        this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg);
      }
    }

    // Summons.
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = b.summonEvery;
      const type: EnemyType = phase === 3 ? "spitter" : phase === 2 ? "swarmling" : "grunt";
      for (let i = 0; i < (phase === 1 ? 2 : 3); i++) {
        this.host.spawnAt(type, bx + (Math.random() - 0.5) * 8, by + (Math.random() - 0.5) * 8);
      }
    }

    // Charge-dash (all phases; rarer in phase 1). The lunge is the boss's
    // contact threat — it travels just past the ship so it crosses the hull.
    // Never overlaps the ring windup or the beam so telegraphs stay readable.
    this.dashT -= dt;
    const otherAttackActive = this.ringState !== "idle" || this.beamState !== "idle";
    if (this.dashState === "none" && this.dashT <= 0 && !otherAttackActive) {
      this.dashState = "telegraph";
      this.dashTime = b.dashTelegraph;
      boss.flash = b.dashTelegraph;
    } else if (this.dashState === "telegraph") {
      this.dashTime -= dt;
      if (this.dashTime <= 0) {
        const ddx = sx - bx;
        const ddy = sy - by;
        const dist = Math.hypot(ddx, ddy) || 1;
        this.dashX = (ddx / dist) * b.dashSpeed;
        this.dashY = (ddy / dist) * b.dashSpeed;
        this.dashState = "charge";
        // Travel just past the ship so the lunge actually crosses the hull.
        this.dashTime = Math.min(0.8, (dist + 4) / b.dashSpeed);
        this.dashT = b.dashEvery * (phase === 1 ? 1.6 : 1);
        this.render.addShake(CONSTANTS.fx.shake.bossCharge);
      }
    }

    // Telegraphed attacks: ring volleys + the beam (each phase mixes its own).
    this.updateRing(dt, boss, phase, bx, by);
    this.updateBeam(dt, phase, bx, by, sx, sy);

    // Phase 3: rotating spiral of globs.
    if (phase === 3) {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = b.spiralEvery;
        this.orbit += 0.4;
        for (let k = 0; k < b.spiralCount; k++) {
          const a = this.orbit + (k / b.spiralCount) * TAU;
          this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg);
        }
      }
    }
  }

  /** Telegraphed radial ring volley: glow windup, then staggered slow rings.
   *  Rings per volley and the cooldown scale with the boss phase. */
  private updateRing(dt: number, boss: Enemy, phase: BossPhase, bx: number, by: number) {
    const r = CONSTANTS.boss.ring;
    if (this.ringState === "idle") {
      this.ringT -= dt;
      // Hold while dashing so the glow windup is never masked by the lunge.
      if (this.ringT <= 0 && this.dashState === "none" && this.beamState === "idle") {
        const plan = ringBurstPlan(phase);
        this.ringState = "windup";
        this.ringTime = r.telegraph;
        this.ringCount = plan.rings;
        this.ringIndex = 0;
        this.ringAngle = Math.random() * TAU;
        this.ringT = plan.cooldown;
        audio.sfx("shieldUp"); // charge-up cue alongside the glow
      }
      return;
    }
    if (this.ringState === "windup") {
      this.ringTime -= dt;
      boss.telegraph = 1 - Math.max(0, this.ringTime) / r.telegraph;
      if (this.ringTime <= 0) {
        boss.telegraph = 0;
        this.ringState = "volley";
        this.ringTime = 0; // first ring fires immediately
      } else {
        return;
      }
    }
    // volley: fire rings on the stagger cadence.
    this.ringTime -= dt;
    while (this.ringTime <= 0 && this.ringIndex < this.ringCount) {
      this.fireRing(bx, by, this.ringAngle + ringOffset(this.ringIndex, r.count));
      this.ringIndex++;
      this.ringTime += r.ringInterval;
    }
    if (this.ringIndex >= this.ringCount) this.ringState = "idle";
  }

  /** One evenly-spaced ring of slow spores (weavable at base player speed). */
  private fireRing(bx: number, by: number, offset: number) {
    const r = CONSTANTS.boss.ring;
    for (const a of radialBurstAngles(r.count, offset)) {
      this.entities.spawnGlob(bx, by, Math.cos(a) * r.bulletSpeed, Math.sin(a) * r.bulletSpeed, r.bulletDmg);
    }
    this.entities.pop(bx, by, COLORS.toxic, 10);
    audio.sfx("shootCannon", { pitch: 0.75 });
  }

  /** Telegraphed beam: a warning line locks onto the ship's position, renders
   *  for the telegraph window, then burns along the SAME line (dodge by
   *  leaving the corridor). Offline in phase 1; faster in phase 3. */
  private updateBeam(dt: number, phase: BossPhase, bx: number, by: number, sx: number, sy: number) {
    const bm = CONSTANTS.boss.beam;
    if (this.beamState === "idle") {
      const plan = beamPlan(phase);
      if (!plan) return; // offline this phase — the timer holds
      this.beamT -= dt;
      if (this.beamT <= 0 && this.dashState === "none" && this.ringState === "idle") {
        this.beamT = plan.cooldown;
        this.beamState = "warn";
        this.beamTime = bm.telegraph;
        // Lock the firing line: from the boss through the ship, full length.
        const dx = sx - bx;
        const dy = sy - by;
        const d = Math.hypot(dx, dy) || 1;
        this.beamX1 = bx;
        this.beamY1 = by;
        this.beamX2 = bx + (dx / d) * bm.length;
        this.beamY2 = by + (dy / d) * bm.length;
        audio.sfx("berserk"); // warning klaxon while the line renders
      }
      return;
    }
    if (this.beamState === "warn") {
      this.beamTime -= dt;
      const t01 = 1 - Math.max(0, this.beamTime) / bm.telegraph;
      this.entities.showBossBeamWarn(this.beamX1, this.beamY1, this.beamX2, this.beamY2, bm.width, t01);
      if (this.beamTime <= 0) {
        this.beamState = "fire";
        this.beamTime = bm.duration;
        audio.sfx("laser", { pitch: 0.6 });
        this.render.addShake(CONSTANTS.fx.shake.bossCharge);
      }
      return;
    }
    // fire: burn along the locked line; the ship's i-frames gate repeat ticks.
    this.beamTime -= dt;
    const left = Math.max(0, this.beamTime) / bm.duration;
    this.entities.showBossBeamFire(this.beamX1, this.beamY1, this.beamX2, this.beamY2, bm.width, left);
    const d = pointSegDist(sx, sy, this.beamX1, this.beamY1, this.beamX2, this.beamY2);
    if (d < bm.width / 2 + CONSTANTS.player.width * 0.5) this.host.hitPlayer(bm.damage);
    if (this.beamTime <= 0) {
      this.beamState = "idle";
      this.entities.hideBossBeam();
    }
  }

  /** Health hit zero: rewards + teardown, then hand run-state to the Game. */
  defeated(e: Enemy) {
    const x = e.mesh.position.x;
    const y = e.mesh.position.y;
    e.dead = true;
    e.mesh.visible = false;
    this.disposeBossMesh(e);
    this.boss = null;
    this.resetAttacks();
    // Triumphant gem shower + storm.
    for (let i = 0; i < 10; i++) {
      this.entities.spawnGem(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 25);
    }
    this.burst(x, y, COLORS.hellfire, CONSTANTS.fx.burst.bossDeath);
    this.burst(x, y, COLORS.bone, CONSTANTS.fx.burst.bossPhase);
    this.entities.pop(x, y, COLORS.bloodHot, 30);
    this.render.addShake(CONSTANTS.fx.shake.bossDeath);
    audio.sfx("explosion", { pitch: 0.7 });
    audio.sfx("victory");
    this.host.onDefeated();
  }

  /** New run / back to title: tear down a live boss, rearm the trigger.
   *  Call before EntitySystem.clearEnemies() (the boss mesh is bespoke). */
  reset() {
    if (this.boss && !this.boss.dead) {
      this.boss.dead = true;
      this.boss.mesh.visible = false;
      this.disposeBossMesh(this.boss);
    }
    this.boss = null;
    this.triggered = false;
    this.resetAttacks();
  }

  /** Teardown / HMR: free the bespoke mesh before EntitySystem.dispose(). */
  dispose() {
    this.reset();
  }

  /** Clear the telegraphed-attack machines (run start/exit, boss death). */
  private resetAttacks() {
    this.phaseSeen = 1;
    this.ringState = "idle";
    this.ringT = 0;
    this.ringTime = 0;
    this.ringIndex = 0;
    this.beamState = "idle";
    this.beamT = 0;
    this.beamTime = 0;
    this.entities.hideBossBeam();
  }

  /** Kit ParticleBursts spawn with the data-driven sizing from fx.burst. */
  private burst(x: number, y: number, color: number, b: { count: number; speed: number; life: number; size: number }) {
    this.render.bursts.spawn({
      position: { x, y, z: 0.5 },
      color,
      count: b.count,
      speed: b.speed,
      life: b.life,
      size: b.size,
    });
  }

  /** The bespoke (non-pooled) boss mesh: remove + free GPU resources. */
  private disposeBossMesh(e: Enemy) {
    this.render.remove(e.mesh);
    e.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }
}

// Scratch colors (avoid `new THREE.Color` in hot loops).
const BONE = new THREE.Color(COLORS.bone);
const TOXIC_HOT = new THREE.Color(COLORS.toxicHot);
