import { CONSTANTS } from "./constants";
import type { CreepKind } from "./types";

/**
 * Wave director data: deterministic composition per wave so runs are fair and
 * the schedule is unit-testable without THREE. Rippers (fast) join from wave 3,
 * Breach Hulks (armored) from wave 4, and a Lane Tyrant leads every Nth wave.
 */

/** game director: spawn count = baseCount + (wave-1)*countGrowth (wave is 1-based). */
export function spawnCountForWave(wave: number): number {
  return CONSTANTS.waves.baseCount + (wave - 1) * CONSTANTS.waves.countGrowth;
}

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % CONSTANTS.waves.bossEvery === 0;
}

/** The exact creep order a wave spawns (boss appended last so it arrives behind escorts). */
export function waveComposition(wave: number): CreepKind[] {
  const count = spawnCountForWave(wave);
  const list: CreepKind[] = [];
  for (let i = 0; i < count; i++) {
    if (wave >= 4 && i % 5 === 4) list.push("hulk");
    else if (wave >= 3 && i % 3 === 2) list.push("ripper");
    else list.push("shambler");
  }
  if (isBossWave(wave)) list.push("boss");
  return list;
}

/** Per-kind stats after the compounding per-wave scaling. Wave clamps to >= 1. */
export function creepStatsForWave(kind: CreepKind, wave: number): { hp: number; speed: number } {
  const w = Math.max(1, wave);
  const def = CONSTANTS.creeps[kind];
  return {
    hp: def.hp * CONSTANTS.creepScaling.hpGrowth ** (w - 1),
    speed: def.speed * CONSTANTS.creepScaling.speedGrowth ** (w - 1),
  };
}
