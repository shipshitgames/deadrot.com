// Combat-readability budget + audit (issue #35).
//
// Arena dressing (issue #34) layered sky domes, horizon haze, floor decals, and
// billboard props over every campaign map. This module hardens that dressing
// against gameplay-readability regressions: it encodes, as data, the invariants
// that keep enemies, pickups, projectiles, and the HUD legible against the new
// backgrounds, and audits any map against them.
//
// Two seams consume one budget:
//   - `auditArenaReadability(map)` scores the AUTHORED map data (unit-tested) —
//     the authoring gate that fails when a future edit buries targets under
//     opaque dressing, carpets the floor, over-hazes the skyline, tightens fog
//     onto the play space, or lightens the background.
//   - `scoreLiveReadability(metrics)` scores values MEASURED off the built scene
//     (ArenaSystem.debugSnapshot → e2e) — proving the rendered arena, not just
//     the data, honours the same budget.
//
// Pure + THREE-free so it runs under vitest and stays importable from the data
// layer; only `ARENA_HALF` (the default arena half-extent) is a runtime import.

import type { MapBounds } from "@shipshitgames/engine";
import { ARENA_HALF } from "../constants";
import { type ArenaMap, resolveArenaEnvironment } from "../data/maps";

/** Axis-aligned XZ play-area extents, in metres. */
export interface PlayAreaExtents {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Resolve a map's authored bounds (or the default centred square) to flat XZ
 *  extents — the same square ArenaSystem builds the floor + boundary walls on. */
export function playAreaExtents(bounds: MapBounds | undefined): PlayAreaExtents {
  if (!bounds) return { minX: -ARENA_HALF, maxX: ARENA_HALF, minZ: -ARENA_HALF, maxZ: ARENA_HALF };
  if (bounds.kind === "square") {
    return { minX: -bounds.half, maxX: bounds.half, minZ: -bounds.half, maxZ: bounds.half };
  }
  return { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ };
}

/** The play-area diagonal — the longest straight line between a player and a
 *  target both inside the arena. Fog that fully occludes nearer than this would
 *  swallow the farthest in-arena target, so it is the floor for `fogFar`. */
export function playAreaDiagonal(ext: PlayAreaExtents): number {
  const w = ext.maxX - ext.minX;
  const d = ext.maxZ - ext.minZ;
  return Math.sqrt(w * w + d * d);
}

/** Is (x,z) inside the CORE play area — the bounds inset by `margin` metres?
 *  Core dressing sits where the player fights and can occlude targets behind it;
 *  dressing in the outer ring (hugging the walls) reads as backdrop. */
export function isInCorePlayArea(x: number, z: number, ext: PlayAreaExtents, margin: number): boolean {
  return x >= ext.minX + margin && x <= ext.maxX - margin && z >= ext.minZ + margin && z <= ext.maxZ - margin;
}

/** Does an axis-aligned dressing box (centre x/z, full width `w` / depth `d`)
 *  overlap the play-area AABB at all? Distant silhouettes must NOT — one that
 *  intruded into the arena would be an opaque wall standing across the fight. */
export function boxOverlapsPlayArea(x: number, z: number, w: number, d: number, ext: PlayAreaExtents): boolean {
  const halfW = w / 2;
  const halfD = d / 2;
  return x + halfW > ext.minX && x - halfW < ext.maxX && z + halfD > ext.minZ && z - halfD < ext.maxZ;
}

/** Relative luminance of a packed 0xRRGGBB colour, normalised to 0..1 (Rec.601).
 *  Bright Scourge sprites, pickups, and tracers need a DARK background to pop;
 *  this scores how light a candidate background / fog colour is. */
export function luminance(hex: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * The combat-readability budget (#35): the invariants that keep enemies,
 * pickups, projectiles, and the HUD legible against the authored arena dressing.
 * Calibrated so every shipped map passes; a regression that buries targets under
 * opaque dressing, carpets the floor, over-hazes the skyline, tightens fog onto
 * the play space, or lightens the background trips an invariant.
 *
 * Frozen — the single contract the authoring audit and the live e2e readback
 * both assert. (Fog `far` is bounds-relative, so its floor is the per-map
 * play-area diagonal rather than a constant here.)
 */
export const READABILITY_BUDGET = Object.freeze({
  /** Floor decals are multiplied translucent stains — never near-opaque paint. */
  maxDecalOpacity: 0.3,
  /** Fraction of the play-area floor decal footprints may blanket before they
   *  read as full-screen noise rather than localised grime. */
  maxDecalCoverage: 0.2,
  /** Hard ceiling on ANY billboard prop sprite — props are vertical occluders. */
  maxPropOpacity: 0.9,
  /** Stricter ceiling on props INSIDE the core play area (inset by
   *  `corePlayAreaMargin`), where a dense sprite can hide a target behind it. */
  maxInPlayPropOpacity: 0.85,
  /** Inset (metres) defining the "core" play area for the in-play prop rule. */
  corePlayAreaMargin: 6,
  /** The horizon haze band sits behind the fight; keep it a faint wash so
   *  distant sprites stay silhouetted against it rather than dissolving in. */
  maxHorizonOpacity: 0.3,
  /** Fog must not begin inside the player's immediate combat bubble (metres). */
  minFogNear: 12,
  /** Background / fog colour must stay dark enough that bright targets pop
   *  (0..1 Rec.601 luminance; the lightest shipped biome bg is ~0.094). */
  maxBackgroundLuminance: 0.2,
});

export type ReadabilityBudget = typeof READABILITY_BUDGET;

/** One failed invariant, with the offending value and the limit it broke. */
export interface ReadabilityViolation {
  rule: string;
  detail: string;
  value: number;
  limit: number;
}

/** Measured maxima for a map — reported alongside the verdict for diagnostics
 *  and mirrored by the live scene readback. */
export interface ReadabilityMetrics {
  maxDecalOpacity: number;
  decalCoverage: number;
  maxPropOpacity: number;
  maxInPlayPropOpacity: number;
  horizonOpacity: number;
  fogNear: number;
  fogFar: number;
  /** The `fogFar` floor for this map (its play-area diagonal). */
  fogFarRequired: number;
  backgroundLuminance: number;
}

export interface ReadabilityAudit {
  mapId: string;
  ok: boolean;
  violations: ReadabilityViolation[];
  metrics: ReadabilityMetrics;
}

const DEFAULT_DECAL_OPACITY = 0.22;
const DEFAULT_PROP_OPACITY = 0.86;

/**
 * Audit a map's AUTHORED dressing against {@link READABILITY_BUDGET}. Fog and
 * background checks read the resolved presentation `theme` (populated by the
 * MAPS registry); a map handed in without a theme is audited on its dressing
 * geometry alone.
 */
export function auditArenaReadability(map: ArenaMap): ReadabilityAudit {
  const b = READABILITY_BUDGET;
  const ext = playAreaExtents(map.bounds);
  const env = resolveArenaEnvironment(map.environment);
  const violations: ReadabilityViolation[] = [];

  // --- floor decals: opacity ceiling + total floor coverage ---
  let maxDecalOpacity = 0;
  let decalFootprint = 0;
  for (const [i, d] of env.decals.entries()) {
    const opacity = d.opacity ?? DEFAULT_DECAL_OPACITY;
    maxDecalOpacity = Math.max(maxDecalOpacity, opacity);
    decalFootprint += d.w * d.d;
    if (opacity > b.maxDecalOpacity) {
      violations.push({ rule: "decalOpacity", detail: `decal[${i}]`, value: opacity, limit: b.maxDecalOpacity });
    }
  }
  const playArea = (ext.maxX - ext.minX) * (ext.maxZ - ext.minZ);
  const decalCoverage = playArea > 0 ? decalFootprint / playArea : 0;
  if (decalCoverage > b.maxDecalCoverage) {
    violations.push({ rule: "decalCoverage", detail: "decals", value: decalCoverage, limit: b.maxDecalCoverage });
  }

  // --- billboard props: global ceiling + stricter in-core ceiling ---
  let maxPropOpacity = 0;
  let maxInPlayPropOpacity = 0;
  for (const [i, p] of env.props.entries()) {
    const opacity = p.opacity ?? DEFAULT_PROP_OPACITY;
    maxPropOpacity = Math.max(maxPropOpacity, opacity);
    if (opacity > b.maxPropOpacity) {
      violations.push({ rule: "propOpacity", detail: `prop[${i}]`, value: opacity, limit: b.maxPropOpacity });
    }
    if (isInCorePlayArea(p.x, p.z, ext, b.corePlayAreaMargin)) {
      maxInPlayPropOpacity = Math.max(maxInPlayPropOpacity, opacity);
      if (opacity > b.maxInPlayPropOpacity) {
        violations.push({
          rule: "inPlayPropOpacity",
          detail: `prop[${i}]`,
          value: opacity,
          limit: b.maxInPlayPropOpacity,
        });
      }
    }
  }

  // --- horizon haze band must stay a faint wash ---
  const horizonOpacity = env.horizonOpacity;
  if (horizonOpacity > b.maxHorizonOpacity) {
    violations.push({
      rule: "horizonOpacity",
      detail: "horizonHaze",
      value: horizonOpacity,
      limit: b.maxHorizonOpacity,
    });
  }

  // --- distant silhouettes must stay clear of the play area ---
  for (const [i, s] of env.silhouettes.entries()) {
    if (boxOverlapsPlayArea(s.x, s.z, s.w, s.d, ext)) {
      violations.push({ rule: "silhouetteIntrusion", detail: `silhouette[${i}]`, value: 1, limit: 0 });
    }
  }

  // --- fog + background (resolved presentation theme) ---
  const fogFarRequired = playAreaDiagonal(ext);
  let fogNear = 0;
  let fogFar = 0;
  let backgroundLuminance = 0;
  if (map.theme) {
    fogNear = map.theme.fogNear;
    fogFar = map.theme.fogFar;
    backgroundLuminance = luminance(map.theme.bg);
    if (fogFar < fogFarRequired) {
      violations.push({ rule: "fogFar", detail: "theme.fogFar", value: fogFar, limit: fogFarRequired });
    }
    if (fogNear < b.minFogNear) {
      violations.push({ rule: "fogNear", detail: "theme.fogNear", value: fogNear, limit: b.minFogNear });
    }
    if (backgroundLuminance > b.maxBackgroundLuminance) {
      violations.push({
        rule: "backgroundLuminance",
        detail: "theme.bg",
        value: backgroundLuminance,
        limit: b.maxBackgroundLuminance,
      });
    }
  } else {
    // No resolved theme means fog/background go UNAUDITED — fogNear/fogFar/
    // backgroundLuminance all read 0, which would otherwise sail past every
    // check and report a map "ok" on an arena whose sky was never scored.
    // Fail closed: an unaudited presentation layer is a readability gap.
    violations.push({ rule: "missingTheme", detail: "theme", value: 0, limit: 1 });
  }

  return {
    mapId: map.id,
    ok: violations.length === 0,
    violations,
    metrics: {
      maxDecalOpacity,
      decalCoverage,
      maxPropOpacity,
      maxInPlayPropOpacity,
      horizonOpacity,
      fogNear,
      fogFar,
      fogFarRequired,
      backgroundLuminance,
    },
  };
}

/** The subset of {@link ReadabilityMetrics} the live scene can measure directly
 *  off its materials, fog, and background (decal coverage + silhouette geometry
 *  are authoring-only concerns, asserted by the unit audit, not re-measured). */
export interface LiveReadabilityMetrics {
  maxDecalOpacity: number;
  maxPropOpacity: number;
  maxInPlayPropOpacity: number;
  horizonOpacity: number;
  fogNear: number;
  fogFar: number;
  fogFarRequired: number;
  backgroundLuminance: number;
}

export interface LiveReadabilityReport extends LiveReadabilityMetrics {
  ok: boolean;
  violations: number;
}

/**
 * Score metrics already MEASURED off the built scene against the budget — the
 * live counterpart to {@link auditArenaReadability}, applying the identical
 * opacity / fog / background rules so the rendered arena and the authored data
 * are held to one contract.
 */
export function scoreLiveReadability(m: LiveReadabilityMetrics): LiveReadabilityReport {
  const b = READABILITY_BUDGET;
  let violations = 0;
  if (m.maxDecalOpacity > b.maxDecalOpacity) violations += 1;
  if (m.maxPropOpacity > b.maxPropOpacity) violations += 1;
  if (m.maxInPlayPropOpacity > b.maxInPlayPropOpacity) violations += 1;
  if (m.horizonOpacity > b.maxHorizonOpacity) violations += 1;
  if (m.fogFar < m.fogFarRequired) violations += 1;
  if (m.fogNear < b.minFogNear) violations += 1;
  if (m.backgroundLuminance > b.maxBackgroundLuminance) violations += 1;
  return { ...m, ok: violations === 0, violations };
}
