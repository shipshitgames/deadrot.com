// Biome theme presets (#80): every campaign map resolves its visual theme from
// the shared biome catalog (`@deadrot/game-kit/maps` BIOMES) instead of an
// authored per-map theme block. This spec boots each campaign map in sandbox
// mode and asserts the arena debug snapshot reports the expected biomeId AND
// the exact preset palette — read LIVE from the Three.js scene (scene
// background + fog, floor/wall/trim material tints, accent light colours +
// positions), not echoed from map data. The four campaign maps author no
// themeOverrides, so the live theme must be bit-identical to the preset.

import { expect, type Page, test } from "@playwright/test";

type HudSnapshot = {
  status: string;
  sandbox: boolean;
  mapName: string;
};

type ThemeSnapshot = {
  bg: number;
  fogNear: number;
  fogFar: number;
  floorTint: number;
  wallTint: number;
  trim: number;
  accentA: { color: number; x: number; y: number; z: number };
  accentB: { color: number; x: number; y: number; z: number };
};

type ArenaDebugSnapshot = {
  mapId: string;
  /** Biome the map resolved its theme from (preset id in the game-kit catalog). */
  biomeId: string;
  /** Live scene readback — background/fog/materials/lights, NOT the map data. */
  theme: ThemeSnapshot;
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function arenaSnapshot(page: Page): Promise<ArenaDebugSnapshot> {
  return page.evaluate(() =>
    (
      window as unknown as { __fpsGame: { arenaDebugSnapshot: () => ArenaDebugSnapshot } }
    ).__fpsGame.arenaDebugSnapshot(),
  );
}

// Pinned per-biome preset palettes (game-kit `BIOMES`). These literals are the
// regression contract: the campaign maps carried these exact values as authored
// theme blocks before #80, so the biome wiring must keep the rendered output
// bit-identical.
const EXPECTED = [
  {
    mapId: "ashgate",
    biomeId: "foundry",
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
  },
  {
    mapId: "hollowlanes",
    biomeId: "bone",
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
  },
  {
    mapId: "maw",
    biomeId: "rot",
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
  },
  {
    mapId: "perdition",
    biomeId: "perdition",
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
  },
] as const;

test.describe("biome theme presets (#80)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
        configurable: true,
        value: function requestPointerLock() {},
      });
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: function exitPointerLock() {},
      });
    });
  });

  test("every campaign map drives the live scene from its biome preset", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
    await expect(page.getByTestId("game-canvas")).toBeVisible();

    for (const map of EXPECTED) {
      await page.evaluate((id) => {
        (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(id);
      }, map.mapId);

      // Boot gate: the sandbox run is live on the requested map (poll mapId
      // before reading any other arena fields — rebuilds race the snapshot).
      await expect.poll(() => snapshot(page).then((state) => state.sandbox)).toBe(true);
      await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe(map.mapId);

      const result = await arenaSnapshot(page);
      expect(result.biomeId, `${map.mapId} biomeId`).toBe(map.biomeId);
      // The theme block is read back from the live scene objects (background,
      // fog, MeshStandardMaterial tints, accent lights), so this proves the
      // biome preset actually reached Three.js — not just the data layer.
      expect(result.theme, `${map.mapId} live theme`).toEqual(map.theme);
    }

    expect(consoleErrors).toEqual([]);
  });
});
