import { CONSTANTS } from "../constants";
import type { CoreGoal, CoreLoopPhase, ExitGoal } from "./types";

export interface CoreLoopState {
  phase: CoreLoopPhase;
}

export function createCoreLoopState(): CoreLoopState {
  return { phase: "infiltrate" };
}

export function igniteBreachCore(state: CoreLoopState): CoreLoopState {
  if (state.phase !== "infiltrate") return state;
  return { phase: "escape" };
}

export function completeEscape(state: CoreLoopState): CoreLoopState {
  if (state.phase !== "escape") return state;
  return { phase: "won" };
}

export function shouldIgniteCore(heroX: number, heroY: number, core: CoreGoal, phase: CoreLoopPhase): boolean {
  // The core is ignited in every phase past infiltrate.
  return phase === "infiltrate" && distance(heroX, heroY, core.x, core.y) < CONSTANTS.CORE_IGNITE_RADIUS;
}

export function shouldCompleteEscape(heroX: number, heroY: number, exit: ExitGoal, phase: CoreLoopPhase): boolean {
  // The exit is only reached once the run is won.
  return phase !== "won" && distance(heroX, heroY, exit.x, exit.y) < exit.radius;
}

export function objectiveForPhase(phase: CoreLoopPhase, checkpointReached: boolean): string {
  if (phase === "escape") return "ESCAPE THE SEVERED HULK";
  if (phase === "won") return "HULK SEVERED // LANE CLEARED";
  return checkpointReached ? "PUSH DEEPER // IGNITE THE CORE" : "REACH + IGNITE THE CORE";
}

export function progressForPhase(heroX: number, levelWidth: number, phase: CoreLoopPhase): number {
  if (phase === "won") return 1;
  if (levelWidth <= 0) return 0;
  const depth = clamp01(heroX / levelWidth);
  return phase === "escape" ? 1 - depth : depth;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
