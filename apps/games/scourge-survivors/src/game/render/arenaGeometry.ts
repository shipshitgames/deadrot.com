// Pure geometry helpers that translate the game-agnostic v2 structural layout
// (rooms, floor levels, platforms, ramps from @deadrot/game-kit/maps) into the
// axis-aligned solid boxes ArenaSystem renders + registers as colliders.
//
// No THREE, no DOM — every function is plain math over plain data so the
// elevation/ramp arithmetic is unit-testable in node (see
// tests/unit/arena-geometry.test.ts). ArenaSystem turns each SolidBox into a
// THREE.Mesh + THREE.Box3; this module never touches the renderer.
//
// Coordinate conventions match scourge MapObstacle: world-space XZ metres, Y up.
// `x`/`y`/`z` are a box CENTRE; `w`/`h`/`d` are FULL sizes along X/Y/Z. The
// walkable top surface of a box is therefore `y + h / 2`.

import {
  type ArenaDoorMotion,
  type ArenaFloorLevel,
  type ArenaOpeningKind,
  type ArenaOpeningState,
  type ArenaPlatform,
  type ArenaRamp,
  type ArenaRect,
  type ArenaRoom,
  type ArenaStructure,
  type ArenaStructureSide,
  type ArenaStructureStorey,
  type ArenaVolume,
  boundsToRect,
  DEFAULT_ROOF_THICKNESS,
  GROUND_LEVEL_ID,
  holeAppliesToStorey,
  openingStorey,
  structureFloorThickness,
  structureInteriorRect,
  structureOpeningPlacement,
  structureStoreys,
  structureWallAxis,
  structureWallThickness,
} from "@deadrot/game-kit/maps";

/** An axis-aligned solid box in world space: centre (x,y,z), full sizes (w,h,d). */
export interface SolidBox {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** Map of floor-level id → walkable surface elevation (y). The reserved ground
 *  level always resolves to 0 even when the layout omits it (defensive — the
 *  normalize adapter always prepends it). */
export function levelYById(levels: ArenaFloorLevel[]): Map<string, number> {
  const byId = new Map<string, number>();
  for (const level of levels) byId.set(level.id, level.y);
  if (!byId.has(GROUND_LEVEL_ID)) byId.set(GROUND_LEVEL_ID, 0);
  return byId;
}

/** Walkable surface elevation a room rests on (its level's y, or ground 0). */
export function roomLevelY(room: ArenaRoom<ArenaVolume>, levelY: Map<string, number>): number {
  return levelY.get(room.levelId ?? GROUND_LEVEL_ID) ?? 0;
}

/** A raised room (level y > 0) needs a walkable floor slab filling from the
 *  ground (y = 0) up to its level surface. Returns null for ground-level rooms:
 *  the single base arena floor plane already covers them, so flat v1 maps emit
 *  zero extra geometry and stay byte-identical. */
export function roomFloorSlab(room: ArenaRoom<ArenaVolume>, y: number): SolidBox | null {
  if (y <= 0) return null;
  const rect = boundsToRect(room.bounds);
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  return {
    x: rect.minX + w / 2,
    z: rect.minZ + d / 2,
    y: y / 2, // centre between ground and the level surface
    w,
    h: y, // fill from 0 up to the level surface
    d,
  };
}

/** A raised walkable slab. `thickness` is the slab depth below its top; omitted
 *  = a solid plinth filled down to the ground (matches the schema's "pass under"
 *  contract). The top surface always lands at `p.y`. Returns null for a
 *  ground-or-below platform (h <= 0) — mirroring roomFloorSlab/rampStepBoxes —
 *  so a degenerate (zero/negative-height) box is never emitted. */
export function platformBox(p: ArenaPlatform): SolidBox | null {
  const h = p.thickness ?? p.y;
  if (h <= 0) return null;
  return { x: p.x, z: p.z, y: p.y - h / 2, w: p.w, h, d: p.d };
}

/** Approximate a ramp/stair as a staircase of solid boxes, each rise ≤
 *  `stepHeight` so the player climbs it via groundUnder's step-up snap. Runs
 *  along the dominant axis (X or Z) of from→to; the perpendicular span is the
 *  ramp `width`. Each step's top sits at the higher of its two segment edges so
 *  the staircase is symmetric (walkable up AND down). Degenerate steps whose top
 *  is at/below ground are dropped. `fromY`/`toY` are the surface elevations of
 *  the referenced levels (single source of truth — never duplicated on the ramp). */
export function rampStepBoxes(ramp: ArenaRamp, fromY: number, toY: number, stepHeight: number): SolidBox[] {
  const rise = toY - fromY;
  const dx = ramp.to.x - ramp.from.x;
  const dz = ramp.to.z - ramp.from.z;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const span = alongX ? dx : dz; // signed run length along the dominant axis
  const steps = Math.max(1, Math.ceil(Math.abs(rise) / Math.max(stepHeight, 1e-6)));
  const segLen = Math.abs(span) / steps;
  const start = alongX ? ramp.from.x : ramp.from.z;

  const boxes: SolidBox[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const top = Math.max(fromY + t0 * rise, fromY + t1 * rise);
    if (top <= 0) continue; // nothing to fill (flat or below-ground segment)
    const center = start + ((t0 + t1) / 2) * span;
    boxes.push(
      alongX
        ? { x: center, z: ramp.from.z, y: top / 2, w: segLen, h: top, d: ramp.width }
        : { x: ramp.from.x, z: center, y: top / 2, w: ramp.width, h: top, d: segLen },
    );
  }
  return boxes;
}

// ---------------------------------------------------------------------------
// Structures (enterable buildings)
//
// game-kit's ./structures.ts declares WHAT a building is (footprint, storeys,
// openings, floor holes) and resolves the placement arithmetic. This section
// turns those declarations into the two things the renderer actually needs:
//
//   - `structureGeometry` — the STATIC solids, split into `walls` (perimeter,
//     already cut around every opening) and `decks` (upper-storey floor slabs
//     with their stairwell holes subtracted, plus the roof cap). ArenaSystem
//     registers walls as push-out colliders and decks as walkable tops; both are
//     rendered and shootable, so no extra plumbing is needed either way.
//   - `structureLeaves` — the MOVABLE panels: one per door, one per glazed
//     window. Each carries its closed pose plus the pivot/arm/displacement the
//     interaction system animates it along, so the animation maths lives here
//     (pure, testable) and the system only interpolates a 0..1 value.
//
// Splitting walls at author time rather than rendering a wall and punching a
// hole with CSG keeps everything axis-aligned: every emitted piece is still a
// plain SolidBox, so it drops into the existing Box3 collider pipeline and the
// player can walk through a doorway without a single bespoke collision case.
// ---------------------------------------------------------------------------

/** Tolerance for the 1D/2D span arithmetic below. Well under a millimetre, so
 *  it only ever collapses genuinely degenerate slivers. */
const SPAN_EPSILON = 1e-6;

/** Fraction of the wall thickness a door panel occupies. Leaving the panel
 *  thinner than its frame is what makes the doorway read as a recess rather
 *  than a flat plug. */
const DOOR_PANEL_THICKNESS_RATIO = 0.55;

/** Fraction of the wall thickness a window pane occupies — glass reads as a
 *  sliver, and a thin pane keeps the broken-glass shards cheap. */
const WINDOW_PANE_THICKNESS_RATIO = 0.16;

/** Clearance shaved off a panel on every edge so a swinging door never binds
 *  against its own frame and coplanar faces never z-fight. */
const PANEL_EDGE_CLEARANCE = 0.02;

/** How far a swing door rotates when fully open. Past 90° so the leaf clears
 *  the doorway completely and never clips the player walking through. */
const DOOR_OPEN_ANGLE = (100 * Math.PI) / 180;

/** A closed 1D interval on some axis. */
interface Span {
  min: number;
  max: number;
}

/** One movable panel of a structure: a door leaf or a window pane.
 *
 *  Everything needed to animate it is resolved here in world space. The
 *  interaction system owns only a 0..1 `openness` per leaf and applies:
 *    swing → rotate the pivot group by `openYaw * openness` about +Y
 *    slide → translate the panel by `openSlide * openness`
 *  Both start from the same closed pose (`pivot` + `arm`), so a system can
 *  drive either motion without branching on geometry. */
export interface StructureLeaf {
  /** Owning structure id — leaves are keyed `${structureId}:${openingId}`. */
  structureId: string;
  /** Opening id, unique within the structure. */
  openingId: string;
  kind: ArenaOpeningKind;
  side: ArenaStructureSide;
  /** Storey the opening is cut into. */
  levelId: string;
  /** Closed-pose solid box of the panel itself (centre + full sizes). */
  box: SolidBox;
  /** World point the panel pivots about: the hinge edge, on the wall centreline. */
  pivot: { x: number; y: number; z: number };
  /** Closed-pose offset from `pivot` to the panel centre, world XZ. Rotating
   *  this by `openYaw * openness` and re-adding it to `pivot` gives the swung
   *  panel centre — no matrix maths needed at the call site. */
  arm: { x: number; z: number };
  motion: ArenaDoorMotion;
  /** Yaw delta at full open, radians, THREE.Object3D.rotation.y semantics.
   *  Signed so the free edge travels OUTWARD (away from the interior). Zero for
   *  sliding panels and window panes. */
  openYaw: number;
  /** World XZ displacement at full open. Non-zero only for sliding doors, which
   *  pocket into the wall segment behind their hinge edge. */
  openSlide: { x: number; z: number };
  /** Authored resting state — "open" starts wide, "locked" never opens. */
  state: ArenaOpeningState;
  /** Windows: is there a pane to break? Doors are always solid. */
  glazed: boolean;
  /** Centre of the CLEAR cut (not the panel): where the interact prompt anchors
   *  and what a traversal check aims at. */
  center: { x: number; y: number; z: number };
  /** Unit outward normal of the pierced wall, world XZ. */
  outward: { x: number; z: number };
  /** Clear span along the wall, metres. */
  clearWidth: number;
  /** Clear height of the cut, metres. */
  clearHeight: number;
}

/** The static solids of one structure, split by how the player interacts with
 *  them. The two lists are deliberately NOT interchangeable:
 *
 *  - `walls` are push-out colliders (ctx.obstacleBoxes). Without that the player
 *    walks straight through a building, since ctx.rig colliders only shorten the
 *    third-person camera boom.
 *  - `decks` are walkable tops (ctx.deckBoxes) and must NOT be push-out: the
 *    XZ push runs before the player's feet clear the slab, so a stairwell exit
 *    would shove them back down the stairs. They get their own list rather than
 *    joining ctx.surfaceBoxes because a building stacks a walkable top over the
 *    same footprint at every storey, which breaks the single-height-per-point
 *    assumption spawn placement relies on.
 *
 *  Both are rendered and shootable either way. */
export interface StructureGeometry {
  /** Perimeter walls of every storey, already split around doors and windows. */
  walls: SolidBox[];
  /** Upper-storey floor slabs (stairwell holes removed) plus the roof cap. */
  decks: SolidBox[];
}

/** Resolve a structure into its static geometry.
 *
 *  Emits nothing for a structure whose levels are all dangling or whose
 *  footprint is too small to enclose anything — those are authoring errors the
 *  validator reports, and drawing a degenerate shell would only hide them. */
export function structureGeometry(structure: ArenaStructure, levelY: Map<string, number>): StructureGeometry {
  const empty: StructureGeometry = { walls: [], decks: [] };
  const storeys = structureStoreys(structure, levelY);
  if (storeys.length === 0) return empty;

  const thickness = structureWallThickness(structure);
  const interior = structureInteriorRect(structure.bounds, thickness);
  if (interior.maxX - interior.minX <= SPAN_EPSILON || interior.maxZ - interior.minZ <= SPAN_EPSILON) {
    return empty;
  }

  const walls: SolidBox[] = [];
  const decks: SolidBox[] = [];
  for (const storey of storeys) {
    for (const side of STRUCTURE_SIDES) {
      walls.push(...structureWallBoxes(structure, side, storey, storeys, thickness));
    }
    decks.push(...structureFloorSlabs(structure, storey, interior));
  }

  const roof = structureRoofBox(structure, storeys[storeys.length - 1]);
  if (roof !== null) decks.push(roof);
  return { walls, decks };
}

/** The four walls, in a fixed order so output is deterministic across runs. */
const STRUCTURE_SIDES: readonly ArenaStructureSide[] = ["north", "east", "south", "west"];

/** One wall of one storey, decomposed into the solid pieces left over after its
 *  openings are removed.
 *
 *  The decomposition is a two-pass sweep: first split the wall into vertical
 *  columns at every opening edge, then within each column emit the vertical
 *  gaps left between the openings that fully span it. That yields the lintel
 *  above a door, the spandrel below a window, and the jambs beside both —
 *  every piece axis-aligned, no CSG, no triangulation. */
export function structureWallBoxes(
  structure: ArenaStructure,
  side: ArenaStructureSide,
  storey: ArenaStructureStorey,
  storeys: ArenaStructureStorey[],
  thickness: number,
): SolidBox[] {
  const axis = structureWallAxis(structure.bounds, side, thickness);
  const wallMin = axis.mid - axis.length / 2;
  const wallMax = axis.mid + axis.length / 2;
  const floorY = storey.floorY;
  const ceilingY = storey.ceilingY;
  if (wallMax - wallMin <= SPAN_EPSILON || ceilingY - floorY <= SPAN_EPSILON) return [];

  // Cuts on THIS wall of THIS storey, clamped to the wall so an over-wide
  // authoring error removes at most the wall itself (never negative geometry).
  const cuts: { span: Span; bottom: number; top: number }[] = [];
  for (const opening of structure.openings) {
    if (opening.side !== side) continue;
    // An opening without a levelId belongs to the ground storey only — resolve
    // against the FULL storey list so it is not punched through every floor.
    const owner = openingStorey(opening, storeys);
    if (owner === undefined || owner.levelId !== storey.levelId) continue;
    const placement = structureOpeningPlacement(structure, opening, storey);
    const span: Span = {
      min: Math.max(wallMin, placement.min),
      max: Math.min(wallMax, placement.max),
    };
    if (span.max - span.min <= SPAN_EPSILON) continue;
    cuts.push({
      span,
      bottom: Math.max(floorY, placement.bottom),
      top: Math.min(ceilingY, placement.top),
    });
  }

  const columns = splitPoints(
    wallMin,
    wallMax,
    cuts.flatMap((cut) => [cut.span.min, cut.span.max]),
  );
  const boxes: SolidBox[] = [];
  for (let i = 0; i < columns.length - 1; i++) {
    const a = columns[i];
    const b = columns[i + 1];
    if (b - a <= SPAN_EPSILON) continue;

    // A cut only removes material from a column it fully spans — a column is by
    // construction either wholly inside a cut or wholly outside it.
    const removed: Span[] = [];
    for (const cut of cuts) {
      if (cut.span.min <= a + SPAN_EPSILON && cut.span.max >= b - SPAN_EPSILON) {
        removed.push({ min: cut.bottom, max: cut.top });
      }
    }

    for (const gap of spanGaps(floorY, ceilingY, removed)) {
      const along = (a + b) / 2;
      const size = b - a;
      boxes.push({
        x: axis.along === "x" ? along : axis.center,
        z: axis.along === "x" ? axis.center : along,
        y: (gap.min + gap.max) / 2,
        w: axis.along === "x" ? size : thickness,
        h: gap.max - gap.min,
        d: axis.along === "x" ? thickness : size,
      });
    }
  }
  return boxes;
}

/** The walkable floor slab(s) of one storey, with its floor holes removed.
 *
 *  The ground-most storey at y = 0 emits nothing: ArenaSystem's single base
 *  floor plane already covers it, exactly like `roomFloorSlab`. Any storey
 *  above ground gets a slab hanging `floorThickness` below its walkable
 *  surface, spanning the INTERIOR rect only — the walls already fill the
 *  perimeter for the full storey height. */
export function structureFloorSlabs(
  structure: ArenaStructure,
  storey: ArenaStructureStorey,
  interior: ArenaRect,
): SolidBox[] {
  if (storey.floorY <= 0) return [];

  const thickness = structureFloorThickness(structure);
  const holes: ArenaRect[] = [];
  for (const hole of structure.floorHoles ?? []) {
    if (!holeAppliesToStorey(hole, storey)) continue;
    holes.push({
      minX: hole.x - hole.w / 2,
      maxX: hole.x + hole.w / 2,
      minZ: hole.z - hole.d / 2,
      maxZ: hole.z + hole.d / 2,
    });
  }

  return subtractRects(interior, holes).map((rect) => ({
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    y: storey.floorY - thickness / 2, // walkable surface lands exactly on floorY
    w: rect.maxX - rect.minX,
    h: thickness,
    d: rect.maxZ - rect.minZ,
  }));
}

/** The roof cap sitting on top of the highest storey's walls, spanning the full
 *  outer footprint so the shell is watertight from above. Null when the author
 *  opted out (`roof: false`) — ruins and rooftop arenas want an open top. */
export function structureRoofBox(structure: ArenaStructure, top: ArenaStructureStorey): SolidBox | null {
  if (structure.roof === false) return null;
  const rect = boundsToRect(structure.bounds);
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  if (w <= SPAN_EPSILON || d <= SPAN_EPSILON) return null;
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    y: top.ceilingY + DEFAULT_ROOF_THICKNESS / 2, // rests ON the walls, never inside them
    w,
    h: DEFAULT_ROOF_THICKNESS,
    d,
  };
}

/** Every movable panel of a structure, in author order.
 *
 *  Doors always produce a leaf. Windows produce one only when glazed — an
 *  unglazed window is a permanent hole, and emitting an invisible pane for it
 *  would put a phantom collider in the opening. */
export function structureLeaves(structure: ArenaStructure, levelY: Map<string, number>): StructureLeaf[] {
  const storeys = structureStoreys(structure, levelY);
  if (storeys.length === 0) return [];

  const thickness = structureWallThickness(structure);
  const leaves: StructureLeaf[] = [];
  for (const opening of structure.openings) {
    const storey = openingStorey(opening, storeys);
    if (storey === undefined) continue;
    const glazed = opening.glazed !== false;
    if (opening.kind === "window" && !glazed) continue;

    const placement = structureOpeningPlacement(structure, opening, storey);
    const clearWidth = placement.max - placement.min;
    const clearHeight = placement.top - placement.bottom;
    if (clearWidth <= SPAN_EPSILON || clearHeight <= SPAN_EPSILON) continue;

    const isDoor = opening.kind === "door";
    const panelWidth = Math.max(clearWidth - PANEL_EDGE_CLEARANCE * 2, SPAN_EPSILON);
    const panelHeight = Math.max(clearHeight - PANEL_EDGE_CLEARANCE * 2, SPAN_EPSILON);
    const panelThickness = thickness * (isDoor ? DOOR_PANEL_THICKNESS_RATIO : WINDOW_PANE_THICKNESS_RATIO);

    // Hinge side is authored as seen from OUTSIDE the building, so resolve
    // which END of the cut that is before anything else. Standing outside and
    // looking in, "right" points toward increasing along-axis on south/west
    // walls and toward decreasing on north/east — the parity below.
    const rightTowardMax = (placement.along === "x") === (placement.outward === 1);
    const hingeRight = (opening.hinge ?? "left") === "right";
    const hingeAtMax = hingeRight === rightTowardMax;

    // Unit direction along the wall from the hinge edge toward the free edge.
    const armSign = hingeAtMax ? -1 : 1;
    const hingeAlong = hingeAtMax ? placement.max : placement.min;
    const panelCenterAlong = hingeAlong + armSign * (panelWidth / 2);
    const centerY = (placement.bottom + placement.top) / 2;

    // Swing sense: pick the sign that sends the free edge outward. Differentiating
    // the +Y rotation of the arm at θ = 0 gives velocity (armZ, −armX), so the
    // outward-positive sign is −armSign·outward on X-running walls and
    // +armSign·outward on Z-running ones.
    const swingSign = (placement.along === "x" ? -1 : 1) * armSign * placement.outward;
    const motion: ArenaDoorMotion = isDoor ? (opening.motion ?? "swing") : "swing";
    const swings = isDoor && motion === "swing";
    const slides = isDoor && motion === "slide";

    leaves.push({
      structureId: structure.id,
      openingId: opening.id,
      kind: opening.kind,
      side: opening.side,
      levelId: storey.levelId,
      box: {
        x: placement.along === "x" ? panelCenterAlong : placement.wallCenter,
        z: placement.along === "x" ? placement.wallCenter : panelCenterAlong,
        y: centerY,
        w: placement.along === "x" ? panelWidth : panelThickness,
        h: panelHeight,
        d: placement.along === "x" ? panelThickness : panelWidth,
      },
      pivot: {
        x: placement.along === "x" ? hingeAlong : placement.wallCenter,
        y: centerY,
        z: placement.along === "x" ? placement.wallCenter : hingeAlong,
      },
      arm: {
        x: placement.along === "x" ? armSign * (panelWidth / 2) : 0,
        z: placement.along === "x" ? 0 : armSign * (panelWidth / 2),
      },
      motion,
      openYaw: swings ? swingSign * DOOR_OPEN_ANGLE : 0,
      // A sliding door pockets AWAY from its free edge, i.e. back past the
      // hinge, clearing exactly its own clear width.
      openSlide: {
        x: slides && placement.along === "x" ? -armSign * clearWidth : 0,
        z: slides && placement.along === "z" ? -armSign * clearWidth : 0,
      },
      state: opening.state ?? "closed",
      glazed,
      center: { x: placement.x, y: placement.y, z: placement.z },
      outward: {
        x: placement.along === "x" ? 0 : placement.outward,
        z: placement.along === "x" ? placement.outward : 0,
      },
      clearWidth,
      clearHeight,
    });
  }
  return leaves;
}

/** Sorted, de-duplicated split coordinates spanning [min, max]: the bounds
 *  themselves plus every interior cut edge. Edges outside the range are
 *  dropped rather than clamped so they cannot create a zero-width column. */
function splitPoints(min: number, max: number, edges: number[]): number[] {
  const points = [min, max];
  for (const edge of edges) {
    if (edge > min + SPAN_EPSILON && edge < max - SPAN_EPSILON) points.push(edge);
  }
  points.sort((a, b) => a - b);
  const out: number[] = [];
  for (const point of points) {
    if (out.length === 0 || point - out[out.length - 1] > SPAN_EPSILON) out.push(point);
  }
  return out;
}

/** Merge overlapping or touching spans into a minimal ascending set. */
function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.min - b.min);
  const out: Span[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = out[out.length - 1];
    if (current.min <= last.max + SPAN_EPSILON) last.max = Math.max(last.max, current.max);
    else out.push({ ...current });
  }
  return out;
}

/** The parts of [min, max] left after removing `holes`. Slivers under the
 *  epsilon are dropped so a flush-to-ceiling opening emits no hairline lintel. */
function spanGaps(min: number, max: number, holes: Span[]): Span[] {
  const out: Span[] = [];
  let cursor = min;
  for (const hole of mergeSpans(holes)) {
    if (hole.max <= min + SPAN_EPSILON || hole.min >= max - SPAN_EPSILON) continue;
    const low = Math.max(min, hole.min);
    if (low - cursor > SPAN_EPSILON) out.push({ min: cursor, max: low });
    cursor = Math.max(cursor, Math.min(max, hole.max));
  }
  if (max - cursor > SPAN_EPSILON) out.push({ min: cursor, max });
  return out;
}

/** `outer` minus `holes`, as a set of axis-aligned rectangles.
 *
 *  Grid-decomposes on every hole edge, then greedily merges surviving cells
 *  along X within each Z band. Not a minimal cover, but it is exact, stable,
 *  and produces a handful of boxes for the one-or-two-stairwell case that
 *  actually occurs — far cheaper than a general polygon partition. */
function subtractRects(outer: ArenaRect, holes: ArenaRect[]): ArenaRect[] {
  const live = holes.filter(
    (hole) =>
      hole.maxX > outer.minX + SPAN_EPSILON &&
      hole.minX < outer.maxX - SPAN_EPSILON &&
      hole.maxZ > outer.minZ + SPAN_EPSILON &&
      hole.minZ < outer.maxZ - SPAN_EPSILON,
  );
  if (live.length === 0) return [outer];

  const xs = splitPoints(
    outer.minX,
    outer.maxX,
    live.flatMap((hole) => [hole.minX, hole.maxX]),
  );
  const zs = splitPoints(
    outer.minZ,
    outer.maxZ,
    live.flatMap((hole) => [hole.minZ, hole.maxZ]),
  );

  const out: ArenaRect[] = [];
  for (let zi = 0; zi < zs.length - 1; zi++) {
    const minZ = zs[zi];
    const maxZ = zs[zi + 1];
    const midZ = (minZ + maxZ) / 2;
    let runStart: number | null = null;
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const minX = xs[xi];
      const maxX = xs[xi + 1];
      const midX = (minX + maxX) / 2;
      const covered = live.some((hole) => midX > hole.minX && midX < hole.maxX && midZ > hole.minZ && midZ < hole.maxZ);
      if (covered) {
        if (runStart !== null) out.push({ minX: runStart, maxX: minX, minZ, maxZ });
        runStart = null;
      } else if (runStart === null) {
        runStart = minX;
      }
    }
    if (runStart !== null) out.push({ minX: runStart, maxX: xs[xs.length - 1], minZ, maxZ });
  }
  return out;
}
