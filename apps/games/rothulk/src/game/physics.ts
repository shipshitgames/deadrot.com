import type { AABB, Platform } from "./types";

const COLLISION_SKIN = 0.0001;

// Axis-aligned overlap test.
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
}

export function platformToAABB(p: Platform): AABB {
  return { x: p.x, y: p.y, hw: p.w / 2, hh: p.h / 2 };
}

export function rectToAABB(x: number, y: number, w: number, h: number): AABB {
  return { x, y, hw: w / 2, hh: h / 2 };
}

export interface CollisionResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  groundPlatform: number; // index into solids, or -1
}

// Resolve a moving AABB against an array of solid platform AABBs.
// Sweeps X then Y (the classic order for stable platformer collision) so a
// fast hero never tunnels through a slab and we get clean landings/walls.
export function resolveAgainstSolids(
  px: number,
  py: number,
  hw: number,
  hh: number,
  vx: number,
  vy: number,
  dt: number,
  solids: AABB[],
): CollisionResult {
  let x = px;
  let y = py;
  let grounded = false;
  let groundPlatform = -1;

  // ---- X axis ----
  x += vx * dt;
  for (const s of solids) {
    const overlapsX = Math.abs(x - s.x) < hw + s.hw;
    const overlapsY = Math.abs(y - s.y) < hh + s.hh - COLLISION_SKIN;
    if (overlapsX && overlapsY) {
      if (vx > 0) {
        x = s.x - s.hw - hw;
        vx = 0;
      } else if (vx < 0) {
        x = s.x + s.hw + hw;
        vx = 0;
      }
    }
  }

  // ---- Y axis ----
  y += vy * dt;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (Math.abs(x - s.x) < hw + s.hw && Math.abs(y - s.y) < hh + s.hh) {
      if (vy < 0) {
        // falling onto a top surface
        y = s.y + s.hh + hh;
        vy = 0;
        grounded = true;
        groundPlatform = i;
      } else if (vy > 0) {
        // head bonk
        y = s.y - s.hh - hh;
        vy = 0;
      }
    }
  }

  return { x, y, vx, vy, grounded, groundPlatform };
}
