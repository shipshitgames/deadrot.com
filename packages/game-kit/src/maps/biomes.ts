// Biome theme presets — the shared-presentation half of the maps module
// (issue #80). The ArenaMap v2 structural schema (./arenaLayout) says WHERE
// things are; a biome says what a place LOOKS like: background, fog range,
// floor/wall/trim tints, and the two accent lights every arena hangs. Maps
// author a `biomeId` (plus optional per-map overrides) instead of a hand-rolled
// theme block, and games resolve it into their own theme type with
// resolveBiomeTheme — so Scourge Survivors, Deadlane, and future games draw
// from one canon-checked palette catalog instead of forking hex soup.
//
// Like the structural schema, this is an engine-graduation candidate: plain
// JSON-serialisable data and one pure function — no THREE, no assets, no UI,
// no DOM. Deadlane can consume it unchanged (its board fog/tints map 1:1 onto
// BiomeTheme).
//
// Canon rules baked into the palettes (see apps/lore/content/Universe/
// Style-Bible.md and Vault-Conventions.md):
// - Toxic-green is RESERVED for the Scourge: only the `rot` biome may carry
//   green-dominant trim/accents.
// - Ember discipline, never neon: trim and accents are embers, alarm lamps,
//   and hot metal — sparing, sourced, desaturated-warm. Do not add saturated
//   signage colours.
// - No cool grades: the Style Bible bans blue/teal washes. Even `cryo` frost
//   reads in bone/ash neutrals, never blue.
// - Coined names (BiomePreset.coined) are provisional until promoted through
//   the lore vault's naming flow (Vault-Conventions.md).

/** One of the two arena accent point-lights a biome prescribes. Positions are
 *  world-space metres (same XZ conventions as ./arenaLayout; Y up). Plain data
 *  — games construct their own THREE.PointLight (or equivalent) from it. */
export interface BiomeAccentLight {
  /** Light colour as a 24-bit hex int (0xRRGGBB). */
  color: number;
  /** World X of the light, metres. */
  x: number;
  /** World Y (height) of the light, metres. */
  y: number;
  /** World Z of the light, metres. */
  z: number;
}

/** A complete arena presentation palette: everything a game needs to dress an
 *  arena's atmosphere (background, fog, surface tints, trim, accent lights).
 *  All colour fields are 24-bit hex ints; fog distances are world metres with
 *  fogNear < fogFar. Obtain instances via resolveBiomeTheme — never mutate a
 *  preset's theme in place. */
export interface BiomeTheme {
  /** Scene background / clear colour (0xRRGGBB). */
  bg: number;
  /** Linear-fog near distance, metres. Always less than fogFar. */
  fogNear: number;
  /** Linear-fog far distance, metres. Always greater than fogNear. */
  fogFar: number;
  /** Floor material tint (0xRRGGBB), multiplied over the floor texture. */
  floorTint: number;
  /** Wall/obstacle material tint (0xRRGGBB), multiplied over the wall texture. */
  wallTint: number;
  /** Trim/emissive accent colour (0xRRGGBB) — ember discipline: sourced glow
   *  (vents, lamps, seams), used sparingly, never as a wash. */
  trim: number;
  /** First accent light (conventionally the −X/−Z corner). */
  accentA: BiomeAccentLight;
  /** Second accent light (conventionally the +X/+Z corner). */
  accentB: BiomeAccentLight;
}

/** Per-map adjustments layered over a biome preset by resolveBiomeTheme. Every
 *  field is optional; omitted fields keep the preset value. Accent overrides
 *  merge PER-FIELD (e.g. `{ accentA: { y: 12 } }` keeps the preset's
 *  color/x/z). Inputs are never mutated and never aliased into the result. */
export interface BiomeThemeOverrides {
  /** Override for BiomeTheme.bg. */
  bg?: number;
  /** Override for BiomeTheme.fogNear. */
  fogNear?: number;
  /** Override for BiomeTheme.fogFar. */
  fogFar?: number;
  /** Override for BiomeTheme.floorTint. */
  floorTint?: number;
  /** Override for BiomeTheme.wallTint. */
  wallTint?: number;
  /** Override for BiomeTheme.trim. */
  trim?: number;
  /** Per-field overrides for BiomeTheme.accentA (unset fields keep the preset's). */
  accentA?: Partial<BiomeAccentLight>;
  /** Per-field overrides for BiomeTheme.accentB (unset fields keep the preset's). */
  accentB?: Partial<BiomeAccentLight>;
}

/** Stable id of a biome preset. Persisted in map data — never rename a member,
 *  only add. Use isBiomeId to narrow untrusted strings. */
export type BiomeId = "foundry" | "bone" | "rot" | "perdition" | "cinderwell" | "cryo";

/** A catalog entry: identity + canon notes + the palette + material direction. */
export interface BiomePreset {
  /** The preset's stable id; always equals its key in BIOMES. */
  id: BiomeId;
  /** Short display name for pickers/tooling. Non-empty. */
  name: string;
  /** One-or-two-sentence canon framing of the biome. Non-empty. */
  description: string;
  /** True when the biome NAME is newly coined rather than canon-anchored —
   *  provisional until promoted through the lore vault's naming flow (see
   *  apps/lore/content/Universe/Vault-Conventions.md). Omitted = canon. */
  coined?: boolean;
  /** The complete presentation palette games resolve via resolveBiomeTheme. */
  theme: BiomeTheme;
  /** Material/texture direction for asset work and prop dressing. Non-empty;
   *  prose hints, not asset ids. */
  materialHints: readonly string[];
}

/** All biome ids, in catalog order (= BIOMES key order). Frozen. */
export const BIOME_IDS: readonly BiomeId[] = Object.freeze([
  "foundry",
  "bone",
  "rot",
  "perdition",
  "cinderwell",
  "cryo",
] as const);

/** Deep-freeze a preset so the catalog is immutable at runtime — consumers get
 *  fresh objects from resolveBiomeTheme, never the preset itself. */
function freezePreset(preset: BiomePreset): BiomePreset {
  Object.freeze(preset.theme.accentA);
  Object.freeze(preset.theme.accentB);
  Object.freeze(preset.theme);
  Object.freeze(preset.materialHints);
  return Object.freeze(preset);
}

/** The biome preset catalog, keyed by BiomeId (key order matches BIOME_IDS).
 *  Deep-frozen — treat as read-only reference data; resolve themes with
 *  resolveBiomeTheme. The foundry/bone/rot/perdition palettes are the exact
 *  values previously authored inline on the shipped scourge-survivors maps
 *  (visual-parity contract: resolving them must be bit-identical to the old
 *  theme blocks). */
export const BIOMES: Record<BiomeId, BiomePreset> = Object.freeze({
  foundry: freezePreset({
    id: "foundry",
    name: "Foundry",
    description:
      "Ashgate Foundry Wards — scorched industrial gunmetal under ember light, the war economy still radiating heat.",
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
    materialHints: ["scorched riveted gunmetal", "slag", "ember vents", "soot"],
  }),
  bone: freezePreset({
    id: "bone",
    name: "Bone",
    description:
      "The dead Hollow Lanes — bleached rubble and dust in bone/ash neutrals, derived from the palette tokens.",
    theme: {
      bg: 0x181818,
      fogNear: 30,
      fogFar: 150,
      floorTint: 0xd4c8b7,
      wallTint: 0xc4b8a6,
      trim: 0xcdbfae,
      accentA: { color: 0xcdbfae, x: -26, y: 9, z: -26 },
      accentB: { color: 0x9b958a, x: 26, y: 9, z: 26 },
    },
    materialHints: ["cracked basalt", "dead concrete", "dust", "faded bone stencils", "chitin-crusted asphalt"],
  }),
  rot: freezePreset({
    id: "rot",
    name: "Rot",
    description:
      "Active Scourge infestation — chitin and rupture seams lit by the toxic-green that belongs to this biome alone.",
    /** Canon: toxic-green trim/accents are RESERVED for rot. For a
     *  flesh-forward Rothulk-style variant, keep this preset and apply per-map
     *  overrides (floorTint 0x7a4a44, wallTint 0x63403c). */
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
    materialHints: ["chitin", "wet rupture seams", "tendril mesh", "toxic-green node specks"],
  }),
  perdition: freezePreset({
    id: "perdition",
    name: "Perdition",
    description: "Deep-breach flesh-throat — ribbed wet growth and blood emissive where no rock is left.",
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
    materialHints: ["ribbed wet flesh-growth", "blood emissive", "growth with no rock left"],
  }),
  cinderwell: freezePreset({
    id: "cinderwell",
    name: "Cinderwell",
    description:
      "The Cinder Wells' hazard decks — desaturated amber over machine oil, alarm red used sparingly per Warden hazard grammar.",
    theme: {
      bg: 0x130a06,
      fogNear: 32,
      fogFar: 160,
      floorTint: 0x9c9285,
      wallTint: 0x857b6e,
      trim: 0xd9a521,
      accentA: { color: 0xff2a18, x: -26, y: 9, z: -26 },
      accentB: { color: 0xd9a521, x: 26, y: 9, z: 26 },
    },
    materialHints: [
      "induction stacks",
      "slag exchangers",
      "warning stripes",
      "copper and ceramic cells",
      "machine oil",
    ],
  }),
  cryo: freezePreset({
    id: "cryo",
    name: "Cryo",
    description:
      "Frost-locked wreckage — hoarfrost over iron in bone/ash neutrals; canon places frost only orbitally near the Skyhook, so the name is provisional.",
    /** Coined name — provisional until promoted (Vault-Conventions.md). NO
     *  blue/teal: the Style Bible bans cool grades; frost here reads in
     *  bone/ash neutrals. */
    coined: true,
    theme: {
      bg: 0x0f0f11,
      fogNear: 30,
      fogFar: 150,
      floorTint: 0xdadad4,
      wallTint: 0xc2c2ba,
      trim: 0xe9e3d6,
      accentA: { color: 0xe9e3d6, x: -26, y: 9, z: -26 },
      accentB: { color: 0x9b958a, x: 26, y: 9, z: 26 },
    },
    materialHints: ["hoarfrost-rimmed iron", "rime over gunmetal", "frozen debris", "bone-white frost"],
  }),
});

/** The biome maps fall back to when none is authored: "foundry". */
export const DEFAULT_BIOME_ID: BiomeId = "foundry";

/** Type guard: true iff `id` is a member of BIOME_IDS. Use to narrow persisted
 *  or user-supplied strings before indexing BIOMES. */
export function isBiomeId(id: string): id is BiomeId {
  return (BIOME_IDS as readonly string[]).includes(id);
}

/** Resolve a biome id (+ optional per-map overrides) into a concrete
 *  BiomeTheme. Pure, deterministic, non-mutating — safe on deep-frozen
 *  overrides — and ALWAYS returns fresh objects (a fresh theme with fresh
 *  accentA/accentB), never aliasing the preset or the overrides. Scalar
 *  overrides replace the preset value; accent overrides merge per-field.
 *  @throws TypeError when `biomeId` is not a known BiomeId. */
export function resolveBiomeTheme(biomeId: string, overrides?: BiomeThemeOverrides): BiomeTheme {
  if (!isBiomeId(biomeId)) {
    throw new TypeError(`resolveBiomeTheme: unknown biome id "${biomeId}"`);
  }
  const base = BIOMES[biomeId].theme;
  return {
    bg: overrides?.bg ?? base.bg,
    fogNear: overrides?.fogNear ?? base.fogNear,
    fogFar: overrides?.fogFar ?? base.fogFar,
    floorTint: overrides?.floorTint ?? base.floorTint,
    wallTint: overrides?.wallTint ?? base.wallTint,
    trim: overrides?.trim ?? base.trim,
    accentA: mergeAccent(base.accentA, overrides?.accentA),
    accentB: mergeAccent(base.accentB, overrides?.accentB),
  };
}

/** Per-field accent merge into a FRESH object (never aliases either input);
 *  explicit-undefined override fields fall back to the base, same as omitted. */
function mergeAccent(base: BiomeAccentLight, override?: Partial<BiomeAccentLight>): BiomeAccentLight {
  return {
    color: override?.color ?? base.color,
    x: override?.x ?? base.x,
    y: override?.y ?? base.y,
    z: override?.z ?? base.z,
  };
}
