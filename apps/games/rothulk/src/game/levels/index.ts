import type { LevelData } from "../types";
import { buildLevel1 } from "./level1";
import { buildLevel2 } from "./level2";

// The ordered campaign. Game advances through this list each time an escape
// completes; finishing the last entry is the run victory.
export interface LevelEntry {
  id: string;
  build: () => LevelData;
}

export const LEVELS: readonly LevelEntry[] = [
  { id: "rothulk", build: buildLevel1 },
  { id: "maw-spire", build: buildLevel2 },
];

export function levelCount(): number {
  return LEVELS.length;
}

export function buildLevelAt(index: number): LevelData {
  const entry = LEVELS[index];
  if (!entry) throw new Error(`Rothulk: no level at index ${index}`);
  return entry.build();
}

export { buildLevel1, buildLevel2 };
