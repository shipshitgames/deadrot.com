import { CONSTANTS } from "./constants";
import { EntitySystem } from "./systems/EntitySystem";
import { HudSystem } from "./systems/HudSystem";
import { InputSystem } from "./systems/InputSystem";
import { RenderSystem } from "./systems/RenderSystem";
import type { Phase } from "./types";

// Thin owner of shared state. It wires the systems together, runs the clamped
// rAF loop, and exposes a tiny amount of game state the systems mutate.
export class Game {
  readonly render: RenderSystem;
  readonly input: InputSystem;
  readonly entities: EntitySystem;
  readonly hud: HudSystem;

  // Shared run state
  phase: Phase = "title";
  buffTime = 0; // seconds of champion damage buff remaining
  elapsed = 0;

  // Pause is owned by the React shell (Esc-toggled). When set, the loop keeps
  // rendering but freezes the simulation so the player is never stuck.
  paused = false;
  // Fired whenever `phase` transitions so the React shell can react (e.g. drop
  // the pause overlay the moment a match ends).
  onPhaseChange: ((phase: Phase) => void) | null = null;

  private running = false;
  private lastTime = 0;
  private readonly tick = (now: number) => this.frame(now);

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.render = new RenderSystem(canvas);
    this.input = new InputSystem(canvas, this.render);
    this.entities = new EntitySystem(this);
    this.hud = new HudSystem(hudRoot);

    // Click / R to redeploy once the match has resolved. Returns true when it
    // actually redeployed, so a redeploy click isn't also read as a move order.
    this.input.onRestart = () => {
      if (this.phase === "playing") return false;
      this.beginRun();
      return true;
    };

    this.entities.reset();
  }

  beginRun(): void {
    this.buffTime = 0;
    this.elapsed = 0;
    this.paused = false;
    this.entities.reset();
    this.hud.setBanner(null);
    this.setPhase("playing");
  }

  pause(): void {
    if (this.phase === "playing") this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  get buffed(): boolean {
    return this.buffTime > 0;
  }

  grantBuff(): void {
    this.buffTime = CONSTANTS.scourge.buffDuration;
  }

  win(): void {
    if (this.phase === "playing") {
      this.paused = false;
      this.setPhase("won");
    }
  }

  lose(): void {
    if (this.phase === "playing") {
      this.paused = false;
      this.setPhase("lost");
    }
  }

  private frame(now: number): void {
    if (!this.running) return;
    requestAnimationFrame(this.tick);

    // Clamp delta: large gaps (tab switch) become a single safe step.
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, CONSTANTS.maxDelta);

    this.update(dt);
    this.render.draw();
  }

  private update(dt: number): void {
    // While paused, freeze the whole simulation (and camera drift) but keep the
    // HUD in sync; the React PauseMenu renders the overlay on top.
    if (this.paused) {
      this.hud.update(this);
      return;
    }

    this.render.update(dt);

    if (this.phase === "playing") {
      this.elapsed += dt;
      if (this.buffTime > 0) this.buffTime = Math.max(0, this.buffTime - dt);
      this.entities.update(dt);
      this.render.followChampion(this.entities.champion.pos, dt);
    }

    this.hud.update(this);
  }
}
