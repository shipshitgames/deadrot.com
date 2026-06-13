import { expect, type Page, test } from "@playwright/test";

interface RothulkSnapshot {
  mode: string;
  level: number;
  hp: number;
  lives: number;
  grounded: boolean;
  hero: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
}

test("Rothulk opening platform route is playable with normal held inputs", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("rothulk:"), "Rothulk-only movement regression.");

  await boot(page);
  await page.keyboard.down("KeyD");
  await waitForHeroX(page, 18.2);
  await page.keyboard.down("Space");
  await page.waitForTimeout(480);
  await page.keyboard.up("Space");
  await waitForHeroX(page, 28.5);
  await page.keyboard.up("KeyD");

  const state = await snapshot(page);
  expect(state.mode).toBe("playing");
  expect(state.level).toBe(1);
  expect(state.lives).toBe(3);
  expect(state.hero.x).toBeGreaterThan(28.5);
  expect(state.hero.y).toBeGreaterThan(2.7);
  await expect(page.locator("#hud-obj")).toContainText("REACH");
});

test("Rothulk fatal falls show recovery feedback", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("rothulk:"), "Rothulk-only death-feedback regression.");

  await boot(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __rothulkGame: { debugTeleportTo: (x: number, y: number) => void };
      }
    ).__rothulkGame.debugTeleportTo(22.8, 1.8);
  });
  await expect(page.locator("#toast")).toContainText("PIT FALL", { timeout: 8000 });

  const state = await snapshot(page);
  expect(state.lives).toBeLessThan(3);
});

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.getByText("ROTHULK")).toBeVisible();
  await page.getByText("Press Enter to continue").click();
  await page.getByRole("button", { name: /^Breach\b/i }).click();
  await page.waitForFunction(() => {
    const game = (window as unknown as { __rothulkGame?: { debugSnapshot: () => RothulkSnapshot } }).__rothulkGame;
    return game?.debugSnapshot().mode === "playing";
  });
}

async function snapshot(page: Page): Promise<RothulkSnapshot> {
  return page.evaluate(() => {
    return (
      window as unknown as { __rothulkGame: { debugSnapshot: () => RothulkSnapshot } }
    ).__rothulkGame.debugSnapshot();
  });
}

async function waitForHeroX(page: Page, x: number) {
  await page.waitForFunction((targetX) => {
    const game = (window as unknown as { __rothulkGame?: { debugSnapshot: () => RothulkSnapshot } }).__rothulkGame;
    const state = game?.debugSnapshot();
    return state?.mode === "playing" && state.hero.x >= targetX;
  }, x);
}
