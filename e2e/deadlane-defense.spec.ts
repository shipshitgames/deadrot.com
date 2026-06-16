import { expect, type Page, test } from "@playwright/test";

// Deadlane lane-defense slice: a fixed-step tower-defense run where the wave
// director and breach economy advance state on their own once the run is live.
//
// Unlike pactfall/rothulk/brawl, deadlane exposes NO window debug hook —
// `new Game(canvas)` in main.ts never lands on window/globalThis and every Game
// field is private. So the only deterministic levers are (a) the DEPLOY button
// click and (b) the real fixed-step sim, which keeps running WITHOUT pointer
// lock after DEPLOY (requestCapture() rejects silently in headless Chromium but
// pausedForCapture stays false, so step()/director() fire every frame on the
// wall-clock loop). Every assertion therefore reads the React-rendered HUD DOM
// (the #stat-* spans + #hint-text + the #hud-banner `hidden` class) that
// HudSystem.update() refreshes each displayed frame via the bannerBridge store.
//
// We deliberately do NOT assert a tower build: building requires the player to
// be in buildRange of an unoccupied non-path cell AND aiming at it under
// pointer-lock input — none of which is reproducible in headless Playwright
// without a window hook to position the rig. The robust deterministic deep path
// is wave-advance + baseHp-decrease + loss/restart, all driven by the director.

test("the wave director launches wave 1 on its own after DEPLOY", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);

  // Fresh-state economy proves we started a clean run (constants.ts: startGold
  // 175, startHp 20, ember selected at cost 50, wave 0 of 10).
  await expect(page.locator("#stat-gold")).toHaveText("175");
  await expect(page.locator("#stat-hp")).toHaveText("20");
  await expect(page.locator("#stat-wave")).toHaveText("0 / 10");
  await expect(page.locator("#stat-tower")).toHaveText("EMBER TURRET (50)");

  // Beyond smoke: the director ends the 7.5s inter-wave build window and calls
  // beginWave(), flipping #stat-wave to "1 / 10" with no input from us. Format
  // is `${wave} / ${total}` with spaces around the slash (HudSystem.update).
  await expect(page.locator("#stat-wave")).toHaveText("1 / 10", { timeout: 20_000 });

  expectNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("undefended creeps breach the base and chip baseHp mid-run", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  // The first breach is wall-clock-paced: wave 1 begins at interWaveDelay (7.5s)
  // and the lead shambler (speed 2.25 u/s) still has to walk the full ~42u
  // door->base lane (~19s) before it chips the base — so first contact is ~27s
  // of sim time, slower under headless mobile. Widen past the 45s suite default.
  test.setTimeout(90_000);

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);

  // With no towers (we can't aim deterministically without pointer lock), every
  // wave-1 shambler walks the lane to the door; moveCreeps() decrements baseHp
  // by breachDamage (shambler=1) per arrival. Poll for a strict decrease — we
  // assert hp<20 while still mid-run so this never races the loss banner.
  await expect
    .poll(async () => Number((await page.locator("#stat-hp").textContent()) ?? "20"), { timeout: 70_000 })
    .toBeLessThan(20);

  // The run is still live, so the hint reflects an active-but-unaimed build
  // readiness state (one of buildReadiness's phrases in game.ts:367-385).
  await expect(page.locator("#hint-text")).toContainText(
    /LOOK AT A BUILD TILE|MOVE TO TILE|CLICK THE GAME TO LOCK VIEW|PRESS E OR CLICK/,
  );

  // While hp has dropped, the run banner is still hidden — the run hasn't ended.
  await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);

  expectNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("clearing wave 1 grants the wave-clear bonus and the director rolls into wave 2", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  // The full director loop is wall-clock-paced: all 6 wave-1 shamblers must
  // reach the base (~45s sim) before the wave clears, then a fresh 7.5s
  // inter-wave window precedes wave 2. We assert the wave-clear ECONOMY rather
  // than draining all 20 HP to a loss — a natural full drain needs ~3 waves and
  // is far too slow/flaky for a deterministic check.
  test.setTimeout(120_000);

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);
  await expect(page.locator("#stat-gold")).toHaveText("175");

  // Wave 1 launches on its own (director ends the build window).
  await expect(page.locator("#stat-wave")).toHaveText("1 / 10", { timeout: 30_000 });

  // Undefended, all 6 shamblers breach; once creeps.length hits 0 the director
  // takes the wave-cleared branch (game.ts:292-301): +waveClearBonus gold (25),
  // so startGold 175 -> 200. This proves the clear path fired, not just spawning.
  await expect(page.locator("#stat-gold")).toHaveText("200", { timeout: 90_000 });

  // ...and grantWaveBonus() + beginInterWave() roll the run into wave 2, proving
  // the director's full clear -> inter-wave -> next-wave cycle ran end to end.
  await expect(page.locator("#stat-wave")).toHaveText("2 / 10", { timeout: 30_000 });

  // The run is still live throughout (no win/lose banner) — the breach economy
  // chipped HP but the base still stands.
  await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);
  expect(Number((await page.locator("#stat-hp").textContent()) ?? "20")).toBeLessThan(20);

  expectNoUnexpectedErrors(consoleErrors, pageErrors);
});

// ---- helpers ----------------------------------------------------------------

interface CapturedErrors {
  consoleErrors: string[];
  pageErrors: string[];
}

/**
 * Boot deadlane, assert the title screen rendered while the splash is up, then
 * dismiss the splash. We reveal the menu nav by CLICKING the "Press Enter to
 * continue" prompt rather than pressing Enter/Space: useEnterToReveal does not
 * stopPropagation, so a key reveal also reaches game input and can auto-start.
 */
async function boot(page: Page): Promise<CapturedErrors> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto("/");

  // Title booted while the splash is still up (matches games.spec assertLoaded).
  await expect(page.getByText("Gold", { exact: true })).toBeVisible();
  await expect(page.getByText("Wave", { exact: true })).toBeVisible();
  await expect(page.getByText("Base HP", { exact: true })).toBeVisible();

  // The scene canvas exists (AppShell.tsx <canvas id="scene" />).
  await expect(page.locator("#scene")).toBeVisible();

  // Reveal the menu nav (DEPLOY lives inside <MainMenuNav hidden={!revealed}>).
  const enterPrompt = page.getByText("Press Enter to continue");
  await expect(enterPrompt).toBeVisible();
  await enterPrompt.click();
  await expect(enterPrompt).toBeHidden();

  return { consoleErrors, pageErrors };
}

/**
 * Click DEPLOY to start the run and confirm it went live. The engine grabs the
 * click via a document listener matching target.closest("#banner-btn"), so a
 * normal DOM click works without pointer lock. startRun() hides the banner (the
 * `hidden` class appears), and the fixed-step sim runs from here on.
 */
async function deploy(page: Page): Promise<void> {
  await page.getByRole("button", { name: "DEPLOY" }).click();
  await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);
}

/**
 * Assert no unexpected console/page errors. Deadlane's games.spec entry sets no
 * ignoredConsoleErrors and the wave-advance + breach flow reaches neither
 * win()/lose() warline reporting nor a surfaced pointer-lock rejection (it is
 * swallowed by .catch(() => {})), so we expect zero errors.
 */
function expectNoUnexpectedErrors(consoleErrors: string[], pageErrors: string[]): void {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
}
