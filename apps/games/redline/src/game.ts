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
 * The loop uses a clamped delta and a small fixed-step accumulator so physics
 * stays stable regardless of frame rate.
 */

import { subscribeGlobalGameSettings } from "@shipshitgames/ui";
import { CAMERA } from "./constants";
import { generateCourse } from "./course";
import { Runner } from "./entities/runner";
import { Hud } from "./systems/hud";
import { Input } from "./systems/input";
import { Physics } from "./systems/physics";
import { Render } from "./systems/render";
import type { Course, Phase } from "./types";

const FIXED_DT = 1 / 120; // physics step
const MAX_FRAME = 0.1; // clamp huge deltas (tab switch etc.)

export class Game {
  private input: Input;
  private physics = new Physics();
  private render: Render;
  private hud = new Hud();

  private runner = new Runner();
  private course: Course;

  phase: Phase = "ready";
  private time = 0; // run timer (s)
  private embersCollected = 0;

  private last = 0;
  private acc = 0;
  private raf = 0;
  private readonly unsubscribeSettings: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input(canvas);
    this.render = new Render(canvas);
    this.course = generateCourse();
    this.unsubscribeSettings = subscribeGlobalGameSettings((settings) => {
      this.render.setEffectsLevel(settings.effectLevels.shake);
      this.hud.setEffectsLevel(settings.effectLevels.flash);
    });

    this.render.buildCourse(this.course, this.runner);

    window.addEventListener("resize", this.onResize);

    this.hud.showStart();
    this.hud.onOverlayButton(() => this.startRun());
  }

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.input.dispose();
    this.render.dispose();
    this.unsubscribeSettings();
  }

  private onResize = () => this.render.resize();

  // ---------------------------------------------------------------------------
  // Run lifecycle
  // ---------------------------------------------------------------------------

  private startRun() {
    this.course = generateCourse(); // same seed -> identical, fair course
    this.runner.reset();
    this.render.buildCourse(this.course, this.runner);
    this.time = 0;
    this.embersCollected = 0;
    this.phase = "running";
    this.hud.hideOverlay();
  }

  private win() {
    this.phase = "won";
    const record = this.hud.submitTime(this.time);
    this.hud.showWin(this.time, record, this.embersCollected);
    this.hud.onOverlayButton(() => this.startRun());
  }

  private die(reason: string) {
    this.phase = "dead";
    this.render.kickShake(0.8);
    this.hud.flashHit();
    this.hud.showDead(reason);
    this.hud.onOverlayButton(() => this.startRun());
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);

    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;

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

    if (this.phase === "running") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 8) {
        this.fixedStep(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
        if (this.phase !== "running") break;
      }
    } else {
      // drain accumulator so we don't fast-forward after un-pausing
      this.acc = 0;
    }

    // Render + HUD always update (so overlays animate, camera settles).
    this.render.update(dt, this.runner, this.course);
    this.updateHud();
    this.render.render();

    this.runner.clearEvents();
  };

  private fixedStep(dt: number) {
    this.time += dt;

    this.runner.updateHorizontal(dt, this.input);
    const res = this.physics.step(dt, this.runner, this.course);

    // --- juice driven by physics events ------------------------------------
    if (this.runner.justHit) {
      this.render.kickShake(0.9);
      this.hud.flashHit();
    }
    if (res.collectedEmbers > 0) {
      this.embersCollected += res.collectedEmbers;
      this.hud.flashEmber();
    }

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

  private updateHud() {
    this.hud.update({
      speed: this.runner.vx + (this.runner.dashing ? 14 : 0),
      speedFrac: this.runner.speedFrac,
      time: this.time,
      distance: this.physics.distance(this.runner),
      progress: this.physics.progress(this.runner, this.course),
      state: this.runner.state,
    });
  }

  // expose for debugging in console if needed
  get debug() {
    return { runner: this.runner, course: this.course, cameraLead: CAMERA.lead };
  }
}
