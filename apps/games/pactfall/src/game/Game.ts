import { CONSTANTS } from './constants';
import type { Phase } from './types';
import { RenderSystem } from './systems/RenderSystem';
import { InputSystem } from './systems/InputSystem';
import { EntitySystem } from './systems/EntitySystem';
import { HudSystem } from './systems/HudSystem';

// Thin owner of shared state. It wires the systems together, runs the clamped
// rAF loop, and exposes a tiny amount of game state the systems mutate.
export class Game {
  readonly render: RenderSystem;
  readonly input: InputSystem;
  readonly entities: EntitySystem;
  readonly hud: HudSystem;

  // Shared run state
  phase: Phase = 'playing';
  buffTime = 0; // seconds of champion damage buff remaining
  elapsed = 0;

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
      if (this.phase === 'playing') return false;
      this.reset();
      return true;
    };

    this.reset();
  }

  reset(): void {
    this.phase = 'playing';
    this.buffTime = 0;
    this.elapsed = 0;
    this.entities.reset();
    this.hud.setBanner(null);
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
    if (this.phase === 'playing') this.phase = 'won';
  }

  lose(): void {
    if (this.phase === 'playing') this.phase = 'lost';
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
    this.render.update(dt);

    if (this.phase === 'playing') {
      this.elapsed += dt;
      if (this.buffTime > 0) this.buffTime = Math.max(0, this.buffTime - dt);
      this.entities.update(dt);
      this.render.followChampion(this.entities.champion.pos, dt);
    }

    this.hud.update(this);
  }
}
