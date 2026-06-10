import { recordWarResult } from "@deadrot/game-kit/core";
import { audio } from "../audio";
import { EntitySystem } from "../systems/EntitySystem";
import { HudSystem } from "../systems/HudSystem";
import { InputSystem } from "../systems/InputSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import { clearPauseActions, emitRunEnd, setPauseActions, subscribeDrydockTiers } from "../ui/gameBridge";
import {
  type BossPhase,
  beamPlan,
  bossPhaseFor,
  pointSegDist,
  radialBurstAngles,
  ringBurstPlan,
  ringOffset,
} from "./bossPatterns";
import { COLORS, CONSTANTS, type EnemyType, WORLD } from "./constants";
import type { ShopTiers } from "./drydock";
import type { DraftCard, Enemy, GamePhase, HudState } from "./types";
import { ALL_UPGRADES, computeStats, defOf, maxLevelOf, type Stats, type UpgradeId, xpForLevel } from "./upgrades";

const TAU = Math.PI * 2;

// Survivors orchestrator: owns run-state (XP / level / integrity / draft), the
// time-driven director, the boss state machine, collisions, and the rAF loop.
export class Game {
  private render: RenderSystem;
  private input: InputSystem;
  private entities: EntitySystem;
  private weapons: WeaponSystem;
  private hud: HudSystem;

  // --- run-state ---------------------------------------------------------
  private phase: GamePhase = "title";
  private clock = 0;
  private level = 1;
  private currentXP = 0;
  private pendingLevels = 0;
  private integrity: number = CONSTANTS.player.startIntegrity;
  private kills = 0;
  private salvage = 0; // total gem value collected (the "salvage" readout)
  private invuln = 0;
  private vacuum = false; // queued salvage-pulse (vacuum all gems next frame)

  private levels = new Map<UpgradeId, number>();
  private stats: Stats = computeStats(new Map(), CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
  private draft: DraftCard[] | null = null;

  // Persisted Drydock meta-upgrade tiers (pushed from React via the bridge),
  // folded into a run's starting stats + loadout.
  private shopTiers: ShopTiers = {};
  private unsubTiers: () => void = () => {};

  // --- director ----------------------------------------------------------
  private spawnT = 0;
  private eliteT = 0;

  // --- boss --------------------------------------------------------------
  private boss: Enemy | null = null;
  private bossTriggered = false;
  private bossBurstT = 0;
  private bossDashT = 0;
  private bossSpiralT = 0;
  private bossSummonT = 0;
  private bossOrbit = 0;
  private bossDashState: "none" | "telegraph" | "charge" = "none";
  private bossDashTime = 0;
  private bossDashX = 0;
  private bossDashY = 0;
  private bossPhaseSeen: BossPhase = 1;

  // Telegraphed radial ring volley (bossPatterns.ts owns the math).
  private bossRingState: "idle" | "windup" | "volley" = "idle";
  private bossRingT = 0; // cooldown until the next volley may start
  private bossRingTime = 0; // timer inside the current windup/volley
  private bossRingIndex = 0; // next ring to fire within the volley
  private bossRingCount = 1; // rings in the current volley
  private bossRingAngle = 0; // base rotation of the current volley

  // Telegraphed beam (warning line -> burn along the locked path).
  private bossBeamState: "idle" | "warn" | "fire" = "idle";
  private bossBeamT = 0;
  private bossBeamTime = 0;
  private bossBeamX1 = 0;
  private bossBeamY1 = 0;
  private bossBeamX2 = 0;
  private bossBeamY2 = 0;

  // --- audio / juice throttles --------------------------------------------
  private laserT = 0;
  private laserQueued = false;
  private explosionT = 0;
  private gemSfxT = 0;
  private gemStreak = 0;
  private lastGemAt = -999;
  private lowHealthT = 0;
  private bossHitFxT = 0;

  private raf = 0;
  private prev = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas);
    this.input = new InputSystem(canvas);
    this.entities = new EntitySystem(this.render);
    this.weapons = new WeaponSystem(this.render, this.entities);
    this.weapons.damageEnemy = (e, dmg, allowCrit) => this.damageEnemy(e, dmg, allowCrit);
    // Weapon fire is voiced once per frame at most, throttled in simulate().
    this.weapons.onFire = () => {
      this.laserQueued = true;
    };
    this.hud = new HudSystem(
      () => this.startRun(),
      (id) => this.pickById(id),
      () => this.pauseRun(),
    );
    // The shared PauseMenu (React) invokes these through the gameBridge.
    setPauseActions({
      resume: () => this.resumeRun(),
      restart: () => this.startRun(),
      title: () => this.returnToTitle(),
    });
    // React pushes persisted Drydock tiers through the bridge (replayed on subscribe).
    this.unsubTiers = subscribeDrydockTiers((tiers) => this.setShopTiers(tiers));
  }

  start() {
    this.input.bind();
    this.entities.buildShip();
    this.emitHud();
    this.prev = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsubTiers();
    clearPauseActions();
    this.input.dispose();
    this.weapons.dispose();
    this.entities.dispose();
    this.hud.dispose();
    this.render.dispose();
  }

  // --- run lifecycle -----------------------------------------------------

  private startRun() {
    this.phase = "playing";
    this.clock = 0;
    this.level = 1;
    this.currentXP = 0;
    this.pendingLevels = 0;
    this.kills = 0;
    this.salvage = 0;
    this.invuln = 0;
    this.vacuum = false;
    this.draft = null;

    this.levels = new Map<UpgradeId, number>([["seeker", 1]]); // start armed
    // Drydock: Phalanx Cache starts the sortie with the orbiting drones too.
    if ((this.shopTiers.phalanxcache ?? 0) > 0) this.levels.set("phalanx", 1);
    this.recomputeStats();
    this.integrity = this.stats.maxIntegrity;

    this.entities.clearEnemies();
    this.entities.clearProjectiles();
    this.entities.clearGems();
    this.entities.clearParticles();
    this.entities.resetShip();
    this.weapons.reset();
    this.weapons.setLoadout(this.levels, this.stats);
    this.render.resetFocus(0, 0);

    this.boss = null;
    this.bossTriggered = false;
    this.spawnT = 0.6;
    this.eliteT = CONSTANTS.director.eliteEvery;
    this.resetBossAttacks();
    this.resetFeedback();

    audio.unlock(); // started from a click/keypress — the gesture allows audio
    this.emitHud();
  }

  /** Clear the telegraphed-attack machines (run start/exit, boss death). */
  private resetBossAttacks() {
    this.bossPhaseSeen = 1;
    this.bossRingState = "idle";
    this.bossRingT = 0;
    this.bossRingTime = 0;
    this.bossRingIndex = 0;
    this.bossBeamState = "idle";
    this.bossBeamT = 0;
    this.bossBeamTime = 0;
    this.entities.hideBossBeam();
  }

  /** Reset the audio/juice throttles so a fresh run starts quiet. */
  private resetFeedback() {
    this.laserT = 0;
    this.laserQueued = false;
    this.explosionT = 0;
    this.gemSfxT = 0;
    this.gemStreak = 0;
    this.lastGemAt = -999;
    this.lowHealthT = 0;
    this.bossHitFxT = 0;
  }

  private pauseRun() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.emitHud();
  }

  private resumeRun() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.emitHud();
  }

  private returnToTitle() {
    this.phase = "title";
    this.clock = 0;
    this.level = 1;
    this.currentXP = 0;
    this.pendingLevels = 0;
    this.kills = 0;
    this.salvage = 0;
    this.invuln = 0;
    this.vacuum = false;
    this.draft = null;

    this.levels = new Map();
    this.recomputeStats();
    this.integrity = this.stats.maxIntegrity;

    this.entities.clearEnemies();
    this.entities.clearProjectiles();
    this.entities.clearGems();
    this.entities.clearParticles();
    this.entities.resetShip();
    this.weapons.reset();
    this.render.resetFocus(0, 0);

    this.boss = null;
    this.bossTriggered = false;
    this.spawnT = 0;
    this.eliteT = 0;
    this.resetBossAttacks();
    this.resetFeedback();

    this.emitHud();
  }

  private recomputeStats() {
    this.stats = computeStats(this.levels, this.baseMagnet(), this.baseIntegrity());
    if (this.integrity > this.stats.maxIntegrity) this.integrity = this.stats.maxIntegrity;
    this.weapons.setLoadout(this.levels, this.stats);
  }

  // Drydock meta-upgrades bias only the START of a run: Reinforced Frame raises
  // base integrity, Salvage Magnet scales base magnet. They fold into the base
  // args of computeStats — its signature is unchanged so in-run draft math is
  // untouched. Picked up by the next startRun()/recomputeStats().
  private baseIntegrity(): number {
    return CONSTANTS.player.startIntegrity + 20 * (this.shopTiers.frame ?? 0);
  }

  private baseMagnet(): number {
    return CONSTANTS.xp.baseMagnet * (1 + 0.15 * (this.shopTiers.magnet ?? 0));
  }

  /** React side (via bridge): store the latest purchased tiers for the next run. */
  private setShopTiers(tiers: ShopTiers) {
    this.shopTiers = tiers ?? {};
  }

  // --- main loop ---------------------------------------------------------

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    const dt = Math.min((now - this.prev) / 1000, CONSTANTS.maxDelta);
    this.prev = now;

    if (this.input.consumePause()) {
      if (this.phase === "playing") this.pauseRun();
      else if (this.phase === "paused") this.resumeRun();
    }

    if (this.phase === "playing") this.simulate(dt);

    // Camera follows the ship (also keeps the menu backdrop alive). Kill-pop
    // bursts only advance while simulating — same gate as the legacy particle
    // sim in simulate() — so all FX freeze together on pause / level-up.
    this.render.update(dt, this.entities.ship.position.x, this.entities.ship.position.y, this.phase === "playing");
    this.render.render();
    this.emitHud();

    // Menu confirm starts / restarts, or resumes from pause.
    if (this.phase === "paused" && this.input.consumeConfirm()) {
      this.resumeRun();
    } else if (
      (this.phase === "title" || this.phase === "gameover" || this.phase === "victory") &&
      this.input.consumeConfirm()
    ) {
      this.startRun();
    } else {
      this.input.consumeConfirm();
    }
    // Drain a queued keyboard card pick while drafting.
    if (this.phase === "levelup") {
      const c = this.input.consumeCard();
      if (c >= 0 && this.draft && c < this.draft.length) this.pickById(this.draft[c].id);
    } else {
      this.input.consumeCard();
    }
  };

  private simulate(dt: number) {
    this.clock += dt;
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    this.laserT = Math.max(0, this.laserT - dt);
    this.explosionT = Math.max(0, this.explosionT - dt);
    this.gemSfxT = Math.max(0, this.gemSfxT - dt);
    this.bossHitFxT = Math.max(0, this.bossHitFxT - dt);

    // 1. flight
    const aim = this.render.screenToWorld(this.input.ndcX, this.input.ndcY);
    const key = this.input.keyAxis();
    this.entities.moveShip(aim.x, aim.y, key.x, key.y, dt, this.stats.moveMul, this.stats.accelMul);

    // 2. director + 3. enemy AI
    this.director(dt);
    this.entities.updateEnemies(dt, this.clock);
    if (this.boss) this.updateBoss(dt);

    // 4. weapons fire / deal damage
    this.weapons.update(dt, this.clock);
    this.voiceWeaponFire();

    // 5. player bolts vs enemies
    this.entities.updateBullets(dt);
    this.resolveBolts();

    // 6. enemy globs vs ship + 7. contact
    this.entities.updateEnemyBullets(dt);
    this.resolveEnemyBullets();
    this.resolveContact();

    // 8. salvage magnet + XP
    const raw = this.entities.updateGems(dt, this.stats.magnetRadius, this.vacuum);
    this.vacuum = false;
    if (raw > 0) this.gainXp(raw);

    this.entities.updateParticles(dt);
    this.entities.sweepEnemies();
    this.updateLowHealthWarning(dt);

    if (this.integrity <= 0 && this.phase === "playing") {
      this.integrity = 0;
      this.phase = "gameover";
      audio.sfx("defeat");
      emitRunEnd(Math.round(this.salvage)); // bank salvage as Drydock wreckage
      // Bank the loss into the cross-game war record (Warline shows it).
      recordWarResult("starblight", { outcome: "defeat", score: this.level }, Date.now());
      this.emitHud();
    }
  }

  /** Throttled weapon-fire cue: at most 1/laserMinInterval plays per second. */
  private voiceWeaponFire() {
    if (!this.laserQueued) return;
    this.laserQueued = false;
    if (this.laserT > 0) return;
    const a = CONSTANTS.audio;
    this.laserT = a.laserMinInterval;
    audio.sfx("laser", { pitch: a.laserPitchLo + Math.random() * (a.laserPitchHi - a.laserPitchLo) });
  }

  /** Periodic warning ping while integrity sits under the danger threshold. */
  private updateLowHealthWarning(dt: number) {
    const a = CONSTANTS.audio;
    if (this.integrity > 0 && this.integrity < this.stats.maxIntegrity * a.lowHealthPct) {
      this.lowHealthT -= dt;
      if (this.lowHealthT <= 0) {
        this.lowHealthT = a.lowHealthEvery;
        audio.sfx("lowhealth");
      }
    } else {
      this.lowHealthT = 0; // re-crossing the threshold pings immediately
    }
  }

  // --- director ----------------------------------------------------------

  private director(dt: number) {
    const d = CONSTANTS.director;
    // Boss trigger.
    if (!this.bossTriggered && this.clock >= CONSTANTS.boss.spawnAt) {
      this.spawnBoss();
    }

    // Alive-cap ramps over the run.
    const ramp = Math.min(1, this.clock / d.aliveRampTime);
    const aliveCap = d.aliveMin + (d.aliveMax - d.aliveMin) * ramp;
    const aliveCount = this.boss ? this.entities.enemies.length - 1 : this.entities.enemies.length;

    this.spawnT -= dt;
    if (this.spawnT <= 0 && aliveCount < aliveCap) {
      let interval = Math.max(d.spawnFloor, d.spawnBase - this.clock * d.spawnSlope);
      if (this.boss) interval *= 3; // the fight reads as a duel
      this.spawnT = interval;
      const batch = Math.min(d.batchCap, d.batchBase + Math.floor(this.clock / d.batchPer));
      // Respect remaining headroom each pick so a swarmling cluster can't blow
      // past the alive-cap in a single tick (the cap protects the framerate).
      let headroom = Math.floor(aliveCap) - aliveCount;
      for (let i = 0; i < batch && headroom > 0; i++) {
        headroom -= this.spawnFromRing(this.pickType(), headroom);
      }
    }

    this.eliteT -= dt;
    if (!this.boss && this.eliteT <= 0) {
      this.eliteT = d.eliteEvery;
      const p = this.ringPoint();
      this.entities.pop(p.x, p.y, COLORS.toxicHot, 16); // spawn flare
      this.render.addShake(CONSTANTS.fx.shake.eliteSpawn);
      this.spawnAt("elite", p.x, p.y);
    }
  }

  private pickType(): EnemyType {
    const c = this.clock;
    const weights: [EnemyType, number][] = [
      ["grunt", 1],
      ["swarmling", c > 20 ? 0.8 : 0.1],
      ["weaver", c > 30 ? 0.6 : 0],
      ["spitter", c > 45 ? 0.5 : 0],
    ];
    let total = 0;
    for (const [, w] of weights) total += w;
    let r = Math.random() * total;
    for (const [type, w] of weights) {
      r -= w;
      if (r <= 0) return type;
    }
    return "grunt";
  }

  private ringPoint(): { x: number; y: number } {
    const a = Math.random() * TAU;
    const r = this.render.viewHalfDiag + CONSTANTS.director.ringPad;
    const lim = WORLD.halfW - 2;
    const x = clamp(this.entities.ship.position.x + Math.cos(a) * r, -lim, lim);
    const y = clamp(this.entities.ship.position.y + Math.sin(a) * r, -lim, lim);
    return { x, y };
  }

  /** Spawns one pick (a swarmling cluster or a single enemy), clamped to the
   *  given headroom. Returns how many enemies it actually spawned. */
  private spawnFromRing(type: EnemyType, headroom: number): number {
    const p = this.ringPoint();
    if (type === "swarmling") {
      const n = Math.min(headroom, 5 + Math.floor(Math.random() * 4));
      for (let i = 0; i < n; i++) {
        this.spawnAt("swarmling", p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6);
      }
      return n;
    }
    this.spawnAt(type, p.x, p.y);
    return 1;
  }

  private spawnAt(type: EnemyType, x: number, y: number) {
    const d = CONSTANTS.director;
    const hpMul = 1 + this.clock * d.hpSlope;
    const speedMul = Math.min(d.speedCap, 1 + this.clock * d.speedSlope);
    this.entities.spawnEnemy(type, x, y, hpMul, speedMul);
  }

  // --- damage + kills ----------------------------------------------------

  private damageEnemy(e: Enemy, baseDmg: number, allowCrit = true) {
    if (e.dead) return;
    const crit = allowCrit && this.stats.critChance > 0 && Math.random() < this.stats.critChance;
    const dmg = baseDmg * this.stats.damageMul * (crit ? 2 : 1);
    e.health -= dmg;
    this.entities.hitFlash(e);
    // Boss-hit sparks, throttled — continuous beams hit every frame.
    if (e.boss && this.bossHitFxT <= 0) {
      this.bossHitFxT = CONSTANTS.fx.burst.bossHit.every;
      this.burst(e.mesh.position.x, e.mesh.position.y, COLORS.bone, CONSTANTS.fx.burst.bossHit);
    }
    if (e.health <= 0) this.onKill(e);
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

  private onKill(e: Enemy) {
    if (e.boss) {
      this.bossDefeated(e);
      return;
    }
    this.kills++;
    const x = e.mesh.position.x;
    const y = e.mesh.position.y;
    if (e.type === "elite") {
      this.entities.spawnGem(x, y, 25);
      const shards = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < shards; i++) {
        this.entities.spawnGem(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 3);
      }
      // BLIGHT-BOIL elites blow big: a fat toxic burst plus a hellfire core.
      this.burst(x, y, COLORS.toxicHot, CONSTANTS.fx.burst.elite);
      this.burst(x, y, COLORS.hellfire, CONSTANTS.fx.burst.enemy);
      if (this.explosionT <= 0) {
        this.explosionT = CONSTANTS.audio.explosionMinInterval;
        audio.sfx("explosion");
      }
      this.render.addShake(CONSTANTS.fx.shake.eliteKill);
    } else {
      this.entities.spawnGem(x, y, e.gemValue);
      this.burst(x, y, COLORS.toxic, CONSTANTS.fx.burst.enemy); // ichor pop
      this.render.addShake(CONSTANTS.fx.shake.gruntKill);
    }
    this.entities.killEnemy(e);
  }

  // --- collisions --------------------------------------------------------

  private resolveBolts() {
    for (const b of this.entities.bullets) {
      if (b.dead) continue;
      for (const e of this.entities.enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        const dx = b.mesh.position.x - e.mesh.position.x;
        const dy = b.mesh.position.y - e.mesh.position.y;
        if (dx * dx + dy * dy < (e.radius + 0.6) ** 2) {
          b.hit.push(e);
          this.damageEnemy(e, b.damage);
          if (b.pierce <= 0) {
            b.dead = true;
            break;
          }
          b.pierce--;
        }
      }
    }
  }

  private resolveEnemyBullets() {
    if (this.invuln > 0) return;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const rr = (CONSTANTS.player.width * 0.5 + 0.5) ** 2;
    for (const b of this.entities.enemyBullets) {
      if (b.dead) continue;
      const dx = b.mesh.position.x - sx;
      const dy = b.mesh.position.y - sy;
      if (dx * dx + dy * dy < rr) {
        b.dead = true;
        this.hitPlayer(b.damage);
        return;
      }
    }
  }

  private resolveContact() {
    if (this.invuln > 0) return;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const shipR = CONSTANTS.player.width * 0.5;
    for (const e of this.entities.enemies) {
      if (e.dead) continue;
      const dx = e.mesh.position.x - sx;
      const dy = e.mesh.position.y - sy;
      const rr = e.radius + shipR;
      if (dx * dx + dy * dy < rr * rr) {
        this.hitPlayer(e.contactDmg);
        return;
      }
    }
  }

  private hitPlayer(dmg: number) {
    this.integrity -= dmg;
    this.invuln = CONSTANTS.player.invulnTime;
    this.entities.pop(this.entities.ship.position.x, this.entities.ship.position.y, COLORS.blood, 18);
    this.render.addShake(CONSTANTS.fx.shake.playerHit);
    audio.sfx("hurt");
  }

  // --- XP + draft --------------------------------------------------------

  private gainXp(raw: number) {
    this.salvage += raw;
    // Rising salvage ding: the pitch climbs while pickups keep streaking in.
    const a = CONSTANTS.audio;
    if (this.clock - this.lastGemAt <= a.gemStreakWindow) this.gemStreak++;
    else this.gemStreak = 0;
    this.lastGemAt = this.clock;
    if (this.gemSfxT <= 0) {
      this.gemSfxT = a.gemMinInterval;
      audio.sfx("gem", { pitch: Math.min(a.gemPitchMax, 1 + this.gemStreak * a.gemPitchStep) });
    }
    this.currentXP += raw * this.stats.xpGainMul;
    let leveled = false;
    while (this.currentXP >= xpForLevel(this.level)) {
      this.currentXP -= xpForLevel(this.level);
      this.level++;
      this.pendingLevels++;
      leveled = true;
    }
    if (leveled && this.phase === "playing") this.triggerLevelUp();
  }

  private triggerLevelUp() {
    this.phase = "levelup";
    this.vacuum = true; // salvage pulse: vacuum the field
    audio.sfx("levelup");
    this.rollDraft();
    this.emitHud();
  }

  private rollDraft() {
    const eligible = ALL_UPGRADES.filter((u) => (this.levels.get(u.id) ?? 0) < maxLevelOf(u.id));
    if (eligible.length === 0) {
      // Everything maxed — nothing to draft; just drain the queue.
      this.pendingLevels = Math.max(0, this.pendingLevels - 1);
      this.draft = null;
      this.phase = this.pendingLevels > 0 ? "levelup" : "playing";
      if (this.phase === "levelup") this.rollDraft();
      return;
    }
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    this.draft = eligible.slice(0, 3).map((u) => {
      const lvl = this.levels.get(u.id) ?? 0;
      return {
        id: u.id,
        name: u.name,
        desc: u.desc,
        icon: u.icon,
        kind: u.kind,
        level: lvl,
        max: maxLevelOf(u.id),
      };
    });
  }

  private pickById(id: UpgradeId) {
    if (this.phase !== "levelup" || !this.draft) return;
    if (!this.draft.some((c) => c.id === id)) return;
    const prev = this.levels.get(id) ?? 0;
    this.levels.set(id, prev + 1);
    audio.sfx(defOf(id).kind === "passive" ? "powerup" : "uiSelect");
    this.recomputeStats();
    if (id === "hull") this.integrity = this.stats.maxIntegrity; // full repair
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) {
      this.rollDraft();
      this.emitHud();
    } else {
      this.draft = null;
      this.phase = "playing";
      this.emitHud();
    }
  }

  // --- boss --------------------------------------------------------------

  private spawnBoss() {
    this.bossTriggered = true;
    const b = CONSTANTS.boss;
    const p = this.ringPoint();
    this.boss = this.entities.spawnBoss(p.x, p.y, b.baseHP, b.contactDmg, 5);
    this.bossBurstT = 1.5;
    this.bossDashT = b.dashEvery;
    this.bossSpiralT = 0;
    this.bossSummonT = b.summonEvery;
    this.bossOrbit = Math.random() * TAU;
    this.bossDashState = "none";
    this.resetBossAttacks();
    this.bossRingT = b.ring.firstDelay;
    this.bossBeamT = b.beam.firstDelay;
    audio.sfx("boss");
    this.render.addShake(CONSTANTS.fx.shake.bossSpawn);
    this.entities.pop(p.x, p.y, COLORS.toxicHot, 40);
  }

  private bossPhase(): BossPhase {
    if (!this.boss) return 1;
    return bossPhaseFor(this.boss.health / this.boss.maxHealth);
  }

  private updateBoss(dt: number) {
    const boss = this.boss;
    if (!boss || boss.dead) return;
    const b = CONSTANTS.boss;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const phase = this.bossPhase();

    // Phase transition: vents blow, the attack mix changes.
    if (phase > this.bossPhaseSeen) {
      this.bossPhaseSeen = phase;
      audio.sfx("boss");
      audio.sfx("explosion", { pitch: 0.8 });
      this.render.addShake(CONSTANTS.fx.shake.bossPhase);
      this.burst(boss.mesh.position.x, boss.mesh.position.y, COLORS.toxicHot, CONSTANTS.fx.burst.bossPhase);
    }

    // Movement: orbit the ship, unless dashing.
    if (this.bossDashState === "charge") {
      boss.mesh.position.x += this.bossDashX * dt;
      boss.mesh.position.y += this.bossDashY * dt;
      this.bossDashTime -= dt;
      if (this.bossDashTime <= 0) this.bossDashState = "none";
    } else {
      this.bossOrbit += b.orbitSpeed * dt;
      const tx = sx + Math.cos(this.bossOrbit) * b.orbitR;
      const ty = sy + Math.sin(this.bossOrbit) * b.orbitR;
      boss.mesh.position.x += (tx - boss.mesh.position.x) * Math.min(1, dt * 1.4);
      boss.mesh.position.y += (ty - boss.mesh.position.y) * Math.min(1, dt * 1.4);
    }
    const bx = boss.mesh.position.x;
    const by = boss.mesh.position.y;

    // Radial spore bursts (all phases, faster later).
    this.bossBurstT -= dt;
    if (this.bossBurstT <= 0) {
      this.bossBurstT = b.burstEvery * (phase === 1 ? 1 : phase === 2 ? 0.75 : 0.55);
      boss.flash = 0.12;
      const off = Math.random() * TAU;
      for (let i = 0; i < b.burstCount; i++) {
        const a = off + (i / b.burstCount) * TAU;
        this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg);
      }
    }

    // Summons.
    this.bossSummonT -= dt;
    if (this.bossSummonT <= 0) {
      this.bossSummonT = b.summonEvery;
      const type: EnemyType = phase === 3 ? "spitter" : phase === 2 ? "swarmling" : "grunt";
      for (let i = 0; i < (phase === 1 ? 2 : 3); i++) {
        this.spawnAt(type, bx + (Math.random() - 0.5) * 8, by + (Math.random() - 0.5) * 8);
      }
    }

    // Charge-dash (all phases; rarer in phase 1). The lunge is the boss's
    // contact threat — it travels just past the ship so it crosses the hull.
    // Never overlaps the ring windup or the beam so telegraphs stay readable.
    this.bossDashT -= dt;
    const otherAttackActive = this.bossRingState !== "idle" || this.bossBeamState !== "idle";
    if (this.bossDashState === "none" && this.bossDashT <= 0 && !otherAttackActive) {
      this.bossDashState = "telegraph";
      this.bossDashTime = b.dashTelegraph;
      boss.flash = b.dashTelegraph;
    } else if (this.bossDashState === "telegraph") {
      this.bossDashTime -= dt;
      if (this.bossDashTime <= 0) {
        const ddx = sx - bx;
        const ddy = sy - by;
        const dist = Math.hypot(ddx, ddy) || 1;
        this.bossDashX = (ddx / dist) * b.dashSpeed;
        this.bossDashY = (ddy / dist) * b.dashSpeed;
        this.bossDashState = "charge";
        // Travel just past the ship so the lunge actually crosses the hull.
        this.bossDashTime = Math.min(0.8, (dist + 4) / b.dashSpeed);
        this.bossDashT = b.dashEvery * (phase === 1 ? 1.6 : 1);
        this.render.addShake(CONSTANTS.fx.shake.bossCharge);
      }
    }

    // Telegraphed attacks: ring volleys + the beam (each phase mixes its own).
    this.updateBossRing(dt, boss, phase, bx, by);
    this.updateBossBeam(dt, phase, bx, by, sx, sy);

    // Phase 3: rotating spiral of globs.
    if (phase === 3) {
      this.bossSpiralT -= dt;
      if (this.bossSpiralT <= 0) {
        this.bossSpiralT = b.spiralEvery;
        this.bossOrbit += 0.4;
        for (let k = 0; k < b.spiralCount; k++) {
          const a = this.bossOrbit + (k / b.spiralCount) * TAU;
          this.entities.spawnGlob(bx, by, Math.cos(a) * b.bulletSpeed, Math.sin(a) * b.bulletSpeed, b.bulletDmg);
        }
      }
    }
  }

  /** Telegraphed radial ring volley: glow windup, then staggered slow rings.
   *  Rings per volley and the cooldown scale with the boss phase. */
  private updateBossRing(dt: number, boss: Enemy, phase: BossPhase, bx: number, by: number) {
    const r = CONSTANTS.boss.ring;
    if (this.bossRingState === "idle") {
      this.bossRingT -= dt;
      // Hold while dashing so the glow windup is never masked by the lunge.
      if (this.bossRingT <= 0 && this.bossDashState === "none" && this.bossBeamState === "idle") {
        const plan = ringBurstPlan(phase);
        this.bossRingState = "windup";
        this.bossRingTime = r.telegraph;
        this.bossRingCount = plan.rings;
        this.bossRingIndex = 0;
        this.bossRingAngle = Math.random() * TAU;
        this.bossRingT = plan.cooldown;
        audio.sfx("shieldUp"); // charge-up cue alongside the glow
      }
      return;
    }
    if (this.bossRingState === "windup") {
      this.bossRingTime -= dt;
      boss.telegraph = 1 - Math.max(0, this.bossRingTime) / r.telegraph;
      if (this.bossRingTime <= 0) {
        boss.telegraph = 0;
        this.bossRingState = "volley";
        this.bossRingTime = 0; // first ring fires immediately
      } else {
        return;
      }
    }
    // volley: fire rings on the stagger cadence.
    this.bossRingTime -= dt;
    while (this.bossRingTime <= 0 && this.bossRingIndex < this.bossRingCount) {
      this.fireBossRing(bx, by, this.bossRingAngle + ringOffset(this.bossRingIndex, r.count));
      this.bossRingIndex++;
      this.bossRingTime += r.ringInterval;
    }
    if (this.bossRingIndex >= this.bossRingCount) this.bossRingState = "idle";
  }

  /** One evenly-spaced ring of slow spores (weavable at base player speed). */
  private fireBossRing(bx: number, by: number, offset: number) {
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
  private updateBossBeam(dt: number, phase: BossPhase, bx: number, by: number, sx: number, sy: number) {
    const bm = CONSTANTS.boss.beam;
    if (this.bossBeamState === "idle") {
      const plan = beamPlan(phase);
      if (!plan) return; // offline this phase — the timer holds
      this.bossBeamT -= dt;
      if (this.bossBeamT <= 0 && this.bossDashState === "none" && this.bossRingState === "idle") {
        this.bossBeamT = plan.cooldown;
        this.bossBeamState = "warn";
        this.bossBeamTime = bm.telegraph;
        // Lock the firing line: from the boss through the ship, full length.
        const dx = sx - bx;
        const dy = sy - by;
        const d = Math.hypot(dx, dy) || 1;
        this.bossBeamX1 = bx;
        this.bossBeamY1 = by;
        this.bossBeamX2 = bx + (dx / d) * bm.length;
        this.bossBeamY2 = by + (dy / d) * bm.length;
        audio.sfx("berserk"); // warning klaxon while the line renders
      }
      return;
    }
    if (this.bossBeamState === "warn") {
      this.bossBeamTime -= dt;
      const t01 = 1 - Math.max(0, this.bossBeamTime) / bm.telegraph;
      this.entities.showBossBeamWarn(this.bossBeamX1, this.bossBeamY1, this.bossBeamX2, this.bossBeamY2, bm.width, t01);
      if (this.bossBeamTime <= 0) {
        this.bossBeamState = "fire";
        this.bossBeamTime = bm.duration;
        audio.sfx("laser", { pitch: 0.6 });
        this.render.addShake(CONSTANTS.fx.shake.bossCharge);
      }
      return;
    }
    // fire: burn along the locked line; the ship's i-frames gate repeat ticks.
    this.bossBeamTime -= dt;
    const left = Math.max(0, this.bossBeamTime) / bm.duration;
    this.entities.showBossBeamFire(this.bossBeamX1, this.bossBeamY1, this.bossBeamX2, this.bossBeamY2, bm.width, left);
    if (this.invuln <= 0) {
      const d = pointSegDist(sx, sy, this.bossBeamX1, this.bossBeamY1, this.bossBeamX2, this.bossBeamY2);
      if (d < bm.width / 2 + CONSTANTS.player.width * 0.5) this.hitPlayer(bm.damage);
    }
    if (this.bossBeamTime <= 0) {
      this.bossBeamState = "idle";
      this.entities.hideBossBeam();
    }
  }

  private bossDefeated(e: Enemy) {
    const x = e.mesh.position.x;
    const y = e.mesh.position.y;
    this.entities.killEnemy(e);
    this.boss = null;
    this.kills++;
    this.resetBossAttacks();
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
    this.vacuum = true;
    this.phase = "victory";
    emitRunEnd(Math.round(this.salvage)); // bank salvage as Drydock wreckage
    // Bank the boss kill into the cross-game war record (Warline shows it).
    recordWarResult("starblight", { outcome: "victory", score: this.level, bossKill: true }, Date.now());
    this.emitHud();
  }

  // --- HUD bridge --------------------------------------------------------

  private emitHud() {
    const build = this.buildChips();
    const need = xpForLevel(this.level);
    const state: HudState = {
      phase: this.phase,
      level: this.level,
      xp01: need > 0 ? Math.min(1, this.currentXP / need) : 0,
      timeSec: this.clock,
      integrity: Math.max(0, Math.round(this.integrity)),
      maxIntegrity: Math.round(this.stats.maxIntegrity),
      gems: Math.round(this.salvage),
      kills: this.kills,
      build,
      draft: this.draft,
      bossHp01: this.boss && !this.boss.dead ? Math.max(0, this.boss.health / this.boss.maxHealth) : null,
      lowIntegrity: this.integrity > 0 && this.integrity < this.stats.maxIntegrity * 0.25,
    };
    this.hud.update(state);
  }

  private buildChips() {
    const out: HudState["build"] = [];
    for (const [id, level] of this.levels) {
      if (level <= 0) continue;
      const def = defOf(id);
      out.push({
        id,
        icon: def.icon,
        name: def.name,
        level,
        max: maxLevelOf(id),
        kind: def.kind,
      });
    }
    // Weapons first, then passives.
    out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "weapon" ? -1 : 1));
    return out;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
