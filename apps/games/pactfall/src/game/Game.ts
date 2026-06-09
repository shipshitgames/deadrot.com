import { createFixedLoop, type FixedLoop } from "@deadrot/game-kit/core";
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

  // Pause is owned by the Game (Esc-toggled via the React shell). When set,
  // the loop keeps rendering but freezes the simulation so the player is
  // never stuck.
  paused = false;
  private readonly phaseListeners = new Set<(phase: Phase) => void>();
  private readonly pauseListeners = new Set<(paused: boolean) => void>();

  // Pactfall is a variable-step sim: run it in the render callback so the
  // shared loop only contributes the clamped rAF cadence, not fixed stepping.
  private readonly loop: FixedLoop = createFixedLoop({
    maxFrame: CONSTANTS.maxDelta,
    update: () => {},
    render: (_alpha, frameDt) => {
      this.update(Math.min(frameDt, CONSTANTS.maxDelta));
      this.render.draw();
    },
  });

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

  subscribePhaseChange(listener: (phase: Phase) => void): () => void {
    this.phaseListeners.add(listener);
    return () => {
      this.phaseListeners.delete(listener);
    };
  }

  subscribePauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);
    return () => {
      this.pauseListeners.delete(listener);
    };
  }

  beginRun(): void {
    this.buffTime = 0;
    this.elapsed = 0;
    this.setPaused(false);
    this.entities.reset();
    this.setPhase("playing");
  }

  pause(): void {
    if (this.phase === "playing") this.setPaused(true);
  }

  resume(): void {
    this.setPaused(false);
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const listener of this.pauseListeners) listener(paused);
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    for (const listener of this.phaseListeners) listener(phase);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  get buffed(): boolean {
    return this.buffTime > 0;
  }

  grantBuff(): void {
    this.buffTime = CONSTANTS.scourge.buffDuration;
  }

  win(): void {
    if (this.phase === "playing") {
      this.setPaused(false);
      this.setPhase("won");
    }
  }

  lose(): void {
    if (this.phase === "playing") {
      this.setPaused(false);
      this.setPhase("lost");
    }
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
