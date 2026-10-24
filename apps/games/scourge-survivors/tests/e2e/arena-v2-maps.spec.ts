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
  /** Building floor decks + roofs; 0 for maps that author no structures. */
  deckBoxes: number;
  /** Populated only when the current map carries a normalized v2 layout — the
   *  honest proof that MAPS routed the map through normalizeArenaLayout. */
  layout: {
    rooms: number;
    levels: number;
    ramps: number;
    platforms: number;
    structures: number;
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

async function playerPosition(page: Page): Promise<{ x: number; z: number }> {
  return page.evaluate(() => {
    const position = (window as unknown as { __fpsGame: { ctx: { body: { position: { x: number; z: number } } } } })
      .__fpsGame.ctx.body.position;
    return { x: position.x, z: position.z };
  });
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
        structures: 0,
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
      expect(result.deckBoxes, `${result.mapId} deckBoxes`).toBe(0);
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
      structures: 0,
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
    // walkable surface: solidMeshes = 4 walls + obstacles + surfaces + decks.
    // Gantry authors no buildings, so the deck term is 0 here — spelled out so
    // the invariant stays honest on maps that do.
    expect(result.deckBoxes).toBe(0);
    expect(result.surfaceBoxes + result.deckBoxes).toBe(result.solidMeshes - 4 - result.layout!.flattenedObstacles);
    // All geometry is still shootable.
    expect(result.raycastTargets).toBe(result.solidMeshes);

    expect(consoleErrors).toEqual([]);
  });

  test("boots the oversized Foundry Wards beyond the legacy 80x80 clamp", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
    await expect(page.getByTestId("game-canvas")).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(
        "foundry-wards",
      );
    });

    await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe("foundry-wards");
    await expect.poll(() => snapshot(page).then((state) => state.mapName)).toBe("Foundry Wards");
    expect((await arenaSnapshot(page)).bounds).toEqual({ minX: -72, maxX: 72, minZ: -56, maxZ: 56 });

    await page.evaluate(() => {
      type DevGame = { ctx: { status: string }; sys: { hud: { emit: () => void } } };
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.ctx.status = "playing";
      game.sys.hud.emit();
    });
    await expect.poll(() => gameTime(page)).toBeGreaterThan(0);

    // The authored spawn is 22m beyond the old -40 wall. A hardcoded legacy
    // clamp would snap it back on the first simulation tick.
    await expect.poll(() => playerPosition(page).then((position) => position.x)).toBeLessThan(-55);
    await expect.poll(() => playerPosition(page).then((position) => Math.abs(position.z))).toBeLessThan(0.5);

    const result = await arenaSnapshot(page);
    expect(result.layout).toEqual({
      rooms: 2,
      levels: 1,
      ramps: 0,
      platforms: 0,
      structures: 0,
      flattenedObstacles: 11,
      anchors: { playerSpawn: 1, breachSpawn: 2, objective: 1, extraction: 0 },
    });
    expect(consoleErrors).toEqual([]);
  });

  // The two building maps are the first shipped layouts that author `structures`,
  // so they are the only place the deck/surface split is exercised end to end:
  // every map above asserts `deckBoxes === 0`.
  const buildingMaps = [
    {
      id: "warren-blocks",
      name: "Warren Blocks",
      bounds: { minX: -56, maxX: 56, minZ: -48, maxZ: 48 },
      layout: {
        rooms: 3,
        levels: 2,
        ramps: 3,
        platforms: 0,
        structures: 3,
        flattenedObstacles: 15,
        anchors: { playerSpawn: 1, breachSpawn: 3, objective: 1, extraction: 0 },
      },
    },
    {
      id: "cinder-stacks",
      name: "Cinder Stacks",
      bounds: { minX: -48, maxX: 48, minZ: -44, maxZ: 44 },
      layout: {
        rooms: 2,
        levels: 3,
        ramps: 4,
        platforms: 0,
        structures: 3,
        flattenedObstacles: 10,
        anchors: { playerSpawn: 1, breachSpawn: 3, objective: 1, extraction: 0 },
      },
    },
  ] as const;

  for (const map of buildingMaps) {
    test(`boots ${map.name} with enterable, multi-storey buildings`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(String(error)));

      await page.goto("/?sandbox=1");
      await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
      await expect(page.getByTestId("game-canvas")).toBeVisible();

      await page.evaluate((id) => {
        (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(id);
      }, map.id);

      await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe(map.id);
      await expect.poll(() => snapshot(page).then((state) => state.mapName)).toBe(map.name);

      await page.evaluate(() => {
        type DevGame = { ctx: { status: string }; sys: { hud: { emit: () => void } } };
        const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
        game.ctx.status = "playing";
        game.sys.hud.emit();
      });
      await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
      await expect.poll(() => gameTime(page)).toBeGreaterThan(0);

      const result = await arenaSnapshot(page);
      expect(result.layout).toEqual(map.layout);
      expect(result.bounds).toEqual(map.bounds);

      // Buildings were actually expanded into geometry: floor decks and roofs
      // land in the deck set (step-clamped, multi-valued per x/z) rather than the
      // surface set, stair treads in the walkable surface set, and the wall
      // segments in the player-blocking set — which therefore has to exceed the
      // authored obstacle count, since those walls plus the closed door and
      // window panes are all colliders no room ever declared.
      expect(result.deckBoxes).toBeGreaterThan(0);
      expect(result.surfaceBoxes).toBeGreaterThan(0);
      expect(result.obstacleBoxes).toBeGreaterThan(result.layout!.flattenedObstacles);

      // solidMeshes = 4 boundary walls + obstacle meshes + surfaces + decks +
      // building wall segments. The gantry pins that identity exactly because it
      // builds no walls; here the inequality is strict, and the slack IS the
      // wall count.
      expect(result.solidMeshes).toBeGreaterThan(
        4 + result.layout!.flattenedObstacles + result.surfaceBoxes + result.deckBoxes,
      );

      // Door and window panes are shootable but are NOT arena solids — they move
      // as the panel swings, so they go straight to raycastTargets and stay out
      // of solidMeshes (which feeds the camera-boom colliders). The excess here
      // is exactly the openable leaf count, and it proves the shatter path in
      // WeaponSystem has something to hit.
      expect(result.raycastTargets).toBeGreaterThan(result.solidMeshes);

      expect(consoleErrors).toEqual([]);
    });
  }
});
