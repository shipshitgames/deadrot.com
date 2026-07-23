import type { BuildChip, GamePhase, HudState } from "../game/types";

export interface MenuSnapshot {
  phase: GamePhase;
  level: number;
  timeSec: number;
  salvage: number;
  kills: number;
  build: BuildChip[];
}

export const INITIAL_MENU_SNAPSHOT: MenuSnapshot = {
  phase: "title",
  level: 1,
  timeSec: 0,
  salvage: 0,
  kills: 0,
  build: [],
};

/**
 * The React menu shell only needs run details while a run is paused or over.
 * Keeping live-play snapshots empty prevents the 60 fps HUD adapter from
 * turning into a 60 fps React state stream.
 */
export function menuSnapshotFromHud(state: HudState): MenuSnapshot {
  const includeRun = state.phase === "paused" || state.phase === "gameover" || state.phase === "victory";
  return {
    phase: state.phase,
    level: includeRun ? state.level : 1,
    timeSec: includeRun ? Math.floor(state.timeSec) : 0,
    salvage: includeRun ? state.gems : 0,
    kills: includeRun ? state.kills : 0,
    build: includeRun ? state.build.map((chip) => ({ ...chip })) : [],
  };
}

export function sameMenuSnapshot(a: MenuSnapshot, b: MenuSnapshot): boolean {
  if (
    a.phase !== b.phase ||
    a.level !== b.level ||
    a.timeSec !== b.timeSec ||
    a.salvage !== b.salvage ||
    a.kills !== b.kills ||
    a.build.length !== b.build.length
  ) {
    return false;
  }

  return a.build.every((chip, index) => {
    const other = b.build[index];
    return (
      other !== undefined &&
      chip.id === other.id &&
      chip.name === other.name &&
      chip.level === other.level &&
      chip.max === other.max &&
      chip.kind === other.kind &&
      chip.icon === other.icon
    );
  });
}
