import * as THREE from "three";
import type { EntitySystem } from "../systems/EntitySystem";
import type { RenderSystem } from "../systems/RenderSystem";
import { COLORS, CONSTANTS, type EnemyType } from "./constants";
import { clamp, TAU } from "./math";
import type { Enemy } from "./types";

const HIT_FLASH = 0.09;

/** What the encounter needs from the Game: scaled spawns and run-state hooks. */
export interface BossEncounterHost {
  ringPoint(): { x: number; y: number };
  spawnAt(type: EnemyType, x: number, y: number): void;
  /** Run-state on defeat: count the kill, vacuum the field, enter victory. */
  onDefeated(): void;
}

// THE BLIGHT-MAW (Orbital Breach Carrier): owns the boss state machine —
// trigger, orbit/dash movement, burst/summon/spiral attacks, visuals on the
// bespoke mesh, defeat rewards, and mesh teardown. The boss stays an Enemy
// record inside EntitySystem.enemies for shared damage/collision contracts.
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
    this.render.addShake(CONSTANTS.fx.shake.bossSpawn);
    this.entities.pop(p.x, p.y, COLORS.toxicHot, 40);
  }

  private phase(): 1 | 2 | 3 {
    if (!this.boss) return 1;
    const pct = this.boss.health / this.boss.maxHealth;
    if (pct > CONSTANTS.boss.phase2Pct) return 1;
    if (pct > CONSTANTS.boss.phase3Pct) return 2;
    return 3;
  }

  update(dt: number, time: number) {
    const boss = this.boss;
    if (!boss || boss.dead) return;
    const b = CONSTANTS.boss;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const phase = this.phase();

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

    // Visuals: face the ship; hit-flash, else a slow menace pulse.
    boss.mesh.rotation.z = Math.atan2(sy - by, sx - bx) + Math.PI / 2;
    if (boss.flash > 0) {
      boss.flash = Math.max(0, boss.flash - dt);
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
    this.dashT -= dt;
    if (this.dashState === "none" && this.dashT <= 0) {
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

  /** Health hit zero: rewards + teardown, then hand run-state to the Game. */
  defeated(e: Enemy) {
    const x = e.mesh.position.x;
    const y = e.mesh.position.y;
    e.dead = true;
    e.mesh.visible = false;
    this.disposeBossMesh(e);
    this.boss = null;
    // Triumphant gem shower + storm.
    for (let i = 0; i < 10; i++) {
      this.entities.spawnGem(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 25);
    }
    this.entities.pop(x, y, COLORS.hellfire, 40);
    this.entities.pop(x, y, COLORS.bone, 30);
    this.entities.pop(x, y, COLORS.bloodHot, 30);
    this.render.addShake(CONSTANTS.fx.shake.bossDeath);
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
  }

  /** Teardown / HMR: free the bespoke mesh before EntitySystem.dispose(). */
  dispose() {
    this.reset();
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

// Scratch color (avoid `new THREE.Color` in hot loops).
const BONE = new THREE.Color(COLORS.bone);
