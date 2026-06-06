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
// All maps share the fixed 80x80 footprint (ARENA_HALF = 40) and the four
// boundary walls — only the INTERIOR obstacle layout and the visual theme
// differ. The picker lets the player choose a starting point along the descent
// (the rest follow, wrapping).
//
// Palette is canon DOOM (see DESIGN.md / Style-Bible): blood + fire + metal +
// bone, no neon. Toxic-green is reserved for the Scourge only.
//
// Layouts were generated + geometrically validated by a multi-agent design
// pass (no out-of-bounds boxes, no overlaps/slivers, clear player spawns).

import type { PixelIconId } from "../../assets/ui/pixelIcons";

export type ObstacleMat = "crate" | "pillar" | "wall";

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

export interface MapLight {
  color: number;
  x: number;
  y: number;
  z: number;
}

export interface MapTheme {
  bg: number; // scene background + fog colour
  fogNear: number;
  fogFar: number;
  floorTint: number; // multiplied over the floor texture
  wallTint: number; // multiplied over walls + obstacle textures
  trim: number; // emissive neon edge colour
  accentA: MapLight; // two coloured rim lights
  accentB: MapLight;
}

export interface ArenaMap {
  id: string;
  loreId: string; // canonical lore note id (see apps/lore/content/Locations + apps/lore/content/Maps.md)
  front: "holdout" | "lane" | "breach" | "orbital" | "hulk"; // war-front classification
  name: string;
  subtitle: string;
  icon: PixelIconId;
  accent: string; // css hex for the picker card border / glow
  theme: MapTheme;
  spawn: { x: number; z: number }; // player start (faces the arena centre)
  obstacles: MapObstacle[];
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
  theme: {
    bg: 0x160d08,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0xc9a98a,
    wallTint: 0xb89274,
    trim: 0xff6a00,
    accentA: { color: 0xff6a00, x: -26, y: 8, z: -26 },
    accentB: { color: 0xff8a3c, x: 26, y: 9, z: 26 },
  },
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
// junction chokepoints. Desaturated bone/gunmetal grey — dead, lightless, no neon.
// ============================================================================
const HOLLOWLANES: ArenaMap = {
  id: "hollowlanes",
  loreId: "hollowlanes",
  front: "lane",
  name: "The Hollow Lanes",
  subtitle: "Dead corridors between the holdouts",
  icon: "bone",
  accent: "#cdbfae",
  theme: {
    bg: 0x121214,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0x9b958a,
    wallTint: 0x8a857c,
    trim: 0xcdbfae,
    accentA: { color: 0xcdbfae, x: -26, y: 9, z: -26 },
    accentB: { color: 0x9b958a, x: 26, y: 9, z: 26 },
  },
  spawn: { x: 0, z: -33 },
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
  theme: {
    bg: 0x0a0f08,
    fogNear: 38,
    fogFar: 175,
    floorTint: 0x6b7a5a,
    wallTint: 0x5a6b4a,
    trim: 0x6acf3c,
    accentA: { color: 0x8bdc1f, x: -26, y: 9, z: -26 },
    accentB: { color: 0x6acf3c, x: 26, y: 9, z: 26 },
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
  theme: {
    bg: 0x1a0408,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0x9a5560,
    wallTint: 0x86424e,
    trim: 0xc1121f,
    accentA: { color: 0xc1121f, x: -26, y: 9, z: -26 },
    accentB: { color: 0xff2a18, x: 26, y: 8, z: 26 },
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

// ----------------------------------------------------------------------------

/** All campaign maps, keyed by id. */
export const MAPS: Record<string, ArenaMap> = {
  ashgate: ASHGATE,
  hollowlanes: HOLLOWLANES,
  maw: MAW,
  perdition: PERDITION,
};

/**
 * Canonical campaign order — the canon descent into the breach:
 * Ashgate → The Hollow Lanes → The Maw → Perdition.
 */
export const CAMPAIGN_ORDER: string[] = ["ashgate", "hollowlanes", "maw", "perdition"];

/** Default arena for non-campaign modes (Survivors / Multiplayer / menu). */
export const DEFAULT_MAP_ID = "ashgate";

export function getMap(id: string): ArenaMap {
  return MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
}

/**
 * Build the campaign stage sequence starting from `startId`: that map first,
 * then the remaining maps in canonical order (wrapping around).
 */
export function campaignSequence(startId: string): ArenaMap[] {
  const start = CAMPAIGN_ORDER.indexOf(startId);
  const order = start < 0 ? CAMPAIGN_ORDER : [...CAMPAIGN_ORDER.slice(start), ...CAMPAIGN_ORDER.slice(0, start)];
  return order.map((id) => MAPS[id]);
}

/** Lightweight metadata for the picker UI (no THREE dependency). */
export interface MapMeta {
  id: string;
  name: string;
  subtitle: string;
  icon: PixelIconId;
  accent: string;
}
export const MAP_PICKER: MapMeta[] = CAMPAIGN_ORDER.map((id) => {
  const m = MAPS[id];
  return { id: m.id, name: m.name, subtitle: m.subtitle, icon: m.icon, accent: m.accent };
});
