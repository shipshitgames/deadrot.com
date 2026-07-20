import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "@shipshitgames/assets/games/scourge-survivors/assets.json";
import { describe, expect, it } from "vitest";
import { DEFAULT_ARENA_MATERIALS, MAPS, SANDBOX_MAPS } from "../../src/game/data/maps";

// Sibling coverage to assets-manifest.test.ts's campaign material/dressing test:
// that test already validates default-journey maps' material ids, decal/prop
// texture existence and the minimum dressing counts. This file fills the gaps it
// leaves — the SANDBOX_MAPS demonstrators (e.g. The Gantry), the
// DEFAULT_ARENA_MATERIALS fallback set, and the numeric validity of every map's
// authored sky/colour data (campaign + sandbox). No assertion here duplicates
// the campaign material/dressing-count test.

const assetsRoot = fileURLToPath(new URL("../../../../../packages/assets/", import.meta.url));
const textureIds = new Set(Object.keys(manifest.textures));

function expectTextureOnDisk(id: string, label: string) {
  expect(textureIds.has(id), `${label} texture ${id}`).toBe(true);
  const path = manifest.textures[id as keyof typeof manifest.textures].path;
  const fullPath = join(assetsRoot, path);
  expect(existsSync(fullPath), path).toBe(true);
  expect(statSync(fullPath).size, path).toBeGreaterThan(0);
}

function expectHexColor(value: number, label: string) {
  expect(Number.isInteger(value), `${label} is an integer`).toBe(true);
  expect(value, `${label} >= 0`).toBeGreaterThanOrEqual(0);
  expect(value, `${label} <= 0xffffff`).toBeLessThanOrEqual(0xffffff);
}

function expectUnitInterval(value: number, label: string) {
  expect(value, `${label} >= 0`).toBeGreaterThanOrEqual(0);
  expect(value, `${label} <= 1`).toBeLessThanOrEqual(1);
}

const allMaps = { ...MAPS, ...SANDBOX_MAPS };

describe("arena environment integrity", () => {
  it("backs every sandbox map's materials and dressing with real textures on disk", () => {
    // SANDBOX_MAPS (e.g. The Gantry) are reachable via startSandbox() but skipped
    // by the campaign-only test; they reuse a campaign map's texture ids, so a
    // missing asset would still surface as a broken sandbox arena.
    for (const [mapId, map] of Object.entries(SANDBOX_MAPS)) {
      for (const id of Object.values(map.materials)) expectTextureOnDisk(id, `${mapId} material`);
      for (const decal of map.environment.decals) expectTextureOnDisk(decal.texture, `${mapId} decal`);
      for (const prop of map.environment.props) expectTextureOnDisk(prop.texture, `${mapId} prop`);
    }
  });

  it("backs the default material fallback set with real textures on disk", () => {
    // ArenaSystem.debugSnapshot falls back to DEFAULT_ARENA_MATERIALS when a map
    // omits materials; keep those ids resolvable so the fallback never 404s.
    for (const id of Object.values(DEFAULT_ARENA_MATERIALS)) expectTextureOnDisk(id, "default material");
  });

  it("authors valid sky, haze and dressing colours for every map", () => {
    for (const [mapId, map] of Object.entries(allMaps)) {
      const env = map.environment;
      expectHexColor(env.skyTop, `${mapId} skyTop`);
      expectHexColor(env.skyHorizon, `${mapId} skyHorizon`);
      expectHexColor(env.horizonHaze, `${mapId} horizonHaze`);
      expectUnitInterval(env.horizonOpacity, `${mapId} horizonOpacity`);

      for (const [i, s] of env.silhouettes.entries()) {
        expectHexColor(s.color, `${mapId} silhouette[${i}].color`);
        if (s.emissive !== undefined) expectHexColor(s.emissive, `${mapId} silhouette[${i}].emissive`);
        if (s.opacity !== undefined) expectUnitInterval(s.opacity, `${mapId} silhouette[${i}].opacity`);
      }
      for (const [i, d] of env.decals.entries()) {
        if (d.color !== undefined) expectHexColor(d.color, `${mapId} decal[${i}].color`);
        if (d.opacity !== undefined) expectUnitInterval(d.opacity, `${mapId} decal[${i}].opacity`);
      }
      for (const [i, p] of env.props.entries()) {
        if (p.color !== undefined) expectHexColor(p.color, `${mapId} prop[${i}].color`);
        if (p.opacity !== undefined) expectUnitInterval(p.opacity, `${mapId} prop[${i}].opacity`);
      }
    }
  });
});
