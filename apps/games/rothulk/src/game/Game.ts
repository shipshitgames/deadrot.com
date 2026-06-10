import type { DeadrotSfx } from "@deadrot/game-kit/audio";
import { InputLatch } from "@deadrot/game-kit/core";
import { FlashOverlay, ParticleBursts, ScreenShake } from "@deadrot/game-kit/juice";
import { audio } from "../audio";
import { COLORS, CONSTANTS } from "../constants";
import {
  type CoreLoopState,
  completeEscape,
  createCoreLoopState,
  igniteBreachCore,
  objectiveForPhase,
  progressForPhase,
  shouldCompleteEscape,
  shouldIgniteCore,
} from "./coreLoop";
import { globLaunchVelocity, updateCharger, updateSpitter } from "./enemies";
import { Hud } from "./hud";
import { buildLevelAt, LEVELS } from "./levels";
import { aabbOverlap, platformToAABB, rectToAABB, resolveAgainstSolids } from "./physics";
import { Renderer } from "./render";
import type { AABB, GameMode, LevelData, Spitter, ToxicGlob } from "./types";

// Behavior tunings for the pure enemy state machines — values live in the
// constants file; the systems never hardcode numbers.
const CHARGER_TUNING = {
  patrolSpeed: CONSTANTS.CHARGER_PATROL_SPEED,
  chargeSpeed: CONSTANTS.CHARGER_CHARGE_SPEED,
  triggerRange: CONSTANTS.CHARGER_TRIGGER_RANGE,
  rowTolerance: CONSTANTS.CHARGER_ROW_TOLERANCE,
  stunTime: CONSTANTS.CHARGER_STUN_TIME,
} as const;

const SPITTER_TUNING = {
  range: CONSTANTS.SPITTER_RANGE,
  cooldown: CONSTANTS.SPITTER_COOLDOWN,
} as const;

function makeGlobPool(): ToxicGlob[] {
  return Array.from({ length: CONSTANTS.MAX_GLOBS }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    active: false,
  }));
}

// The thin owner of shared state + systems. Runs the rAF loop with a clamped
// delta and routes update/draw through the renderer, input, physics and HUD.
export class Game {
  private renderer: Renderer;
  private input = new InputLatch<"jump" | "left" | "right" | "restart">({
    keys: {
      Space: "jump",
      KeyW: "jump",
      ArrowUp: "jump",
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      KeyR: "restart",
    },
    // Only jump keys had preventDefault in the bespoke Input class.
    preventDefault: (code) => code === "Space" || code === "KeyW" || code === "ArrowUp",
  });
  private hud = new Hud();

  private levelIndex = 0;
  private level: LevelData = buildLevelAt(0);
  private globs: ToxicGlob[] = makeGlobPool();
  private mode: GameMode = "title";

  // --- Juice (consumed once per displayed frame) ----------------------------
  private shake = new ScreenShake();
  private bursts: ParticleBursts;
  private flash: FlashOverlay;
  private sfxThisFrame = 0;

  // --- Hero state ----------------------------------------------------------
  private hx: number = CONSTANTS.HERO_SPAWN_X;
  private hy: number = CONSTANTS.HERO_SPAWN_Y;
  private vx = 0;
  private vy = 0;
  private grounded = false;
  private facing = 1;
  private squash = 1;

  // assists
  private coyote = 0;
  private jumpBuffer = 0;

  // --- Run state -----------------------------------------------------------
  private coreLoop: CoreLoopState = createCoreLoopState();
  private lives = CONSTANTS.START_LIVES;
  private hp = CONSTANTS.MAX_HP;
  private embers = 0;
  private invuln = 0;
  private respawnTimer = 0;
  private spawnX: number = CONSTANTS.HERO_SPAWN_X;
  private spawnY: number = CONSTANTS.HERO_SPAWN_Y;

  private lastTime = 0;
  private elapsed = 0;
  private running = false;
  private paused = false;

  // React bridge: fired whenever the paused flag flips so the UI can mirror it.
  onPauseChange: ((paused: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.buildLevel(this.level);
    this.renderer.buildHero();
    this.renderer.setHeroTransform(this.hx, this.hy, this.facing, 1);
    this.bursts = new ParticleBursts(this.renderer.scene);
    this.flash = new FlashOverlay(canvas.parentElement ?? document.body);
    this.refreshHud();
  }

  /** -1 left, +1 right, 0 none. */
  private get moveAxis(): number {
    let axis = 0;
    if (this.input.isHeld("left")) axis -= 1;
    if (this.input.isHeld("right")) axis += 1;
    return axis;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  beginRun() {
    if (this.mode === "playing") return;
    audio.unlock(); // user gesture — safe to start the bed + cues
    this.resetRun();
    this.mode = "playing";
  }

  // --- Pause control -------------------------------------------------------
  // Pausing only halts the gameplay/HUD step; the renderer keeps drawing the
  // frozen frame so the canvas doesn't go black behind the overlay.
  isPaused() {
    return this.paused;
  }

  setPaused(next: boolean) {
    if (this.paused === next) return;
    this.paused = next;
    this.onPauseChange?.(next);
  }

  togglePause() {
    // Pause is only meaningful during an active run.
    if (this.mode !== "playing" && !this.paused) return;
    this.setPaused(!this.paused);
  }

  resume() {
    this.setPaused(false);
  }

  // Restart the current run from scratch (used by the pause menu).
  restart() {
    this.resetRun();
    this.mode = "playing";
    this.resume();
  }

  // Full reset (new run from the title or after win/gameover via R).
  private resetRun() {
    this.lives = CONSTANTS.START_LIVES;
    this.hp = CONSTANTS.MAX_HP;
    this.embers = 0;
    this.hud.clearBigToast();
    this.loadLevel(0);
    this.refreshHud();
  }

  // Build + enter a level by campaign index. Lives/HP/embers carry across; the
  // core loop, projectiles, and spawn point are per-level.
  private loadLevel(index: number) {
    this.levelIndex = index;
    this.level = buildLevelAt(index);
    this.coreLoop = createCoreLoopState();
    this.renderer.buildLevel(this.level);
    for (const glob of this.globs) glob.active = false;
    this.spawnX = this.level.spawn.x;
    this.spawnY = this.level.spawn.y;
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase, this.level.checkpoint.reached));
    this.respawnHero();
  }

  // Soft respawn after a death (keeps embers + checkpoint).
  private respawnHero() {
    this.hx = this.spawnX;
    this.hy = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.invuln = CONSTANTS.IHURT_TIME;
    this.respawnTimer = 0;
    this.renderer.setHeroVisible(true);
  }

  private refreshHud() {
    this.hud.setLives(this.lives);
    this.hud.setHp(this.hp);
    this.hud.setEmbers(this.embers);
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase, this.level.checkpoint.reached));
    this.hud.setProgress(progressForPhase(this.hx, this.level.width, this.coreLoop.phase));
  }

  debugSnapshot() {
    return {
      mode: this.mode,
      phase: this.coreLoop.phase,
      level: this.levelIndex + 1,
      levelName: this.level.name,
      coreIgnited: this.coreLoop.phase !== "infiltrate",
      scourgeSevered: this.coreLoop.phase !== "infiltrate",
      exitReached: this.coreLoop.phase === "won",
      feralScourge: this.level.scourge.filter((s) => s.feral).length,
      objective: objectiveForPhase(this.coreLoop.phase, false),
      hero: {
        x: this.hx,
        y: this.hy,
      },
    };
  }

  teleportToCore() {
    this.hx = this.level.core.x;
    this.hy = this.level.core.y;
    this.vx = 0;
    this.vy = 0;
    this.renderer.setHeroTransform(this.hx, this.hy, this.facing, 1);
  }

  // Debug/e2e helper: jump to the FINAL armed exit. Fast-forwards any remaining
  // levels (arming their escape) so one core + one exit always ends the run.
  teleportToExit() {
    if (this.levelIndex < LEVELS.length - 1) {
      this.loadLevel(LEVELS.length - 1);
    }
    if (this.coreLoop.phase === "infiltrate") {
      this.coreLoop = igniteBreachCore(this.coreLoop);
      this.armFeralEscape();
    }
    this.hx = this.level.exit.x;
    this.hy = this.level.exit.y;
    this.vx = 0;
    this.vy = 0;
    this.renderer.setHeroTransform(this.hx, this.hy, this.facing, 1);
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------
  private loop = (now: number) => {
    if (!this.running) return;

    // While paused, keep the rAF alive and re-draw the frozen frame, but skip
    // all simulation. Reset lastTime so dt doesn't spike on resume.
    if (this.paused) {
      this.lastTime = now;
      this.renderer.render();
      requestAnimationFrame(this.loop);
      return;
    }

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > CONSTANTS.MAX_DELTA) dt = CONSTANTS.MAX_DELTA; // clamp stutters
    this.elapsed += dt;
    this.sfxThisFrame = 0; // re-arm the per-frame SFX cap

    if (this.input.isHeld("restart") && this.mode !== "title") {
      this.resetRun();
      this.mode = "playing";
    }

    if (this.mode === "playing") {
      this.updatePlaying(dt);
    } else if (this.mode === "dead") {
      this.updateDead(dt);
    }

    // Movers + decorative animation run in every non-title mode for life.
    if (this.mode !== "title") this.updateMovers(dt);

    // Juice is consumed once per displayed frame.
    this.shake.update(dt);
    this.bursts.update(dt);
    this.flash.update(dt);

    this.renderer.animate(this.elapsed, dt);
    this.renderer.updateCamera(this.hx, this.hy, this.level.width);
    this.hud.update(dt);

    // Apply the shake offset around the render only, so the camera's follow
    // lerp never fights the jitter.
    const shakeX = this.shake.offsetX;
    const shakeY = this.shake.offsetY;
    this.renderer.camera.position.x += shakeX;
    this.renderer.camera.position.y += shakeY;
    this.renderer.render();
    this.renderer.camera.position.x -= shakeX;
    this.renderer.camera.position.y -= shakeY;

    requestAnimationFrame(this.loop);
  };

  private updateDead(dt: number) {
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      if (this.lives <= 0) {
        this.mode = "gameover";
        this.playSfx("defeat");
        this.hud.showBigToast("gameover");
      } else {
        this.respawnHero();
        this.mode = "playing";
      }
    }
  }

  // -------------------------------------------------------------------------
  // Gameplay step
  // -------------------------------------------------------------------------
  private updatePlaying(dt: number) {
    if (this.invuln > 0) this.invuln -= dt;

    // --- Horizontal input ---
    const axis = this.moveAxis;
    if (axis !== 0) this.facing = axis;
    const target = axis * CONSTANTS.MOVE_SPEED;
    const accel = this.grounded ? CONSTANTS.ACCEL : CONSTANTS.AIR_ACCEL;
    if (axis !== 0) {
      this.vx += Math.sign(target - this.vx) * accel * dt;
      if (Math.sign(target) === Math.sign(this.vx) && Math.abs(this.vx) > Math.abs(target)) {
        this.vx = target;
      }
    } else if (this.grounded) {
      // friction
      const f = CONSTANTS.FRICTION * dt;
      if (Math.abs(this.vx) <= f) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * f;
    }

    // --- Jump assists: coyote + buffer ---
    if (this.grounded) this.coyote = CONSTANTS.COYOTE_TIME;
    else if (this.coyote > 0) this.coyote -= dt;

    if (this.input.consume("jump")) this.jumpBuffer = CONSTANTS.JUMP_BUFFER;
    else if (this.jumpBuffer > 0) this.jumpBuffer -= dt;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = CONSTANTS.JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 1.18; // stretch on launch
      this.playSfx("jump", 0.96 + Math.random() * 0.08);
    }

    // --- Gravity (variable jump height) ---
    let g = CONSTANTS.GRAVITY;
    if (this.vy < 0) {
      g *= CONSTANTS.FALL_GRAVITY_MULT;
    } else if (this.vy > 0 && !this.input.isHeld("jump")) {
      g *= CONSTANTS.LOW_JUMP_MULT; // cut the jump short on release
    }
    this.vy -= g * dt;
    if (this.vy < -CONSTANTS.MAX_FALL_SPEED) this.vy = -CONSTANTS.MAX_FALL_SPEED;

    // --- Build solids (static slabs + movers) and resolve collision ---
    const solids: AABB[] = [];
    const solidIsMover: number[] = []; // mover index or -1
    for (const p of this.level.platforms) {
      if (p.kind === "slab") {
        solids.push(platformToAABB(p));
        solidIsMover.push(-1);
      }
    }
    for (let i = 0; i < this.level.movers.length; i++) {
      const mv = this.level.movers[i];
      solids.push(rectToAABB(mv.x, mv.y, mv.w, mv.h));
      solidIsMover.push(i);
    }

    const hw = CONSTANTS.HERO_WIDTH / 2;
    const hh = CONSTANTS.HERO_HEIGHT / 2;
    const impactVy = this.vy; // pre-resolve fall speed, for landing feedback
    const res = resolveAgainstSolids(this.hx, this.hy, hw, hh, this.vx, this.vy, dt, solids);
    this.hx = res.x;
    this.hy = res.y;
    this.vx = res.vx;
    this.vy = res.vy;
    const wasGrounded = this.grounded;
    this.grounded = res.grounded;

    // Carry the hero on a moving platform if standing on one.
    if (res.grounded && res.groundPlatform >= 0) {
      const mvIdx = solidIsMover[res.groundPlatform];
      if (mvIdx >= 0) {
        const mv = this.level.movers[mvIdx];
        this.hx += mv.vx * dt;
        this.hy += mv.vy * dt;
      }
    }

    // Landing squash juice + dust kick on a real fall.
    if (!wasGrounded && this.grounded) {
      this.squash = 0.78;
      if (impactVy <= -CONSTANTS.LAND_DUST_MIN_FALL) {
        this.playSfx("land", 0.95 + Math.random() * 0.1);
        this.bursts.spawn({
          position: { x: this.hx, y: this.hy - hh, z: 0.4 },
          color: COLORS.ash,
          count: 10,
          speed: 3,
          life: 0.4,
          gravity: 9,
          upwardBias: 0.6,
          size: 0.14,
        });
      }
    }
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);

    // Clamp to level bounds horizontally.
    if (this.hx < hw) {
      this.hx = hw;
      if (this.vx < 0) this.vx = 0;
    }

    // --- Interactions ---
    this.updateScourge(dt);
    this.updateSpitters(dt);
    this.updateChargers(dt);
    this.updateGlobs(dt, solids);
    this.checkScourgeCollisions();
    this.checkSpitterCollisions();
    this.checkChargerCollisions();
    this.checkHazards();
    this.checkEmbers();
    this.checkCheckpoint();
    this.checkCore();
    this.checkExit();
    this.checkFatalFall();

    // --- Push transforms to renderer ---
    this.renderer.setHeroTransform(this.hx, this.hy, this.facing, this.squash);
    this.renderer.setHeroHurt(this.invuln);
    this.syncDynamicMeshes();
    this.refreshHud();
  }

  private updateMovers(dt: number) {
    for (const mv of this.level.movers) {
      // Position along the authored segment via t in [0,1], ping-ponging.
      const segLen = Math.hypot(mv.toX - mv.baseX, mv.toY - mv.baseY) || 1;

      mv.t += (mv.dir * CONSTANTS.MOVER_SPEED * dt) / segLen;
      if (mv.t >= 1) {
        mv.t = 1;
        mv.dir = -1;
      } else if (mv.t <= 0) {
        mv.t = 0;
        mv.dir = 1;
      }
      const nx = mv.baseX + (mv.toX - mv.baseX) * mv.t;
      const ny = mv.baseY + (mv.toY - mv.baseY) * mv.t;
      mv.vx = (nx - mv.x) / dt;
      mv.vy = (ny - mv.y) / dt;
      mv.x = nx;
      mv.y = ny;
    }
  }

  private updateScourge(dt: number) {
    for (const s of this.level.scourge) {
      if (!s.alive) {
        if (s.popTimer > 0) s.popTimer -= dt;
        continue;
      }
      s.x += s.vx * dt;
      if (s.x <= s.minX) {
        s.x = s.minX;
        s.vx = Math.abs(s.vx);
      } else if (s.x >= s.maxX) {
        s.x = s.maxX;
        s.vx = -Math.abs(s.vx);
      }
    }
  }

  private updateSpitters(dt: number) {
    for (const sp of this.level.spitters) {
      const fired = updateSpitter(sp, this.hx, this.hy, dt, SPITTER_TUNING);
      if (fired) this.launchGlob(sp);
    }
  }

  private launchGlob(sp: Spitter) {
    const glob = this.globs.find((g) => !g.active);
    if (!glob) return;
    const mouthY = sp.y + sp.size * 0.4;
    const v = globLaunchVelocity(sp.x, mouthY, this.hx, this.hy, CONSTANTS.GLOB_ARC_TIME, CONSTANTS.GLOB_GRAVITY);
    glob.x = sp.x;
    glob.y = mouthY;
    glob.vx = v.vx;
    glob.vy = v.vy;
    glob.life = CONSTANTS.GLOB_LIFE;
    glob.active = true;
    this.playSfx("switch", 0.8); // wet lob cue
  }

  private updateGlobs(dt: number, solids: AABB[]) {
    const hero = this.heroAABB();
    for (const g of this.globs) {
      if (!g.active) continue;
      g.vy -= CONSTANTS.GLOB_GRAVITY * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;
      if (g.life <= 0 || g.y < CONSTANTS.KILL_FLOOR_Y) {
        g.active = false;
        continue;
      }
      const box = rectToAABB(g.x, g.y, CONSTANTS.GLOB_SIZE, CONSTANTS.GLOB_SIZE);
      if (aabbOverlap(hero, box)) {
        g.active = false;
        this.damageHero(CONSTANTS.GLOB_DAMAGE, g.x);
        continue;
      }
      for (const s of solids) {
        if (aabbOverlap(box, s)) {
          g.active = false;
          this.bursts.spawn({
            position: { x: g.x, y: g.y, z: 0.4 },
            color: COLORS.toxic,
            count: 6,
            speed: 2.5,
            life: 0.3,
            size: 0.12,
          });
          break;
        }
      }
    }
  }

  private updateChargers(dt: number) {
    for (let i = 0; i < this.level.chargers.length; i++) {
      const c = this.level.chargers[i];
      const event = updateCharger(c, this.hx, this.hy, dt, CHARGER_TUNING);
      if (!c.alive || event === null) continue;
      if (event === "charged") {
        this.playSfx("dash", 0.9);
        this.renderer.setChargerState(i, "charge");
      } else if (event === "stunned") {
        this.playSfx("hit", 0.7);
        this.shake.kick(CONSTANTS.SHAKE_WALLHIT);
        this.bursts.spawn({
          position: { x: c.x + c.facing * (c.w / 2), y: c.y, z: 0.4 },
          color: COLORS.ash,
          count: 8,
          speed: 3,
          life: 0.35,
          gravity: 8,
          size: 0.13,
        });
        this.renderer.setChargerState(i, "stunned");
      } else {
        this.renderer.setChargerState(i, "patrol");
      }
    }
  }

  private heroAABB(): AABB {
    return rectToAABB(this.hx, this.hy, CONSTANTS.HERO_WIDTH, CONSTANTS.HERO_HEIGHT);
  }

  // Shared stomp-kill feedback: bounce, squash-pop burst, kick, kill cue.
  private stompKill(x: number, y: number, toast: string) {
    this.vy = CONSTANTS.STOMP_BOUNCE;
    this.squash = 1.2;
    this.shake.kick(CONSTANTS.SHAKE_STOMP);
    this.playSfx("kill", 0.94 + Math.random() * 0.12);
    this.bursts.spawn({
      position: { x, y, z: 0.4 },
      color: COLORS.toxic,
      count: 16,
      speed: 5,
      life: 0.5,
      gravity: 10,
      upwardBias: 0.5,
      size: 0.16,
    });
    this.hud.flashToast(toast, 0.8);
  }

  private checkScourgeCollisions() {
    const hero = this.heroAABB();
    for (const s of this.level.scourge) {
      if (!s.alive) continue;
      const box = rectToAABB(s.x, s.y, s.size, s.size * 0.8);
      if (!aabbOverlap(hero, box)) continue;

      const heroFeet = this.hy - CONSTANTS.HERO_HEIGHT / 2;
      const blobTop = s.y + (s.size * 0.8) / 2;
      // Stomp if descending and feet are above the blob's upper third.
      if (this.vy < 0 && heroFeet > blobTop - s.size * 0.45) {
        s.alive = false;
        s.popTimer = 0.3;
        this.stompKill(s.x, s.y, "SCOURGE POPPED");
      } else {
        this.damageHero(CONSTANTS.CONTACT_DAMAGE, s.x);
      }
    }
  }

  private checkSpitterCollisions() {
    const hero = this.heroAABB();
    for (const sp of this.level.spitters) {
      if (!sp.alive) continue;
      const box = rectToAABB(sp.x, sp.y, sp.size, sp.size * 0.8);
      if (!aabbOverlap(hero, box)) continue;

      const heroFeet = this.hy - CONSTANTS.HERO_HEIGHT / 2;
      const moundTop = sp.y + (sp.size * 0.8) / 2;
      if (this.vy < 0 && heroFeet > moundTop - sp.size * 0.45) {
        sp.alive = false;
        sp.popTimer = 0.3;
        this.stompKill(sp.x, sp.y, "SPITTER BURST");
      } else {
        this.damageHero(CONSTANTS.CONTACT_DAMAGE, sp.x);
      }
    }
  }

  private checkChargerCollisions() {
    const hero = this.heroAABB();
    for (const c of this.level.chargers) {
      if (!c.alive) continue;
      const box = rectToAABB(c.x, c.y, c.w, c.h);
      if (!aabbOverlap(hero, box)) continue;

      const heroFeet = this.hy - CONSTANTS.HERO_HEIGHT / 2;
      const backTop = c.y + c.h / 2;
      // Stomp from above kills it; side contact (especially mid-charge) hurts.
      if (this.vy < 0 && heroFeet > backTop - c.h * 0.55) {
        c.alive = false;
        c.popTimer = 0.3;
        this.stompKill(c.x, c.y, "CHARGER CRACKED");
      } else {
        this.damageHero(CONSTANTS.CONTACT_DAMAGE, c.x);
      }
    }
  }

  private checkHazards() {
    const hero = this.heroAABB();
    for (const h of this.level.hazards) {
      const box = rectToAABB(h.x, h.y, h.w, h.h);
      if (aabbOverlap(hero, box)) {
        // Acid / spikes deal a chunk and knock you back.
        this.damageHero(CONSTANTS.HAZARD_DAMAGE, this.hx - this.facing);
        if (this.hp > 0) {
          // bump up out of the hazard so we don't sit and drain
          this.vy = CONSTANTS.JUMP_VELOCITY * 0.55;
        }
        return;
      }
    }
  }

  private checkEmbers() {
    const hero = this.heroAABB();
    for (let i = 0; i < this.level.embers.length; i++) {
      const e = this.level.embers[i];
      if (e.collected) continue;
      const box = rectToAABB(e.x, e.y, 1, 1);
      if (aabbOverlap(hero, box)) {
        e.collected = true;
        this.embers += CONSTANTS.EMBER_VALUE;
        this.playSfx("pickup", 1 + Math.random() * 0.08);
        this.bursts.spawn({
          position: { x: e.x, y: e.y, z: 0.4 },
          color: COLORS.hellfire,
          count: 6,
          speed: 2.5,
          life: 0.35,
          size: 0.13,
        });
        const mesh = this.renderer.emberMeshes[i];
        if (mesh) mesh.visible = false;
      }
    }
  }

  private checkCheckpoint() {
    const cp = this.level.checkpoint;
    if (cp.reached) return;
    if (Math.abs(this.hx - cp.x) < 1.4 && this.hy > cp.y - 2) {
      cp.reached = true;
      this.spawnX = cp.x;
      this.spawnY = cp.y + 1.5;
      this.renderer.setCheckpointReached();
      this.playSfx("pickup", 1.25);
      this.hud.flashToast("CHECKPOINT SECURED", 1.4);
    }
  }

  private checkCore() {
    if (this.coreLoop.phase !== "infiltrate") return;
    if (!shouldIgniteCore(this.hx, this.hy, this.level.core, this.coreLoop.phase)) return;

    this.coreLoop = igniteBreachCore(this.coreLoop);
    this.playSfx("explosion"); // core ignition
    this.shake.kick(CONSTANTS.SHAKE_IGNITE);
    this.armFeralEscape();
  }

  private checkExit() {
    if (this.coreLoop.phase !== "escape") return;
    if (!shouldCompleteEscape(this.hx, this.hy, this.level.exit, this.coreLoop.phase)) return;

    this.coreLoop = completeEscape(this.coreLoop);
    this.renderer.triggerFlash();

    if (this.levelIndex < LEVELS.length - 1) {
      // Node severed mid-run — breach the next, deeper hulk immediately.
      this.playSfx("breach");
      this.shake.kick(CONSTANTS.SHAKE_IGNITE);
      this.loadLevel(this.levelIndex + 1);
      this.hud.flashToast(`NODE SEVERED // ${this.level.name.toUpperCase()}`, 2);
      this.refreshHud();
      return;
    }

    this.mode = "won";
    this.playSfx("victory");
    this.renderer.setExitArmed(false);
    this.hud.setProgress(1);
    this.hud.showBigToast("won");
  }

  private armFeralEscape() {
    this.playSfx("breach"); // the escape klaxon
    this.renderer.triggerFlash();
    this.renderer.setCoreIgnited();
    this.renderer.setExitArmed(true);
    for (let i = 0; i < this.level.scourge.length; i++) {
      const s = this.level.scourge[i];
      if (!s.alive) continue;
      s.feral = true;
      const dir = s.vx === 0 ? (s.x >= this.hx ? 1 : -1) : Math.sign(s.vx);
      s.vx = dir * CONSTANTS.SCOURGE_FERAL_SPEED;
      this.renderer.setScourgeFeral(i, true);
    }
    this.hud.flashToast("NODE SEVERED // ESCAPE", 1.8);
  }

  private checkFatalFall() {
    if (this.hy < CONSTANTS.KILL_FLOOR_Y) {
      this.killHero();
    }
  }

  private damageHero(amount: number, fromX: number) {
    if (this.invuln > 0) return;
    this.hp -= amount;
    this.invuln = CONSTANTS.IHURT_TIME;
    // knockback away from the source
    const dir = this.hx >= fromX ? 1 : -1;
    this.vx = dir * CONSTANTS.MOVE_SPEED * 0.8;
    this.shake.kick(CONSTANTS.SHAKE_HURT);
    this.flash.flash("#c1121f", { alpha: 0.32, duration: 0.3 });
    this.playSfx("hurt");
    this.hud.flashToast("INTEGRITY BREACHED", 0.9);
    if (this.hp <= 0) this.killHero();
  }

  private killHero() {
    if (this.mode !== "playing") return;
    this.lives -= 1;
    this.hp = CONSTANTS.MAX_HP;
    this.mode = "dead";
    this.respawnTimer = CONSTANTS.RESPAWN_DELAY;
    this.shake.kick(CONSTANTS.SHAKE_DEATH);
    this.flash.flash("#ff2a18", { alpha: 0.5, duration: 0.45 });
    this.playSfx("hurt", 0.7);
    this.renderer.setHeroVisible(false);
    this.renderer.triggerFlash();
    this.refreshHud();
  }

  // One-shot cue through the shared engine, capped per displayed frame so a
  // pile-up of events never turns into a noise burst.
  private playSfx(name: DeadrotSfx, pitch?: number) {
    if (this.sfxThisFrame >= CONSTANTS.SFX_FRAME_CAP) return;
    this.sfxThisFrame += 1;
    audio.sfx(name, pitch === undefined ? undefined : { pitch });
  }

  private syncDynamicMeshes() {
    // Scourge
    for (let i = 0; i < this.level.scourge.length; i++) {
      const s = this.level.scourge[i];
      const g = this.renderer.scourgeMeshes[i];
      if (!g) continue;
      if (s.alive) {
        g.position.set(s.x, s.y, 0.2);
        g.scale.setScalar(1);
        g.visible = true;
      } else if (s.popTimer > 0) {
        // pop: splat flat then vanish
        const k = s.popTimer / 0.3;
        g.scale.set(1 + (1 - k) * 1.4, k * 0.4, 1);
        g.visible = true;
      } else {
        g.visible = false;
      }
    }
    // Spitters
    for (let i = 0; i < this.level.spitters.length; i++) {
      const sp = this.level.spitters[i];
      const g = this.renderer.spitterMeshes[i];
      if (!g) continue;
      if (sp.alive) {
        g.position.set(sp.x, sp.y, 0.2);
        g.scale.setScalar(1);
        g.visible = true;
      } else if (sp.popTimer > 0) {
        const k = sp.popTimer / 0.3;
        g.scale.set(1 + (1 - k) * 1.4, k * 0.4, 1);
        g.visible = true;
      } else {
        g.visible = false;
      }
    }
    // Chargers (scale.x mirrors the facing so the horn leads)
    for (let i = 0; i < this.level.chargers.length; i++) {
      const c = this.level.chargers[i];
      const g = this.renderer.chargerMeshes[i];
      if (!g) continue;
      if (c.alive) {
        g.position.set(c.x, c.y, 0.2);
        g.scale.set(c.facing || 1, 1, 1);
        g.visible = true;
      } else if (c.popTimer > 0) {
        const k = c.popTimer / 0.3;
        g.scale.set((1 + (1 - k) * 1.4) * (c.facing || 1), k * 0.4, 1);
        g.visible = true;
      } else {
        g.visible = false;
      }
    }
    // Toxic globs
    for (let i = 0; i < this.globs.length; i++) {
      const glob = this.globs[i];
      const m = this.renderer.globMeshes[i];
      if (!m) continue;
      m.visible = glob.active;
      if (glob.active) m.position.set(glob.x, glob.y, 0.3);
    }
    // Movers
    for (let i = 0; i < this.level.movers.length; i++) {
      const mv = this.level.movers[i];
      const m = this.renderer.moverMeshes[i];
      if (m) m.position.set(mv.x, mv.y, 0);
    }
  }
}
