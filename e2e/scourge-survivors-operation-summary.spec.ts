import { expect, type Page, test } from "@playwright/test";

// Scourge Survivors operation-summary deep slice (#361): every run is a Warline
// operation feeding the shared front, so the post-run summary must tell the
// player WHAT operation they ran (canon "Breach Purge") and WHAT it bought the
// front (biomass banked into the cross-game war-effort pool, #280). We start a
// real survivors run via the DEV hooks App.tsx installs (__fpsGame /
// __hudSnapshot), force the ending deterministically (house style: direct state
// surgery, no real-time gameplay or pointerlock), then read the rendered
// GameOverScreen back from the DOM. Extends the boot smoke in games.spec.ts.

interface HudSnapshot {
  status: string;
  outcome: "win" | "dead" | null;
  survivors: boolean;
}

type DevGame = {
  startSurvivors: (classId: "ranger") => Promise<void>;
  // ctx.time is the run clock the HUD reads (HudSystem: `time: Math.floor(ctx.time)`),
  // and runBiomass(kills, level, time) keys off it — NOT survivors.survClock.
  ctx: { status: string; time: number };
  sys: {
    hud: { emit: () => void };
    gameOver: { gameOver: (outcome: "dead" | "win") => void };
  };
};

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function boot(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
      configurable: true,
      value: function requestPointerLock() {},
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: function exitPointerLock() {},
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => {
    const win = window as unknown as { __fpsGame?: unknown; __hudSnapshot?: () => unknown };
    return Boolean(win.__fpsGame && win.__hudSnapshot);
  });
}

/** Start a survivors run, let a little run-clock accrue so the run banks a real
 *  (non-zero) contribution, then force the death ending — all deterministic. */
async function runToGameOver(page: Page) {
  await page.evaluate(async () => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    await game.startSurvivors("ranger");
    game.ctx.status = "playing";
    // Bank a real survival time onto the run clock the HUD reads, so the run's
    // contribution — runBiomass(kills, level, time) — is a stable, non-zero
    // number and the "what it bought the front" line shows real numbers.
    game.ctx.time = 120;
    game.sys.hud.emit();
  });
  await expect.poll(() => snapshot(page).then((s) => s.survivors)).toBe(true);

  await page.evaluate(() => {
    (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.gameOver.gameOver("dead");
  });
  await expect
    .poll(() => snapshot(page).then((s) => ({ status: s.status, survivors: s.survivors })))
    .toEqual({ status: "gameover", survivors: true });
}

test("the run summary names the Warline operation and what it bought the front", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-survivors-only operation-summary slice.");

  await boot(page);
  await runToGameOver(page);

  // The summary's Operation cell carries the canon op name from the typed lore
  // (games.json warlineRole.operation), never a hardcoded game-side string.
  const operationCell = page.getByTestId("summary-operation");
  await expect(operationCell).toBeVisible();
  await expect(operationCell).toContainText("Breach Purge");
  await expect(operationCell).toContainText(/biomass to the front/i);

  // The Warline front-report line states what the run bought the shared front —
  // shown win or loss, since contribution is credited either way (#280).
  const frontReport = page.getByTestId("front-report");
  await expect(frontReport).toBeVisible();
  await expect(frontReport).toContainText("Breach Purge");
  await expect(frontReport).toContainText(/biomass to the front/i);

  // It reports a REAL contribution number, not a placeholder "+0" — the run
  // banked something into the front (the actual value is pinned by the unit test).
  const reportText = (await frontReport.textContent()) ?? "";
  const banked = Number((reportText.match(/\+\s*([\d,]+)\s*biomass/i)?.[1] ?? "0").replace(/,/g, ""));
  expect(banked).toBeGreaterThan(0);
});
