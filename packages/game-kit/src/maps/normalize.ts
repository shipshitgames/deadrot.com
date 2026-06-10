// Thin adapter: lifts any v1-style flat map (bounds? + spawn? + obstacles?)
// plus optional v2 authoring fields into the fully-populated ArenaLayout.
// Pure, non-mutating, idempotent, deterministic. The load-bearing invariant:
// for a normalized v1 map, flattenObstacles(layout) equals the original flat
// obstacle list element-wise (===, same order) — which is what lets #82 flip
// ArenaSystem's build loop to rooms with zero geometry change.

import type {
  ArenaAnchor,
  ArenaAnchorKind,
  ArenaBounds,
  ArenaFloorLevel,
  ArenaLayout,
  ArenaObstacle,
  ArenaPlatform,
  ArenaRamp,
  ArenaRoom,
  ArenaVolume,
} from "./arenaLayout";
import { GROUND_LEVEL_ID, ROOT_ROOM_ID, SYNTH_PLAYER_SPAWN_ID } from "./arenaLayout";

/** Authoring-side input: a v1 flat map, a v2 map, anything in between — or an
 *  already-normalized ArenaLayout. Structural: scourge's ArenaMap satisfies it
 *  directly. */
export interface ArenaLayoutSource<TObstacle extends ArenaVolume = ArenaObstacle> {
  bounds?: ArenaBounds;
  /** v1 single player spawn; becomes a playerSpawn anchor when none is authored. */
  spawn?: { x: number; z: number };
  /** v1 flat obstacle list; homed into the root room. */
  obstacles?: TObstacle[];
  rooms?: ArenaRoom<TObstacle>[];
  levels?: ArenaFloorLevel[];
  ramps?: ArenaRamp[];
  platforms?: ArenaPlatform[];
  anchors?: ArenaAnchor[];
}

export interface NormalizeArenaLayoutOptions {
  /** Used when src.bounds is omitted (the game's default footprint, e.g. scourge's 80x80). */
  defaultBounds?: ArenaBounds;
  /** Override the reserved root-room id if a game needs a different one. Default ROOT_ROOM_ID. */
  rootRoomId?: string;
  /** Override the reserved ground-level id if a game needs a different one. Default GROUND_LEVEL_ID. */
  groundLevelId?: string;
}

/** Normalize a v1/v2/mixed authoring source into the guaranteed-invariant
 *  ArenaLayout (see ArenaLayout doc for the invariants). Rules:
 *  - bounds: src.bounds ?? opts.defaultBounds; TypeError when both are missing.
 *  - rooms: absent/empty → one synthesized whole-bounds root room that ALIASES
 *    the flat obstacle array; authored rooms pass through, with flat obstacles
 *    not homed in any room (by object identity) merged into the root room
 *    (replacing an authored root in place, else prepended).
 *  - levels: ground level (y = 0) prepended unless the author declares one with
 *    the ground id — an authored ground level is trusted verbatim even with
 *    y !== 0 (the rendered floor mesh stays at 0; #81 may warn).
 *  - anchors: authored anchors first; a playerSpawn synthesized from the v1
 *    `spawn` is appended only when none is authored. breachSpawn/objective/
 *    extraction are NEVER invented — an empty breachSpawn set IS the typed
 *    encoding of v1 procedural scatter spawning.
 *  - ramps/platforms: passed through, defaulting to []. Dangling levelId
 *    references are not rejected — geometry validation is #81's contract.
 *  Never mutates src (safe on Object.frozen input); idempotent
 *  (normalize(layout) deep-equals layout). */
export function normalizeArenaLayout<TObstacle extends ArenaVolume = ArenaObstacle>(
  src: ArenaLayoutSource<TObstacle>,
  opts: NormalizeArenaLayoutOptions = {},
): ArenaLayout<TObstacle> {
  const rootId = opts.rootRoomId ?? ROOT_ROOM_ID;
  const groundId = opts.groundLevelId ?? GROUND_LEVEL_ID;

  // --- bounds: the only hard requirement ---
  const bounds = src.bounds ?? opts.defaultBounds;
  if (bounds === undefined) {
    throw new TypeError("normalizeArenaLayout: src.bounds or opts.defaultBounds is required");
  }

  // --- rooms: home the flat v1 obstacles into a root room ---
  const authoredRooms = src.rooms;
  const flat = src.obstacles;
  let rooms: ArenaRoom<TObstacle>[];
  if (!authoredRooms || authoredRooms.length === 0) {
    // v1 (or room-less v2) map: one whole-bounds root room aliasing the flat
    // obstacle array (no copy — reference identity is part of the contract).
    rooms = [{ id: rootId, bounds, levelId: groundId, obstacles: flat ?? [] }];
  } else if (!flat || flat.length === 0) {
    // Fully room-authored map: used as-is (same array reference, author order).
    rooms = authoredRooms;
  } else {
    // Mixed authoring: flat obstacles not already homed in a room (by object
    // identity) are merged into the root room, preserving flat order.
    const homed = new Set<TObstacle>();
    for (const room of authoredRooms) {
      for (const obstacle of room.obstacles) homed.add(obstacle);
    }
    const extras = flat.filter((obstacle) => !homed.has(obstacle));
    if (extras.length === 0) {
      rooms = authoredRooms;
    } else {
      const rootIndex = authoredRooms.findIndex((room) => room.id === rootId);
      rooms =
        rootIndex >= 0
          ? // Replace the authored root at its position with a fresh object —
            // never mutate authored room objects or arrays.
            authoredRooms.map((room, i) =>
              i === rootIndex ? { ...room, obstacles: [...room.obstacles, ...extras] } : room,
            )
          : [{ id: rootId, bounds, levelId: groundId, obstacles: extras }, ...authoredRooms];
    }
  }

  // --- levels: guarantee the ground plane ---
  const authoredLevels = src.levels;
  const levels: ArenaFloorLevel[] = authoredLevels?.some((level) => level.id === groundId)
    ? authoredLevels // an authored ground level is trusted verbatim (even with y !== 0)
    : [{ id: groundId, y: 0, name: "Ground" }, ...(authoredLevels ?? [])];

  // --- anchors: lift the v1 single spawn unless the author declared one ---
  const anchors: ArenaAnchor[] = [...(src.anchors ?? [])];
  if (src.spawn !== undefined && !anchors.some((anchor) => anchor.kind === "playerSpawn")) {
    anchors.push({
      kind: "playerSpawn",
      id: SYNTH_PLAYER_SPAWN_ID,
      x: src.spawn.x,
      z: src.spawn.z,
      levelId: groundId,
    });
  }

  return {
    bounds,
    rooms,
    levels,
    ramps: [...(src.ramps ?? [])],
    platforms: [...(src.platforms ?? [])],
    anchors,
  };
}

/** All obstacles across rooms: rooms in layout order, each room's obstacles in
 *  author order. Always a FRESH array; element identity preserved. For a
 *  normalized v1 map this equals the original flat obstacles element-wise
 *  (===, same order) — the load-bearing invariant that lets #82 switch
 *  buildArena to rooms with zero geometry change. */
export function flattenObstacles<T extends ArenaVolume>(layout: { rooms: ArenaRoom<T>[] }): T[] {
  const out: T[] = [];
  for (const room of layout.rooms) out.push(...room.obstacles);
  return out;
}

/** Anchors of one kind, in layout order (fresh array). */
export function anchorsOfKind(layout: { anchors: ArenaAnchor[] }, kind: ArenaAnchorKind): ArenaAnchor[] {
  return layout.anchors.filter((anchor) => anchor.kind === kind);
}

/** First anchor of a kind, or undefined (callers supply fallbacks; #81 validates presence). */
export function firstAnchor(layout: { anchors: ArenaAnchor[] }, kind: ArenaAnchorKind): ArenaAnchor | undefined {
  return layout.anchors.find((anchor) => anchor.kind === kind);
}
