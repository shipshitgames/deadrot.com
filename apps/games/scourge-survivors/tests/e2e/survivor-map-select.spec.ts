import { expect, type Page, test } from "@playwright/test";
import { survivorChapterStart } from "../../src/game/data/survivors";

type SurvivorClassId = "ranger" | "heavy" | "scout" | "medic";

type HudSnapshot = {
  survivors: boolean;
  mapName: string;
  survivorChapter: number;
  survivorChapterName: string;
};

type DevGame = {
  startSurvivors: (classId?: SurvivorClassId, mapId?: string) => void;
  sys: {
    hud: { emit: () => void };
    survivors: { survClock: number; updateSurvivors: (delta: number) => void };
  };
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

test.describe("survivor map select (#276)", () => {
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

  test("the picked breach site persists across a chapter advance", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.startSurvivors("ranger", "maw");
      game.sys.hud.emit();
    });

    await expect
      .poll(() => snapshot(page))
      .toMatchObject({
        survivors: true,
        mapName: "The Maw",
        survivorChapter: 1,
      });

    // Jump the run clock past the real first chapter boundary and tick the
    // structured run: the chapter must advance while the arena stays put.
    const secondChapterClock = survivorChapterStart(1) + 5;
    await page.evaluate((clock) => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.sys.survivors.survClock = clock;
      game.sys.survivors.updateSurvivors(0.016);
      game.sys.hud.emit();
    }, secondChapterClock);

    await expect
      .poll(() => snapshot(page))
      .toMatchObject({
        mapName: "The Maw",
        survivorChapter: 2,
      });
  });

  test("a garbage map id falls back to the default arena", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      game.startSurvivors("ranger", "not-a-map");
      game.sys.hud.emit();
    });

    await expect
      .poll(() => snapshot(page))
      .toMatchObject({
        survivors: true,
        mapName: "Ashgate",
      });
  });

  test("title menu reveals the Survivors hub as the default mode", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await expect(page.getByText("Pyre breach hub")).toBeVisible();
    await expect(page.getByText("Drop as a Pyre-operator")).toBeVisible();
    await expect(page.getByText("Pyre operator ready")).toBeVisible();
    await expect(page.getByText(/FPS ARENA/i)).toHaveCount(0);

    await page.keyboard.press("Enter");

    const hub = page.getByRole("navigation", { name: /Survivors hub/i });
    await expect(hub).toBeVisible();
    await expect(hub.getByRole("button", { name: /Play a Run/i })).toContainText(/Structured run/i);
    await expect(hub.getByRole("button", { name: /Shop/i })).toBeVisible();
    await expect(hub.getByRole("button", { name: /PvP Arena/i })).toContainText(
      /Unauthenticated preview · no PvE waves/i,
    );
    await expect(hub.getByRole("button", { name: /Leaderboard/i })).toBeVisible();
    await expect(hub.getByRole("button", { name: /Campaign/i })).toHaveCount(0);
    await expect(hub.getByRole("button", { name: /Multiplayer/i })).toHaveCount(0);
  });

  test("menu flow runs Character Select → Map Select → Run", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    // Reveal the hub menu behind the title splash, then walk the pre-run flow.
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Play a Run/i }).click();
    await expect(page.getByText("Operator Loadout")).toBeVisible();
    await page.getByRole("button", { name: /Choose Breach Site/i }).click();

    await expect(page.locator(".ssg-section-heading", { hasText: "Breach Site" })).toBeVisible();
    await page.getByRole("button", { name: /The Hollow Lanes/i }).click();
    await page.getByRole("button", { name: /^Play a Run$/i }).click();

    await expect
      .poll(() => snapshot(page))
      .toMatchObject({
        survivors: true,
        mapName: "The Hollow Lanes",
        survivorChapter: 1,
      });
  });
});
