// Arena map definitions for the Campaign.
//
// Canon: the descent Ashgate → The Hollow Lanes → The Maw → Perdition. See
// apps/lore/content/Locations/{Ashgate,The-Hollow-Lanes,The-Maw,Perdition}.md and
// apps/lore/content/Maps.md (cross-game map registry).
//
// The Campaign IS the canon descent into the breach: Ashgate → The Hollow Lanes
// → The Maw → Perdition. A Purger drops in at the Ashgate foundry-wall, pushes
// through the dead Hollow Lanes between holdouts, crosses The Maw spanning the
// breach throat, and ends at Perdition where the source pulses — few walk out.
//
// The canon campaign maps share the default 80x80 footprint (ARENA_HALF = 40)
// and the four boundary walls. Survivors variants may override `bounds`; the
// runtime clamp, floor, wall, cull, and spawn seams all consume live map bounds.
//
// v2 structural layer: the game-agnostic schema (rooms, floor levels, ramps,
// platforms, typed anchors) lives in `@deadrot/game-kit/maps`. The MAPS
// registry attaches the normalized view as `layout` at module load via
// `normalizeArenaLayout`, so every map handed out by MAPS/getMap/
// campaignSequence is a NormalizedArenaMap. v1 maps author none of the v2
// fields — the adapter synthesizes a whole-bounds root room, a ground level,
// and a playerSpawn anchor from `spawn`. Note: `elevated` obstacle stacking is
// a render-only quirk that floor levels will subsume in #82.
//
// Biome presentation layer (issue #80): maps no longer author a theme block.
// Each map authors a `biomeId` (plus optional per-map `themeOverrides`) and
// the MAPS registry resolves the concrete `theme` at module load via
// `resolveBiomeTheme` — mirroring the `layout` normalization above — so every
// map handed out by MAPS/getMap/campaignSequence carries a resolved MapTheme.
// The presets live in `@deadrot/game-kit/maps` (the canon-checked biome
// catalog shared across games). `biomeId` is presentation-only: it does NOT
// replace `loreId`/`front`, which stay the lore-registry join keys.
//
// Palette is canon DOOM (see DESIGN.md / Style-Bible): blood + fire + metal +
// bone — ember discipline, sourced glow only (vents, lamps, seams), never
// saturated signage. Toxic-green is reserved for the Scourge only (the `rot`
// biome carries it).
//
// Layouts were generated + geometrically validated by a multi-agent design
// pass (no out-of-bounds boxes, no overlaps/slivers, clear player spawns).

import {
  type ArenaAnchor,
  type ArenaBounds,
  type ArenaFloorLevel,
  type ArenaLayout,
  type ArenaPlatform,
  type ArenaRamp,
  type ArenaRoom,
  type ArenaStructure,
  type BiomeAccentLight,
  type BiomeId,
  type BiomeTheme,
  type BiomeThemeOverrides,
  DEFAULT_BIOME_ID,
  GROUND_LEVEL_ID,
  normalizeArenaLayout,
  resolveBiomeTheme,
} from "@deadrot/game-kit/maps";
import type { MapBounds } from "@shipshitgames/engine";
import type { PixelIconId } from "../../assets/ui/pixelIcons";
import { ARENA_HALF, STAGE_CLEAR_HEAL, STAGE_DIFFICULTY_STEP } from "../constants";

export type ObstacleMat = "crate" | "pillar" | "wall";
export type ArenaMaterialRole = "floor" | "wall" | "block" | "column";
export type ArenaMaterialSet = Record<ArenaMaterialRole, string>;

export const DEFAULT_ARENA_BOUNDS: MapBounds = { kind: "square", half: ARENA_HALF };

/** First oversized shipped test zone (#329): 144x112m, 2.52x the default
 *  floor area. Exported so authoring and runtime tests lock the same contract. */
export const FOUNDRY_WARDS_BOUNDS: MapBounds = {
  kind: "rect",
  minX: -72,
  maxX: 72,
  minZ: -56,
  maxZ: 56,
};

export const DEFAULT_ARENA_MATERIALS: ArenaMaterialSet = {
  floor: "arena-floor",
  wall: "arena-wall",
  block: "arena-block",
  column: "arena-column",
};

export interface MapObstacle {
  x: number;
  z: number;
  w: number; // size along X
  h: number; // height
  d: number; // size along Z
  mat: ObstacleMat;
  /** Decorative box resting on top of another — drawn + shootable, but not a collider. */
  elevated?: boolean;
}

/** Game-local alias for the shared biome accent-light shape (one of the two
 *  coloured rim lights). Kept exported so existing importers keep compiling. */
export type MapLight = BiomeAccentLight;

/** Game-local alias for the shared biome theme: background + fog colour, fog
 *  range, floor/wall tints, the emissive ember trim colour, and the two accent
 *  rim lights. Resolved from `biomeId` + `themeOverrides` by the registry. */
export type MapTheme = BiomeTheme;

export interface ArenaSilhouette {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  emissive?: number;
  opacity?: number;
}

export interface ArenaDecal {
  x: number;
  z: number;
  w: number;
  d: number;
  texture: string;
  color?: number;
  opacity?: number;
  rotation?: number;
}

export interface ArenaProp {
  x: number;
  z: number;
  w: number;
  h: number;
  texture: string;
  y?: number;
  color?: number;
  opacity?: number;
}

export interface ArenaEnvironment {
  skyTop: number;
  skyHorizon: number;
  horizonHaze: number;
  horizonOpacity: number;
  silhouettes: ArenaSilhouette[];
  decals: ArenaDecal[];
  props: ArenaProp[];
}

/**
 * Safe presentation used when a map only authors structure. It deliberately
 * uses Ashgate's non-Scourge foundry palette: no toxic-green environment
 * lighting, non-empty distant silhouettes, and registered dressing textures.
 *
 * This one constant is cloned for EVERY fallback map, so its distant silhouettes
 * must clear the LARGEST arena that omits an environment — currently Foundry
 * Wards ({@link FOUNDRY_WARDS_BOUNDS}, ±72×±56). The readability audit (#35)
 * fails any silhouette whose AABB overlaps the play area, so the ring is placed
 * just beyond that widest footprint rather than the default ±40 outer ring.
 */
export const DEFAULT_ARENA_ENVIRONMENT: ArenaEnvironment = {
  skyTop: 0x090505,
  skyHorizon: 0x261109,
  horizonHaze: 0xff6a00,
  horizonOpacity: 0.16,
  silhouettes: [
    { x: -82, z: -24, w: 5, h: 26, d: 5, color: 0x241713, emissive: 0x3a1507, opacity: 0.88 },
    { x: -84, z: 26, w: 8, h: 18, d: 6, color: 0x1b1513, emissive: 0x281006, opacity: 0.9 },
    { x: 82, z: -30, w: 7, h: 22, d: 5, color: 0x201614, emissive: 0x351307, opacity: 0.88 },
    { x: 82, z: 34, w: 16, h: 10, d: 5, color: 0x241610, emissive: 0x4a1b08, opacity: 0.84 },
    { x: 0, z: 66, w: 36, h: 8, d: 5, color: 0x1d1310, emissive: 0x2a0f06, opacity: 0.82 },
  ],
  decals: [
    { x: -20, z: 15, w: 8, d: 8, texture: "arena-ashgate-decal", color: 0xff8a3c, opacity: 0.28, rotation: 0.35 },
    { x: 18, z: -18, w: 9, d: 7, texture: "arena-ashgate-decal", color: 0xff6a00, opacity: 0.24, rotation: -0.2 },
    { x: 3, z: 3, w: 12, d: 12, texture: "arena-ashgate-decal", color: 0xb89274, opacity: 0.18, rotation: 0.78 },
    { x: -28, z: -25, w: 7, d: 10, texture: "arena-ashgate-decal", color: 0xc1121f, opacity: 0.16, rotation: -0.55 },
  ],
  props: [
    { x: -30, z: -20, w: 5.2, h: 8.4, texture: "arena-ashgate-prop", color: 0xff8a3c, opacity: 0.85 },
    { x: 30, z: 20, w: 5.2, h: 8.4, texture: "arena-ashgate-prop", color: 0xff6a00, opacity: 0.85 },
    { x: -6, z: 26, w: 4.3, h: 7, texture: "arena-ashgate-prop", color: 0xb89274, opacity: 0.78 },
    { x: 32, z: -7, w: 4.1, h: 6.8, texture: "arena-ashgate-prop", color: 0xff8a3c, opacity: 0.74 },
  ],
};

/**
 * Resolve optional environment authoring into a runtime value. Explicit
 * presentations preserve their identity so variants can intentionally share
 * one registered environment; the fallback is cloned so no map aliases the
 * default authoring constant.
 */
export function resolveArenaEnvironment(environment?: ArenaEnvironment): ArenaEnvironment {
  if (environment) return environment;
  return {
    ...DEFAULT_ARENA_ENVIRONMENT,
    silhouettes: DEFAULT_ARENA_ENVIRONMENT.silhouettes.map((silhouette) => ({ ...silhouette })),
    decals: DEFAULT_ARENA_ENVIRONMENT.decals.map((decal) => ({ ...decal })),
    props: DEFAULT_ARENA_ENVIRONMENT.props.map((prop) => ({ ...prop })),
  };
}

export interface ArenaMap {
  id: string;
  loreId: string; // canonical lore note id (see apps/lore/content/Locations + apps/lore/content/Maps.md)
  front: "holdout" | "lane" | "breach" | "orbital"; // canon war-front class (apps/lore/content/Maps.md)
  name: string;
  subtitle: string;
  icon: PixelIconId;
  accent: string; // css hex for the picker card border / glow
  bounds?: MapBounds; // defaults to DEFAULT_ARENA_BOUNDS so current FPS tuning stays unchanged
  /** Biome preset id the registry resolves into `theme` at module load (see
   *  `@deadrot/game-kit/maps`). Presentation-only — it does NOT replace the
   *  `loreId`/`front` lore-registry join keys. */
  /** Omit to use the non-toxic foundry presentation fallback. */
  biomeId?: BiomeId;
  /** Optional per-map adjustments layered over the biome preset by
   *  `resolveBiomeTheme` (scalars replace; accent overrides merge per-field). */
  themeOverrides?: BiomeThemeOverrides;
  /** Resolved presentation palette — populated by the MAPS registry at module
   *  load from `biomeId` + `themeOverrides`; always present on maps from
   *  MAPS/getMap/campaignSequence. Do not author directly. */
  theme?: MapTheme;
  materials: ArenaMaterialSet;
  /** Omit to use DEFAULT_ARENA_ENVIRONMENT during registry normalization. */
  environment?: ArenaEnvironment;
  spawn: { x: number; z: number }; // player start (faces the arena centre)
  obstacles: MapObstacle[];
  // --- v2 structural authoring (all optional; v1 maps author none of them) ---
  /** Named sub-regions with world-space bounds + their own obstacles. Omit for a single
   *  open arena (a whole-bounds root room is synthesized). Data only until #82 — the
   *  runtime still builds geometry from the flat `obstacles` list. */
  rooms?: ArenaRoom<MapObstacle>[];
  /** Floor planes. Omit for flat maps (ground level at y=0 is synthesized). `elevated`
   *  obstacles remain a render-only stacking quirk, NOT levels — #82 subsumes them. */
  levels?: ArenaFloorLevel[];
  /** Ramps/stairs between levels. Data only until #82. */
  ramps?: ArenaRamp[];
  /** Raised walkable slabs. Data only until #82. */
  platforms?: ArenaPlatform[];
  /** Enterable buildings: a wall shell per storey, floor decks with optional holes for
   *  stairwells, and door/window openings the player can open, shoot through, or shatter.
   *  `ArenaSystem` expands these into wall obstacles + walkable decks; `StructureSystem`
   *  owns the swinging/sliding leaves. Omit for open-field maps. */
  structures?: ArenaStructure[];
  /** Typed points (playerSpawn/breachSpawn/objective/extraction). Until #82 the runtime
   *  reads `spawn` for placement (placeAtSpawn) and scatter-spawns enemies procedurally;
   *  keep an authored playerSpawn consistent with `spawn`. No breachSpawns = procedural
   *  scatter (v1 behavior). NOTE: missions.ts MissionCheckpoint.spawn is a dead copy of
   *  `spawn` today; #82 re-points it at the playerSpawn anchor. */
  anchors?: ArenaAnchor[];
  /** Normalized v2 view — populated by the MAPS registry at module load; always present
   *  on maps from MAPS/getMap/campaignSequence. Do not author directly. */
  layout?: ArenaLayout<MapObstacle>;
}

/** An ArenaMap whose presentation + layout have been populated — what the registry hands out. */
export type NormalizedArenaMap = Omit<ArenaMap, "biomeId" | "environment" | "layout" | "theme"> & {
  biomeId: BiomeId;
  environment: ArenaEnvironment;
  layout: ArenaLayout<MapObstacle>;
  theme: MapTheme;
};

function arenaMaterials(mapId: string): ArenaMaterialSet {
  return {
    floor: `arena-${mapId}-floor`,
    wall: `arena-${mapId}-wall`,
    block: `arena-${mapId}-block`,
    column: `arena-${mapId}-column`,
  };
}

// ============================================================================
// ASHGATE — the eastern foundry-wall holdout where the Purgers drop in.
// Gunmetal + hellfire-orange: heavy pillars + blocky, broken crate cover.
// ============================================================================
const ASHGATE: ArenaMap = {
  id: "ashgate",
  loreId: "ashgate",
  front: "holdout",
  name: "Ashgate",
  subtitle: "The eastern foundry-wall — where the Purgers drop in",
  icon: "foundry",
  accent: "#ff6a00",
  biomeId: "foundry",
  materials: arenaMaterials("ashgate"),
  environment: DEFAULT_ARENA_ENVIRONMENT,
  spawn: { x: -26, z: 28 },
  obstacles: [
    { x: 0, z: 0, w: 2.2, h: 6, d: 2.2, mat: "pillar" },
    { x: -9, z: -7, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 9, z: 7, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: -25, z: 20, w: 8, h: 1.1, d: 5, mat: "wall" },
    { x: -20, z: 20, w: 2, h: 0.45, d: 5, mat: "crate" },
    { x: 24, z: -22, w: 8, h: 1.1, d: 5, mat: "wall" },
    { x: 19, z: -22, w: 2, h: 0.45, d: 5, mat: "crate" },
    { x: -16, z: 15, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
    { x: -13.4, z: 15, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
    { x: -16, z: 17.6, w: 2.6, h: 2.4, d: 2.6, mat: "crate" },
    { x: 16, z: -15, w: 2.8, h: 2.8, d: 2.8, mat: "crate" },
    { x: 16, z: -15, w: 2, h: 2, d: 2, mat: "crate", elevated: true },
    { x: 19, z: 17, w: 2.4, h: 2.4, d: 2.4, mat: "crate" },
    { x: -16, z: -16, w: 8, h: 3, d: 2.4, mat: "wall" },
    { x: 13, z: -3, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
    { x: -14, z: -1, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
  ],
};

// ============================================================================
// THE HOLLOW LANES — dead corridors between the holdouts: long slab aisles with
// junction chokepoints. Desaturated bone/gunmetal grey — dead, lightless, no
// ember glow left.
// ============================================================================
const HOLLOWLANES: ArenaMap = {
  id: "hollowlanes",
  loreId: "hollowlanes",
  front: "lane",
  name: "The Hollow Lanes",
  subtitle: "Dead corridors between the holdouts",
  icon: "bone",
  accent: "#cdbfae",
  biomeId: "bone",
  materials: arenaMaterials("hollowlanes"),
  environment: {
    skyTop: 0x0c0c0d,
    skyHorizon: 0x2a2724,
    horizonHaze: 0xcdbfae,
    horizonOpacity: 0.28,
    silhouettes: [
      { x: -60, z: -8, w: 7, h: 12, d: 30, color: 0x151516, emissive: 0x24221e, opacity: 0.88 },
      { x: 60, z: 8, w: 7, h: 13, d: 30, color: 0x151516, emissive: 0x24221e, opacity: 0.88 },
      { x: -32, z: 62, w: 18, h: 10, d: 5, color: 0x181817, emissive: 0x2a261f, opacity: 0.82 },
      { x: 31, z: -62, w: 16, h: 11, d: 5, color: 0x181817, emissive: 0x2a261f, opacity: 0.82 },
      { x: 0, z: 70, w: 10, h: 18, d: 5, color: 0x111113, emissive: 0x1e1c18, opacity: 0.78 },
    ],
    decals: [
      { x: 0, z: -20, w: 10, d: 16, texture: "arena-hollowlanes-decal", color: 0xe9e3d6, opacity: 0.24 },
      { x: -16, z: 0, w: 8, d: 14, texture: "arena-hollowlanes-decal", color: 0xcdbfae, opacity: 0.26, rotation: 1.57 },
      { x: 16, z: 0, w: 8, d: 14, texture: "arena-hollowlanes-decal", color: 0xcdbfae, opacity: 0.26, rotation: -1.57 },
      { x: 0, z: 25, w: 16, d: 8, texture: "arena-hollowlanes-decal", color: 0xf6efe2, opacity: 0.2, rotation: 0.2 },
    ],
    props: [
      // Bone-pale pillars dropped from near-opaque 0.96 to the readability
      // budget's 0.85 in-core ceiling so they read as cover, not walls (#35).
      { x: -9, z: -22, w: 4.6, h: 7.4, texture: "arena-hollowlanes-prop", color: 0xf6efe2, opacity: 0.85 },
      { x: 9, z: -22, w: 4.6, h: 7.4, texture: "arena-hollowlanes-prop", color: 0xf6efe2, opacity: 0.85 },
      { x: -21, z: 21, w: 4.3, h: 7, texture: "arena-hollowlanes-prop", color: 0xcdbfae, opacity: 0.84 },
      { x: 21, z: 21, w: 4.3, h: 7, texture: "arena-hollowlanes-prop", color: 0xcdbfae, opacity: 0.84 },
      { x: 0, z: 31, w: 4.8, h: 7.8, texture: "arena-hollowlanes-prop", color: 0xf6efe2, opacity: 0.8 },
    ],
  },
  spawn: { x: -10, z: -32 },
  obstacles: [
    { x: -28, z: 0, w: 7, h: 1.0, d: 13, mat: "wall" },
    { x: -23.6, z: 0, w: 1.8, h: 0.45, d: 8, mat: "crate" },
    { x: 28, z: 0, w: 7, h: 1.0, d: 13, mat: "wall" },
    { x: 23.6, z: 0, w: 1.8, h: 0.45, d: 8, mat: "crate" },
    { x: -15, z: -13, w: 2.4, h: 3, d: 14, mat: "wall" },
    { x: -15, z: 13, w: 2.4, h: 3, d: 14, mat: "wall" },
    { x: 15, z: -13, w: 2.4, h: 3, d: 14, mat: "wall" },
    { x: 15, z: 13, w: 2.4, h: 3, d: 14, mat: "wall" },
    { x: 0, z: -27, w: 16, h: 3.2, d: 2.4, mat: "wall" },
    { x: 0, z: 27, w: 16, h: 3.2, d: 2.4, mat: "wall" },
    { x: -15, z: 0, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 15, z: 0, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 0, z: 0, w: 2.4, h: 2.8, d: 2.4, mat: "crate" },
    { x: -27, z: 27, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
    { x: 27, z: -27, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
  ],
};

// ============================================================================
// THE MAW — an exposed span over the breach throat: sparse tall pillars, long
// sightlines. Toxic-green Scourge glow bleeding up out of a dark chasm.
// ============================================================================
const MAW: ArenaMap = {
  id: "maw",
  loreId: "maw",
  front: "breach",
  name: "The Maw",
  subtitle: "An exposed span over the breach throat",
  icon: "maw",
  accent: "#6acf3c",
  biomeId: "rot",
  materials: arenaMaterials("maw"),
  environment: {
    skyTop: 0x050706,
    skyHorizon: 0x10170f,
    horizonHaze: 0x6b7a5a,
    horizonOpacity: 0.18,
    silhouettes: [
      { x: -62, z: 0, w: 8, h: 24, d: 36, color: 0x071007, emissive: 0x172b12, opacity: 0.86 },
      { x: 62, z: 0, w: 8, h: 22, d: 36, color: 0x071007, emissive: 0x172b12, opacity: 0.86 },
      { x: -28, z: 66, w: 20, h: 8, d: 6, color: 0x0c120c, emissive: 0x25321b, opacity: 0.78 },
      { x: 29, z: 66, w: 18, h: 8, d: 6, color: 0x0c120c, emissive: 0x25321b, opacity: 0.78 },
      { x: 0, z: -68, w: 30, h: 7, d: 6, color: 0x0b100b, emissive: 0x202d18, opacity: 0.8 },
    ],
    decals: [
      { x: 0, z: 0, w: 18, d: 18, texture: "arena-maw-decal", color: 0x6acf3c, opacity: 0.24 },
      { x: 0, z: -23, w: 10, d: 9, texture: "arena-maw-decal", color: 0x8bdc1f, opacity: 0.2, rotation: 0.4 },
      { x: 0, z: 23, w: 10, d: 9, texture: "arena-maw-decal", color: 0x8bdc1f, opacity: 0.2, rotation: -0.4 },
      { x: -18, z: 0, w: 9, d: 12, texture: "arena-maw-decal", color: 0x6b7a5a, opacity: 0.18, rotation: 1.57 },
      { x: 18, z: 0, w: 9, d: 12, texture: "arena-maw-decal", color: 0x6b7a5a, opacity: 0.18, rotation: -1.57 },
    ],
    props: [
      // Capped at the readability budget's 0.85 in-core ceiling; the toxic glow
      // still reads, but a Scourge sprite behind one stays visible (#35).
      { x: -11, z: -24, w: 4.2, h: 9.2, texture: "arena-maw-prop", color: 0x8bdc1f, opacity: 0.85 },
      { x: 11, z: -24, w: 4.2, h: 9.2, texture: "arena-maw-prop", color: 0x8bdc1f, opacity: 0.85 },
      { x: -23, z: 18, w: 5, h: 10.5, texture: "arena-maw-prop", color: 0x6acf3c, opacity: 0.82 },
      { x: 23, z: 18, w: 5, h: 10.5, texture: "arena-maw-prop", color: 0x6acf3c, opacity: 0.82 },
    ],
  },
  spawn: { x: 0, z: -32 },
  obstacles: [
    { x: -18, z: -12, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 18, z: -12, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: -18, z: 12, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 18, z: 12, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 0, z: 22, w: 2.2, h: 6, d: 2.2, mat: "pillar" },
    { x: 0, z: -22, w: 2.2, h: 6, d: 2.2, mat: "pillar" },
    { x: 0, z: 0, w: 5, h: 1.05, d: 5, mat: "wall" },
    { x: 0, z: -3.6, w: 5, h: 0.45, d: 2, mat: "crate" },
    { x: 0, z: 3.6, w: 5, h: 0.45, d: 2, mat: "crate" },
    { x: -10, z: 0, w: 8, h: 2.6, d: 2.4, mat: "wall" },
    { x: 10, z: 0, w: 8, h: 2.6, d: 2.4, mat: "wall" },
  ],
};

// ============================================================================
// PERDITION — the source pulses at the far end of the descent; few Purgers walk
// out. A dense central core ringed by cover, lit blood-red hazard.
// (floor/wall tints lightened slightly from the original spec for readability)
// ============================================================================
const PERDITION: ArenaMap = {
  id: "perdition",
  loreId: "perdition",
  front: "breach",
  name: "Perdition",
  subtitle: "The source pulses — few Purgers walk out",
  icon: "fire",
  accent: "#c1121f",
  biomeId: "perdition",
  materials: arenaMaterials("perdition"),
  environment: {
    skyTop: 0x070103,
    skyHorizon: 0x220407,
    horizonHaze: 0xc1121f,
    horizonOpacity: 0.18,
    silhouettes: [
      { x: -64, z: -10, w: 9, h: 25, d: 20, color: 0x160508, emissive: 0x3b080e, opacity: 0.88 },
      { x: 64, z: 10, w: 9, h: 25, d: 20, color: 0x160508, emissive: 0x3b080e, opacity: 0.88 },
      { x: -25, z: 66, w: 16, h: 15, d: 7, color: 0x1c0609, emissive: 0x4c0b13, opacity: 0.84 },
      { x: 25, z: 66, w: 16, h: 15, d: 7, color: 0x1c0609, emissive: 0x4c0b13, opacity: 0.84 },
      { x: 0, z: -68, w: 24, h: 18, d: 7, color: 0x130407, emissive: 0x5c0d17, opacity: 0.82 },
    ],
    decals: [
      { x: 0, z: 0, w: 14, d: 14, texture: "arena-perdition-decal", color: 0xff2a18, opacity: 0.26, rotation: 0.78 },
      {
        x: -14,
        z: -14,
        w: 10,
        d: 10,
        texture: "arena-perdition-decal",
        color: 0xc1121f,
        opacity: 0.22,
        rotation: -0.32,
      },
      { x: 14, z: 14, w: 10, d: 10, texture: "arena-perdition-decal", color: 0xc1121f, opacity: 0.22, rotation: 0.32 },
      { x: 0, z: 24, w: 18, d: 9, texture: "arena-perdition-decal", color: 0x9a5560, opacity: 0.16 },
      { x: 0, z: -24, w: 18, d: 9, texture: "arena-perdition-decal", color: 0x9a5560, opacity: 0.16 },
    ],
    props: [
      // The two central core-flanking props sit right where the fight happens —
      // capped at the readability budget's 0.85 in-core ceiling (#35).
      { x: -14, z: 0, w: 4.5, h: 8.8, texture: "arena-perdition-prop", color: 0xff2a18, opacity: 0.85 },
      { x: 14, z: 0, w: 4.5, h: 8.8, texture: "arena-perdition-prop", color: 0xff2a18, opacity: 0.85 },
      { x: 0, z: -14, w: 4, h: 8.2, texture: "arena-perdition-prop", color: 0xc1121f, opacity: 0.8 },
      { x: 0, z: 14, w: 4, h: 8.2, texture: "arena-perdition-prop", color: 0xc1121f, opacity: 0.8 },
    ],
  },
  spawn: { x: 0, z: -32 },
  obstacles: [
    { x: -28, z: 0, w: 7, h: 1.0, d: 12, mat: "wall" },
    { x: -23.6, z: 0, w: 1.8, h: 0.45, d: 8, mat: "crate" },
    { x: 28, z: 0, w: 7, h: 1.0, d: 12, mat: "wall" },
    { x: 23.6, z: 0, w: 1.8, h: 0.45, d: 8, mat: "crate" },
    { x: 0, z: 0, w: 2.4, h: 2.8, d: 2.4, mat: "crate" },
    { x: 0, z: 0, w: 1.6, h: 2.6, d: 1.6, mat: "crate", elevated: true },
    { x: 4.7, z: 0, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: -4.7, z: 0, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 0, z: 4.7, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 0, z: -4.7, w: 2, h: 6, d: 2, mat: "pillar" },
    { x: 0, z: 19, w: 8, h: 3, d: 2.4, mat: "wall" },
    { x: 0, z: -19, w: 8, h: 3, d: 2.4, mat: "wall" },
    { x: 19, z: 0, w: 2.4, h: 3, d: 8, mat: "wall" },
    { x: -19, z: 0, w: 2.4, h: 3, d: 8, mat: "wall" },
    { x: 13, z: 13, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
    { x: -13, z: -13, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
  ],
};

// ============================================================================
// THE GANTRY — a sandbox-only v2 STRUCTURAL demonstrator (issue #82). Not part
// of the canon campaign descent and deliberately kept OUT of the MAPS registry
// (campaign-order invariants stay intact); it lives in SANDBOX_MAPS and is
// reachable from the dev SandboxPanel + e2e harness via startSandbox("gantry").
//
// It exercises every runtime path ArenaSystem.buildArena / PlayerSystem now
// consume from `layout`: multiple ROOMS, a raised LEVEL (the mezzanine gantry)
// with its walkable floor slab, a climbable RAMP up to it, jump/step PLATFORMS,
// and authored breachSpawn ANCHORS that swap enemy spawning from procedural
// scatter to fixed mouths. Presentation reuses The Maw's theme/materials/assets
// (loreId "maw") so it ships no new texture ids.
//
// Geometry: a front YARD at ground (z ≳ -2) and a raised GANTRY deck at y=3
// (z ≲ -2) spanning the breach throat. A central ramp (x≈0) is the only walk-up;
// retaining walls flank it so the deck reads solid. Enemies breach from the deck
// and the two flanks; the objective core sits on the deck.
const GANTRY: ArenaMap = {
  id: "gantry",
  loreId: "maw",
  front: "breach",
  name: "The Gantry",
  subtitle: "Sandbox: a multi-level span over the breach throat",
  icon: "maw",
  accent: "#6acf3c",
  biomeId: "rot",
  // No explicit `theme`: normalizeMap resolves it from biomeId ("rot") — the same
  // theme The Maw uses. (A literal `theme: MAW.theme` here was dead: raw map
  // literals no longer author `theme`, so MAW.theme is undefined.)
  materials: arenaMaterials("maw"),
  environment: MAW.environment,
  spawn: { x: 0, z: 30 },
  // All geometry is homed in rooms; the flat list stays empty so the adapter
  // uses the authored rooms verbatim (no synthesized root room).
  obstacles: [],
  levels: [{ id: "mezzanine", y: 3, name: "Gantry Deck" }],
  rooms: [
    {
      id: "yard",
      name: "Approach Yard",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: -2, maxZ: 40 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // Retaining walls of the raised deck, with a central gap for the ramp.
        { x: -20, z: -2, w: 36, h: 3, d: 1.5, mat: "wall" },
        { x: 20, z: -2, w: 36, h: 3, d: 1.5, mat: "wall" },
        // Ground cover.
        { x: -14, z: 18, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
        { x: 14, z: 14, w: 2.6, h: 2.6, d: 2.6, mat: "crate" },
        { x: 0, z: 22, w: 2.2, h: 6, d: 2.2, mat: "pillar" },
      ],
    },
    {
      id: "gantry-deck",
      name: "Gantry Deck",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: -40, maxZ: -2 },
      levelId: "mezzanine",
      obstacles: [
        // Rendered at the deck elevation (roomY = 3): pillars + a low parapet.
        { x: -18, z: -22, w: 2, h: 6, d: 2, mat: "pillar" },
        { x: 18, z: -22, w: 2, h: 6, d: 2, mat: "pillar" },
        { x: 0, z: -12, w: 6, h: 1.0, d: 2.4, mat: "wall" },
      ],
    },
  ],
  ramps: [
    {
      id: "deck-ramp",
      kind: "ramp",
      from: { x: 0, z: 4 },
      to: { x: 0, z: -2 },
      width: 6,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "mezzanine",
    },
  ],
  platforms: [
    // Step up from the ground yard (top 0.4 ≤ player step height).
    { id: "yard-step", x: 22, z: 28, w: 5, d: 5, y: 0.4, thickness: 0.4, levelId: GROUND_LEVEL_ID },
    // Overlook step on the deck (top 3.4 — a step up from the deck floor at 3).
    { id: "deck-overlook", x: 0, z: -32, w: 12, d: 6, y: 3.4, thickness: 0.5, levelId: "mezzanine" },
  ],
  anchors: [
    { kind: "playerSpawn", id: "player-spawn", x: 0, z: 30, levelId: GROUND_LEVEL_ID },
    { kind: "breachSpawn", id: "deck-breach", x: 0, z: -36, levelId: "mezzanine", laneId: "north" },
    { kind: "breachSpawn", id: "east-breach", x: 34, z: -20, levelId: "mezzanine", laneId: "east" },
    { kind: "breachSpawn", id: "west-breach", x: -34, z: -20, levelId: "mezzanine", laneId: "west" },
    { kind: "objective", id: "core", x: 0, z: -26, levelId: "mezzanine" },
  ],
};

// ============================================================================
// FOUNDRY WARDS — a selectable Survivors variant inside Ashgate's fabrication
// yards and the first oversized-zone proof (#329). Its 144x112 footprint is
// 2.52x the default arena area. Two authored ground-level rooms are separated
// by a furnace bulkhead with a wide traversal opening through the centre.
//
// Presentation deliberately reuses Ashgate's registered assets. The layout is
// new runtime data, while loreId/front keep the arena joined to the canon place.
// ============================================================================
const FOUNDRY_WARDS: ArenaMap = {
  id: "foundry-wards",
  loreId: "ashgate",
  front: "holdout",
  name: "Foundry Wards",
  subtitle: "Ashgate fabrication yards — furnace by furnace",
  icon: "foundry",
  accent: "#ff6a00",
  biomeId: "foundry",
  bounds: FOUNDRY_WARDS_BOUNDS,
  themeOverrides: {
    // The 182.5m corner-to-corner sightline must remain inside the fog falloff.
    fogFar: 210,
    // Pull the existing foundry rim lights out with the larger combat floor.
    accentA: { x: -50, z: -38 },
    accentB: { x: 50, z: 38 },
  },
  materials: ASHGATE.materials,
  // Omit environment: this fallback variant uses DEFAULT_ARENA_ENVIRONMENT
  // (a fresh clone via normalizeMap), sharing Ashgate's registered dressing
  // textures without aliasing Ashgate's environment identity.
  spawn: { x: -62, z: 0 },
  obstacles: [],
  rooms: [
    {
      id: "assembly-yard",
      name: "Assembly Yard",
      bounds: { kind: "rect", minX: -72, maxX: 0, minZ: -56, maxZ: 56 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // The two bulkhead runs leave a 40m opening from z=-20..20.
        { x: -1, z: -38, w: 2, h: 4, d: 36, mat: "wall" },
        { x: -1, z: 38, w: 2, h: 4, d: 36, mat: "wall" },
        { x: -48, z: 0, w: 14, h: 1.2, d: 2.4, mat: "wall" },
        { x: -38, z: -26, w: 4, h: 3, d: 4, mat: "crate" },
        { x: -34, z: 28, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: -56, z: 38, w: 5, h: 3, d: 5, mat: "crate" },
      ],
    },
    {
      id: "furnace-yard",
      name: "Furnace Yard",
      bounds: { kind: "rect", minX: 0, maxX: 72, minZ: -56, maxZ: 56 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: 48, z: 0, w: 14, h: 1.2, d: 2.4, mat: "wall" },
        { x: 38, z: -24, w: 4, h: 3, d: 4, mat: "crate" },
        { x: 34, z: 28, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 54, z: 40, w: 4, h: 3, d: 4, mat: "crate" },
        { x: 56, z: -38, w: 5, h: 3, d: 5, mat: "crate" },
      ],
    },
  ],
  anchors: [
    {
      kind: "playerSpawn",
      id: "assembly-spawn",
      x: -62,
      z: 0,
      levelId: GROUND_LEVEL_ID,
      roomId: "assembly-yard",
    },
    {
      kind: "breachSpawn",
      id: "furnace-breach",
      x: 62,
      z: 0,
      levelId: GROUND_LEVEL_ID,
      roomId: "furnace-yard",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "assembly-breach",
      x: -62,
      z: -42,
      levelId: GROUND_LEVEL_ID,
      roomId: "assembly-yard",
      laneId: "west",
    },
    {
      kind: "objective",
      id: "ward-furnace",
      x: 54,
      z: 10,
      levelId: GROUND_LEVEL_ID,
      roomId: "furnace-yard",
    },
  ],
};

// ============================================================================
// BREACH PRIMUS — the authored multi-level crossing at The Maw. Purgers enter
// from the lower breach lip, climb the central ramp, then fight across a raised
// span while the horde breaches from the far deck and both flanks.
//
// Like The Gantry demonstrator, this reuses The Maw's registered presentation;
// unlike The Gantry, it is a shipped Survivors-selectable arena.
// ============================================================================
const BREACH_PRIMUS: ArenaMap = {
  id: "breach-primus",
  loreId: "maw",
  front: "breach",
  name: "Breach Primus",
  subtitle: "Climb the throat-span while the Maw pours upward",
  icon: "maw",
  accent: "#6acf3c",
  biomeId: "rot",
  materials: MAW.materials,
  environment: MAW.environment,
  spawn: { x: 0, z: 32 },
  obstacles: [],
  levels: [{ id: "throat-span", y: 3, name: "Breach Primus Span" }],
  rooms: [
    {
      id: "breach-lip",
      name: "Breach Lip",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: 4, maxZ: 40 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // Retaining walls leave the central 12m ramp mouth clear.
        { x: -23, z: 4.75, w: 34, h: 3, d: 1.5, mat: "wall" },
        { x: 23, z: 4.75, w: 34, h: 3, d: 1.5, mat: "wall" },
        { x: -18, z: 22, w: 3, h: 3, d: 3, mat: "crate" },
        { x: 18, z: 18, w: 3, h: 3, d: 3, mat: "crate" },
        { x: 0, z: 25, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
      ],
    },
    {
      id: "primus-span",
      name: "Breach Primus Span",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: -40, maxZ: 4 },
      levelId: "throat-span",
      obstacles: [
        { x: -20, z: -22, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 20, z: -22, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: -11, z: -10, w: 9, h: 1.1, d: 2.4, mat: "wall" },
        { x: 11, z: -10, w: 9, h: 1.1, d: 2.4, mat: "wall" },
        { x: 0, z: -28, w: 4, h: 3, d: 4, mat: "crate" },
      ],
    },
  ],
  ramps: [
    {
      id: "primus-ramp",
      kind: "ramp",
      from: { x: 0, z: 10 },
      to: { x: 0, z: 4 },
      width: 6,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "throat-span",
    },
  ],
  platforms: [
    {
      id: "throat-overlook",
      x: 0,
      z: -34,
      w: 12,
      d: 6,
      y: 3.4,
      thickness: 0.4,
      levelId: "throat-span",
    },
  ],
  anchors: [
    {
      kind: "playerSpawn",
      id: "breach-lip-spawn",
      x: 0,
      z: 32,
      levelId: GROUND_LEVEL_ID,
      roomId: "breach-lip",
    },
    {
      kind: "breachSpawn",
      id: "north-throat",
      x: 10,
      z: -36,
      levelId: "throat-span",
      roomId: "primus-span",
      laneId: "north",
    },
    {
      kind: "breachSpawn",
      id: "east-throat",
      x: 34,
      z: -18,
      levelId: "throat-span",
      roomId: "primus-span",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "west-throat",
      x: -34,
      z: -18,
      levelId: "throat-span",
      roomId: "primus-span",
      laneId: "west",
    },
    {
      kind: "objective",
      id: "primus-node",
      x: 0,
      z: -20,
      levelId: "throat-span",
      roomId: "primus-span",
    },
  ],
};

// ============================================================================
// REACTOR VERGE — an Ashgate holdout variant at the edge of a live induction
// stack. Four solid exchanger banks leave a cross-shaped hazard route through
// the centre while split baffles force the horde around both flanks.
//
// `cinderwell` is the shared catalog's Reactor/hazard biome: induction stacks,
// slag exchangers, machine oil, and disciplined hazard-yellow/alarm-red light.
// Presentation reuses Ashgate's registered assets; only layout + palette data
// differ from the canon campaign map.
// ============================================================================
const REACTOR_VERGE: ArenaMap = {
  id: "reactor-verge",
  loreId: "ashgate",
  front: "holdout",
  name: "Reactor Verge",
  subtitle: "Ashgate induction stacks — hold the exchanger line",
  icon: "foundry",
  accent: "#d6a21f",
  biomeId: "cinderwell",
  materials: ASHGATE.materials,
  environment: ASHGATE.environment,
  spawn: { x: -32, z: 32 },
  obstacles: [],
  rooms: [
    {
      id: "exchanger-verge",
      name: "Exchanger Verge",
      bounds: DEFAULT_ARENA_BOUNDS,
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // Four exchanger banks form a cross-shaped central hazard route.
        { x: -6, z: -6, w: 6, h: 4, d: 6, mat: "wall" },
        { x: 6, z: -6, w: 6, h: 4, d: 6, mat: "wall" },
        { x: -6, z: 6, w: 6, h: 4, d: 6, mat: "wall" },
        { x: 6, z: 6, w: 6, h: 4, d: 6, mat: "wall" },
        // Split outer baffles preserve north/south traversal on both flanks.
        { x: -20, z: -15, w: 2.4, h: 3, d: 16, mat: "wall" },
        { x: -20, z: 15, w: 2.4, h: 3, d: 16, mat: "wall" },
        { x: 20, z: -15, w: 2.4, h: 3, d: 16, mat: "wall" },
        { x: 20, z: 15, w: 2.4, h: 3, d: 16, mat: "wall" },
        { x: 0, z: -24, w: 3, h: 3, d: 3, mat: "crate" },
        { x: 0, z: 24, w: 3, h: 3, d: 3, mat: "crate" },
      ],
    },
  ],
  anchors: [
    {
      kind: "playerSpawn",
      id: "verge-spawn",
      x: -32,
      z: 32,
      levelId: GROUND_LEVEL_ID,
      roomId: "exchanger-verge",
    },
    {
      kind: "breachSpawn",
      id: "reactor-east-breach",
      x: 34,
      z: -32,
      levelId: GROUND_LEVEL_ID,
      roomId: "exchanger-verge",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "reactor-west-breach",
      x: -34,
      z: -32,
      levelId: GROUND_LEVEL_ID,
      roomId: "exchanger-verge",
      laneId: "west",
    },
    {
      kind: "objective",
      id: "exchanger-control",
      x: 0,
      z: 0,
      levelId: GROUND_LEVEL_ID,
      roomId: "exchanger-verge",
    },
  ],
};

// ============================================================================
// CHOIR NODE — a three-room route through Perdition's densest repeater-heart.
// The operator enters through the pressure throat, crosses the signal nave,
// and reaches the node chamber where the breach mouths converge.
//
// This is local sabotage inside the canon Choir Node, not a claim that the
// wider Choir can be severed. Presentation reuses Perdition's registered
// material/environment assets and its deep-breach biome.
// ============================================================================
const CHOIR_NODE: ArenaMap = {
  id: "choir-node",
  loreId: "perdition",
  front: "breach",
  name: "Choir Node",
  subtitle: "Perdition repeater-heart — burn a wound and run",
  icon: "fire",
  accent: "#ff2a18",
  biomeId: "perdition",
  materials: PERDITION.materials,
  environment: PERDITION.environment,
  spawn: { x: 0, z: 34 },
  obstacles: [],
  rooms: [
    {
      id: "pressure-throat",
      name: "Pressure Throat",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: 12, maxZ: 40 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // Split ribs leave a 24m mouth into the signal nave.
        { x: -24, z: 13, w: 24, h: 4, d: 2, mat: "wall" },
        { x: 24, z: 13, w: 24, h: 4, d: 2, mat: "wall" },
        { x: -20, z: 28, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 20, z: 28, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 0, z: 22, w: 8, h: 1.2, d: 2.4, mat: "wall" },
      ],
    },
    {
      id: "signal-nave",
      name: "Signal Nave",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: -12, maxZ: 12 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: -22, z: -5, w: 12, h: 3, d: 2.4, mat: "wall" },
        { x: 22, z: 5, w: 12, h: 3, d: 2.4, mat: "wall" },
        { x: -8, z: 6, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 8, z: -6, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
      ],
    },
    {
      id: "repeater-heart",
      name: "Repeater Heart",
      bounds: { kind: "rect", minX: -40, maxX: 40, minZ: -40, maxZ: -12 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        // A second split rib frames the chamber without sealing the route.
        { x: -24, z: -13, w: 24, h: 4, d: 2, mat: "wall" },
        { x: 24, z: -13, w: 24, h: 4, d: 2, mat: "wall" },
        { x: -12, z: -25, w: 4, h: 4, d: 4, mat: "crate" },
        { x: 12, z: -25, w: 4, h: 4, d: 4, mat: "crate" },
        { x: 0, z: -34, w: 10, h: 1.2, d: 2.4, mat: "wall" },
      ],
    },
  ],
  anchors: [
    {
      kind: "playerSpawn",
      id: "throat-spawn",
      x: 0,
      z: 34,
      levelId: GROUND_LEVEL_ID,
      roomId: "pressure-throat",
    },
    {
      kind: "breachSpawn",
      id: "heart-breach",
      x: 0,
      z: -38,
      levelId: GROUND_LEVEL_ID,
      roomId: "repeater-heart",
      laneId: "north",
    },
    {
      kind: "breachSpawn",
      id: "nave-east-breach",
      x: 34,
      z: 0,
      levelId: GROUND_LEVEL_ID,
      roomId: "signal-nave",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "nave-west-breach",
      x: -34,
      z: 0,
      levelId: GROUND_LEVEL_ID,
      roomId: "signal-nave",
      laneId: "west",
    },
    {
      kind: "objective",
      id: "choir-node",
      x: 0,
      z: -26,
      levelId: GROUND_LEVEL_ID,
      roomId: "repeater-heart",
    },
  ],
};

// ----------------------------------------------------------------------------

/**
 * Warren Blocks — the first arena built around ENTERABLE buildings.
 *
 * The `warren-upper` level carries no outdoor terrain: it exists only as the
 * second storey of the three habitat blocks. That is legal because
 * `validateArenaLayout` asks a level for a unique id and a height in range, not
 * for a room — so the room graph stays a single flat ground plane (three rooms
 * touching at matching `levelY`) while the vertical play is entirely interior.
 *
 * Each block therefore owns the same three-piece kit:
 *   - a `floorHoles` entry punching the upper deck open over the stairwell,
 *   - a `kind: "stairs"` ramp whose step footprint sits INSIDE that hole, so the
 *     climb emerges through the shaft instead of into the deck underside,
 *   - doors on at least two different sides. There is no navmesh — enemies steer
 *     straight at the player and get pushed out of walls — so a single entrance
 *     would just pile the horde against a blank facade.
 *
 * Obstacles are hand-kept clear of every building footprint: structure walls are
 * emitted as game-side geometry rather than `ArenaObstacle`s, so the validator's
 * obstacle-overlap pass never sees them.
 */
const WARREN_BLOCKS: ArenaMap = {
  id: "warren-blocks",
  loreId: "hollowlanes",
  front: "lane",
  name: "Warren Blocks",
  subtitle: "Hollow Lanes housing stacks — clear them floor by floor",
  icon: "bone",
  accent: "#cdbfae",
  biomeId: "bone",
  bounds: { kind: "rect", minX: -56, maxX: 56, minZ: -48, maxZ: 48 },
  themeOverrides: {
    // 112x96 puts the corner-to-corner sightline at ~147.5m, which the bone
    // preset's 150m fogFar clears by only 2.5m. Push it out so the far wall
    // reads as distance rather than as the edge of the fog volume.
    fogFar: 168,
    accentA: { x: -38, z: -32 },
    accentB: { x: 38, z: 32 },
  },
  materials: HOLLOWLANES.materials,
  environment: {
    skyTop: 0x0b0b0c,
    skyHorizon: 0x241f1b,
    horizonHaze: 0xcdbfae,
    horizonOpacity: 0.14,
    // Silhouettes sit wholly outside +-56 / +-48; any overlap with the play
    // rect is an opaque wall standing across the fight (#35).
    silhouettes: [
      { x: -70, z: -20, w: 8, h: 20, d: 6, color: 0x1d1b19, emissive: 0x2a2622, opacity: 0.88 },
      { x: -72, z: 24, w: 10, h: 16, d: 6, color: 0x191817, emissive: 0x232019, opacity: 0.9 },
      { x: 70, z: -26, w: 8, h: 22, d: 6, color: 0x1c1a18, emissive: 0x2b2723, opacity: 0.88 },
      { x: 72, z: 22, w: 12, h: 14, d: 6, color: 0x1a1917, emissive: 0x262220, opacity: 0.86 },
      { x: 0, z: -60, w: 30, h: 12, d: 6, color: 0x181716, emissive: 0x211e1b, opacity: 0.84 },
      { x: -12, z: 62, w: 26, h: 10, d: 6, color: 0x191816, emissive: 0x231f1c, opacity: 0.82 },
    ],
    decals: [
      { x: 0, z: 10, w: 14, d: 12, texture: "arena-hollowlanes-decal", color: 0xe9e3d6, opacity: 0.24 },
      {
        x: -30,
        z: -8,
        w: 10,
        d: 14,
        texture: "arena-hollowlanes-decal",
        color: 0xcdbfae,
        opacity: 0.22,
        rotation: 1.57,
      },
      { x: 28, z: 24, w: 12, d: 10, texture: "arena-hollowlanes-decal", color: 0xb9ab98, opacity: 0.2, rotation: -0.4 },
      { x: -6, z: -46, w: 18, d: 8, texture: "arena-hollowlanes-decal", color: 0xe9e3d6, opacity: 0.18 },
      {
        x: 44,
        z: -32,
        w: 10,
        d: 10,
        texture: "arena-hollowlanes-decal",
        color: 0xcdbfae,
        opacity: 0.22,
        rotation: 0.6,
      },
    ],
    props: [
      { x: -48, z: -40, w: 4.6, h: 7.4, texture: "arena-hollowlanes-prop", color: 0xf6efe2, opacity: 0.84 },
      { x: 48, z: 40, w: 4.6, h: 7.4, texture: "arena-hollowlanes-prop", color: 0xcdbfae, opacity: 0.84 },
      { x: -50, z: 14, w: 4.3, h: 7, texture: "arena-hollowlanes-prop", color: 0xb9ab98, opacity: 0.82 },
      { x: 50, z: -14, w: 4.3, h: 7, texture: "arena-hollowlanes-prop", color: 0xf6efe2, opacity: 0.82 },
      { x: 6, z: -12, w: 4.1, h: 6.8, texture: "arena-hollowlanes-prop", color: 0xcdbfae, opacity: 0.8 },
    ],
  },
  spawn: { x: 4, z: 42 },
  obstacles: [],
  levels: [{ id: "warren-upper", y: 3.4, name: "Warren Upper Floors" }],
  rooms: [
    {
      id: "north-warren",
      name: "North Warren",
      bounds: { kind: "rect", minX: -56, maxX: 56, minZ: -48, maxZ: -12 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: 20, z: -34, w: 5, h: 3, d: 5, mat: "crate" },
        { x: 34, z: -40, w: 4, h: 3, d: 4, mat: "crate" },
        { x: -46, z: -30, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 2, z: -24, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: -18, z: -16, w: 14, h: 1.2, d: 2.4, mat: "wall" },
      ],
    },
    {
      id: "warren-plaza",
      name: "Warren Plaza",
      bounds: { kind: "rect", minX: -56, maxX: 56, minZ: -12, maxZ: 16 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: -30, z: 0, w: 6, h: 1.2, d: 2.4, mat: "wall" },
        { x: -8, z: 8, w: 4, h: 3, d: 4, mat: "crate" },
        { x: 4, z: -6, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 46, z: 10, w: 5, h: 3, d: 5, mat: "crate" },
        { x: 30, z: 12, w: 12, h: 1.2, d: 2.4, mat: "wall" },
      ],
    },
    {
      id: "south-warren",
      name: "South Warren",
      bounds: { kind: "rect", minX: -56, maxX: 56, minZ: 16, maxZ: 48 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: 16, z: 30, w: 5, h: 3, d: 5, mat: "crate" },
        { x: 34, z: 38, w: 4, h: 3, d: 4, mat: "crate" },
        { x: -44, z: 28, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 8, z: 20, w: 14, h: 1.2, d: 2.4, mat: "wall" },
        { x: -14, z: 46, w: 10, h: 1.2, d: 2.4, mat: "wall" },
      ],
    },
  ],
  // One flight per block. Each `from`/`to` pair runs 9m for the 3.4m storey
  // rise and its stepped footprint is contained by that block's floor hole.
  ramps: [
    {
      id: "hab-north-stairs",
      kind: "stairs",
      from: { x: -31.6, z: -26.5 },
      to: { x: -31.6, z: -35.5 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "warren-upper",
    },
    {
      id: "hab-east-stairs",
      kind: "stairs",
      from: { x: 37.2, z: -3.5 },
      to: { x: 37.2, z: -12.5 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "warren-upper",
    },
    {
      id: "hab-south-stairs",
      kind: "stairs",
      from: { x: -23.6, z: 36.5 },
      to: { x: -23.6, z: 27.5 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "warren-upper",
    },
  ],
  structures: [
    {
      id: "hab-north",
      name: "North Habitat Block",
      bounds: { kind: "rect", minX: -34, maxX: -10, minZ: -40, maxZ: -22 },
      levelIds: [GROUND_LEVEL_ID, "warren-upper"],
      roof: true,
      floorHoles: [{ id: "hab-north-shaft", x: -31.6, z: -31, w: 3.2, d: 10, levelId: "warren-upper" }],
      openings: [
        { id: "hab-north-door-s", kind: "door", side: "south", offset: 6, width: 2.2, height: 2.4 },
        { id: "hab-north-door-n", kind: "door", side: "north", offset: -6, width: 2.2, height: 2.4 },
        { id: "hab-north-door-e", kind: "door", side: "east", offset: -4, width: 2.2, height: 2.4 },
        { id: "hab-north-win-s", kind: "window", side: "south", offset: -7, width: 1.8, height: 1.3, glazed: true },
        { id: "hab-north-win-w", kind: "window", side: "west", offset: 5, width: 1.8, height: 1.3, glazed: true },
        // Upper-storey glass is placed off the stairwell footprint so every pane
        // has deck under it to vault onto.
        {
          id: "hab-north-up-s1",
          kind: "window",
          side: "south",
          levelId: "warren-upper",
          offset: 6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-north-up-s2",
          kind: "window",
          side: "south",
          levelId: "warren-upper",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-north-up-e",
          kind: "window",
          side: "east",
          levelId: "warren-upper",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-north-up-n",
          kind: "window",
          side: "north",
          levelId: "warren-upper",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-north-up-w",
          kind: "window",
          side: "west",
          levelId: "warren-upper",
          offset: 7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
    {
      id: "hab-east",
      name: "East Habitat Block",
      bounds: { kind: "rect", minX: 14, maxX: 40, minZ: -18, maxZ: 2 },
      levelIds: [GROUND_LEVEL_ID, "warren-upper"],
      roof: true,
      floorHoles: [{ id: "hab-east-shaft", x: 37.2, z: -8, w: 3.2, d: 10, levelId: "warren-upper" }],
      openings: [
        { id: "hab-east-door-w", kind: "door", side: "west", offset: 4, width: 2.2, height: 2.4 },
        { id: "hab-east-door-n", kind: "door", side: "north", offset: -6, width: 2.2, height: 2.4 },
        { id: "hab-east-door-s", kind: "door", side: "south", offset: 7, width: 2.2, height: 2.4 },
        { id: "hab-east-win-w", kind: "window", side: "west", offset: -5, width: 1.8, height: 1.3, glazed: true },
        { id: "hab-east-win-n", kind: "window", side: "north", offset: 7, width: 1.8, height: 1.3, glazed: true },
        {
          id: "hab-east-up-w1",
          kind: "window",
          side: "west",
          levelId: "warren-upper",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-east-up-w2",
          kind: "window",
          side: "west",
          levelId: "warren-upper",
          offset: 7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-east-up-n",
          kind: "window",
          side: "north",
          levelId: "warren-upper",
          offset: -8,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-east-up-s1",
          kind: "window",
          side: "south",
          levelId: "warren-upper",
          offset: -8,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-east-up-s2",
          kind: "window",
          side: "south",
          levelId: "warren-upper",
          offset: 6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-east-up-e",
          kind: "window",
          side: "east",
          levelId: "warren-upper",
          offset: 6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
    {
      id: "hab-south",
      name: "South Habitat Block",
      bounds: { kind: "rect", minX: -26, maxX: -2, minZ: 22, maxZ: 42 },
      levelIds: [GROUND_LEVEL_ID, "warren-upper"],
      roof: true,
      floorHoles: [{ id: "hab-south-shaft", x: -23.6, z: 32, w: 3.2, d: 10, levelId: "warren-upper" }],
      openings: [
        { id: "hab-south-door-n", kind: "door", side: "north", offset: 5, width: 2.2, height: 2.4 },
        { id: "hab-south-door-e", kind: "door", side: "east", offset: -6, width: 2.2, height: 2.4 },
        { id: "hab-south-door-w", kind: "door", side: "west", offset: 6, width: 2.2, height: 2.4 },
        { id: "hab-south-win-n", kind: "window", side: "north", offset: -7, width: 1.8, height: 1.3, glazed: true },
        { id: "hab-south-win-e", kind: "window", side: "east", offset: 6, width: 1.8, height: 1.3, glazed: true },
        {
          id: "hab-south-up-n1",
          kind: "window",
          side: "north",
          levelId: "warren-upper",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-south-up-n2",
          kind: "window",
          side: "north",
          levelId: "warren-upper",
          offset: 8,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-south-up-s",
          kind: "window",
          side: "south",
          levelId: "warren-upper",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-south-up-e",
          kind: "window",
          side: "east",
          levelId: "warren-upper",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "hab-south-up-w",
          kind: "window",
          side: "west",
          levelId: "warren-upper",
          offset: -7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
  ],
  anchors: [
    { kind: "playerSpawn", id: "warren-spawn", x: 4, z: 42, levelId: GROUND_LEVEL_ID, roomId: "south-warren" },
    {
      kind: "breachSpawn",
      id: "warren-north-breach",
      x: 0,
      z: -44,
      levelId: GROUND_LEVEL_ID,
      roomId: "north-warren",
      laneId: "north",
    },
    {
      kind: "breachSpawn",
      id: "warren-east-breach",
      x: 50,
      z: -6,
      levelId: GROUND_LEVEL_ID,
      roomId: "warren-plaza",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "warren-west-breach",
      x: -50,
      z: 4,
      levelId: GROUND_LEVEL_ID,
      roomId: "warren-plaza",
      laneId: "west",
    },
    // Held in the open plaza on purpose: an objective sealed inside a block
    // would let the player camp a doorway the horde cannot open.
    { kind: "objective", id: "warren-node", x: 0, z: -8, levelId: GROUND_LEVEL_ID, roomId: "warren-plaza" },
  ],
};

// ----------------------------------------------------------------------------

/**
 * Cinder Stacks — the three-storey climb.
 *
 * Same interior-vertical idea as {@link WARREN_BLOCKS}, taken one level higher:
 * the central tower stacks ground -> `stack-mid` -> `stack-top`, and the two
 * annexes stop at `stack-mid`. The tower's two shafts sit on OPPOSITE corners,
 * so reaching the top floor means crossing the mid deck under fire rather than
 * running a single stairwell straight up.
 *
 * `storeyHeight: 3.6` matches the authored level spacing on every structure —
 * `structureStoreys` derives each storey's height from the gap to the next
 * level and only falls back to this value for the topmost one, so leaving it at
 * the 3.4m default would give the tower's top floor a shorter ceiling than the
 * two below it.
 */
const CINDER_STACKS: ArenaMap = {
  id: "cinder-stacks",
  loreId: "ashgate",
  front: "holdout",
  name: "Cinder Stacks",
  subtitle: "Ashgate tenement spine — take the tower or lose the yard",
  icon: "foundry",
  accent: "#ff6a00",
  biomeId: "foundry",
  bounds: { kind: "rect", minX: -48, maxX: 48, minZ: -44, maxZ: 44 },
  themeOverrides: {
    // 96x88 -> ~130.2m diagonal, inside the foundry preset's 165m fogFar.
    // Only the accent lights move, out to the yard corners the tower shadows.
    accentA: { x: -34, z: -28 },
    accentB: { x: 34, z: 28 },
  },
  materials: ASHGATE.materials,
  environment: {
    skyTop: 0x0a0605,
    skyHorizon: 0x2a1309,
    horizonHaze: 0xff6a00,
    horizonOpacity: 0.18,
    silhouettes: [
      { x: -62, z: -18, w: 8, h: 24, d: 6, color: 0x241713, emissive: 0x3a1507, opacity: 0.88 },
      { x: -64, z: 22, w: 10, h: 18, d: 6, color: 0x1b1513, emissive: 0x281006, opacity: 0.9 },
      { x: 62, z: -24, w: 8, h: 22, d: 6, color: 0x201614, emissive: 0x351307, opacity: 0.88 },
      { x: 64, z: 20, w: 12, h: 16, d: 6, color: 0x241610, emissive: 0x4a1b08, opacity: 0.86 },
      { x: -6, z: -56, w: 28, h: 14, d: 6, color: 0x1d1310, emissive: 0x2a0f06, opacity: 0.84 },
      { x: 10, z: 58, w: 24, h: 12, d: 6, color: 0x1f1411, emissive: 0x2f1207, opacity: 0.82 },
    ],
    decals: [
      { x: 0, z: 22, w: 12, d: 10, texture: "arena-ashgate-decal", color: 0xff8a3c, opacity: 0.26, rotation: 0.3 },
      { x: -26, z: -6, w: 10, d: 12, texture: "arena-ashgate-decal", color: 0xff6a00, opacity: 0.22, rotation: -0.5 },
      { x: 32, z: 6, w: 12, d: 9, texture: "arena-ashgate-decal", color: 0xb89274, opacity: 0.2, rotation: 0.9 },
      { x: -4, z: -38, w: 16, d: 8, texture: "arena-ashgate-decal", color: 0xff8a3c, opacity: 0.18 },
      { x: 36, z: -38, w: 9, d: 9, texture: "arena-ashgate-decal", color: 0xc1121f, opacity: 0.22, rotation: -0.8 },
    ],
    props: [
      { x: -44, z: -30, w: 5.2, h: 8.4, texture: "arena-ashgate-prop", color: 0xff8a3c, opacity: 0.85 },
      { x: 44, z: 32, w: 5.2, h: 8.4, texture: "arena-ashgate-prop", color: 0xff6a00, opacity: 0.85 },
      { x: -46, z: 40, w: 4.3, h: 7, texture: "arena-ashgate-prop", color: 0xb89274, opacity: 0.82 },
      { x: 46, z: -40, w: 4.3, h: 7, texture: "arena-ashgate-prop", color: 0xff8a3c, opacity: 0.82 },
      { x: 16, z: -6, w: 4.1, h: 6.8, texture: "arena-ashgate-prop", color: 0xb89274, opacity: 0.8 },
    ],
  },
  spawn: { x: -38, z: -38 },
  obstacles: [],
  levels: [
    { id: "stack-mid", y: 3.6, name: "Stack Mid Deck" },
    { id: "stack-top", y: 7.2, name: "Stack Top Deck" },
  ],
  rooms: [
    {
      id: "stack-west",
      name: "West Stacks",
      bounds: { kind: "rect", minX: -48, maxX: 0, minZ: -44, maxZ: 44 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: -30, z: -32, w: 5, h: 3, d: 5, mat: "crate" },
        { x: -42, z: -10, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: -20, z: 34, w: 14, h: 1.2, d: 2.4, mat: "wall" },
        { x: -8, z: -34, w: 4, h: 3, d: 4, mat: "crate" },
        { x: -44, z: 34, w: 4, h: 3, d: 4, mat: "crate" },
      ],
    },
    {
      id: "stack-east",
      name: "East Stacks",
      bounds: { kind: "rect", minX: 0, maxX: 48, minZ: -44, maxZ: 44 },
      levelId: GROUND_LEVEL_ID,
      obstacles: [
        { x: 30, z: 8, w: 5, h: 3, d: 5, mat: "crate" },
        { x: 42, z: -2, w: 2.4, h: 6, d: 2.4, mat: "pillar" },
        { x: 18, z: 30, w: 14, h: 1.2, d: 2.4, mat: "wall" },
        { x: 8, z: -36, w: 4, h: 3, d: 4, mat: "crate" },
        { x: 40, z: 30, w: 5, h: 3, d: 5, mat: "crate" },
      ],
    },
  ],
  ramps: [
    // Tower: ground -> mid on the north-west shaft, mid -> top on the
    // south-east one. Both step footprints are contained by their floor hole.
    {
      id: "tower-stairs-lower",
      kind: "stairs",
      from: { x: -11.2, z: -3.9 },
      to: { x: -11.2, z: -12.9 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "stack-mid",
    },
    {
      id: "tower-stairs-upper",
      kind: "stairs",
      from: { x: 11.2, z: 1.5 },
      to: { x: 11.2, z: 10.5 },
      width: 3,
      steps: 12,
      fromLevelId: "stack-mid",
      toLevelId: "stack-top",
    },
    {
      id: "annex-west-stairs",
      kind: "stairs",
      from: { x: -37.4, z: 20.5 },
      to: { x: -37.4, z: 11.5 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "stack-mid",
    },
    {
      id: "annex-east-stairs",
      kind: "stairs",
      from: { x: 24.6, z: -16.5 },
      to: { x: 24.6, z: -25.5 },
      width: 3,
      steps: 12,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "stack-mid",
    },
  ],
  structures: [
    {
      id: "cinder-tower",
      name: "Cinder Tower",
      bounds: { kind: "rect", minX: -14, maxX: 14, minZ: -14, maxZ: 12 },
      levelIds: [GROUND_LEVEL_ID, "stack-mid", "stack-top"],
      storeyHeight: 3.6,
      roof: true,
      floorHoles: [
        { id: "tower-shaft-mid", x: -11.2, z: -8.4, w: 3.2, d: 10, levelId: "stack-mid" },
        { id: "tower-shaft-top", x: 11.2, z: 6, w: 3.2, d: 10, levelId: "stack-top" },
      ],
      openings: [
        { id: "tower-door-s", kind: "door", side: "south", offset: 0, width: 2.4, height: 2.6 },
        { id: "tower-door-n", kind: "door", side: "north", offset: -5, width: 2.2, height: 2.6 },
        { id: "tower-door-e", kind: "door", side: "east", offset: 4, width: 2.2, height: 2.6 },
        { id: "tower-door-w", kind: "door", side: "west", offset: 6, width: 2.2, height: 2.6 },
        { id: "tower-win-s1", kind: "window", side: "south", offset: -9, width: 1.8, height: 1.4, glazed: true },
        { id: "tower-win-s2", kind: "window", side: "south", offset: 9, width: 1.8, height: 1.4, glazed: true },
        { id: "tower-win-n", kind: "window", side: "north", offset: 7, width: 1.8, height: 1.4, glazed: true },
        {
          id: "tower-mid-n1",
          kind: "window",
          side: "north",
          levelId: "stack-mid",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-mid-n2",
          kind: "window",
          side: "north",
          levelId: "stack-mid",
          offset: -8,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-mid-s",
          kind: "window",
          side: "south",
          levelId: "stack-mid",
          offset: 6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-mid-e1",
          kind: "window",
          side: "east",
          levelId: "stack-mid",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-mid-e2",
          kind: "window",
          side: "east",
          levelId: "stack-mid",
          offset: 5,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-mid-w",
          kind: "window",
          side: "west",
          levelId: "stack-mid",
          offset: 5,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-top-s1",
          kind: "window",
          side: "south",
          levelId: "stack-top",
          offset: -4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-top-s2",
          kind: "window",
          side: "south",
          levelId: "stack-top",
          offset: 4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-top-n",
          kind: "window",
          side: "north",
          levelId: "stack-top",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-top-w",
          kind: "window",
          side: "west",
          levelId: "stack-top",
          offset: -4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "tower-top-e",
          kind: "window",
          side: "east",
          levelId: "stack-top",
          offset: -8,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
    {
      id: "cinder-annex-west",
      name: "West Annex",
      bounds: { kind: "rect", minX: -40, maxX: -22, minZ: 6, maxZ: 26 },
      levelIds: [GROUND_LEVEL_ID, "stack-mid"],
      storeyHeight: 3.6,
      roof: true,
      floorHoles: [{ id: "annex-west-shaft", x: -37.4, z: 16, w: 3.2, d: 10, levelId: "stack-mid" }],
      openings: [
        { id: "annex-w-door-e", kind: "door", side: "east", offset: -4, width: 2.2, height: 2.6 },
        { id: "annex-w-door-s", kind: "door", side: "south", offset: 5, width: 2.2, height: 2.6 },
        { id: "annex-w-door-n", kind: "door", side: "north", offset: -4, width: 2.2, height: 2.6 },
        { id: "annex-w-win-e", kind: "window", side: "east", offset: 6, width: 1.8, height: 1.4, glazed: true },
        { id: "annex-w-win-s", kind: "window", side: "south", offset: -5, width: 1.8, height: 1.4, glazed: true },
        {
          id: "annex-w-mid-e1",
          kind: "window",
          side: "east",
          levelId: "stack-mid",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-w-mid-e2",
          kind: "window",
          side: "east",
          levelId: "stack-mid",
          offset: -7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-w-mid-s",
          kind: "window",
          side: "south",
          levelId: "stack-mid",
          offset: 4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-w-mid-n",
          kind: "window",
          side: "north",
          levelId: "stack-mid",
          offset: 4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-w-mid-w",
          kind: "window",
          side: "west",
          levelId: "stack-mid",
          offset: -6,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
    {
      id: "cinder-annex-east",
      name: "East Annex",
      bounds: { kind: "rect", minX: 22, maxX: 42, minZ: -30, maxZ: -12 },
      levelIds: [GROUND_LEVEL_ID, "stack-mid"],
      storeyHeight: 3.6,
      roof: true,
      floorHoles: [{ id: "annex-east-shaft", x: 24.6, z: -21, w: 3.2, d: 10, levelId: "stack-mid" }],
      openings: [
        { id: "annex-e-door-s", kind: "door", side: "south", offset: -4, width: 2.2, height: 2.6 },
        { id: "annex-e-door-w", kind: "door", side: "west", offset: 5, width: 2.2, height: 2.6 },
        { id: "annex-e-door-e", kind: "door", side: "east", offset: -5, width: 2.2, height: 2.6 },
        { id: "annex-e-win-n", kind: "window", side: "north", offset: 6, width: 1.8, height: 1.4, glazed: true },
        { id: "annex-e-win-s", kind: "window", side: "south", offset: 7, width: 1.8, height: 1.4, glazed: true },
        {
          id: "annex-e-mid-s1",
          kind: "window",
          side: "south",
          levelId: "stack-mid",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-e-mid-s2",
          kind: "window",
          side: "south",
          levelId: "stack-mid",
          offset: 7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-e-mid-n",
          kind: "window",
          side: "north",
          levelId: "stack-mid",
          offset: 4,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-e-mid-e",
          kind: "window",
          side: "east",
          levelId: "stack-mid",
          offset: 0,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
        {
          id: "annex-e-mid-w",
          kind: "window",
          side: "west",
          levelId: "stack-mid",
          offset: 7,
          width: 1.8,
          height: 1.4,
          glazed: true,
        },
      ],
    },
  ],
  anchors: [
    { kind: "playerSpawn", id: "stacks-spawn", x: -38, z: -38, levelId: GROUND_LEVEL_ID, roomId: "stack-west" },
    {
      kind: "breachSpawn",
      id: "stacks-north-breach",
      x: -4,
      z: -40,
      levelId: GROUND_LEVEL_ID,
      roomId: "stack-west",
      laneId: "north",
    },
    {
      kind: "breachSpawn",
      id: "stacks-east-breach",
      x: 42,
      z: 18,
      levelId: GROUND_LEVEL_ID,
      roomId: "stack-east",
      laneId: "east",
    },
    {
      kind: "breachSpawn",
      id: "stacks-west-breach",
      x: -44,
      z: 16,
      levelId: GROUND_LEVEL_ID,
      roomId: "stack-west",
      laneId: "west",
    },
    { kind: "objective", id: "stacks-node", x: 4, z: 26, levelId: GROUND_LEVEL_ID, roomId: "stack-east" },
  ],
};

// ----------------------------------------------------------------------------

/** Registry normalization entry point: attaches the normalized structural
 *  layout and resolves optional environment/biome authoring into a complete,
 *  non-empty presentation contract. */
function normalizeMap(map: ArenaMap): NormalizedArenaMap {
  const biomeId = map.biomeId ?? DEFAULT_BIOME_ID;
  return {
    ...map,
    biomeId,
    environment: resolveArenaEnvironment(map.environment),
    layout: normalizeArenaLayout<MapObstacle>(map, { defaultBounds: DEFAULT_ARENA_BOUNDS }),
    theme: resolveBiomeTheme(biomeId, map.themeOverrides),
  };
}

/** All campaign maps, keyed by id. */
export const MAPS = {
  ashgate: normalizeMap(ASHGATE),
  hollowlanes: normalizeMap(HOLLOWLANES),
  maw: normalizeMap(MAW),
  perdition: normalizeMap(PERDITION),
} satisfies Record<string, NormalizedArenaMap>;

export type CampaignMapId = keyof typeof MAPS;

export interface JourneyStageDefinition {
  mapId: CampaignMapId;
  /** Authored health scalar for enemies and the breach boss at this depth. */
  difficultyMultiplier: number;
  /** Health restored when entering this stage after clearing the previous one. */
  healOnEnter: number;
}

export interface JourneyDefinition {
  id: string;
  name: string;
  description: string;
  stages: readonly JourneyStageDefinition[];
}

/**
 * Named structured-run journeys. This is the sole source of campaign order and
 * stage escalation; future descents can add a definition without maintaining a
 * parallel order array.
 */
export const JOURNEYS = {
  "perdition-descent": {
    id: "perdition-descent",
    name: "The Perdition Descent",
    description: "Push from Ashgate through the dead lanes and breach throat to Perdition.",
    stages: [
      { mapId: "ashgate", difficultyMultiplier: 1, healOnEnter: 0 },
      {
        mapId: "hollowlanes",
        difficultyMultiplier: 1 + STAGE_DIFFICULTY_STEP,
        healOnEnter: STAGE_CLEAR_HEAL,
      },
      {
        mapId: "maw",
        difficultyMultiplier: 1 + STAGE_DIFFICULTY_STEP * 2,
        healOnEnter: STAGE_CLEAR_HEAL,
      },
      {
        mapId: "perdition",
        difficultyMultiplier: 1 + STAGE_DIFFICULTY_STEP * 3,
        healOnEnter: STAGE_CLEAR_HEAL,
      },
    ],
  },
} as const satisfies Record<string, JourneyDefinition>;

export type JourneyId = keyof typeof JOURNEYS;

export const DEFAULT_JOURNEY_ID: JourneyId = "perdition-descent";
export const DEFAULT_JOURNEY = JOURNEYS[DEFAULT_JOURNEY_ID];

/** Derived map ids for registry checks and consumers that only need order. */
export const DEFAULT_JOURNEY_MAP_IDS: CampaignMapId[] = DEFAULT_JOURNEY.stages.map((stage) => stage.mapId);

/**
 * Shipped Survivors-selectable maps. Campaign maps stay in MAPS so the
 * canonical four-stage sequence remains a separate, closed contract.
 */
export const SURVIVOR_MAPS: Record<string, NormalizedArenaMap> = {
  ...MAPS,
  "foundry-wards": normalizeMap(FOUNDRY_WARDS),
  "breach-primus": normalizeMap(BREACH_PRIMUS),
  "reactor-verge": normalizeMap(REACTOR_VERGE),
  "choir-node": normalizeMap(CHOIR_NODE),
  "warren-blocks": normalizeMap(WARREN_BLOCKS),
  "cinder-stacks": normalizeMap(CINDER_STACKS),
};

/**
 * Sandbox-only maps: dev/e2e-reachable demonstrators that are NOT part of the
 * campaign and NOT in MAPS (so journey/MAPS invariants stay intact).
 * getMap falls through to here, so startSandbox("gantry") resolves a real,
 * normalized map without polluting the campaign registry or its texture-preload
 * list (these reuse a campaign map's material ids — see GANTRY).
 */
export const SANDBOX_MAPS: Record<string, NormalizedArenaMap> = {
  gantry: normalizeMap(GANTRY),
};

const JOURNEY_MAP_ORDER = [
  ...new Set(Object.values(JOURNEYS).flatMap((journey) => journey.stages.map((stage) => stage.mapId))),
];

/** Stable picker order: named-journey maps first, then optional breach arenas. */
export const SURVIVOR_MAP_ORDER: string[] = [
  ...JOURNEY_MAP_ORDER,
  "foundry-wards",
  "breach-primus",
  "reactor-verge",
  "choir-node",
  "warren-blocks",
  "cinder-stacks",
];

/** Default arena for non-structured modes (Survivors / PvP preview / menu). */
export const DEFAULT_MAP_ID = "ashgate";

export function getMap(id: string): NormalizedArenaMap {
  return SURVIVOR_MAPS[id] ?? SANDBOX_MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
}

/** Resolve a saved/requested map id to a real one, falling back to the default. */
export function normalizeMapId(id?: string | null): string {
  return id && SURVIVOR_MAPS[id] ? id : DEFAULT_MAP_ID;
}

/** Build authored stage definitions from `startId` down to the journey's end. */
export function journeyStageSequence(
  startId: string,
  journeyId: JourneyId = DEFAULT_JOURNEY_ID,
): readonly JourneyStageDefinition[] {
  const journey = JOURNEYS[journeyId];
  const start = journey.stages.findIndex((stage) => stage.mapId === startId);
  return start < 0 ? journey.stages : journey.stages.slice(start);
}

/** Build normalized campaign maps from a named journey's authored stages. */
export function campaignSequence(startId: string, journeyId: JourneyId = DEFAULT_JOURNEY_ID): NormalizedArenaMap[] {
  return journeyStageSequence(startId, journeyId).map((stage) => MAPS[stage.mapId]);
}

/** Lightweight metadata for the picker UI (no THREE dependency). */
export interface MapMeta {
  id: string;
  name: string;
  subtitle: string;
  icon: PixelIconId;
  accent: string;
}
export const MAP_PICKER: MapMeta[] = SURVIVOR_MAP_ORDER.map((id) => {
  const m = SURVIVOR_MAPS[id];
  return { id: m.id, name: m.name, subtitle: m.subtitle, icon: m.icon, accent: m.accent };
});

/** Picker list for the dev sandbox: the campaign maps plus the sandbox-only
 *  demonstrators (e.g. The Gantry). Used only for map-switch buttons; the
 *  asset browser derives its registered ids from each map's presentation. */
export const SANDBOX_MAP_PICKER: MapMeta[] = [
  ...MAP_PICKER,
  ...Object.values(SANDBOX_MAPS).map((m) => ({
    id: m.id,
    name: m.name,
    subtitle: m.subtitle,
    icon: m.icon,
    accent: m.accent,
  })),
];

/** Compile-time drift gate: engine MapBounds ⇄ game-kit ArenaBounds must stay mutually
 *  assignable (game-kit duplicates the union to stay engine-free). If either side
 *  changes shape, this line stops compiling. */
export const ARENA_BOUNDS_PARITY: ArenaBounds extends MapBounds
  ? MapBounds extends ArenaBounds
    ? true
    : never
  : never = true;
