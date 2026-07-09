import { AudioSystem } from "./audio/AudioSystem";
import { FighterSystem } from "./fighters/FighterSystem";
import { InputSystem } from "./input/InputSystem";
import { RenderSystem } from "./render/RenderSystem";
import type { FighterId } from "./roster";
import type { GameSystems } from "./systems";
import type { GameMode, InputAction, StateListener } from "./types";

/**
 * Thin Brawl orchestrator. Its flat loop is the deterministic contract:
 * input/AI + physics + attacks, then FX/camera, then render, then HUD emit.
 */
export class Game {
  private readonly sys: GameSystems;
  private raf = 0;
  private disposed = false;
  private lastFrame = performance.now();
  private emitAccumulator = 0;

  constructor(canvas: HTMLCanvasElement, listener: StateListener) {
    const sys = {} as GameSystems;
    this.sys = sys;
    sys.render = new RenderSystem(canvas);
    sys.audio = new AudioSystem();
    sys.input = new InputSystem(() => this.togglePause());
    sys.fighters = new FighterSystem(sys.render, sys.input, sys.audio, listener);
    sys.render.start();
    sys.input.start();
  }

  start() {
    if (this.disposed || this.raf) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  setMode(mode: GameMode) {
    this.sys.fighters.setMode(mode);
  }

  setArenaSlots(slots: number) {
    this.sys.fighters.setArenaSlots(slots);
  }

  selectFighter(id: FighterId) {
    this.sys.fighters.selectFighter(id);
  }

  startFight(id?: FighterId) {
    this.sys.render.resetCamera();
    this.sys.fighters.startFight(id);
  }

  startArena(id?: FighterId, slots?: number) {
    this.sys.render.resetCamera();
    this.sys.fighters.startArena(id, slots);
  }

  rematch() {
    this.sys.render.resetCamera();
    this.sys.fighters.rematch();
  }

  pause() {
    this.sys.fighters.pause();
  }

  resume() {
    this.sys.fighters.resume();
  }

  togglePause() {
    this.sys.fighters.togglePause();
  }

  returnToRoster() {
    this.sys.render.resetCamera();
    this.sys.fighters.returnToRoster();
  }

  setMenuOverlayOpen(open: boolean) {
    this.sys.input.setMenuOverlayOpen(open);
  }

  command(action: InputAction) {
    this.sys.input.command(action);
  }

  setVirtual(action: InputAction, pressed: boolean) {
    this.sys.input.setVirtual(action, pressed);
  }

  debugSnapshot(): ReturnType<FighterSystem["debugSnapshot"]> & { audioState: AudioContextState | "none" } {
    return { ...this.sys.fighters.debugSnapshot(), audioState: this.sys.audio.contextState };
  }

  debugRingOut(slot: number) {
    this.sys.fighters.debugRingOut(slot);
  }

  debugSetTimer(seconds: number) {
    this.sys.fighters.debugSetTimer(seconds);
  }

  debugSetDuelPositions(playerX: number, opponentX: number) {
    this.sys.fighters.debugSetDuelPositions(playerX, opponentX);
  }

  debugEliminateRivals() {
    this.sys.fighters.debugEliminateRivals();
  }

  debugLifecycle() {
    return {
      disposed: this.disposed,
      frameScheduled: this.raf !== 0,
      audioState: this.sys.audio.contextState,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sys.input.dispose();
    this.sys.fighters.dispose();
    this.sys.audio.dispose();
    this.sys.render.dispose();
  }

  private readonly loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    // Keep this update sequence explicit. Brawl rules remain local to the
    // fighter system; the engine does not generalize fighting-game semantics.
    if (this.sys.fighters.currentStatus === "playing") {
      if (this.sys.fighters.currentMode === "arena") this.sys.fighters.updateArena(delta);
      else this.sys.fighters.updateDuel(delta);
    }
    this.sys.render.updateEffects(delta);
    this.sys.render.updateCamera(
      delta,
      this.sys.fighters.currentMode,
      this.sys.fighters.currentStatus,
      this.sys.fighters.arenaCameraPositions(),
    );
    this.sys.render.render(this.sys.fighters.currentMode);

    this.emitAccumulator += delta;
    if (this.emitAccumulator >= 0.06) {
      this.emitAccumulator = 0;
      this.sys.fighters.emitSnapshot();
    }
  };
}
