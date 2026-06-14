// ArenaMap v2 structural schema — the game-agnostic core extracted from
// scourge-survivors' flat v1 maps.ts (issue #79). Presentation (material sets,
// environment dressing, picker metadata) stays game-side — except the shared
// biome preset catalog in ./biomes.ts (issue #80), which games resolve into
// their own theme types; this module only describes WHERE things are: bounds,
// rooms, floor levels, ramps/stairs, platforms, and typed anchors.
//
// Engine candidate: everything here is plain JSON-serialisable data — no THREE,
// no engine import. `ArenaBounds` is a structural twin of
// `@shipshitgames/engine` `MapBounds`; if nominal sharing is ever preferred,
// the swap is two lines (add `@shipshitgames/engine` ^0.2.0 as a dependency and
// `export type { MapBounds as ArenaBounds }`).
//
// Coordinate conventions (same as scourge MapObstacle): world-space XZ metres,
// Y up. `x`/`z` are a box centre; `w`/`d` are sizes along X/Z; `h` is height.
//
// Deadlane mapping (the reuse story this schema is shaped for): boardBounds →
// a rect ArenaBounds; breachDoorPoint → a `breachSpawn` anchor; basePoint → an
// `objective` anchor; lane-mouth spawnPoint → a `breachSpawn` anchor with
// `laneId` (parity with engine SpawnPoint.laneId).
//
// Co-op caveat: multiplayer spawns are server-authoritative (NetClient
// onWelcome/respawn) — anchors do NOT propagate to the partykit server.

/** Serialisable XZ play-area bounds. Structural twin of @shipshitgames/engine
 *  MapBounds — mutually assignable; duplicated so game-kit stays engine-free
 *  until this module graduates upstream. Drift gates: ARENA_BOUNDS_PARITY in
 *  scourge maps.ts (compile time) + makeBounds parity vitest (runtime). */
export type ArenaBounds =
  | { kind: "square"; half: number }
  | { kind: "rect"; minX: number; maxX: number; minZ: number; maxZ: number };

/** Plain numeric rectangle on the XZ plane (metres, world space). */
export interface ArenaRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A point on the arena floor plane (world XZ, metres — never a THREE.Vector3). */
export interface ArenaPoint {
  x: number;
  z: number;
}

/** Axis-aligned box footprint: centred at (x,z), w along X, d along Z, h tall.
 *  The structural constraint for game obstacle types (scourge MapObstacle
 *  satisfies it). */
export interface ArenaVolume {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** Default obstacle for games without a richer one. Games with per-obstacle
 *  data (scourge: material token + `elevated`) keep their own type and
 *  parameterize ArenaRoom/ArenaLayout with it. */
export interface ArenaObstacle extends ArenaVolume {
  /** False = drawn/cosmetic only, not a collider. Defaults to true. */
  solid?: boolean;
}

/** Id of the synthesized whole-arena root room (see normalizeArenaLayout). */
export const ROOT_ROOM_ID = "arena";
/** Id of the synthesized ground floor level (y = 0) — the floor ArenaSystem always builds. */
export const GROUND_LEVEL_ID = "ground";
/** Id of the playerSpawn anchor synthesized from a v1 single `spawn`. */
export const SYNTH_PLAYER_SPAWN_ID = "player-spawn";

/** A named region with its own bounds + obstacles. Bounds are WORLD-space (not
 *  room-local) so flat v1 layouts adapt losslessly and collision consumers
 *  never transform. Data only until #82 — the runtime still reads the flat
 *  obstacle list. */
export interface ArenaRoom<TObstacle extends ArenaVolume = ArenaObstacle> {
  /** Stable id, unique within the map. ROOT_ROOM_ID is reserved for the adapter. */
  id: string;
  /** Author-facing label (HUD/minimap later). */
  name?: string;
  /** Room footprint in world space; should sit inside the map bounds (#81 validates). */
  bounds: ArenaBounds;
  /** Obstacles belonging to this room, world-space, author order. Do not share
   *  obstacle objects between rooms (normalize dedupes flat-vs-room aliasing only). */
  obstacles: TObstacle[];
  /** Floor level the room rests on. Defaults to GROUND_LEVEL_ID. */
  levelId?: string;
}

/** A horizontal walkable floor plane. Data only until #82. v1 maps get exactly
 *  one synthesized ground level at y = 0. NOTE: today's `elevated: true`
 *  stacked crates are a render-only quirk (exact `${x}:${z}` key match in
 *  ArenaSystem groundTop), NOT levels — levels/platforms subsume them in #82
 *  without changing v1 stacking. */
export interface ArenaFloorLevel {
  /** Stable id referenced by rooms/ramps/platforms/anchors. GROUND_LEVEL_ID reserved. */
  id: string;
  /** Walkable surface elevation in metres. Ground is 0. */
  y: number;
  /** Author-facing label (HUD/minimap later). */
  name?: string;
  /** Footprint of this plane; omitted = spans the whole map bounds. */
  bounds?: ArenaBounds;
}

/** A raised walkable slab (data only until #82). */
export interface ArenaPlatform {
  /** Stable id, unique within the map. */
  id: string;
  /** Footprint centre along X, world space (obstacle conventions). */
  x: number;
  /** Footprint centre along Z, world space (obstacle conventions). */
  z: number;
  /** Footprint size along X, metres. */
  w: number;
  /** Footprint size along Z, metres. */
  d: number;
  /** World Y of the walkable top surface. */
  y: number;
  /** Slab depth below the top. Omitted = solid down to the ground (a plinth);
   *  set it to make a slab you can pass under. */
  thickness?: number;
  /** Level whose walkable network this belongs to (tooling/AI hint). */
  levelId?: string;
}

/** An inclined connector between two floor levels — ramp or stair run (data
 *  only until #82). Surface Y at each end comes from the referenced levels
 *  (single source of truth — no duplicated elevations). */
export interface ArenaRamp {
  /** Stable id, unique within the map. */
  id: string;
  /** Visual/locomotion treatment; both are walkable slopes to the engine. */
  kind: "ramp" | "stairs";
  /** Bottom edge midpoint (world XZ), at fromLevelId's elevation. */
  from: ArenaPoint;
  /** Top edge midpoint (world XZ), at toLevelId's elevation. */
  to: ArenaPoint;
  /** Walkable width in metres, perpendicular to from→to. */
  width: number;
  /** Level at the bottom of the slope. */
  fromLevelId: string;
  /** Level at the top of the slope. */
  toLevelId: string;
  /** Step-count hint when kind is "stairs" (renderer hint only). */
  steps?: number;
}

/** What an anchor marks. playerSpawn = player start(s); breachSpawn = authored
 *  enemy entry point; objective = defend/interact target; extraction = exit
 *  zone. v1 SEMANTICS: an EMPTY breachSpawn set means "procedural scatter
 *  spawning over the bounds" (engine RectScatterSpawnProvider / survivors
 *  ring) — today's behavior. The adapter NEVER invents breach points; authored
 *  breachSpawns opt a map into point-based spawning once #82 reads them. */
export type ArenaAnchorKind = "playerSpawn" | "breachSpawn" | "objective" | "extraction";

/** A typed named point. Mirrors engine SpawnPoint (incl. laneId) so anchors
 *  can feed a SpawnPointProvider. Deadlane mapping: breachDoorPoint →
 *  breachSpawn, basePoint → objective. */
export interface ArenaAnchor extends ArenaPoint {
  kind: ArenaAnchorKind;
  /** Stable id for missions/scripting; recommended when referenced. Synthesized
   *  playerSpawn uses SYNTH_PLAYER_SPAWN_ID. */
  id?: string;
  /** Yaw in radians around +Y (THREE.Object3D.rotation.y semantics, default
   *  forward −Z): 0 faces −Z; positive rotates toward −X (CCW from above).
   *  Omitted = game default (scourge: face the arena centre). Not read by the
   *  runtime until #82. */
  facing?: number;
  /** Floor level the anchor sits on. Defaults to GROUND_LEVEL_ID. */
  levelId?: string;
  /** Containing room, when the map declares rooms (tooling/AI hint). */
  roomId?: string;
  /** Lane id for lane-spawner games (parity with engine SpawnPoint.laneId). */
  laneId?: string;
  /** Free-form game-defined tags ("wave:boss", "lane:east"). */
  tags?: string[];
}

/** The fully-populated v2 structural layout produced by normalizeArenaLayout.
 *  Invariants: bounds resolved (never undefined); rooms never empty (v1 maps:
 *  exactly [the whole-bounds root room]); levels always contain
 *  GROUND_LEVEL_ID; v1 maps have exactly one playerSpawn anchor (= the v1
 *  `spawn`) and nothing else; ramps/platforms default to []. Consumers (#81
 *  validator, #82 ArenaSystem) read THIS, never the raw authoring fields.
 *  Treat as immutable — element objects may be shared with the source. */
export interface ArenaLayout<TObstacle extends ArenaVolume = ArenaObstacle> {
  bounds: ArenaBounds;
  rooms: ArenaRoom<TObstacle>[];
  levels: ArenaFloorLevel[];
  ramps: ArenaRamp[];
  platforms: ArenaPlatform[];
  anchors: ArenaAnchor[];
}

/** Resolve declarative bounds to plain numbers. Pure-math twin of engine
 *  makeBounds (same numbers, no class) for validators and non-engine
 *  consumers. Always returns a fresh object. square → ±half; rect → copied
 *  as-is. */
export function boundsToRect(bounds: ArenaBounds): ArenaRect {
  if (bounds.kind === "square") {
    return { minX: -bounds.half, maxX: bounds.half, minZ: -bounds.half, maxZ: bounds.half };
  }
  return { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ };
}
