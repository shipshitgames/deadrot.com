import { expect, test } from "@playwright/test";

type DevGame = {
  ctx: { status: string };
  sys: {
    gameOver: { gameOver: (outcome: "win" | "dead") => void };
  };
};

test.describe("breach-drop cinematics", () => {
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

  test("bookends a run with skippable intro and overrun beats", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /play a run/i }).click();
    await page.getByRole("button", { name: /choose breach site/i }).click();
    await page.getByRole("button", { name: /^play a run$/i }).click();

    const intro = page.getByTestId("cinematic-intro");
    await expect(intro).toBeVisible();
    await expect(intro).toContainText("Descend. Cauterize. Return if able.");
    await page.keyboard.press("Space");
    await expect(intro).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __fpsGame: DevGame }).__fpsGame.ctx.status))
      .toBe("pointerlock-needed");

    await page.evaluate(() => {
      (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.gameOver.gameOver("dead");
    });

    const overrun = page.getByTestId("cinematic-overrun");
    await expect(overrun).toBeVisible();
    await expect(overrun).toContainText("Operator overrun.");
    await expect(page.getByTestId("cinematic-extract")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(overrun).toBeHidden();
    await expect(page.getByTestId("gameover-summary")).toBeVisible();
  });
});
