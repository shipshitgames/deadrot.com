import { CONSTANTS } from "../constants";
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
import { Hud } from "./hud";
import { Input } from "./input";
import { buildLevel } from "./level";
import { aabbOverlap, platformToAABB, rectToAABB, resolveAgainstSolids } from "./physics";
import { Renderer } from "./render";
import type { AABB, GameMode, LevelData } from "./types";

// The thin owner of shared state + systems. Runs the rAF loop with a clamped
// delta and routes update/draw through the renderer, input, physics and HUD.
export class Game {
  private renderer: Renderer;
  private input = new Input();
  private hud = new Hud();

  private level: LevelData = buildLevel();
  private mode: GameMode = "title";

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
    this.refreshHud();
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase));
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  beginRun() {
    if (this.mode === "playing") return;
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
    this.level = buildLevel();
    this.coreLoop = createCoreLoopState();
    this.renderer.buildLevel(this.level);
    this.lives = CONSTANTS.START_LIVES;
    this.hp = CONSTANTS.MAX_HP;
    this.embers = 0;
    this.spawnX = CONSTANTS.HERO_SPAWN_X;
    this.spawnY = CONSTANTS.HERO_SPAWN_Y;
    this.hud.clearBigToast();
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase));
    this.respawnHero();
    this.refreshHud();
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
    this.hud.setProgress(progressForPhase(this.hx, this.level.width, this.coreLoop.phase));
  }

  debugSnapshot() {
    return {
      mode: this.mode,
      phase: this.coreLoop.phase,
      coreIgnited: this.level.core.ignited,
      scourgeSevered: this.coreLoop.scourgeSevered,
      exitReached: this.level.exit.reached,
      feralScourge: this.level.scourge.filter((s) => s.feral).length,
      objective: objectiveForPhase(this.coreLoop.phase),
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

  teleportToExit() {
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

    if (this.input.restartPressed && this.mode !== "title") {
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

    this.renderer.animate(this.elapsed, dt);
    this.renderer.updateCamera(this.hx, this.hy, this.level.width);
    this.hud.update(dt);
    this.renderer.render();

    requestAnimationFrame(this.loop);
  };

  private updateDead(dt: number) {
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      if (this.lives <= 0) {
        this.mode = "gameover";
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
    const axis = this.input.moveAxis;
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

    if (this.input.consumeJump()) this.jumpBuffer = CONSTANTS.JUMP_BUFFER;
    else if (this.jumpBuffer > 0) this.jumpBuffer -= dt;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = CONSTANTS.JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 1.18; // stretch on launch
    }

    // --- Gravity (variable jump height) ---
    let g = CONSTANTS.GRAVITY;
    if (this.vy < 0) {
      g *= CONSTANTS.FALL_GRAVITY_MULT;
    } else if (this.vy > 0 && !this.input.jumpHeld) {
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

    // Landing squash juice.
    if (!wasGrounded && this.grounded) this.squash = 0.78;
    this.squash += (1 - this.squash) * Math.min(1, dt * 12);

    // Clamp to level bounds horizontally.
    if (this.hx < hw) {
      this.hx = hw;
      if (this.vx < 0) this.vx = 0;
    }

    // --- Interactions ---
    this.updateScourge(dt);
    this.checkScourgeCollisions();
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
    for (let i = 0; i < this.level.movers.length; i++) {
      const mv = this.level.movers[i];
      const dx = mv.toX - mv.x;
      const dy = mv.toY - mv.y;
      const len = Math.hypot(dx, dy) || 1;
      // We track position along the segment via t in [0,1] using the ORIGINAL
      // endpoints; store base on first run.
      const baseX = mv.baseX ?? mv.x;
      const baseY = mv.baseY ?? mv.y;
      mv.baseX = baseX;
      mv.baseY = baseY;
      const segLen = Math.hypot(mv.toX - baseX, mv.toY - baseY) || 1;

      mv.t += (mv.dir * CONSTANTS.MOVER_SPEED * dt) / segLen;
      if (mv.t >= 1) {
        mv.t = 1;
        mv.dir = -1;
      } else if (mv.t <= 0) {
        mv.t = 0;
        mv.dir = 1;
      }
      const nx = baseX + (mv.toX - baseX) * mv.t;
      const ny = baseY + (mv.toY - baseY) * mv.t;
      mv.vx = (nx - mv.x) / dt;
      mv.vy = (ny - mv.y) / dt;
      mv.x = nx;
      mv.y = ny;
      void len;
      void dx;
      void dy;
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

  private heroAABB(): AABB {
    return rectToAABB(this.hx, this.hy, CONSTANTS.HERO_WIDTH, CONSTANTS.HERO_HEIGHT);
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
        this.vy = CONSTANTS.STOMP_BOUNCE;
        this.squash = 1.2;
        this.hud.flashToast("SCOURGE POPPED", 0.8);
      } else {
        this.damageHero(CONSTANTS.CONTACT_DAMAGE, s.x);
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
      this.hud.flashToast("CHECKPOINT SECURED", 1.4);
      this.hud.setObjective(
        this.coreLoop.phase === "infiltrate"
          ? "PUSH DEEPER // IGNITE THE CORE"
          : objectiveForPhase(this.coreLoop.phase),
      );
    }
  }

  private checkCore() {
    if (this.coreLoop.phase !== "infiltrate") return;
    const core = this.level.core;
    if (!shouldIgniteCore(this.hx, this.hy, core)) return;

    this.coreLoop = igniteBreachCore(this.coreLoop);
    core.ignited = true;
    this.armFeralEscape();
  }

  private checkExit() {
    if (this.coreLoop.phase !== "escape") return;
    const exit = this.level.exit;
    if (!shouldCompleteEscape(this.hx, this.hy, exit)) return;

    this.coreLoop = completeEscape(this.coreLoop);
    exit.reached = true;
    this.mode = "won";
    this.renderer.triggerFlash();
    this.renderer.setExitArmed(false);
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase));
    this.hud.setProgress(1);
    this.hud.showBigToast("won");
  }

  private armFeralEscape() {
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
    this.hud.setObjective(objectiveForPhase(this.coreLoop.phase));
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
    this.hud.flashToast("INTEGRITY BREACHED", 0.9);
    if (this.hp <= 0) this.killHero();
  }

  private killHero() {
    if (this.mode !== "playing") return;
    this.lives -= 1;
    this.hp = CONSTANTS.MAX_HP;
    this.mode = "dead";
    this.respawnTimer = CONSTANTS.RESPAWN_DELAY;
    this.renderer.setHeroVisible(false);
    this.renderer.triggerFlash();
    this.refreshHud();
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
    // Movers
    for (let i = 0; i < this.level.movers.length; i++) {
      const mv = this.level.movers[i];
      const m = this.renderer.moverMeshes[i];
      if (m) m.position.set(mv.x, mv.y, 0);
    }
  }
}
