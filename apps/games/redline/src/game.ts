/**
 * Game — the thin owner of shared state + systems, and the fixed-step loop.
 *
 * Systems:
 *   Input    — keyboard / pointer intent
 *   Physics  — runner vs course resolution
 *   Render   — Three.js scene, camera, juice
 *   Hud      — DOM overlay, timer, best-time persistence
 *
 * Entities:
 *   Runner   — the Pyre courier (momentum / jump / dash / stagger)
 *
 * The loop uses @deadrot/game-kit's createFixedLoop (clamped delta + fixed-step
 * accumulator) so physics stays stable regardless of frame rate.
 */

import { createFixedLoop, type FixedLoop } from "@deadrot/game-kit";
import { recordWarResult } from "@deadrot/game-kit/core";
import { audio } from "./audio";
import { CAMERA, FEEDBACK, RUNNER } from "./constants";
import { generateCourse } from "./course";
import { Runner } from "./entities/runner";
import { Hud } from "./systems/hud";
import { Input } from "./systems/input";
import { Physics } from "./systems/physics";
import { Render } from "./systems/render";
import { detectNearMisses, ScoreSystem } from "./systems/score";
import type { Course, Phase } from "./types";
import { overlayController } from "./ui/overlayController";

// Cap fixed-step catch-up per frame so a long stall can't spiral the sim.
const MAX_STEPS_PER_FRAME = 8;

export class Game {
  private input: Input;
  private physics = new Physics();
  private render: Render;
  private hud = new Hud();

  private runner = new Runner();
  private course: Course;

  phase: Phase = "ready";
  private paused = false;
  private time = 0; // run timer (s)
  private score = new ScoreSystem();

  // Kit defaults match the old hand-rolled loop: 1/120 fixed dt, 0.1s max frame.
  private loop: FixedLoop = createFixedLoop({
    update: (dt) => {
      if (this.phase === "running" && !this.paused && this.frameSteps < MAX_STEPS_PER_FRAME) {
        this.fixedStep(dt);
        this.frameSteps++;
      }
    },
    render: (_alpha, dt) => this.perFrame(dt),
  });
  private frameSteps = 0;

  // Per-displayed-frame feedback accumulators. Runner event flags (justJumped
  // etc.) stay raised across the fixed sub-steps of a frame, so audio reads
  // them once per frame (after the step loop) instead of per step.
  private frameMinVy = 0; // fastest fall speed seen this frame (for landing weight)
  private emberChainQueue: number[] = []; // chain value at each pickup this frame

  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input(canvas);
    this.render = new Render(canvas);
    this.course = generateCourse();

    this.render.buildCourse(this.course, this.runner);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);

    // Shared pause overlay actions (no shop): Restart + Exit to title.
    overlayController.onResume = () => this.resume();
    overlayController.pauseActions = [
      { id: "restart", label: "Restart run", meta: "Same lane", onSelect: () => this.restartFromPause() },
      { id: "title", label: "Exit to title", meta: "Main menu", onSelect: () => this.exitToTitle() },
    ];

    this.showTitle();
  }

  start() {
    this.loop.start();
  }

  dispose() {
    this.loop.stop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.input.dispose();
    this.render.dispose();
  }

  private onResize = () => this.render.resize();

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /** Esc toggles pause, but only while a run is live. */
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Escape") return;
    if (this.paused) {
      this.resume();
    } else if (this.phase === "running") {
      this.pause();
    }
  };

  private pause() {
    if (this.phase !== "running" || this.paused) return;
    this.paused = true;
    overlayController.setPaused(true);
  }

  private resume() {
    if (!this.paused) return;
    this.paused = false;
    overlayController.setPaused(false);
  }

  private restartFromPause() {
    this.resume();
    this.startRun();
  }

  /** Drop the live run and return to the title menu. */
  private exitToTitle() {
    this.resume();
    audio.sfx("uiSelect");
    this.phase = "ready";
    this.showTitle();
  }

  private showTitle() {
    this.hud.showStart({
      onIgnite: () => this.startRun(),
      onSettings: () => this.openSettings(),
    });
  }

  private openSettings() {
    audio.sfx("uiSelect");
    overlayController.openSettings();
  }

  // ---------------------------------------------------------------------------
  // Run lifecycle
  // ---------------------------------------------------------------------------

  private startRun() {
    audio.unlock(); // start screens are reached via gesture; arm music + cues
    audio.sfx("uiSelect");
    this.course = generateCourse(); // same seed -> identical, fair course
    this.runner.reset();
    this.score.reset();
    this.render.buildCourse(this.course, this.runner);
    this.time = 0;
    this.frameMinVy = 0;
    this.emberChainQueue.length = 0;
    this.phase = "running";
    this.hud.hideOverlay();
  }

  private win() {
    this.phase = "won";
    audio.sfx("victory");
    const summary = this.score.summary(this.time);
    const records = this.hud.submitRun(this.time, summary.total);
    // Bank the delivery into the cross-game war record (Warline shows it).
    recordWarResult(
      "redline",
      { outcome: "victory", timeMs: Math.round(this.time * 1000), score: summary.total },
      Date.now(),
    );
    this.hud.showWin(summary, records, () => this.startRun());
  }

  private die(reason: string) {
    this.phase = "dead";
    audio.sfx("defeat");
    // A lost run counts against the war record too — cargo in the pit is a defeat.
    recordWarResult("redline", { outcome: "defeat" }, Date.now());
    this.render.kickShake(0.8);
    this.hud.flashHit();
    this.hud.showDead(reason, () => this.startRun());
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  /** Runs once per animation frame after the fixed-step updates. */
  private perFrame(dt: number) {
    this.frameSteps = 0;

    // While paused, freeze the simulation: drain any buffered input so it does
    // not fire on resume, keep rendering the frozen scene under the overlay.
    if (this.paused) {
      this.input.clear();
      this.render.render();
      this.runner.clearEvents();
      return;
    }

    // Global: restart hotkey works in any phase.
    if (this.input.consumeRestart()) {
      this.startRun();
    }

    // Allow any key / tap to ignite from the start screen.
    if (this.phase === "ready" && this.input.consumeAnyKey()) {
      this.startRun();
    } else {
      // keep the queue from growing while idle on overlays
      this.input.consumeAnyKey();
    }

    // Audio reads the frame-scoped runner events once, before they're cleared.
    this.playFrameAudio();

    // Render + HUD always update (so overlays animate, camera settles).
    this.render.update(dt, this.runner, this.course);
    this.updateHud();
    this.render.render();

    this.runner.clearEvents();
  }

  private fixedStep(dt: number) {
    this.time += dt;

    const prevX = this.runner.x;
    // Track the fastest fall this frame so a landing knows its impact weight.
    if (!this.runner.onGround) {
      this.frameMinVy = Math.min(this.frameMinVy, this.runner.vy);
    }

    this.runner.updateHorizontal(dt, this.input);
    const res = this.physics.step(dt, this.runner, this.course);
    this.score.update(dt);

    // --- juice driven by physics events ------------------------------------
    if (this.runner.justHit) {
      this.render.kickShake(0.9);
      this.hud.flashHit();
    }
    if (res.collectedEmbers > 0) {
      for (let i = 0; i < res.collectedEmbers; i++) {
        this.score.collectEmber();
        this.emberChainQueue.push(this.score.chain);
      }
      this.hud.flashEmber();
      this.render.emitEmberBurst(this.runner.x, this.runner.y);
    }

    // --- style: hazards skimmed cleanly this step ---------------------------
    this.score.addNearMisses(
      detectNearMisses(
        {
          prevX,
          x: this.runner.x,
          y: this.runner.y,
          crouch: this.runner.crouch,
          radius: RUNNER.radius,
          staggered: this.runner.staggered,
          invulnerable: this.runner.invuln > 0,
        },
        this.course.hazards,
      ),
    );

    // --- terminal states ----------------------------------------------------
    if (res.fellInPit) {
      this.die("Cargo lost to the rot below. The lane swallowed the run.");
      return;
    }
    if (res.reachedBeacon) {
      this.win();
      return;
    }
  }

  /**
   * One-shot cues for this displayed frame, capped so layered events never
   * stack into noise. Pitch carries the information: gems climb with the
   * chain, jumps get a hair of variation.
   */
  private playFrameAudio() {
    let budget = FEEDBACK.sfxFrameCap;
    const play = (name: Parameters<typeof audio.sfx>[0], pitch?: number) => {
      if (budget <= 0) return;
      budget--;
      audio.sfx(name, pitch === undefined ? undefined : { pitch });
    };

    if (this.runner.justJumped) play("jump", 1 + (Math.random() - 0.5) * FEEDBACK.jumpPitchJitter);
    if (this.runner.justDashed) play("dash");
    if (this.runner.justLanded && this.frameMinVy <= FEEDBACK.landFallVy) {
      play("land");
      this.render.emitLandingDust(this.runner.x, this.runner.y - RUNNER.radius * this.runner.crouch);
    }
    if (this.runner.justHit) play("hurt");
    for (const chain of this.emberChainQueue) {
      play("gem", 1 + (chain - 1) * FEEDBACK.gemChainPitchStep);
    }
    this.emberChainQueue.length = 0;
    if (this.runner.onGround || this.runner.justLanded) this.frameMinVy = 0;
  }

  private updateHud() {
    this.hud.update({
      speed: this.runner.vx + (this.runner.dashing ? 14 : 0),
      speedFrac: this.runner.speedFrac,
      time: this.time,
      distance: this.physics.distance(this.runner),
      progress: this.physics.progress(this.runner, this.course),
      state: this.runner.state,
      score: this.score.earned,
      chain: this.score.chain,
      chainFrac: this.score.chainFrac,
    });
  }

  // expose for debugging in console if needed
  get debug() {
    return { runner: this.runner, course: this.course, cameraLead: CAMERA.lead };
  }
}
