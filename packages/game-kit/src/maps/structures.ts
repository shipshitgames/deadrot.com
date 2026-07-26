// ArenaMap v2 building schema — enterable multi-storey structures with walls,
// openable doors, breakable windows, interior floor slabs and stairwell holes.
//
// Rooms/levels/ramps (./arenaLayout.ts) describe the OUTDOOR walkable network:
// where the ground sits and how you climb between elevations. Structures
// describe ENCLOSURES placed on top of that network — a shell of walls pierced
// by openings, with its own stacked floor slabs. A structure is geometry inside
// an existing room, never a room itself: that keeps the room-connectivity graph
// (validation.ts) unchanged, and lets a building drop into any authored map
// without re-plumbing reachability.
//
// Everything here is plain JSON-serialisable data + pure math — no THREE, no
// DOM. Games expand these declarations into their own solid boxes / meshes
// (scourge: src/game/render/arenaGeometry.ts), so the arithmetic below is
// unit-testable in node and shared by the validator, the renderer, and any
// future authoring tool.
//
// Coordinate conventions match the rest of the schema: world-space XZ metres,
// Y up, `x`/`z` a centre, `w`/`d` full sizes. SIDE NAMING is fixed and absolute
// (not camera-relative):
//
//        −Z  "north"
//          ┌────────┐
//   "west" │        │ "east"
//     −X   │        │  +X
//          └────────┘
//        +Z  "south"

import { type ArenaBounds, type ArenaRect, boundsToRect } from "./arenaLayout";

/** Wall of a structure footprint, named by absolute world direction (see the
 *  diagram above): north = minZ, south = maxZ, west = minX, east = maxX. */
export type ArenaStructureSide = "north" | "south" | "east" | "west";

/** What an opening is. Doors are floor-level and traversable when open; windows
 *  are raised (a sill) and traversable only by vaulting — or by shooting the
 *  glass out first. */
export type ArenaOpeningKind = "door" | "window";

/** Authored resting state of an opening. "locked" doors never open (scripted /
 *  decorative); "open" starts swung wide. Windows use "closed" (glazed, blocks
 *  movement + projectiles) or "open" (already broken/missing). */
export type ArenaOpeningState = "closed" | "open" | "locked";

/** Which edge a swinging door pivots on, viewed from OUTSIDE the structure. */
export type ArenaDoorHinge = "left" | "right";

/** How a door travels when it opens. "swing" rotates about its hinge edge;
 *  "slide" translates along the wall into the adjacent wall segment. */
export type ArenaDoorMotion = "swing" | "slide";

/** Wall thickness (metres) when a structure omits it. Thick enough to read as
 *  masonry at FPS eye height without eating interior floor area. */
export const DEFAULT_WALL_THICKNESS = 0.4;
/** Floor-to-ceiling clearance (metres) for a storey whose height cannot be
 *  derived from the next storey's elevation (i.e. the topmost storey). */
export const DEFAULT_STOREY_HEIGHT = 3.4;
/** Thickness (metres) of an interior floor slab below its walkable surface. */
export const DEFAULT_FLOOR_THICKNESS = 0.3;
/** Height (metres) of a window's bottom edge above its storey floor. Chest-high
 *  so it reads as a window and is vaultable. */
export const DEFAULT_WINDOW_SILL = 1.05;
/** Thickness (metres) of a roof slab capping the topmost storey. */
export const DEFAULT_ROOF_THICKNESS = 0.3;

/** A hole punched through one storey's floor slab — a stairwell shaft, a
 *  collapsed section, an atrium. Coordinates are world-space (same frame as the
 *  structure footprint), NOT structure-local. */
export interface ArenaStructureHole {
  /** Optional stable id (tooling/debug only; holes are not referenced). */
  id?: string;
  /** Hole centre along X, world space. */
  x: number;
  /** Hole centre along Z, world space. */
  z: number;
  /** Hole size along X, metres. */
  w: number;
  /** Hole size along Z, metres. */
  d: number;
  /** Storey whose slab is pierced. Omitted = every storey above the ground
   *  (an open shaft running the full height). */
  levelId?: string;
}

/** A door or window cut through one wall of one storey. The cut is a rectangle
 *  in the wall plane: `width` along the wall, `height` in Y, positioned by
 *  `offset` (along the wall, signed from its midpoint) and `sill` (above the
 *  storey floor). */
export interface ArenaStructureOpening {
  /** Stable id, unique within the structure. Referenced by interaction state,
   *  telemetry, and mission scripting. */
  id: string;
  kind: ArenaOpeningKind;
  /** Which wall is pierced. */
  side: ArenaStructureSide;
  /** Storey whose wall is pierced. Defaults to the structure's first (ground-most) storey. */
  levelId?: string;
  /** Signed distance along the wall from its midpoint, metres. Positive is
   *  toward +X on north/south walls, toward +Z on east/west walls. Defaults to
   *  0 (centred). */
  offset?: number;
  /** Clear width of the opening along the wall, metres. */
  width: number;
  /** Clear height of the opening, metres. */
  height: number;
  /** Bottom edge above the storey floor, metres. Defaults to 0 for doors and
   *  DEFAULT_WINDOW_SILL for windows. */
  sill?: number;
  /** Pivot edge viewed from outside. Doors only; defaults to "left". */
  hinge?: ArenaDoorHinge;
  /** Door travel style. Doors only; defaults to "swing". */
  motion?: ArenaDoorMotion;
  /** Starting state. Defaults to "closed". */
  state?: ArenaOpeningState;
  /** Windows only: does a pane fill the opening? Glazed panes block movement
   *  and projectiles until broken. Defaults to true. */
  glazed?: boolean;
  /** Free-form game-defined tags ("style:rusted", "loot:medkit"). */
  tags?: string[];
}

/** An enterable building: a stack of storeys sharing one footprint, walled on
 *  all four sides, pierced by openings, floored between storeys and (optionally)
 *  capped by a roof. */
export interface ArenaStructure {
  /** Stable id, unique within the map. */
  id: string;
  /** Author-facing label (HUD/minimap/objective text). */
  name?: string;
  /** Footprint in world space — the OUTER face of the walls. */
  bounds: ArenaBounds;
  /** Floor levels this structure spans, ground-most first. Each entry becomes
   *  one storey whose floor sits at that level's `y`. Must be non-empty. */
  levelIds: string[];
  /** Wall thickness, metres. Defaults to DEFAULT_WALL_THICKNESS. */
  wallThickness?: number;
  /** Floor-to-ceiling clearance for the TOPMOST storey (every lower storey
   *  derives its height from the next storey's elevation). Defaults to
   *  DEFAULT_STOREY_HEIGHT. */
  storeyHeight?: number;
  /** Interior floor slab depth below its walkable surface. Defaults to
   *  DEFAULT_FLOOR_THICKNESS. */
  floorThickness?: number;
  /** Doors and windows cut through the walls. */
  openings: ArenaStructureOpening[];
  /** Holes punched through interior floor slabs (stairwells, collapses). */
  floorHoles?: ArenaStructureHole[];
  /** Cap the topmost storey with a solid roof. Defaults to true; false leaves
   *  an open-topped shell (ruins, courtyards, rooftop fights). */
  roof?: boolean;
  /** Free-form material/dressing token games resolve against their own theme
   *  (scourge maps it to an ObstacleMat). */
  style?: string;
  /** Free-form game-defined tags. */
  tags?: string[];
}

/** One resolved storey of a structure. Produced by structureStoreys — never
 *  authored. */
export interface ArenaStructureStorey {
  /** Level this storey rests on. */
  levelId: string;
  /** 0-based position in the stack (0 = ground-most). */
  index: number;
  /** Walkable floor surface elevation, world Y. */
  floorY: number;
  /** Floor-to-ceiling clearance, metres. */
  height: number;
  /** Top of this storey's walls, world Y (= the next storey's floor, or the
   *  underside of the roof for the topmost storey). */
  ceilingY: number;
}

/** The running axis of one wall of a footprint. Produced by structureWallAxis. */
export interface ArenaWallAxis {
  /** World axis the wall runs along. */
  along: "x" | "z";
  /** Fixed-axis coordinate of the wall CENTRELINE (Z for north/south walls, X
   *  for east/west) — i.e. the outer face pulled inward by half the thickness. */
  center: number;
  /** Midpoint along the running axis — the origin `offset` is measured from. */
  mid: number;
  /** Full length of the wall along its running axis, corner to corner
   *  (footprint size on that axis — corners are shared between adjacent walls,
   *  see structureWallAxis for why that is safe). */
  length: number;
  /** Sign of the outward normal along the fixed axis (+1 = toward +X/+Z). */
  outward: 1 | -1;
}

/** Resolved world placement of one opening. Produced by
 *  structureOpeningPlacement — never authored. */
export interface ArenaOpeningPlacement {
  /** The opening this describes. */
  id: string;
  kind: ArenaOpeningKind;
  side: ArenaStructureSide;
  /** Axis the pierced wall runs along. */
  along: "x" | "z";
  /** Fixed-axis coordinate of the wall centreline. */
  wallCenter: number;
  /** Sign of the wall's outward normal along the fixed axis. */
  outward: 1 | -1;
  /** Wall thickness at this opening, metres. */
  thickness: number;
  /** Low edge of the cut along the running axis, world space. */
  min: number;
  /** High edge of the cut along the running axis, world space. */
  max: number;
  /** Bottom edge of the cut, world Y. */
  bottom: number;
  /** Top edge of the cut, world Y. */
  top: number;
  /** Centre of the cut along X, world space. */
  x: number;
  /** Centre of the cut along Y, world space. */
  y: number;
  /** Centre of the cut along Z, world space. */
  z: number;
}

/** Wall thickness of a structure, defaulted. */
export function structureWallThickness(structure: Pick<ArenaStructure, "wallThickness">): number {
  const t = structure.wallThickness;
  return t !== undefined && Number.isFinite(t) && t > 0 ? t : DEFAULT_WALL_THICKNESS;
}

/** Interior floor slab depth of a structure, defaulted. */
export function structureFloorThickness(structure: Pick<ArenaStructure, "floorThickness">): number {
  const t = structure.floorThickness;
  return t !== undefined && Number.isFinite(t) && t > 0 ? t : DEFAULT_FLOOR_THICKNESS;
}

/** Sill of an opening, defaulted by kind (doors sit on the floor, windows at
 *  chest height). */
export function openingSill(opening: Pick<ArenaStructureOpening, "kind" | "sill">): number {
  if (opening.sill !== undefined && Number.isFinite(opening.sill)) return opening.sill;
  return opening.kind === "window" ? DEFAULT_WINDOW_SILL : 0;
}

/** True when the opening currently blocks movement: a closed/locked door, or a
 *  glazed closed window. Authoring-state only — runtime toggling lives in the
 *  game (this is the initial value it seeds from). */
export function openingBlocksAtRest(opening: ArenaStructureOpening): boolean {
  if (opening.state === "open") return false;
  if (opening.kind === "window") return opening.glazed !== false;
  return true;
}

/** The inner face rectangle of a structure's shell — the usable interior
 *  footprint once wall thickness is removed. Returns a degenerate (inverted)
 *  rect for footprints too small to enclose anything; callers should check
 *  `maxX > minX && maxZ > minZ`. */
export function structureInteriorRect(bounds: ArenaBounds, wallThickness: number): ArenaRect {
  const rect = boundsToRect(bounds);
  return {
    minX: rect.minX + wallThickness,
    maxX: rect.maxX - wallThickness,
    minZ: rect.minZ + wallThickness,
    maxZ: rect.maxZ - wallThickness,
  };
}

/** Geometry of one wall of a footprint.
 *
 *  Walls are centred on the footprint edge pulled INWARD by half the thickness,
 *  so the outer face lands exactly on `bounds` and the building never spills
 *  past its declared footprint. Each wall spans the FULL footprint extent on its
 *  running axis, which means the four walls overlap at the corners — deliberate:
 *  corner overlap is what makes the shell watertight regardless of thickness,
 *  and structure walls are emitted as render/collision geometry rather than
 *  ArenaObstacles, so they never reach the validator's obstacle-overlap check. */
export function structureWallAxis(bounds: ArenaBounds, side: ArenaStructureSide, wallThickness: number): ArenaWallAxis {
  const rect = boundsToRect(bounds);
  const half = wallThickness / 2;
  switch (side) {
    case "north":
      return {
        along: "x",
        center: rect.minZ + half,
        mid: (rect.minX + rect.maxX) / 2,
        length: rect.maxX - rect.minX,
        outward: -1,
      };
    case "south":
      return {
        along: "x",
        center: rect.maxZ - half,
        mid: (rect.minX + rect.maxX) / 2,
        length: rect.maxX - rect.minX,
        outward: 1,
      };
    case "west":
      return {
        along: "z",
        center: rect.minX + half,
        mid: (rect.minZ + rect.maxZ) / 2,
        length: rect.maxZ - rect.minZ,
        outward: -1,
      };
    case "east":
      return {
        along: "z",
        center: rect.maxX - half,
        mid: (rect.minZ + rect.maxZ) / 2,
        length: rect.maxZ - rect.minZ,
        outward: 1,
      };
  }
}

/** Resolve a structure's `levelIds` into stacked storeys with derived heights.
 *
 *  A storey's height is the gap to the next storey's elevation — so authoring a
 *  building is just "these levels, in this order" and the floor-to-ceiling
 *  clearance falls out of the level table (single source of truth, exactly like
 *  ArenaRamp's endpoint elevations). Only the topmost storey needs an explicit
 *  height, which falls back to `structure.storeyHeight`.
 *
 *  Levels missing from `levelY` are skipped: a dangling reference is the
 *  validator's problem, not a crash here. Storeys are returned in the authored
 *  order; `index` reflects position after skipping. */
export function structureStoreys(
  structure: Pick<ArenaStructure, "levelIds" | "storeyHeight">,
  levelY: Map<string, number>,
): ArenaStructureStorey[] {
  const fallbackHeight =
    structure.storeyHeight !== undefined && Number.isFinite(structure.storeyHeight) && structure.storeyHeight > 0
      ? structure.storeyHeight
      : DEFAULT_STOREY_HEIGHT;

  const resolved: { levelId: string; floorY: number }[] = [];
  for (const levelId of structure.levelIds) {
    const y = levelY.get(levelId);
    if (y === undefined || !Number.isFinite(y)) continue;
    resolved.push({ levelId, floorY: y });
  }

  return resolved.map((entry, index) => {
    const next = resolved[index + 1];
    // A next storey at or below this one is authoring garbage (unsorted or
    // duplicate levels); fall back rather than emitting a zero/negative wall.
    const derived = next !== undefined ? next.floorY - entry.floorY : 0;
    const height = derived > 0 ? derived : fallbackHeight;
    return {
      levelId: entry.levelId,
      index,
      floorY: entry.floorY,
      height,
      ceilingY: entry.floorY + height,
    };
  });
}

/** The storey an opening belongs to: its `levelId`, or the ground-most storey
 *  when unset. Returns undefined when the reference is dangling. */
export function openingStorey(
  opening: Pick<ArenaStructureOpening, "levelId">,
  storeys: ArenaStructureStorey[],
): ArenaStructureStorey | undefined {
  if (opening.levelId === undefined) return storeys[0];
  return storeys.find((storey) => storey.levelId === opening.levelId);
}

/** Resolve an opening into its world-space cut rectangle.
 *
 *  Horizontal: `offset` is signed from the wall midpoint along the running
 *  axis, and `width` is the CLEAR span (min..max is exactly what is removed
 *  from the wall). Vertical: `sill` is measured from the storey floor, so the
 *  same opening declaration works on every storey of a building.
 *
 *  Not clamped to the wall or the storey — an opening wider than its wall or
 *  taller than its storey is an authoring error the validator reports, and
 *  clamping here would silently hide it. */
export function structureOpeningPlacement(
  structure: Pick<ArenaStructure, "bounds" | "wallThickness">,
  opening: ArenaStructureOpening,
  storey: ArenaStructureStorey,
): ArenaOpeningPlacement {
  const thickness = structureWallThickness(structure);
  const axis = structureWallAxis(structure.bounds, opening.side, thickness);
  const center = axis.mid + (opening.offset ?? 0);
  const halfWidth = opening.width / 2;
  const bottom = storey.floorY + openingSill(opening);
  const top = bottom + opening.height;

  return {
    id: opening.id,
    kind: opening.kind,
    side: opening.side,
    along: axis.along,
    wallCenter: axis.center,
    outward: axis.outward,
    thickness,
    min: center - halfWidth,
    max: center + halfWidth,
    bottom,
    top,
    x: axis.along === "x" ? center : axis.center,
    y: (bottom + top) / 2,
    z: axis.along === "x" ? axis.center : center,
  };
}

/** Outward yaw of a wall in THREE.Object3D.rotation.y semantics (default
 *  forward −Z): the heading something standing in the opening faces when it
 *  looks OUT of the building. Matches ArenaAnchor.facing so an anchor placed in
 *  a doorway can adopt it directly. */
export function structureSideFacing(side: ArenaStructureSide): number {
  switch (side) {
    case "north":
      return 0; // −Z
    case "south":
      return Math.PI; // +Z
    case "west":
      return Math.PI / 2; // −X
    case "east":
      return -Math.PI / 2; // +X
  }
}

/** Does a hole apply to this storey? An unscoped hole (no levelId) pierces every
 *  storey above the ground-most one — the common "open shaft" case. */
export function holeAppliesToStorey(hole: ArenaStructureHole, storey: ArenaStructureStorey): boolean {
  if (hole.levelId !== undefined) return hole.levelId === storey.levelId;
  return storey.index > 0;
}
