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
  type ArenaFloorLevel,
  type ArenaPlatform,
  type ArenaRamp,
  type ArenaRoom,
  type ArenaVolume,
  boundsToRect,
  GROUND_LEVEL_ID,
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
 *  contract). The top surface always lands at `p.y`. */
export function platformBox(p: ArenaPlatform): SolidBox {
  const h = p.thickness ?? p.y;
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
