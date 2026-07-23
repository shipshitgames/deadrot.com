import { completeRun, createRunNonce } from "@deadrot/game-kit/warline";
import { EntitySystem } from "../systems/EntitySystem";
import { HudSystem } from "../systems/HudSystem";
import { InputSystem } from "../systems/InputSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import { clearPauseActions, emitRunEnd, setPauseActions, subscribeDrydockTiers } from "../ui/gameBridge";
import { audio, type WeaponAudioFamily } from "./audio";
import { BossEncounter } from "./BossEncounter";
import { COLORS, CONSTANTS, type EnemyType, WORLD } from "./constants";
import type { ShopTiers } from "./drydock";
import { HitStopController, type ImpactDirection, type MarqueeImpact, shakeFor } from "./feedback";
import { clamp, TAU } from "./math";
import type { DraftCard, Enemy, GamePhase, HudState } from "./types";
import { ALL_UPGRADES, computeStats, defOf, maxLevelOf, type Stats, type UpgradeId, xpForLevel } from "./upgrades";

// Survivors orchestrator: owns run-state (XP / level / integrity / draft), the
// time-driven director, collisions, and the rAF loop. The boss state machine
// lives in BossEncounter.
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
  private bossEncounter: BossEncounter;

  // --- audio / juice throttles --------------------------------------------
  private weaponAudioT = 0;
  private weaponCueQueued: { family: WeaponAudioFamily; distance: number } | null = null;
  private muzzleT = 0;
  private explosionT = 0;
  private gemSfxT = 0;
  private gemStreak = 0;
  private lastGemAt = -999;
  private lowHealthT = 0;
  private bossHitFxT = 0;
  private readonly hitStop = new HitStopController();
  private readonly collisionCandidates: Enemy[] = [];

  private raf = 0;
  private prev = 0;
  private disposed = false;
  private runNonce = createRunNonce("starblight");

  constructor(canvas: HTMLCanvasElement) {
    this.render = new RenderSystem(canvas);
    this.input = new InputSystem(canvas);
    this.entities = new EntitySystem(this.render);
    this.weapons = new WeaponSystem(this.render, this.entities);
    this.weapons.damageEnemy = (e, dmg, allowCrit) => this.damageEnemy(e, dmg, allowCrit);
    // Weapon fire is voiced once per frame at most, throttled in simulate().
    this.weapons.onFire = (family, x, y) => {
      this.weaponCueQueued ??= { family, distance: this.soundDistance(x, y) };
      this.weaponFireFeedback();
    };
    this.bossEncounter = new BossEncounter(this.entities, this.render, {
      ringPoint: () => this.ringPoint(),
      spawnAt: (type, x, y) => this.spawnAt(type, x, y),
      // The beam re-checks every frame; the ship's i-frames gate repeat ticks.
      hitPlayer: (dmg, direction) => {
        if (this.invuln <= 0) this.hitPlayer(dmg, direction);
      },
      impact: (impact, direction) => this.triggerImpact(impact, direction),
      onDefeated: () => {
        this.kills++;
        this.vacuum = true;
        this.phase = "victory";
        emitRunEnd(Math.round(this.salvage)); // bank salvage as Drydock wreckage
        completeRun("starblight", {
          outcome: "victory",
          score: this.level,
          bossKill: true,
          nonce: this.runNonce,
        });
        this.emitHud();
      },
    });
    this.hud = new HudSystem(
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

  /** Serializable, read-only state for the dev/E2E harness. */
  debugSnapshot() {
    return {
      phase: this.phase,
      timeSec: this.clock,
      level: this.level,
      integrity: Math.max(0, this.integrity),
      maxIntegrity: this.stats.maxIntegrity,
      kills: this.kills,
      salvage: this.salvage,
      aliveEnemies: this.entities.enemies.filter((enemy) => !enemy.dead).length,
      bossHp01: this.bossEncounter.hp01(),
      ship: {
        x: this.entities.ship.position.x,
        y: this.entities.ship.position.y,
      },
      draft: this.draft?.map((card) => ({ ...card })) ?? null,
      build: this.buildChips().map((chip) => ({ ...chip })),
    };
  }

  /** Dev/E2E driver: start a clean sortie through the production reset path. */
  debugStartRun() {
    this.assertDebugActive();
    this.startRun();
  }

  /** Dev/E2E driver: replay the production simulation at a fixed 60 Hz. */
  debugAdvance(seconds: number) {
    this.assertDebugActive();
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 300) {
      throw new Error("Starblight debug advance requires 0..300 finite seconds");
    }
    const fixedDt = 1 / 60;
    const steps = Math.ceil(seconds / fixedDt);
    for (let i = 0; i < steps && this.phase === "playing"; i++) {
      this.simulate(this.hitStop.scaleDelta(fixedDt));
    }
    this.emitHud();
  }

  /** Dev/E2E fixture: put one fragile, stationary Scourge inside seeker range. */
  debugSpawnTarget() {
    this.assertDebugPlaying();
    const ship = this.entities.ship.position;
    const direction = ship.x > WORLD.halfW - 12 ? -1 : 1;
    const enemy = this.entities.spawnEnemy("grunt", ship.x + direction * 8, ship.y, 1, 1);
    enemy.health = 1;
    enemy.maxHealth = 1;
    enemy.speed = 0;
    enemy.contactDmg = 0;
    this.emitHud();
  }

  /** Dev/E2E driver: enter one deterministic three-card draft. */
  debugForceLevelUp() {
    this.assertDebugPlaying();
    this.level++;
    this.currentXP = 0;
    this.pendingLevels++;
    this.triggerLevelUp();
  }

  /** Dev/E2E driver: choose a currently offered card by stable upgrade id. */
  debugPickDraftCard(id: UpgradeId) {
    this.assertDebugActive();
    if (this.phase !== "levelup" || !this.draft?.some((card) => card.id === id)) {
      throw new Error(`Starblight debug draft does not offer "${id}"`);
    }
    this.pickById(id);
  }

  /** Dev/E2E driver: trigger the production boss encounter immediately. */
  debugForceBoss() {
    this.assertDebugPlaying();
    this.bossEncounter.maybeTrigger(CONSTANTS.boss.spawnAt);
    this.emitHud();
  }

  /** Dev/E2E driver: set live boss health so HUD binding can be asserted. */
  debugSetBossHp01(hp01: number) {
    this.assertDebugPlaying();
    const boss = this.bossEncounter.enemy();
    if (!boss || boss.dead) throw new Error("Starblight debug boss is not active");
    boss.health = boss.maxHealth * clamp(hp01, 0.01, 1);
    this.emitHud();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsubTiers();
    clearPauseActions();
    this.input.dispose();
    this.weapons.dispose();
    this.bossEncounter.dispose(); // bespoke boss mesh, before the entity pools
    this.entities.dispose();
    this.hud.dispose();
    this.render.dispose();
  }

  private assertDebugActive() {
    if (this.disposed) throw new Error("Starblight debug handle is disposed");
  }

  private assertDebugPlaying() {
    this.assertDebugActive();
    if (this.phase !== "playing") {
      throw new Error(`Starblight debug action requires playing phase, received "${this.phase}"`);
    }
  }

  // --- run lifecycle -----------------------------------------------------

  private startRun() {
    this.runNonce = createRunNonce("starblight");
    const levels = new Map<UpgradeId, number>([["seeker", 1]]); // start armed
    // Drydock: Phalanx Cache starts the sortie with the orbiting drones too.
    if ((this.shopTiers.phalanxcache ?? 0) > 0) levels.set("phalanx", 1);
    this.resetRun("playing", levels);
  }

  /** Shared reset sequence for a new sortie ("playing") or the menu ("title"). */
  private resetRun(phase: GamePhase, startingLevels: Map<UpgradeId, number>) {
    this.phase = phase;
    this.clock = 0;
    this.level = 1;
    this.currentXP = 0;
    this.pendingLevels = 0;
    this.kills = 0;
    this.salvage = 0;
    this.invuln = 0;
    this.vacuum = false;
    this.draft = null;

    this.levels = startingLevels;
    this.recomputeStats();
    this.integrity = this.stats.maxIntegrity;

    this.bossEncounter.reset(); // before clearEnemies: the boss mesh is bespoke
    this.entities.clearEnemies();
    this.entities.clearProjectiles();
    this.entities.clearGems();
    this.entities.clearParticles();
    this.entities.resetShip();
    this.weapons.reset();
    this.render.resetFocus(0, 0);

    const playing = phase === "playing";
    this.spawnT = playing ? 0.6 : 0;
    this.eliteT = playing ? CONSTANTS.director.eliteEvery : 0;
    this.resetFeedback();

    audio.unlock(); // started from a click/keypress — the gesture allows audio
    this.emitHud();
  }

  /** Reset the audio/juice throttles so a fresh run starts quiet. */
  private resetFeedback() {
    this.weaponAudioT = 0;
    this.weaponCueQueued = null;
    this.muzzleT = 0;
    this.explosionT = 0;
    this.gemSfxT = 0;
    this.gemStreak = 0;
    this.lastGemAt = -999;
    this.lowHealthT = 0;
    this.bossHitFxT = 0;
    this.hitStop.reset();
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
    this.resetRun("title", new Map());
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

    const simulationDt = this.phase === "playing" ? this.hitStop.scaleDelta(dt) : 0;
    if (this.phase === "playing") this.simulate(simulationDt);

    // Camera follows the ship (also keeps the menu backdrop alive). Kill-pop
    // bursts only advance while simulating — same gate as the legacy particle
    // sim in simulate() — so all FX freeze together on pause / level-up.
    this.render.update(
      dt,
      this.entities.ship.position.x,
      this.entities.ship.position.y,
      this.phase === "playing",
      simulationDt,
    );
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
    this.weaponAudioT = Math.max(0, this.weaponAudioT - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.explosionT = Math.max(0, this.explosionT - dt);
    this.gemSfxT = Math.max(0, this.gemSfxT - dt);
    this.bossHitFxT = Math.max(0, this.bossHitFxT - dt);

    // 1. flight
    const aim = this.render.screenToWorld(this.input.ndcX, this.input.ndcY);
    const key = this.input.keyAxis();
    this.entities.moveShip(aim.x, aim.y, key.x, key.y, dt, this.stats.moveMul, this.stats.accelMul);

    // 2. director + 3. enemy AI
    this.director(dt);
    this.entities.updateEnemies(dt, this.clock, this.bossEncounter.enemy());
    this.bossEncounter.update(dt, this.clock);
    this.entities.rebuildEnemyGrid();

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
      completeRun("starblight", { outcome: "defeat", score: this.level, nonce: this.runNonce });
      this.emitHud();
    }
  }

  /** Throttled weapon-fire cue: at most 1/weaponMinInterval plays per second. */
  private voiceWeaponFire() {
    const queued = this.weaponCueQueued;
    if (!queued) return;
    this.weaponCueQueued = null;
    if (this.weaponAudioT > 0) return;
    const a = CONSTANTS.audio;
    this.weaponAudioT = a.weaponMinInterval;
    audio.play(`weapon-${queued.family}`, {
      pitch: a.weaponPitchLo + Math.random() * (a.weaponPitchHi - a.weaponPitchLo),
      distance: queued.distance,
    });
  }

  /** Visual recoil has its own cadence so audio throttling cannot desync it. */
  private weaponFireFeedback() {
    if (this.muzzleT > 0) return;
    this.muzzleT = CONSTANTS.audio.muzzleMinInterval;
    const ship = this.entities.ship;
    this.burst(ship.position.x, ship.position.y, COLORS.hellfire, CONSTANTS.fx.burst.muzzle);
    const heading = ship.rotation.z + Math.PI / 2;
    this.render.addDirectionalKick(shakeFor("weaponFire"), {
      x: -Math.cos(heading),
      y: -Math.sin(heading),
    });
  }

  /** Periodic warning ping while integrity sits under the danger threshold. */
  private updateLowHealthWarning(dt: number) {
    const a = CONSTANTS.audio;
    if (this.integrity > 0 && this.integrity < this.stats.maxIntegrity * a.lowHealthPct) {
      this.lowHealthT -= dt;
      if (this.lowHealthT <= 0) {
        this.lowHealthT = a.lowHealthEvery;
        audio.play("low-integrity");
        this.render.addShake(shakeFor("lowIntegrityPulse"));
      }
    } else {
      this.lowHealthT = 0; // re-crossing the threshold pings immediately
    }
  }

  // --- director ----------------------------------------------------------

  private director(dt: number) {
    const d = CONSTANTS.director;
    // Boss trigger.
    this.bossEncounter.maybeTrigger(this.clock);

    // Alive-cap ramps over the run (the boss counts itself out).
    const ramp = Math.min(1, this.clock / d.aliveRampTime);
    const aliveCap = d.aliveMin + (d.aliveMax - d.aliveMin) * ramp;
    const aliveCount = this.entities.enemies.length - this.bossEncounter.aliveAdjustment();

    this.spawnT -= dt;
    if (this.spawnT <= 0 && aliveCount < aliveCap) {
      const interval =
        Math.max(d.spawnFloor, d.spawnBase - this.clock * d.spawnSlope) * this.bossEncounter.spawnIntervalMul();
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
    if (!this.bossEncounter.isActive() && this.eliteT <= 0) {
      this.eliteT = d.eliteEvery;
      const p = this.ringPoint();
      this.entities.pop(p.x, p.y, COLORS.toxicHot, 16); // spawn flare
      this.render.addShake(shakeFor("eliteSpawn"));
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
    audio.play("enemy-hit", {
      distance: this.soundDistance(e.mesh.position.x, e.mesh.position.y),
      pitch: e.type === "elite" ? 0.86 : undefined,
    });
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
    if (this.bossEncounter.owns(e)) {
      this.bossEncounter.defeated(e);
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
      // Chained kills share one synchronized marquee beat instead of stacking
      // audio and full-screen flashes within the same 100ms window.
      if (this.explosionT <= 0) {
        this.explosionT = CONSTANTS.audio.explosionMinInterval;
        this.render.flashFrame(x, y, COLORS.bone, CONSTANTS.fx.flashSprite.eliteKill);
        audio.play("elite-kill", { distance: this.soundDistance(x, y) });
        this.triggerImpact("eliteKill");
      }
    } else {
      this.entities.spawnGem(x, y, e.gemValue);
      this.burst(x, y, COLORS.toxic, CONSTANTS.fx.burst.enemy); // ichor pop
      this.render.addShake(shakeFor("gruntKill"));
      audio.play("enemy-kill", { distance: this.soundDistance(x, y) });
    }
    this.entities.killEnemy(e);
  }

  // --- collisions --------------------------------------------------------

  private resolveBolts() {
    for (const b of this.entities.bullets) {
      if (b.dead) continue;
      const candidates = this.entities.queryEnemies(
        b.mesh.position.x,
        b.mesh.position.y,
        0.6,
        this.collisionCandidates,
      );
      for (const e of candidates) {
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
        this.hitPlayer(b.damage, { x: b.vx, y: b.vy });
        return;
      }
    }
  }

  private resolveContact() {
    if (this.invuln > 0) return;
    const sx = this.entities.ship.position.x;
    const sy = this.entities.ship.position.y;
    const shipR = CONSTANTS.player.width * 0.5;
    for (const e of this.entities.queryEnemies(sx, sy, shipR, this.collisionCandidates)) {
      if (e.dead) continue;
      const dx = e.mesh.position.x - sx;
      const dy = e.mesh.position.y - sy;
      const rr = e.radius + shipR;
      if (dx * dx + dy * dy < rr * rr) {
        this.hitPlayer(e.contactDmg, { x: -dx, y: -dy });
        return;
      }
    }
  }

  private hitPlayer(dmg: number, direction?: ImpactDirection) {
    this.integrity -= dmg;
    this.invuln = CONSTANTS.player.invulnTime;
    this.entities.pop(this.entities.ship.position.x, this.entities.ship.position.y, COLORS.blood, 18);
    audio.play("player-hit");
    this.triggerImpact("playerHit", direction);
  }

  /** Synchronizes time scaling, camera impact, and flash on the same event. */
  private triggerImpact(impact: MarqueeImpact, direction?: ImpactDirection) {
    this.hitStop.trigger(CONSTANTS.fx.hitStop[impact]);
    this.render.addShake(shakeFor(impact), direction);
    this.hud.pulseImpact(impact);
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
      audio.play("salvage-pickup", {
        pitch: Math.min(a.gemPitchMax, 1 + this.gemStreak * a.gemPitchStep),
      });
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
    audio.play("level-up");
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
    audio.play("card-select", { pitch: defOf(id).kind === "passive" ? 0.94 : 1.04 });
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
      bossHp01: this.bossEncounter.hp01(),
      lowIntegrity: this.integrity > 0 && this.integrity < this.stats.maxIntegrity * 0.25,
    };
    this.hud.update(state);
  }

  private soundDistance(x: number, y: number): number {
    const ship = this.entities.ship.position;
    return Math.hypot(x - ship.x, y - ship.y);
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
