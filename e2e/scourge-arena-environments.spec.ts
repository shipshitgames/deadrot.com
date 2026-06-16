import { expect, type Page, test } from "@playwright/test";

// Root-harness deep spec (#34): proves Scourge Survivors actually RENDERS each
// campaign arena's environment dressing — not just that the data exists (the
// unit tests cover the data). Runs on desktop + Pixel-7 mobile via the shared
// game-matrix projects. Mobile-safe: it never waits on wall-clock sim time, only
// on startSandbox() rebuilding the arena (synchronous), so the frame-throttled
// mobile shard can't time out.

interface ArenaDebugSnapshot {
  mapId: string;
  biomeId: string;
  materialIds: { floor: string; wall: string; block: string; column: string };
  environmentObjectCount: number;
  silhouetteCount: number;
  decalCount: number;
  propCount: number;
  theme: unknown | null;
}

interface HudSnapshot {
  sandbox: boolean;
  mapName: string;
}

// Every shipped (campaign) map, with the human-readable name the HUD reports.
const CAMPAIGN_MAPS = [
  { id: "ashgate", name: "Ashgate" },
  { id: "hollowlanes", name: "The Hollow Lanes" },
  { id: "maw", name: "The Maw" },
  { id: "perdition", name: "Perdition" },
] as const;

async function arenaSnapshot(page: Page): Promise<ArenaDebugSnapshot> {
  return page.evaluate(() =>
    (
      window as unknown as { __fpsGame: { arenaDebugSnapshot: () => ArenaDebugSnapshot } }
    ).__fpsGame.arenaDebugSnapshot(),
  );
}

async function hudSnapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

test("Scourge campaign arenas render their full environment dressing", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-only arena-environment regression.");

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  // Broken-asset guard: a failed image/texture request means a map booted with
  // missing dressing. Scoped to asset requests so unrelated dev sockets (HMR,
  // partykit) can't flake the assertion.
  const failedAssets: string[] = [];
  page.on("requestfailed", (request) => {
    const url = request.url();
    const isAsset = request.resourceType() === "image" || /\.(webp|png|jpe?g|avif|ktx2|basis)(\?|$)/i.test(url);
    if (isAsset) failedAssets.push(`${request.failure()?.errorText ?? "failed"} ${url}`);
  });

  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await expect(page.getByTestId("game-canvas")).toBeVisible();

  for (const map of CAMPAIGN_MAPS) {
    const mapId = map.id;
    await page.evaluate((id) => {
      (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(id);
    }, mapId);

    // Poll mapId first — startSandbox rebuilds the arena and a rebuild races the
    // snapshot. Once the requested map is live, the dressing counts are final.
    await expect.poll(() => arenaSnapshot(page).then((s) => s.mapId)).toBe(mapId);

    // Map identity is readable both ways: the HUD reports the human-readable
    // name and the sandbox run is live on it.
    const hud = await hudSnapshot(page);
    expect(hud.sandbox, `${mapId} sandbox active`).toBe(true);
    expect(hud.mapName, `${mapId} map name`).toBe(map.name);

    const snap = await arenaSnapshot(page);
    expect(snap.silhouetteCount, `${mapId} silhouettes`).toBeGreaterThanOrEqual(3);
    expect(snap.decalCount, `${mapId} decals`).toBeGreaterThanOrEqual(3);
    expect(snap.propCount, `${mapId} props`).toBeGreaterThanOrEqual(4);
    // Live scene = 3 sky-dome meshes (sky + haze + horizon) plus every
    // silhouette, decal and prop actually mounted. Proves the renderer built
    // them, not merely that the map data declares them.
    expect(snap.environmentObjectCount, `${mapId} environment objects`).toBe(
      3 + snap.silhouetteCount + snap.decalCount + snap.propCount,
    );
    // Per-map authored materials are live, not the default fallback set.
    expect(snap.materialIds.floor, `${mapId} floor material`).toBe(`arena-${mapId}-floor`);
    expect(snap.materialIds.wall, `${mapId} wall material`).toBe(`arena-${mapId}-wall`);
    expect(snap.materialIds.block, `${mapId} block material`).toBe(`arena-${mapId}-block`);
    expect(snap.materialIds.column, `${mapId} column material`).toBe(`arena-${mapId}-column`);
    // The biome theme was read back off the live scene (null until dressed).
    expect(snap.theme, `${mapId} live theme`).not.toBeNull();
    expect(snap.biomeId, `${mapId} biomeId`).toBeTruthy();
  }

  expect(failedAssets, "no broken arena asset requests").toEqual([]);
  expect(consoleErrors, "no console/page errors").toEqual([]);
});
