import { expect, type Page, test } from "@playwright/test";

type HudSnapshot = {
  status: string;
  sandbox: boolean;
  weapon: string;
  ammo: number;
  enemiesAlive: number;
  damageBoost: number;
  berserk: number;
  berserkFrac: number;
  dualWeapon: number;
  ads: boolean;
  adsZoom: number;
  adsZoomLevels: number;
};

type AnimationSample = {
  kind: "boss" | "flying" | "melee" | "ranged";
  frame: number;
  src: string;
  state: string;
};

type ArenaDebugSnapshot = {
  mapId: string;
  materialIds: Record<"floor" | "wall" | "block" | "column", string>;
  environmentObjectCount: number;
  silhouetteCount: number;
  decalCount: number;
  propCount: number;
  solidMeshes: number;
  raycastTargets: number;
  obstacleBoxes: number;
};

type HudPanelSample = {
  selector: string;
  visible: boolean;
  maxBackgroundAlpha: number;
  borderLeftWidth: number;
  borderRightWidth: number;
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
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

async function stageActiveSurvivorsHud(page: Page) {
  await page.evaluate(() => {
    type DevGame = {
      startSurvivors: (classId?: "heavy") => void;
      ctx: {
        aliveCount: number;
        combo: number;
        damageBoostTimer: number;
        dualWeaponTimer: number;
        headshots: number;
        kills: number;
        score: number;
        statArmor: number;
        statDodge: number;
        statGrace: number;
        statShield: number;
        statShieldMax: number;
        status: string;
        time: number;
      };
      sys: {
        hud: { emit: () => void };
        survivors: {
          evolved: { orbit: boolean; bolt: boolean; nova: boolean };
          level: number;
          upgradeLevels: Record<string, number>;
          xp: number;
          xpToNext: number;
        };
      };
    };

    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.startSurvivors("heavy");
    game.ctx.status = "playing";
    game.ctx.time = 93;
    game.ctx.score = 12_500;
    game.ctx.kills = 42;
    game.ctx.headshots = 8;
    game.ctx.aliveCount = 26;
    game.ctx.combo = 9;
    game.ctx.statShieldMax = 48;
    game.ctx.statShield = 32;
    game.ctx.statArmor = 0.28;
    game.ctx.statDodge = 0.18;
    game.ctx.statGrace = 1.6;
    game.ctx.damageBoostTimer = 6;
    game.ctx.dualWeaponTimer = 8;
    game.sys.survivors.level = 6;
    game.sys.survivors.xp = 18;
    game.sys.survivors.xpToNext = 42;
    game.sys.survivors.upgradeLevels = { orbit: 2, bolt: 1, armor: 2, ward: 1, dodge: 1, grace: 1 };
    game.sys.survivors.evolved = { orbit: true, bolt: false, nova: false };
    game.sys.hud.emit();
  });

  await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
}

async function sampleHudPanels(page: Page, selectors: string[]): Promise<HudPanelSample[]> {
  return page.evaluate((panelSelectors) => {
    function maxAlpha(value: string) {
      const matches = [...value.matchAll(/rgba?\(([^)]*)\)/g)];
      let max = 0;
      for (const match of matches) {
        const parts = (match[1] ?? "").split(",").map((part) => part.trim());
        const alpha = parts.length >= 4 ? Number(parts[3]) : 1;
        if (Number.isFinite(alpha)) max = Math.max(max, alpha);
      }
      return max;
    }

    return panelSelectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return {
          selector,
          visible: false,
          maxBackgroundAlpha: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
        };
      }
      const styles = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        visible: rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none",
        maxBackgroundAlpha: maxAlpha(`${styles.backgroundColor} ${styles.backgroundImage}`),
        borderLeftWidth: Number.parseFloat(styles.borderLeftWidth),
        borderRightWidth: Number.parseFloat(styles.borderRightWidth),
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      };
    });
  }, selectors);
}

function overlaps(a: HudPanelSample, b: HudPanelSample) {
  return (
    a.rect.left < b.rect.right && a.rect.right > b.rect.left && a.rect.top < b.rect.bottom && a.rect.bottom > b.rect.top
  );
}

test.describe("dev sandbox smoke", () => {
  test("loads runtime visual/audio assets and fires each gun", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await expect(page.getByText("Scourge Labs")).toBeVisible();
    await expect(page.getByTestId("game-canvas")).toBeVisible();
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    expect(await snapshot(page)).toMatchObject({
      status: "pointerlock-needed",
      sandbox: true,
    });

    const brokenImages = await page.$$eval("img", (images) =>
      images
        .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
        .map((img) => img.currentSrc || img.src),
    );
    expect(brokenImages).toEqual([]);

    await page.getByRole("button", { name: /runtime assets/i }).click();

    const assetLabels = await page
      .locator("figcaption")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    expect(assetLabels).toEqual(
      expect.arrayContaining([
        "Pistol",
        "SMG",
        "Shotgun",
        "Cannon",
        "Sniper",
        "Melee front",
        "Melee side",
        "Melee back",
        "Ranged front",
        "Ranged side",
        "Ranged back",
        "Flying front",
        "Flying side",
        "Flying back",
        "Boss front",
        "Boss side",
        "Boss back",
        "Ranger front",
        "Ranger side",
        "Ranger back",
        "Bulwark front",
        "Bulwark side",
        "Bulwark back",
        "Vector front",
        "Vector side",
        "Vector back",
        "Patch front",
        "Patch side",
        "Patch back",
        "Health pickup",
        "Ammo pickup",
        "Damage pickup",
        "Dual pickup",
        "XP ichor",
        "Meat gib",
        "Skull gib",
        "Bone gib",
        "Claw gib",
        "Acid sac gib",
        "Wing gib",
      ]),
    );

    await page.getByRole("button", { name: /^texture$/i }).click();
    const textureLabels = await page
      .locator("figcaption")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    expect(textureLabels).toEqual(
      expect.arrayContaining([
        "Arena floor",
        "Arena wall",
        "Arena column",
        "Arena block",
        "Ashgate floor",
        "Ashgate wall",
        "Ashgate block",
        "Ashgate column",
        "Ashgate decal",
        "Ashgate prop",
        "The Hollow Lanes floor",
        "The Hollow Lanes wall",
        "The Hollow Lanes prop",
        "The Maw floor",
        "The Maw decal",
        "The Maw prop",
        "Perdition floor",
        "Perdition decal",
        "Perdition prop",
      ]),
    );

    await page.getByRole("button", { name: /^audio$/i }).click();
    await expect
      .poll(() => page.$$eval("audio", (nodes) => nodes.map((node) => node.readyState)), { timeout: 15_000 })
      .toEqual([4, 4, 4, 4, 4, 4, 4]);

    const weapons = page.locator("section").filter({ hasText: "Weapons" });
    for (const weapon of ["Pistol", "SMG", "Shotgun", "Cannon", "Sniper"]) {
      await weapons.getByRole("button", { name: new RegExp(`^${weapon}$`, "i") }).click();
      await expect.poll(() => snapshot(page).then((state) => state.weapon)).toBe(weapon);

      const before = await snapshot(page);
      await weapons.getByRole("button", { name: /fire once/i }).click();
      await expect.poll(() => snapshot(page).then((state) => state.ammo)).toBe(before.ammo - 1);
    }

    await page.getByRole("button", { name: /pickups/i }).click();

    const pickups = page.locator("section").filter({ hasText: "Pickups" });
    await expect(pickups.getByRole("button", { name: /^dual$/i })).toBeVisible();
    await pickups.getByRole("button", { name: /^dual$/i }).click();

    await page.getByRole("button", { name: /foes \+ reactions/i }).click();

    const foes = page.locator("section").filter({ hasText: "Foes + Reactions" });
    await expect(foes.getByRole("button", { name: /spawn flying/i })).toBeVisible();
    await foes.getByRole("button", { name: /spawn flying/i }).click();
    await expect.poll(() => snapshot(page).then((state) => state.enemiesAlive)).toBeGreaterThan(0);

    expect(consoleErrors).toEqual([]);
  });

  test("loads authored arena environments for every map without adding collision targets", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const mapIds = ["ashgate", "hollowlanes", "maw", "perdition"] as const;
    const results: ArenaDebugSnapshot[] = [];
    for (const mapId of mapIds) {
      await page.evaluate((id) => {
        (window as unknown as { __fpsGame: { startSandbox: (mapId: string) => void } }).__fpsGame.startSandbox(id);
      }, mapId);
      await expect.poll(() => snapshot(page).then((state) => state.sandbox)).toBe(true);
      await expect.poll(() => arenaSnapshot(page).then((state) => state.mapId)).toBe(mapId);
      results.push(await arenaSnapshot(page));
    }

    for (const result of results) {
      expect(result.materialIds).toMatchObject({
        floor: `arena-${result.mapId}-floor`,
        wall: `arena-${result.mapId}-wall`,
        block: `arena-${result.mapId}-block`,
        column: `arena-${result.mapId}-column`,
      });
      expect(result.environmentObjectCount).toBeGreaterThanOrEqual(8);
      expect(result.silhouetteCount).toBeGreaterThanOrEqual(3);
      expect(result.decalCount).toBeGreaterThanOrEqual(3);
      expect(result.propCount).toBeGreaterThanOrEqual(4);
      expect(result.solidMeshes).toBeGreaterThan(0);
      expect(result.obstacleBoxes).toBeLessThan(result.solidMeshes);
      expect(result.raycastTargets).toBe(result.solidMeshes);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("keeps active gameplay HUD panels light, edge-neutral, and separated", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
    await stageActiveSurvivorsHud(page);

    const styleSelectors = [
      ".scourge-top-stats",
      ".ssg-survivor-runline",
      ".ssg-survivor-xp",
      ".scourge-build-chip",
      ".scourge-berserk-meter",
      ".scourge-dual-weapon",
      ".scourge-health-panel",
      ".scourge-integrity-meta",
      ".scourge-weapon-panel",
    ];
    const desktopSamples = await sampleHudPanels(page, styleSelectors);

    for (const panel of desktopSamples) {
      expect(panel.visible, panel.selector).toBe(true);
      expect(panel.borderLeftWidth, panel.selector).toBeLessThanOrEqual(0.1);
      expect(panel.borderRightWidth, panel.selector).toBeLessThanOrEqual(0.1);
      expect(panel.maxBackgroundAlpha, panel.selector).toBeLessThanOrEqual(0.24);
    }

    await page.setViewportSize({ width: 390, height: 780 });
    const layoutSelectors = [
      ".scourge-top-stats",
      ".ssg-survivor-runline",
      ".ssg-survivor-xp",
      ".scourge-build-strip",
      ".scourge-berserk-meter",
      ".scourge-dual-weapon",
      ".scourge-combo-counter",
      ".scourge-health-panel",
      ".scourge-weapon-panel",
    ];
    const mobileSamples = await sampleHudPanels(page, layoutSelectors);
    const bySelector = Object.fromEntries(mobileSamples.map((panel) => [panel.selector, panel]));

    for (const panel of mobileSamples) {
      expect(panel.visible, panel.selector).toBe(true);
      expect(panel.rect.left, panel.selector).toBeGreaterThanOrEqual(-1);
      expect(panel.rect.right, panel.selector).toBeLessThanOrEqual(391);
    }

    const nonOverlappingPairs = [
      [".scourge-top-stats", ".ssg-survivor-runline"],
      [".ssg-survivor-runline", ".ssg-survivor-xp"],
      [".ssg-survivor-xp", ".scourge-berserk-meter"],
      [".scourge-berserk-meter", ".scourge-build-strip"],
      [".scourge-build-strip", ".scourge-dual-weapon"],
      [".scourge-dual-weapon", ".scourge-combo-counter"],
      [".scourge-health-panel", ".scourge-weapon-panel"],
    ] as const;

    for (const [a, b] of nonOverlappingPairs) {
      expect(overlaps(bySelector[a], bySelector[b]), `${a} overlaps ${b}`).toBe(false);
    }
  });

  test("damage pickup activates a bounded berserk state", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await page.evaluate(() => {
      type DevGame = {
        startSandbox: () => void;
        ctx: {
          status: string;
          damageBoostTimer: number;
        };
        sys: {
          hud: { emit: () => void };
          pickups: { collectPickup: (kind: "damage") => void };
        };
      };

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.startSandbox();
      game.ctx.status = "playing";
      game.sys.pickups.collectPickup("damage");
    });

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(10);
    const active = await snapshot(page);
    expect(active.damageBoost).toBe(10);
    expect(active.berserkFrac).toBeGreaterThan(0.95);
    expect(active.berserkFrac).toBeLessThanOrEqual(1);
    await expect(page.locator(".scourge-berserk-meter").getByText(/BERSERK MODE/i)).toBeVisible();

    await page.evaluate(() => {
      type DevGame = {
        ctx: { damageBoostTimer: number };
        sys: {
          pickups: { collectPickup: (kind: "damage") => void };
        };
      };

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.ctx.damageBoostTimer = 2;
      game.sys.pickups.collectPickup("damage");
    });

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(10);

    await page.evaluate(() => {
      type DevGame = {
        ctx: { damageBoostTimer: number };
        sys: { hud: { emit: () => void } };
      };

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.ctx.damageBoostTimer = 0;
      game.sys.hud.emit();
    });

    await expect.poll(() => snapshot(page).then((state) => state.berserk)).toBe(0);
  });

  test("cycles generated enemy movement and attack frames", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const result = await page.evaluate(async () => {
      type DevEnemy = {
        alive: boolean;
        flying: boolean;
        group: {
          position: {
            x: number;
            z: number;
          };
        };
        isBoss: boolean;
        ranged: boolean;
        spriteAnimationFrame: number;
        spriteAnimationState: string;
        spriteMat: {
          map?: {
            image?: {
              currentSrc?: string;
              src?: string;
            };
          };
        };
        attackAnimationDuration: () => number;
        triggerSpriteAnimation: (animation: "attack", duration: number) => void;
      };
      type DevGame = {
        clearSandboxActors: () => void;
        spawnSandboxEnemy: (kind: "boss" | "flying" | "melee" | "ranged", count?: number) => void;
        startSandbox: () => void;
        ctx: {
          body: {
            position: {
              x: number;
              z: number;
            };
          };
          enemies: DevEnemy[];
          status: string;
        };
      };

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const sample = (): AnimationSample[] =>
        game.ctx.enemies
          .filter((enemy) => enemy.alive)
          .map((enemy) => ({
            kind: enemy.isBoss ? "boss" : enemy.flying ? "flying" : enemy.ranged ? "ranged" : "melee",
            frame: enemy.spriteAnimationFrame,
            src: enemy.spriteMat.map?.image?.currentSrc || enemy.spriteMat.map?.image?.src || "",
            state: enemy.spriteAnimationState,
          }))
          .sort((a, b) => a.kind.localeCompare(b.kind));

      game.startSandbox();
      game.ctx.status = "playing";
      game.clearSandboxActors();
      for (const kind of ["melee", "ranged", "flying", "boss"] as const) {
        game.spawnSandboxEnemy(kind, 1);
      }
      game.ctx.enemies
        .filter((enemy) => enemy.alive)
        .forEach((enemy, index) => {
          enemy.group.position.x = game.ctx.body.position.x + (index - 1.5) * 7;
          enemy.group.position.z = game.ctx.body.position.z - 30;
        });
      game.ctx.status = "playing";

      await wait(240);
      const moveSamples = [sample()];
      for (let index = 0; index < 5; index += 1) {
        await wait(160);
        moveSamples.push(sample());
      }
      const moveA = moveSamples[0] ?? [];
      const moveB = moveSamples[moveSamples.length - 1] ?? [];
      for (const enemy of game.ctx.enemies.filter((enemy) => enemy.alive)) {
        enemy.triggerSpriteAnimation("attack", enemy.attackAnimationDuration());
      }
      await wait(320);
      const attacking = sample();

      return { moveA, moveB, moveSamples, attacking };
    });

    expect(result.moveA.map((sample) => sample.kind)).toEqual(["boss", "flying", "melee", "ranged"]);
    expect(result.moveB.map((sample) => sample.kind)).toEqual(["boss", "flying", "melee", "ranged"]);

    for (const sample of result.moveB) {
      expect(sample.src).toContain("/animations/scourge/");
    }

    for (const kind of ["boss", "flying", "melee", "ranged"] as const) {
      const kindSamples = result.moveSamples.flat().filter((sample) => sample.kind === kind);
      expect(kindSamples.some((sample) => sample.state === "move")).toBe(true);
      const frames = new Set(kindSamples.map((sample) => sample.frame));
      expect(frames.size).toBeGreaterThan(1);
    }

    expect(Object.fromEntries(result.attacking.map((sample) => [sample.kind, sample.src]))).toMatchObject({
      boss: expect.stringContaining("/breach-boss/barrage/"),
      flying: expect.stringContaining("/winged-host/attack/"),
      melee: expect.stringContaining("/host-grunt/slash/"),
      ranged: expect.stringContaining("/spitter-host/spit/"),
    });
    expect(result.attacking.every((sample) => sample.state === "attack")).toBe(true);
  });

  test("uses death animation frames and sprite gibs for enemy kills", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    const result = await page.evaluate(async () => {
      type DevSpriteMaterial = {
        map?: {
          image?: {
            currentSrc?: string;
            src?: string;
          };
        };
      };
      type DevGame = {
        clearSandboxActors: () => void;
        damageSandboxEnemies: (amount: number, headshot?: boolean, all?: boolean) => void;
        spawnSandboxEnemy: (kind: "melee", count?: number) => void;
        startSandbox: () => void;
        ctx: {
          body: {
            position: {
              x: number;
              z: number;
            };
          };
          enemies: Array<{
            alive: boolean;
            group: {
              position: {
                x: number;
                z: number;
              };
            };
          }>;
          status: string;
        };
        sys: {
          fx: {
            corpseParts: Array<{ mesh: { type: string; material: DevSpriteMaterial } }>;
            deathSprites: Array<{ material: DevSpriteMaterial }>;
          };
        };
      };

      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const srcOf = (material?: DevSpriteMaterial) =>
        material?.map?.image?.currentSrc || material?.map?.image?.src || "";

      game.startSandbox();
      game.ctx.status = "playing";
      game.clearSandboxActors();
      game.spawnSandboxEnemy("melee", 1);
      const enemy = game.ctx.enemies.find((candidate) => candidate.alive);
      if (enemy) {
        enemy.group.position.x = game.ctx.body.position.x;
        enemy.group.position.z = game.ctx.body.position.z - 8;
      }
      game.damageSandboxEnemies(-1, true);
      await wait(80);

      return {
        corpseCount: game.sys.fx.corpseParts.length,
        corpseSources: game.sys.fx.corpseParts.map((part) => srcOf(part.mesh.material)),
        corpseTypes: game.sys.fx.corpseParts.map((part) => part.mesh.type),
        deathCount: game.sys.fx.deathSprites.length,
        deathSrc: srcOf(game.sys.fx.deathSprites[0]?.material),
      };
    });

    expect(result.deathCount).toBeGreaterThan(0);
    expect(result.deathSrc).toContain("/animations/scourge/host-grunt/death/");
    expect(result.corpseCount).toBeGreaterThan(0);
    expect(result.corpseTypes.every((type) => type === "Sprite")).toBe(true);
    expect(result.corpseSources.every((src) => src.includes("/fx/gibs/"))).toBe(true);
  });
});
