import { CONSTANTS } from "../constants";
import type { CoreGoal, CoreLoopPhase, ExitGoal } from "./types";

export interface CoreLoopState {
  phase: CoreLoopPhase;
  coreIgnited: boolean;
  scourgeSevered: boolean;
  exitReached: boolean;
}

export function createCoreLoopState(): CoreLoopState {
  return {
    phase: "infiltrate",
    coreIgnited: false,
    scourgeSevered: false,
    exitReached: false,
  };
}

export function igniteBreachCore(state: CoreLoopState): CoreLoopState {
  if (state.phase !== "infiltrate") return state;
  return {
    phase: "escape",
    coreIgnited: true,
    scourgeSevered: true,
    exitReached: false,
  };
}

export function completeEscape(state: CoreLoopState): CoreLoopState {
  if (state.phase !== "escape") return state;
  return {
    ...state,
    phase: "won",
    exitReached: true,
  };
}

export function shouldIgniteCore(heroX: number, heroY: number, core: CoreGoal): boolean {
  return !core.ignited && distance(heroX, heroY, core.x, core.y) < CONSTANTS.CORE_IGNITE_RADIUS;
}

export function shouldCompleteEscape(heroX: number, heroY: number, exit: ExitGoal): boolean {
  return !exit.reached && distance(heroX, heroY, exit.x, exit.y) < exit.radius;
}

export function objectiveForPhase(phase: CoreLoopPhase): string {
  if (phase === "escape") return "ESCAPE THE SEVERED HULK";
  if (phase === "won") return "HULK SEVERED // LANE CLEARED";
  return "REACH + IGNITE THE CORE";
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
