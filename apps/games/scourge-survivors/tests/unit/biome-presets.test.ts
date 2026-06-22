// Biome theme presets (issue #80): maps author a `biomeId` (+ optional
// `themeOverrides`) and the MAPS registry resolves the concrete theme at
// module load via @deadrot/game-kit/maps. This suite pins (a) the map→biome
// assignments, (b) the registry resolution invariant, (c) VISUAL PARITY — the
// resolved themes must be value-identical to the theme blocks the four maps
// authored inline before the refactor (hard-coded literals below, copied from
// the pre-#80 maps.ts in git history), and (d) the canon toxic-green
// reservation at the map level.

import { type BiomeId, isBiomeId, resolveBiomeTheme } from "@deadrot/game-kit/maps";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_ORDER, campaignSequence, getMap, MAPS, type MapTheme } from "../../src/game/data/maps";

/** The exact theme blocks the four maps authored inline before the biome
 *  refactor — the presets must reproduce them bit-identically. */
const PRE_REFACTOR_THEMES: Record<string, MapTheme> = {
  ashgate: {
    bg: 0x160d08,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0xc9a98a,
    wallTint: 0xb89274,
    trim: 0xff6a00,
    accentA: { color: 0xff6a00, x: -26, y: 8, z: -26 },
    accentB: { color: 0xff8a3c, x: 26, y: 9, z: 26 },
  },
  hollowlanes: {
    bg: 0x181818,
    fogNear: 30,
    fogFar: 150,
    floorTint: 0xd4c8b7,
    wallTint: 0xc4b8a6,
    trim: 0xcdbfae,
    accentA: { color: 0xcdbfae, x: -26, y: 9, z: -26 },
    accentB: { color: 0x9b958a, x: 26, y: 9, z: 26 },
  },
  maw: {
    bg: 0x0a0f08,
    fogNear: 38,
    fogFar: 175,
    floorTint: 0x6b7a5a,
    wallTint: 0x5a6b4a,
    trim: 0x6acf3c,
    accentA: { color: 0x8bdc1f, x: -26, y: 9, z: -26 },
    accentB: { color: 0x6acf3c, x: 26, y: 9, z: 26 },
  },
  perdition: {
    bg: 0x1a0408,
    fogNear: 34,
    fogFar: 165,
    floorTint: 0x9a5560,
    wallTint: 0x86424e,
    trim: 0xc1121f,
    accentA: { color: 0xc1121f, x: -26, y: 9, z: -26 },
    accentB: { color: 0xff2a18, x: 26, y: 8, z: 26 },
  },
};

/** The pinned map→biome assignment shipped by #80. */
const EXPECTED_BIOME_BY_MAP: Record<string, BiomeId> = {
  ashgate: "foundry",
  hollowlanes: "bone",
  maw: "rot",
  perdition: "perdition",
};

function channels(hex: number): { r: number; g: number; b: number } {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function isGreenDominant(hex: number): boolean {
  const { r, g, b } = channels(hex);
  return g > 1.2 * r && g > 1.2 * b;
}

describe("biome theme presets (#80)", () => {
  it("gives every map a valid biomeId with the pinned map→biome assignment", () => {
    expect(Object.keys(MAPS).sort()).toEqual(Object.keys(EXPECTED_BIOME_BY_MAP).sort());
    for (const [mapId, map] of Object.entries(MAPS)) {
      expect(isBiomeId(map.biomeId), `${mapId} biomeId "${map.biomeId}"`).toBe(true);
      expect(map.biomeId, `${mapId} biome assignment`).toBe(EXPECTED_BIOME_BY_MAP[mapId]);
    }
  });

  it("resolves every registry theme exactly as resolveBiomeTheme(biomeId, themeOverrides)", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      expect(getMap(mapId).theme, `${mapId} registry resolution`).toEqual(
        resolveBiomeTheme(map.biomeId, map.themeOverrides),
      );
    }
  });

  it("authors no themeOverrides on the four shipped maps (presets carry the exact palettes)", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      expect(map.themeOverrides, `${mapId} overrides`).toBeUndefined();
    }
  });

  it("VISUAL PARITY: resolved themes are value-identical to the pre-refactor authored blocks", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      expect(getMap(mapId).theme, `${mapId} pre-refactor parity`).toEqual(PRE_REFACTOR_THEMES[mapId]);
    }
  });

  it("reserves green-dominant trim for the rot biome alone (canon toxic-green rule)", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      expect(isGreenDominant(map.theme.trim), `${mapId} (${map.biomeId}) trim green-dominance`).toBe(
        map.biomeId === "rot",
      );
    }
    // The rule is non-vacuous: exactly one shipped map carries the rot biome.
    expect(Object.values(MAPS).filter((m) => m.biomeId === "rot")).toHaveLength(1);
  });

  it("hands out a resolved theme on every map from MAPS, getMap, and campaignSequence", () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      expect(map.theme, `MAPS[${mapId}].theme`).toBeDefined();
      expect(getMap(mapId).theme, `getMap(${mapId}).theme`).toBeDefined();
    }
    for (const startId of CAMPAIGN_ORDER) {
      for (const map of campaignSequence(startId)) {
        expect(map.theme, `campaignSequence(${startId}) → ${map.id}.theme`).toBeDefined();
      }
    }
  });
});
