import { expect, type Page, test } from "@playwright/test";

// PRD #242: "a new player can understand what to do within the first 15 seconds
// without reading external docs". Controls otherwise live only behind
// Esc → Controls, which a first-timer has no reason to open, so the first drop
// puts the objective and the core bindings on screen and then takes them away.
// These specs pin the three things that make that honest: it shows on a fresh
// install, it leaves on its own, and it never comes back.

type DevGame = {
  startSandbox: () => Promise<void> | void;
  ctx: { status: string; time: number };
  sys: { hud: { emit: () => void } };
};

const PRIMER = "[data-testid='first-drop-primer']";
/** Mirrors PRIMER_SECONDS in FirstDropPrimer.tsx. */
const PRIMER_SECONDS = 14;

/** Boot the sandbox into an active, emitting run — the same seam hud-core uses. */
async function bootPlaying(page: Page) {
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await page.evaluate(async () => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    await game.startSandbox();
    game.ctx.status = "playing";
    game.sys.hud.emit();
  });
}

/** Push the run clock forward without waiting out real seconds. */
async function advanceRunClock(page: Page, seconds: number) {
  await page.evaluate((s) => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.ctx.time = s;
    game.sys.hud.emit();
  }, seconds);
}

test.describe("first-drop controls primer", () => {
  test("teaches the opening seconds, then retires itself for good", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("PointerLockControls")) consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await bootPlaying(page);

    // A brand-new player sees the objective and every binding they need before
    // they have opened a single menu.
    const primer = page.locator(PRIMER);
    await expect(primer).toBeVisible();
    for (const key of ["WASD", "L-Click", "Shift", "Space", "R", "E"]) {
      await expect(primer).toContainText(key);
    }

    // It never eats a click — the player is already firing while they read it.
    await expect(primer).toHaveCSS("pointer-events", "none");

    await advanceRunClock(page, PRIMER_SECONDS + 1);
    await expect(primer).toBeHidden();

    // Retiring writes the flag, so the next drop starts clean.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("scourge-survivors.primer.v1"))).toBe("1");

    expect(consoleErrors).toEqual([]);
  });

  test("stays away on a returning player's next run", async ({ page }) => {
    await page.goto("/?sandbox=1");
    await page.evaluate(() => localStorage.setItem("scourge-survivors.primer.v1", "1"));

    await bootPlaying(page);

    // The clock is at zero — the only reason to stay hidden is the saved flag.
    await expect(page.locator(PRIMER)).toBeHidden();
  });
});
