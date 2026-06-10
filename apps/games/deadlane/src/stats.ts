import { CONSTANTS } from "./constants";
import type { GameState } from "./types";

/** Build-speed multiplier from wave bonuses (shared by Game and HUD). */
export function buildSpeedMul(state: GameState): number {
  return 1 + state.buildSpeedLevel * CONSTANTS.bonuses.buildSpeedPerLevel;
}

/** Run-speed multiplier from wave bonuses (shared by Game and HUD). */
export function runSpeedMul(state: GameState): number {
  return 1 + state.runSpeedLevel * CONSTANTS.bonuses.runSpeedPerLevel;
}
