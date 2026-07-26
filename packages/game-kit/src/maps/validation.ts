// Pure structural + geometry validation for normalized ArenaMap v2 layouts
// (issue #81). The validator is deliberately THREE-free and deterministic so
// hand-authored maps, generated maps, games, and studio tooling can share the
// same contract. Normalize authoring input first with normalizeArenaLayout,
// then call validateArenaLayout (diagnostics) or assertValidArenaLayout (gate).

import type { ArenaAnchor, ArenaBounds, ArenaLayout, ArenaRect, ArenaRoom, ArenaVolume } from "./arenaLayout";
import { GROUND_LEVEL_ID } from "./arenaLayout";
import {
  openingSill,
  structureInteriorRect,
  structureOpeningPlacement,
  structureStoreys,
  structureWallAxis,
  structureWallThickness,
} from "./structures";

export type ArenaValidationCode =
  | "anchor.blocked"
  | "anchor.id.duplicate"
  | "anchor.level.missing"
  | "anchor.out-of-bounds"
  | "anchor.room.mismatch"
  | "anchor.room.missing"
  | "bounds.invalid"
  | "level.ground.invalid"
  | "level.height.invalid"
  | "level.id.duplicate"
  | "obstacle.dimension.invalid"
  | "obstacle.height.invalid"
  | "obstacle.out-of-bounds"
  | "obstacle.overlap"
  | "obstacle.sliver"
  | "opening.dimension.invalid"
  | "opening.id.duplicate"
  | "opening.level.missing"
  | "opening.out-of-storey"
  | "opening.out-of-wall"
  | "platform.dimension.invalid"
  | "platform.height.invalid"
  | "platform.level.missing"
  | "platform.out-of-bounds"
  | "player-spawn.missing"
  | "player-spawn.unreachable"
  | "ramp.dimension.invalid"
  | "ramp.level.missing"
  | "ramp.out-of-bounds"
  | "ramp.slope.invalid"
  | "room.disconnected"
  | "room.id.duplicate"
  | "room.level.missing"
  | "room.out-of-bounds"
  | "structure.bounds.invalid"
  | "structure.hole.invalid"
  | "structure.id.duplicate"
  | "structure.level.missing"
  | "structure.levels.invalid"
  | "structure.out-of-bounds"
  | "structure.overlap";

/** One deterministic, machine-readable validation failure. `path` uses a
 * JSON-like source path so generators can attach the error to their editor UI. */
export interface ArenaValidationError {
  code: ArenaValidationCode;
  path: string;
  message: string;
  /** A second source path when the failure relates two authored objects. */
  relatedPath?: string;
}

export interface ArenaValidationResult {
  ok: boolean;
  errors: ArenaValidationError[];
}

export interface ArenaValidationOptions {
  /** Reserved ground level id. Default `ground`. */
  groundLevelId?: string;
  /** Numerical tolerance for boundary/touching comparisons. Default 1e-6m. */
  epsilon?: number;
  /** Minimum obstacle/platform XZ extent and obstacle height. Default 0.1m. */
  minExtent?: number;
  /** Minimum shared room opening / ramp width. Default 0.75m. */
  minPassageWidth?: number;
  /** Expansion around player spawns when checking solid obstacles. Default 0.4m. */
  spawnClearance?: number;
  /** Highest accepted level/platform/obstacle top. Default 64m. */
  maxHeight?: number;
}

export const ARENA_VALIDATION_DEFAULTS = Object.freeze({
  groundLevelId: GROUND_LEVEL_ID,
  epsilon: 1e-6,
  minExtent: 0.1,
  minPassageWidth: 0.75,
  spawnClearance: 0.4,
  maxHeight: 64,
});

interface IndexedRoom<TObstacle extends ArenaVolume> {
  room: ArenaRoom<TObstacle>;
  index: number;
  rect: ArenaRect;
  levelY: number;
}

interface IndexedObstacle<TObstacle extends ArenaVolume> {
  obstacle: TObstacle;
  path: string;
  bottom: number;
  top: number;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validRect(bounds: ArenaBounds): ArenaRect | null {
  if (bounds.kind === "square") {
    if (!finite(bounds.half) || bounds.half <= 0) return null;
    return { minX: -bounds.half, maxX: bounds.half, minZ: -bounds.half, maxZ: bounds.half };
  }
  if (
    !finite(bounds.minX) ||
    !finite(bounds.maxX) ||
    !finite(bounds.minZ) ||
    !finite(bounds.maxZ) ||
    bounds.minX >= bounds.maxX ||
    bounds.minZ >= bounds.maxZ
  ) {
    return null;
  }
  return { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ };
}

function rectContains(outer: ArenaRect, inner: ArenaRect, epsilon: number): boolean {
  return (
    inner.minX >= outer.minX - epsilon &&
    inner.maxX <= outer.maxX + epsilon &&
    inner.minZ >= outer.minZ - epsilon &&
    inner.maxZ <= outer.maxZ + epsilon
  );
}

function pointInRect(x: number, z: number, rect: ArenaRect, epsilon: number): boolean {
  return (
    finite(x) &&
    finite(z) &&
    x >= rect.minX - epsilon &&
    x <= rect.maxX + epsilon &&
    z >= rect.minZ - epsilon &&
    z <= rect.maxZ + epsilon
  );
}

function volumeRect(volume: ArenaVolume): ArenaRect {
  return {
    minX: volume.x - volume.w / 2,
    maxX: volume.x + volume.w / 2,
    minZ: volume.z - volume.d / 2,
    maxZ: volume.z + volume.d / 2,
  };
}

function solid(volume: ArenaVolume): boolean {
  return (volume as ArenaVolume & { solid?: boolean }).solid !== false;
}

function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number, epsilon: number): boolean {
  return Math.min(maxA, maxB) - Math.max(minA, minB) > epsilon;
}

function volumesOverlap(a: IndexedObstacle<ArenaVolume>, b: IndexedObstacle<ArenaVolume>, epsilon: number): boolean {
  const ar = volumeRect(a.obstacle);
  const br = volumeRect(b.obstacle);
  return (
    rangesOverlap(ar.minX, ar.maxX, br.minX, br.maxX, epsilon) &&
    rangesOverlap(ar.minZ, ar.maxZ, br.minZ, br.maxZ, epsilon) &&
    rangesOverlap(a.bottom, a.top, b.bottom, b.top, epsilon)
  );
}

function roomsTouch(a: ArenaRect, b: ArenaRect, minPassageWidth: number, epsilon: number): boolean {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);

  // Overlapping footprints share walkable area.
  if (overlapX > epsilon && overlapZ > epsilon) return true;

  const touchX = Math.abs(a.maxX - b.minX) <= epsilon || Math.abs(b.maxX - a.minX) <= epsilon;
  if (touchX && overlapZ + epsilon >= minPassageWidth) return true;

  const touchZ = Math.abs(a.maxZ - b.minZ) <= epsilon || Math.abs(b.maxZ - a.minZ) <= epsilon;
  return touchZ && overlapX + epsilon >= minPassageWidth;
}

function containingRooms<TObstacle extends ArenaVolume>(
  rooms: IndexedRoom<TObstacle>[],
  anchor: Pick<ArenaAnchor, "x" | "z">,
  epsilon: number,
): IndexedRoom<TObstacle>[] {
  return rooms.filter(({ rect }) => pointInRect(anchor.x, anchor.z, rect, epsilon));
}

function spawnBlocked(
  anchor: ArenaAnchor,
  anchorY: number,
  obstacles: IndexedObstacle<ArenaVolume>[],
  clearance: number,
  epsilon: number,
): boolean {
  return obstacles.some(({ obstacle, bottom, top }) => {
    if (!solid(obstacle) || anchorY < bottom - epsilon || anchorY > top + epsilon) return false;
    const rect = volumeRect(obstacle);
    return (
      anchor.x >= rect.minX - clearance &&
      anchor.x <= rect.maxX + clearance &&
      anchor.z >= rect.minZ - clearance &&
      anchor.z <= rect.maxZ + clearance
    );
  });
}

/** Validate a normalized ArenaMap v2 layout. The input is never mutated and
 * errors are emitted in stable source order. */
export function validateArenaLayout<TObstacle extends ArenaVolume = ArenaVolume>(
  layout: ArenaLayout<TObstacle>,
  options: ArenaValidationOptions = {},
): ArenaValidationResult {
  const groundLevelId = options.groundLevelId ?? ARENA_VALIDATION_DEFAULTS.groundLevelId;
  const epsilon = options.epsilon ?? ARENA_VALIDATION_DEFAULTS.epsilon;
  const minExtent = options.minExtent ?? ARENA_VALIDATION_DEFAULTS.minExtent;
  const minPassageWidth = options.minPassageWidth ?? ARENA_VALIDATION_DEFAULTS.minPassageWidth;
  const spawnClearance = options.spawnClearance ?? ARENA_VALIDATION_DEFAULTS.spawnClearance;
  const maxHeight = options.maxHeight ?? ARENA_VALIDATION_DEFAULTS.maxHeight;
  const errors: ArenaValidationError[] = [];

  const add = (code: ArenaValidationCode, path: string, message: string, relatedPath?: string): void => {
    errors.push(relatedPath ? { code, path, message, relatedPath } : { code, path, message });
  };

  const mapRect = validRect(layout.bounds);
  if (!mapRect) {
    add("bounds.invalid", "bounds", "Map bounds must be finite and have positive width and depth.");
  }

  // Levels: stable ids, sane elevations, and an exact ground plane.
  const levelY = new Map<string, number>();
  const levelPath = new Map<string, string>();
  for (const [index, level] of layout.levels.entries()) {
    const path = `levels[${index}]`;
    if (levelY.has(level.id)) {
      add("level.id.duplicate", `${path}.id`, `Duplicate level id "${level.id}".`, `${levelPath.get(level.id)}.id`);
      continue;
    }
    levelY.set(level.id, level.y);
    levelPath.set(level.id, path);
    if (!finite(level.y) || level.y < 0 || level.y > maxHeight) {
      add("level.height.invalid", `${path}.y`, `Level height must be finite and between 0 and ${maxHeight}.`);
    }
    if (level.id === groundLevelId && (!finite(level.y) || Math.abs(level.y) > epsilon)) {
      add("level.ground.invalid", `${path}.y`, `Ground level "${groundLevelId}" must have height 0.`);
    }
  }
  if (!levelY.has(groundLevelId)) {
    add("level.ground.invalid", "levels", `Missing ground level "${groundLevelId}".`);
  }

  // Rooms and their obstacles.
  const roomIds = new Map<string, string>();
  const validRooms: IndexedRoom<TObstacle>[] = [];
  const indexedObstacles: IndexedObstacle<TObstacle>[] = [];
  for (const [roomIndex, room] of layout.rooms.entries()) {
    const roomPath = `rooms[${roomIndex}]`;
    if (roomIds.has(room.id)) {
      add("room.id.duplicate", `${roomPath}.id`, `Duplicate room id "${room.id}".`, `${roomIds.get(room.id)}.id`);
    } else {
      roomIds.set(room.id, roomPath);
    }

    const rect = validRect(room.bounds);
    if (!rect) {
      add("bounds.invalid", `${roomPath}.bounds`, "Room bounds must be finite and have positive width and depth.");
    } else {
      if (mapRect && !rectContains(mapRect, rect, epsilon)) {
        add("room.out-of-bounds", `${roomPath}.bounds`, "Room bounds extend outside the map bounds.");
      }
      const roomLevelId = room.levelId ?? groundLevelId;
      const y = levelY.get(roomLevelId);
      if (y === undefined) {
        add("room.level.missing", `${roomPath}.levelId`, `Room references missing level "${roomLevelId}".`);
      } else {
        validRooms.push({ room, index: roomIndex, rect, levelY: y });
      }
    }

    const roomLevelId = room.levelId ?? groundLevelId;
    const roomY = levelY.get(roomLevelId) ?? 0;
    for (const [obstacleIndex, obstacle] of room.obstacles.entries()) {
      const path = `${roomPath}.obstacles[${obstacleIndex}]`;
      const dimensions = [obstacle.w, obstacle.h, obstacle.d];
      const dimensionsValid = dimensions.every((value) => finite(value) && value > 0);
      const positionValid = finite(obstacle.x) && finite(obstacle.z);
      if (!dimensionsValid || !positionValid) {
        add(
          "obstacle.dimension.invalid",
          path,
          "Obstacle position and dimensions must be finite, with positive width, height, and depth.",
        );
      } else {
        if (Math.min(...dimensions) < minExtent) {
          add("obstacle.sliver", path, `Obstacle dimensions must each be at least ${minExtent}.`);
        }
        if (roomY + obstacle.h > maxHeight + epsilon) {
          add("obstacle.height.invalid", `${path}.h`, `Obstacle top must not exceed ${maxHeight}.`);
        }
        const rectForObstacle = volumeRect(obstacle);
        const outsideMap = Boolean(mapRect && !rectContains(mapRect, rectForObstacle, epsilon));
        const outsideRoom = Boolean(rect && !rectContains(rect, rectForObstacle, epsilon));
        if (outsideMap || outsideRoom) {
          const scope = outsideMap && outsideRoom ? "map and room" : outsideMap ? "map" : "room";
          add("obstacle.out-of-bounds", path, `Obstacle extends outside the ${scope} bounds.`);
        }
      }
      indexedObstacles.push({
        obstacle,
        path,
        bottom: roomY,
        top: roomY + obstacle.h,
      });
    }
  }

  const colliders = indexedObstacles.filter(
    ({ obstacle }) =>
      solid(obstacle) &&
      finite(obstacle.x) &&
      finite(obstacle.z) &&
      finite(obstacle.w) &&
      finite(obstacle.h) &&
      finite(obstacle.d) &&
      obstacle.w > 0 &&
      obstacle.h > 0 &&
      obstacle.d > 0,
  );
  for (let a = 0; a < colliders.length; a++) {
    for (let b = a + 1; b < colliders.length; b++) {
      const left = colliders[a];
      const right = colliders[b];
      if (left && right && volumesOverlap(left, right, epsilon)) {
        add("obstacle.overlap", right.path, "Solid obstacles overlap in three dimensions.", left.path);
      }
    }
  }

  // A room graph catches isolated/sealed-off room footprints. Overlap, a
  // sufficiently wide shared edge, or a ramp whose endpoints land in each room
  // forms a connection. Root traversal at the first valid player spawn so
  // diagnostics identify rooms that gameplay cannot reach, not an arbitrary
  // component chosen by authoring order.
  const reachableRoomIndexes = new Set<number>();
  if (validRooms.length > 0) {
    const edges = validRooms.map(() => new Set<number>());
    for (let a = 0; a < validRooms.length; a++) {
      for (let b = a + 1; b < validRooms.length; b++) {
        const left = validRooms[a];
        const right = validRooms[b];
        if (
          left &&
          right &&
          Math.abs(left.levelY - right.levelY) <= epsilon &&
          roomsTouch(left.rect, right.rect, minPassageWidth, epsilon)
        ) {
          edges[a]?.add(b);
          edges[b]?.add(a);
        }
      }
    }
    for (const ramp of layout.ramps) {
      const fromRooms = containingRooms(validRooms, ramp.from, epsilon);
      const toRooms = containingRooms(validRooms, ramp.to, epsilon);
      for (const from of fromRooms) {
        for (const to of toRooms) {
          const fromIndex = validRooms.indexOf(from);
          const toIndex = validRooms.indexOf(to);
          if (fromIndex !== toIndex && fromIndex >= 0 && toIndex >= 0) {
            edges[fromIndex]?.add(toIndex);
            edges[toIndex]?.add(fromIndex);
          }
        }
      }
    }
    const rootRoomIndex =
      layout.anchors
        .filter(({ kind }) => kind === "playerSpawn")
        .map((spawn) =>
          validRooms.findIndex(
            ({ room, rect }) =>
              pointInRect(spawn.x, spawn.z, rect, epsilon) &&
              (room.levelId ?? groundLevelId) === (spawn.levelId ?? groundLevelId),
          ),
        )
        .find((index) => index >= 0) ?? 0;
    reachableRoomIndexes.add(rootRoomIndex);
    const queue = [rootRoomIndex];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      for (const next of edges[current] ?? []) {
        if (!reachableRoomIndexes.has(next)) {
          reachableRoomIndexes.add(next);
          queue.push(next);
        }
      }
    }
    for (let index = 0; index < validRooms.length; index++) {
      if (!reachableRoomIndexes.has(index)) {
        const isolated = validRooms[index];
        if (isolated) {
          add(
            "room.disconnected",
            `rooms[${isolated.index}].bounds`,
            `Room "${isolated.room.id}" is disconnected from the room graph.`,
          );
        }
      }
    }
  }

  // Platforms.
  for (const [index, platform] of layout.platforms.entries()) {
    const path = `platforms[${index}]`;
    const geometryFinite =
      finite(platform.x) &&
      finite(platform.z) &&
      finite(platform.w) &&
      finite(platform.d) &&
      platform.w > 0 &&
      platform.d > 0;
    if (
      !finite(platform.x) ||
      !finite(platform.z) ||
      !finite(platform.w) ||
      !finite(platform.d) ||
      platform.w < minExtent ||
      platform.d < minExtent
    ) {
      add("platform.dimension.invalid", path, `Platform position must be finite and dimensions at least ${minExtent}.`);
    }
    if (geometryFinite && mapRect && !rectContains(mapRect, volumeRect({ ...platform, h: 1 }), epsilon)) {
      add("platform.out-of-bounds", path, "Platform extends outside the map bounds.");
    }
    const thicknessValid =
      platform.thickness === undefined ||
      (finite(platform.thickness) && platform.thickness >= minExtent && platform.thickness <= platform.y + epsilon);
    if (!finite(platform.y) || platform.y <= 0 || platform.y > maxHeight || !thicknessValid) {
      add(
        "platform.height.invalid",
        path,
        `Platform top must be in (0, ${maxHeight}] and thickness must be positive without extending below ground.`,
      );
    }
    if (platform.levelId !== undefined && !levelY.has(platform.levelId)) {
      add("platform.level.missing", `${path}.levelId`, `Platform references missing level "${platform.levelId}".`);
    }
  }

  // Ramps.
  for (const [index, ramp] of layout.ramps.entries()) {
    const path = `ramps[${index}]`;
    const fromY = levelY.get(ramp.fromLevelId);
    const toY = levelY.get(ramp.toLevelId);
    if (fromY === undefined) {
      add("ramp.level.missing", `${path}.fromLevelId`, `Ramp references missing level "${ramp.fromLevelId}".`);
    }
    if (toY === undefined) {
      add("ramp.level.missing", `${path}.toLevelId`, `Ramp references missing level "${ramp.toLevelId}".`);
    }
    const run = Math.hypot(ramp.to.x - ramp.from.x, ramp.to.z - ramp.from.z);
    if (
      !finite(ramp.width) ||
      ramp.width < minPassageWidth ||
      !finite(run) ||
      run < minExtent ||
      (ramp.steps !== undefined && (!Number.isInteger(ramp.steps) || ramp.steps <= 0))
    ) {
      add(
        "ramp.dimension.invalid",
        path,
        `Ramp run must be at least ${minExtent}, width at least ${minPassageWidth}, and steps a positive integer.`,
      );
    }
    if (
      mapRect &&
      (!pointInRect(ramp.from.x, ramp.from.z, mapRect, epsilon) || !pointInRect(ramp.to.x, ramp.to.z, mapRect, epsilon))
    ) {
      add("ramp.out-of-bounds", path, "Ramp endpoints must stay inside the map bounds.");
    }
    if (fromY !== undefined && toY !== undefined) {
      if (Math.abs(fromY - toY) <= epsilon || Math.max(fromY, toY) > maxHeight) {
        add("ramp.slope.invalid", path, "Ramp must connect two distinct, sane level heights.");
      }
    }
  }

  // Structures: shell sanity, stacked storeys, and openings that actually fit
  // the wall they pierce. Structure walls are emitted as game-side geometry
  // rather than ArenaObstacles, so they never reach the obstacle-overlap pass
  // above — every containment guarantee they have is the one made here.
  const structureIds = new Map<string, string>();
  const structureSpans: { path: string; rect: ArenaRect; minY: number; maxY: number }[] = [];
  for (const [index, structure] of layout.structures.entries()) {
    const path = `structures[${index}]`;
    if (structureIds.has(structure.id)) {
      add(
        "structure.id.duplicate",
        `${path}.id`,
        `Duplicate structure id "${structure.id}".`,
        `${structureIds.get(structure.id)}.id`,
      );
    } else {
      structureIds.set(structure.id, path);
    }

    const wallThickness = structureWallThickness(structure);
    const outerRect = validRect(structure.bounds);
    const interior = outerRect ? structureInteriorRect(structure.bounds, wallThickness) : null;
    if (!interior) {
      add("structure.bounds.invalid", `${path}.bounds`, "Structure bounds must describe a positive-area rectangle.");
    } else if (interior.maxX - interior.minX < minPassageWidth || interior.maxZ - interior.minZ < minPassageWidth) {
      add(
        "structure.bounds.invalid",
        `${path}.bounds`,
        `Structure interior must be at least ${minPassageWidth}m across after removing ${wallThickness}m walls.`,
      );
    }
    if (outerRect && mapRect && !rectContains(mapRect, outerRect, epsilon)) {
      add("structure.out-of-bounds", path, "Structure extends outside the map bounds.");
    }

    // Storeys: every referenced level must exist and elevations must strictly
    // ascend, otherwise the derived floor-to-ceiling heights are meaningless.
    if (structure.levelIds.length === 0) {
      add("structure.levels.invalid", `${path}.levelIds`, "Structure must span at least one floor level.");
    }
    let previousY: number | null = null;
    let ascending = true;
    for (const [levelIndex, levelId] of structure.levelIds.entries()) {
      const y = levelY.get(levelId);
      if (y === undefined) {
        add(
          "structure.level.missing",
          `${path}.levelIds[${levelIndex}]`,
          `Structure references missing level "${levelId}".`,
        );
        continue;
      }
      if (previousY !== null && y <= previousY + epsilon) ascending = false;
      previousY = y;
    }
    if (!ascending) {
      add(
        "structure.levels.invalid",
        `${path}.levelIds`,
        "Structure levelIds must be ordered ground-most first with strictly increasing elevations.",
      );
    }

    const storeys = structureStoreys(structure, levelY);
    if (storeys.length > 0) {
      const top = storeys[storeys.length - 1];
      if (top.ceilingY > maxHeight) {
        add("structure.levels.invalid", `${path}.levelIds`, `Structure roof must stay at or below ${maxHeight}m.`);
      }
      if (outerRect) {
        structureSpans.push({ path, rect: outerRect, minY: storeys[0].floorY, maxY: top.ceilingY });
      }
    }

    // Floor holes: must be resolvable and stay inside the interior, otherwise
    // they would cut through a wall footing.
    for (const [holeIndex, hole] of (structure.floorHoles ?? []).entries()) {
      const holePath = `${path}.floorHoles[${holeIndex}]`;
      if (hole.levelId !== undefined && !levelY.has(hole.levelId)) {
        add("structure.level.missing", `${holePath}.levelId`, `Floor hole references missing level "${hole.levelId}".`);
      }
      if (
        !finite(hole.x) ||
        !finite(hole.z) ||
        !finite(hole.w) ||
        !finite(hole.d) ||
        hole.w < minExtent ||
        hole.d < minExtent
      ) {
        add(
          "structure.hole.invalid",
          holePath,
          `Floor hole position must be finite and at least ${minExtent}m across.`,
        );
        continue;
      }
      if (interior && !rectContains(interior, volumeRect({ ...hole, h: 1 }), epsilon)) {
        add("structure.hole.invalid", holePath, "Floor hole must stay inside the structure's interior footprint.");
      }
    }

    // Openings.
    const openingIds = new Map<string, string>();
    for (const [openingIndex, opening] of structure.openings.entries()) {
      const openingPath = `${path}.openings[${openingIndex}]`;
      if (openingIds.has(opening.id)) {
        add(
          "opening.id.duplicate",
          `${openingPath}.id`,
          `Duplicate opening id "${opening.id}" in structure "${structure.id}".`,
          `${openingIds.get(opening.id)}.id`,
        );
      } else {
        openingIds.set(opening.id, openingPath);
      }

      // Doors are walked through, so they inherit the passage-width floor;
      // windows are vaulted and only need to be non-degenerate.
      const minWidth = opening.kind === "door" ? minPassageWidth : minExtent;
      const minHeight = opening.kind === "door" ? minPassageWidth : minExtent;
      const sill = openingSill(opening);
      if (
        !finite(opening.width) ||
        !finite(opening.height) ||
        !finite(sill) ||
        sill < -epsilon ||
        opening.width < minWidth ||
        opening.height < minHeight ||
        (opening.offset !== undefined && !finite(opening.offset))
      ) {
        add(
          "opening.dimension.invalid",
          openingPath,
          `${opening.kind === "door" ? "Door" : "Window"} must be at least ${minWidth}m wide, ${minHeight}m tall, with a non-negative sill.`,
        );
        continue;
      }

      const storeyId = opening.levelId ?? structure.levelIds[0];
      const storey = storeys.find((candidate) => candidate.levelId === storeyId);
      if (!storey) {
        add(
          "opening.level.missing",
          `${openingPath}.levelId`,
          `Opening references level "${storeyId}", which is not a storey of structure "${structure.id}".`,
        );
        continue;
      }
      if (!outerRect) continue; // bounds already reported; placement would be noise

      const placement = structureOpeningPlacement(structure, opening, storey);
      const axis = structureWallAxis(structure.bounds, opening.side, wallThickness);
      // The corner cells are shared with the two perpendicular walls, so the
      // usable span stops one wall thickness short of each end — cutting into a
      // corner would punch a hole through the neighbouring wall too.
      const usableMin = axis.mid - axis.length / 2 + wallThickness;
      const usableMax = axis.mid + axis.length / 2 - wallThickness;
      if (placement.min < usableMin - epsilon || placement.max > usableMax + epsilon) {
        add(
          "opening.out-of-wall",
          openingPath,
          `Opening must stay within the ${opening.side} wall, clear of its ${wallThickness}m corners.`,
        );
      }
      if (placement.bottom < storey.floorY - epsilon || placement.top > storey.ceilingY + epsilon) {
        add(
          "opening.out-of-storey",
          openingPath,
          `Opening must fit between the storey floor and its ${storey.height}m ceiling.`,
        );
      }
    }
  }

  // Two shells sharing space produce interpenetrating walls and unreachable
  // interiors; catch it here rather than in the renderer.
  for (let i = 0; i < structureSpans.length; i++) {
    for (let j = i + 1; j < structureSpans.length; j++) {
      const a = structureSpans[i];
      const b = structureSpans[j];
      if (
        rangesOverlap(a.rect.minX, a.rect.maxX, b.rect.minX, b.rect.maxX, epsilon) &&
        rangesOverlap(a.rect.minZ, a.rect.maxZ, b.rect.minZ, b.rect.maxZ, epsilon) &&
        rangesOverlap(a.minY, a.maxY, b.minY, b.maxY, epsilon)
      ) {
        add("structure.overlap", a.path, "Structures overlap in three dimensions.", b.path);
      }
    }
  }

  // Anchors: stable references, bounds/room membership, and spawn clearance.
  const anchorIds = new Map<string, string>();
  let playerSpawnCount = 0;
  for (const [index, anchor] of layout.anchors.entries()) {
    const path = `anchors[${index}]`;
    if (anchor.id !== undefined) {
      if (anchorIds.has(anchor.id)) {
        add(
          "anchor.id.duplicate",
          `${path}.id`,
          `Duplicate anchor id "${anchor.id}".`,
          `${anchorIds.get(anchor.id)}.id`,
        );
      } else {
        anchorIds.set(anchor.id, path);
      }
    }
    if (mapRect && !pointInRect(anchor.x, anchor.z, mapRect, epsilon)) {
      add("anchor.out-of-bounds", path, "Anchor must stay inside the map bounds.");
    }
    const anchorLevelId = anchor.levelId ?? groundLevelId;
    const anchorY = levelY.get(anchorLevelId);
    if (anchorY === undefined) {
      add("anchor.level.missing", `${path}.levelId`, `Anchor references missing level "${anchorLevelId}".`);
    }
    if (anchor.roomId !== undefined) {
      const roomPath = roomIds.get(anchor.roomId);
      if (!roomPath) {
        add("anchor.room.missing", `${path}.roomId`, `Anchor references missing room "${anchor.roomId}".`);
      } else {
        const room = validRooms.find(({ room: candidate }) => candidate.id === anchor.roomId);
        if (room && !pointInRect(anchor.x, anchor.z, room.rect, epsilon)) {
          add("anchor.room.mismatch", path, `Anchor lies outside its referenced room "${anchor.roomId}".`);
        }
      }
    }

    const blocked = anchorY !== undefined && spawnBlocked(anchor, anchorY, indexedObstacles, spawnClearance, epsilon);
    if (blocked) {
      add("anchor.blocked", path, `Anchor is blocked by a solid obstacle within ${spawnClearance}m clearance.`);
    }
    if (anchor.kind === "playerSpawn") {
      playerSpawnCount += 1;
      const rooms = containingRooms(validRooms, anchor, epsilon);
      const matchingConnectedLevel = rooms.some(
        (candidate) =>
          (candidate.room.levelId ?? groundLevelId) === anchorLevelId &&
          reachableRoomIndexes.has(validRooms.indexOf(candidate)),
      );
      const reachable = anchorY !== undefined && matchingConnectedLevel && !blocked;
      if (mapRect && !reachable) {
        add(
          "player-spawn.unreachable",
          path,
          "Player spawn must be inside a connected room on its declared level and clear of solid obstacles.",
        );
      }
    }
  }
  if (playerSpawnCount === 0) {
    add("player-spawn.missing", "anchors", "At least one playerSpawn anchor is required.");
  }

  return { ok: errors.length === 0, errors };
}

/** Error thrown by assertValidArenaLayout. The full structured diagnostics stay
 * available to CLI/editor callers through `errors`. */
export class ArenaLayoutValidationError extends Error {
  readonly errors: ArenaValidationError[];

  constructor(errors: ArenaValidationError[]) {
    super(`Arena layout validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
    this.name = "ArenaLayoutValidationError";
    this.errors = errors;
  }
}

/** Runnable gate for generators and build scripts. Throws one aggregate error
 * carrying every structured diagnostic instead of failing on the first issue. */
export function assertValidArenaLayout<TObstacle extends ArenaVolume = ArenaVolume>(
  layout: ArenaLayout<TObstacle>,
  options: ArenaValidationOptions = {},
): void {
  const result = validateArenaLayout(layout, options);
  if (!result.ok) throw new ArenaLayoutValidationError(result.errors);
}
