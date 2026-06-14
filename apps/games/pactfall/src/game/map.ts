// The lane / map data model — the single source of truth for Pactfall's
// battlefield geometry. A MOBA map is a set of LANES; each lane carries the two
// teams' structures (towers guarding a base), the corridor it runs in, and the
// wave cadence that feeds it. Objectives (topple the enemy base, hold your own,
// slay the neutral Scourge) are declared here too.
//
// The shipped slice activates ONE lane ("mid"), but the model already describes
// "top" and "bot" so the full three-lane map can light them up later WITHOUT
// reshaping data — see the README "Three-lane expansion" section and the
// existing follow-ups (#206 blockout, #209 waves, #213 jungle, #214 enemy AI,
// #215 HUD/minimap). Nothing in the sim hard-codes a lane count: it builds from
// `activeLanes(map)`, so flipping a lane's `active` flag is most of the work.
//
// Canon: see apps/lore/content/Locations/Ashgate.md and apps/lore/content/Maps.md.

import { CONSTANTS, type Team } from "./constants";

export type LaneId = "top" | "mid" | "bot";

/** Every lane the model can describe, ordered top → mid → bot. */
export const LANE_IDS: readonly LaneId[] = ["top", "mid", "bot"] as const;

/**
 * A defensive tower: a static structure that must fall before the base behind it
 * can be sieged. `t` is the fraction along the lane measured from the OWNER's
 * base (0) to the enemy base (1). Smaller `t` sits closer to the owner's base
 * (the inner / last-line tower); larger `t` pushes toward center (the outer
 * tower the enemy meets first).
 */
export interface TowerDef {
  t: number;
}

export interface BaseDef {
  x: number;
  z: number;
}

export interface LaneDef {
  id: LaneId;
  /** Only active lanes are simulated. The slice ships with "mid" active. */
  active: boolean;
  /** Lateral center (x) of the corridor. mid = 0; top/bot run parallel, offset. */
  xOffset: number;
  /** Per-team towers, ordered outer → inner (toward the owner's base). */
  towers: Record<Team, TowerDef[]>;
}

/** Minion wave cadence, in data so spawn pressure is a tunable, not a magic number. */
export interface WaveConfig {
  spawnInterval: number;
  waveSize: number;
  /** Per-team delay before the first wave — staggered so the front line moves. */
  firstSpawnDelay: Record<Team, number>;
}

export type ObjectiveId = "destroy-enemy-base" | "defend-base" | "slay-scourge";

export interface ObjectiveDef {
  id: ObjectiveId;
  /** Whether failing/winning this objective resolves the match. */
  decisive: boolean;
  label: string;
}

export interface MapDef {
  id: string;
  name: string;
  loreId: string;
  bases: Record<Team, BaseDef>;
  scourge: { x: number; z: number };
  lanes: LaneDef[];
  waves: WaveConfig;
  objectives: ObjectiveDef[];
}

// Two towers per team per lane: an outer tower flanking center (first to fall)
// and an inner tower guarding the base (the last line). Symmetric for both teams.
const OUTER_T = 0.4; // toward center
const INNER_T = 0.2; // toward the owner's base
function laneTowers(): Record<Team, TowerDef[]> {
  return {
    pyre: [{ t: OUTER_T }, { t: INNER_T }],
    warden: [{ t: OUTER_T }, { t: INNER_T }],
  };
}

// The canonical Pactfall battlefield. Mid is live; top/bot are described but
// dormant — proof the model represents the full three-lane map already.
export const ASHGATE_MAP: MapDef = {
  id: CONSTANTS.arena.loreId,
  name: CONSTANTS.arena.name,
  loreId: CONSTANTS.arena.loreId,
  bases: {
    pyre: { x: 0, z: CONSTANTS.base.friendlyZ },
    warden: { x: 0, z: CONSTANTS.base.enemyZ },
  },
  scourge: { x: 0, z: 0 },
  lanes: [
    { id: "top", active: false, xOffset: -CONSTANTS.arena.laneSpacing, towers: laneTowers() },
    { id: "mid", active: true, xOffset: 0, towers: laneTowers() },
    { id: "bot", active: false, xOffset: CONSTANTS.arena.laneSpacing, towers: laneTowers() },
  ],
  waves: {
    spawnInterval: CONSTANTS.minion.spawnInterval,
    waveSize: CONSTANTS.minion.waveSize,
    firstSpawnDelay: { pyre: 0, warden: 1.3 },
  },
  objectives: [
    { id: "destroy-enemy-base", decisive: true, label: "Topple the Warden base" },
    { id: "defend-base", decisive: true, label: "Hold the Pyre base" },
    { id: "slay-scourge", decisive: false, label: "Slay the Scourge for a buff" },
  ],
};

/** The lanes currently simulated. The slice returns just "mid". */
export function activeLanes(map: MapDef): LaneDef[] {
  return map.lanes.filter((lane) => lane.active);
}

/** The first active lane — the one the camera, champion, and HUD center on. */
export function primaryLane(map: MapDef): LaneDef {
  const lane = map.lanes.find((candidate) => candidate.active);
  if (!lane) throw new Error(`PACTFALL map ${map.id} has no active lane`);
  return lane;
}

/** Absolute Z of a tower: lerp from the owner's base to the enemy base by `t`. */
export function towerZ(map: MapDef, team: Team, tower: TowerDef): number {
  const own = map.bases[team].z;
  const enemy = map.bases[enemyOf(team)].z;
  return own + (enemy - own) * tower.t;
}

/** The opposing team. */
export function enemyOf(team: Team): Team {
  return team === "pyre" ? "warden" : "pyre";
}

/** Count of towers across every active lane (both teams). */
export function totalActiveTowers(map: MapDef): number {
  return activeLanes(map).reduce((sum, lane) => sum + lane.towers.pyre.length + lane.towers.warden.length, 0);
}

/** Count of one team's towers across every active lane. */
export function activeTowersFor(map: MapDef, team: Team): number {
  return activeLanes(map).reduce((sum, lane) => sum + lane.towers[team].length, 0);
}
