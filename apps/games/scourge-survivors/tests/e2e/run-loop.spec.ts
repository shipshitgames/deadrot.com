import { expect, type Page, test } from "@playwright/test";

// PRD #242: "one complete run path exists from menu to win/fail summary and
// restart". The pieces are covered elsewhere — cinematics bookend a run, reaper
// asserts both outcomes, survivor specs call restart() directly — but nothing
// walked the loop the way a player does: title screen, breach select, drop,
// death, summary, Play Again, second run, victory. That seam is where the path
// breaks silently (a summary that swallows its own button, a restart that
// leaves the run status stuck), so it gets its own spec.

type DevGame = {
  ctx: { status: string };
  sys: { gameOver: { gameOver: (outcome: "win" | "dead") => void } };
};

/** End the current run from outside, the way reaper/cinematics specs do. */
async function endRun(page: Page, outcome: "win" | "dead") {
  await page.evaluate((o) => {
    (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.gameOver.gameOver(o);
  }, outcome);
}

/** The status the game settles on once a run is live but the mouse is free. */
async function expectRunLive(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __fpsGame: DevGame }).__fpsGame.ctx.status))
    .toBe("pointerlock-needed");
}

test.describe("complete run loop", () => {
  test.beforeEach(async ({ page }) => {
    // Headless Chromium refuses pointer lock; stub it so the run reaches the
    // same states it would for a player who clicked into the canvas.
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

  test("runs menu → death summary → restart → victory summary without leaving the loop", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("PointerLockControls")) consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

    // --- Menu → drop -------------------------------------------------------
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /play a run/i }).click();
    await page.getByRole("button", { name: /choose breach site/i }).click();
    await page.getByRole("button", { name: /^play a run$/i }).click();

    const intro = page.getByTestId("cinematic-intro");
    await expect(intro).toBeVisible();
    await page.keyboard.press("Space");
    await expect(intro).toBeHidden();
    await expectRunLive(page);

    // --- Fail path → summary ----------------------------------------------
    await endRun(page, "dead");
    const overrun = page.getByTestId("cinematic-overrun");
    await expect(overrun).toBeVisible();
    await page.keyboard.press("Enter");

    const summary = page.getByTestId("gameover-summary");
    await expect(summary).toBeVisible();
    // A summary is only a summary if it says how the run went, not just that it
    // ended: which operation, how deep, and the outcome just lived through.
    await expect(page.getByTestId("run-detail-summary")).toBeVisible();
    await expect(page.getByTestId("summary-operation")).toBeVisible();
    await expect(page.getByTestId("summary-depth")).toBeVisible();
    await expect(page.getByTestId("summary-mode")).toContainText("overrun");
    await expect(page.getByTestId("run-metrics")).toBeVisible();

    // --- Restart straight from the summary ---------------------------------
    await page.getByRole("button", { name: /play again/i }).click();
    // Restarting a breach replays its intro, so the second run opens the same
    // way the first did rather than dumping the player mid-drop.
    await expect(intro).toBeVisible();
    await page.keyboard.press("Space");
    await expect(summary).toBeHidden();
    await expectRunLive(page);

    // --- Win path → victory summary ----------------------------------------
    await endRun(page, "win");
    const extract = page.getByTestId("cinematic-extract");
    await expect(extract).toBeVisible();
    await expect(extract).toContainText("Local node severed.");
    await page.keyboard.press("Enter");

    await expect(summary).toBeVisible();
    // Same card, opposite verdict — the summary reads the run, not the template.
    await expect(page.getByTestId("summary-mode")).toContainText("sealed");
    await expect(page.getByTestId("front-report")).toBeVisible();
    // The loop closes: the winning summary offers the same way back in.
    await expect(page.getByRole("button", { name: /play again/i })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
