import { expect, type Page, test } from "@playwright/test";

type HudSnapshot = {
  status: string;
  sandbox: boolean;
  mapName: string;
};

type ArenaDebugSnapshot = {
  mapId: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  solidMeshes: number;
  raycastTargets: number;
  /** Collider AABBs (non-elevated obstacles → push-out). */
  obstacleBoxes: number;
  /** Raised walkable AABBs (v2 room floors + platforms + ramp steps); 0 for flat maps. */
  surfaceBoxes: number;
  /** Populated only when the current map carries a normalized v2 layout — the
   *  honest proof that MAPS routed the map through normalizeArenaLayout. */
  layout: {
    rooms: number;
    levels: number;
    ramps: number;
    platforms: number;
    flattenedObstacles: number;
    anchors: { playerSpawn: number; breachSpawn: number; objective: number; extraction: number };
  } | null;
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

async function gameTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __fpsGame: { ctx: { time: number } } }).__fpsGame.ctx.time);
}

test.describe("arena v2 map layouts", () => {
  test("boots every campaign map through the v2 normalize adapter into a playing run", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
    await expect(page.getByTestId("game-canvas")).toBeVisible();

    const maps = [
      { id: "ashgate", name: "Ashgate" },
      { id: "hollowlanes", name: "The Hollow Lanes" },
      { id: "maw", name: "The Maw" },
      { id: "perdition", name: "Perdition" },
    ] as const;

    const results: ArenaDebugSnapshot[] = [];
    for (const map of maps) {
      await page.evaluate((id) => {
        (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(id);
      }, map.id);

      // Boot: the sandbox run is live on the requested map (poll mapId before
      // reading any other arena fields — rebuilds race the snapshot).
      await expect.poll(() => snapshot(page).then((state) => state.sandbox)).toBe(true);
      await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe(map.id);
      await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("pointerlock-needed");
      await expect.poll(() => snapshot(page).then((state) => state.mapName)).toBe(map.name);

      // Playing: flip past the pointer-lock gate the way the live-input spec
      // does, then prove the simulation loop is actually ticking on this map
      // (startSandbox resets ctx.time to 0; it only advances while playing).
      await page.evaluate(() => {
        type DevGame = { ctx: { status: string }; sys: { hud: { emit: () => void } } };
        const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
        game.ctx.status = "playing";
        game.sys.hud.emit();
      });
      await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
      await expect.poll(() => gameTime(page)).toBeGreaterThan(0);

      results.push(await arenaSnapshot(page));
    }

    for (const result of results) {
      // The layout block is null unless this map flowed through
      // normalizeArenaLayout at registry load: exactly one synthesized root
      // room and ground level, one playerSpawn lifted from the v1 spawn, no
      // authored ramps/platforms/breach anchors, and the flattened room
      // obstacles matching the built geometry (solidMeshes = 4 boundary walls
      // + one mesh per obstacle).
      expect(result.layout, `${result.mapId} layout`).toEqual({
        rooms: 1,
        levels: 1,
        ramps: 0,
        platforms: 0,
        flattenedObstacles: result.solidMeshes - 4,
        anchors: { playerSpawn: 1, breachSpawn: 0, objective: 0, extraction: 0 },
      });
      // Backward-compat invariants survive the adapter untouched.
      expect(result.bounds, `${result.mapId} bounds`).toEqual({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 });
      expect(result.solidMeshes, `${result.mapId} solidMeshes`).toBeGreaterThan(4);
      expect(result.raycastTargets, `${result.mapId} raycastTargets`).toBe(result.solidMeshes);
      // Flat v1 maps build ZERO raised surfaces — the #82 collider split adds no
      // walkable geometry. Colliders are the non-elevated obstacles, so they never
      // exceed the flattened obstacle count (some maps mark decals as `elevated`).
      expect(result.surfaceBoxes, `${result.mapId} surfaceBoxes`).toBe(0);
      expect(result.obstacleBoxes, `${result.mapId} obstacleBoxes`).toBeLessThanOrEqual(result.solidMeshes - 4);
      expect(result.obstacleBoxes, `${result.mapId} obstacleBoxes`).toBeGreaterThan(0);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("boots the structural sandbox map (The Gantry) with walkable raised geometry", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
    await expect(page.getByTestId("game-canvas")).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox("gantry");
    });

    // Boot the sandbox run on the gantry (poll mapId before reading geometry).
    await expect.poll(() => snapshot(page).then((state) => state.sandbox)).toBe(true);
    await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe("gantry");
    await expect.poll(() => snapshot(page).then((state) => state.mapName)).toBe("The Gantry");

    // Drive past the pointer-lock gate and prove the sim ticks on this map.
    await page.evaluate(() => {
      type DevGame = { ctx: { status: string }; sys: { hud: { emit: () => void } } };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.ctx.status = "playing";
      game.sys.hud.emit();
    });
    await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
    await expect.poll(() => gameTime(page)).toBeGreaterThan(0);

    const result = await arenaSnapshot(page);

    // The structural layout flowed through normalizeArenaLayout: two rooms, the
    // raised mezzanine level, a climbable ramp, two platforms, and the authored
    // breach mouths + objective (no v1-style synthesized single room).
    expect(result.layout).toEqual({
      rooms: 2,
      levels: 2,
      ramps: 1,
      platforms: 2,
      flattenedObstacles: 8,
      anchors: { playerSpawn: 1, breachSpawn: 3, objective: 1, extraction: 0 },
    });
    // Standard arena footprint, reused from the default bounds.
    expect(result.bounds).toEqual({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 });

    // Raised geometry was actually built AND routed to the walkable surface set
    // (room slab + platforms + ramp steps), not the collider set. The collider
    // count still matches the 8 authored obstacles.
    expect(result.surfaceBoxes).toBeGreaterThan(0);
    expect(result.obstacleBoxes).toBe(result.layout?.flattenedObstacles);
    expect(result.solidMeshes).toBeGreaterThan(result.layout!.flattenedObstacles + 4);
    // Every solid mesh beyond the 4 walls and the obstacle meshes is a raised
    // walkable surface: solidMeshes = 4 walls + obstacles + surfaces.
    expect(result.surfaceBoxes).toBe(result.solidMeshes - 4 - result.layout!.flattenedObstacles);
    // All geometry is still shootable.
    expect(result.raycastTargets).toBe(result.solidMeshes);

    expect(consoleErrors).toEqual([]);
  });
});
