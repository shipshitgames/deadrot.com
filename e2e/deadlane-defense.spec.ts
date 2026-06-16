import { expect, type Page, test } from "@playwright/test";

// Deadlane lane-defense slice: a fixed-step tower-defense run where the wave
// director and breach economy advance state on their own once the run is live.
//
// The fixed loop clamps each frame's dt to maxDelta (0.05s), so on a throttled
// headless renderer the sim is wall-clock-starved — a Pixel-7-emulated CI runner
// advances only a fraction of a sim-second per rendered frame, which made the
// real-time waits here (wave launch, first breach, full wave clear) impractically
// slow and viewport dependent. So instead of waiting on rendered frames we drive
// the deterministic sim through the dev-only `__deadlaneGame` hook (mirrors
// pactfall's __pactfallGame / rothulk's __rothulkGame): `fastForward(seconds)`
// replays the loop's own `elapsed += fixedDt; step(fixedDt)` update at the same
// fixedDt with no rAF/WebGL, and `snapshot()` returns a synchronous run-state
// readout. The handle is `import.meta.env.DEV`-gated, so it never ships to prod.
//
// We still neutralize requestPointerLock in boot(): after DEPLOY the rig grabs
// pointer lock, and on the Linux CI runner the lock engages then releases, firing
// the rig "release" handler -> Game.pauseRun() -> pausedForCapture = true. step()
// gates on `!pausedForCapture`, so a paused run makes fastForward a no-op. A no-op
// lock keeps the run live on every platform. snapshot().paused lets each test
// assert the run never silently froze.
//
// We deliberately do NOT assert a tower build: building requires the player to be
// in buildRange of an unoccupied non-path cell AND aiming at it under pointer-lock
// input — none of which is reproducible headlessly without a rig-positioning hook.
// The robust deterministic deep path is wave-advance + baseHp-decrease + the
// wave-clear economy, all driven by the director through fastForward().

interface DeadlaneSnapshot {
  phase: "menu" | "building" | "wave" | "won" | "lost";
  wave: number;
  totalWaves: number;
  baseHp: number;
  gold: number;
  creepCount: number;
  paused: boolean;
}

interface DeadlaneWindow {
  __deadlaneGame: {
    snapshot(): DeadlaneSnapshot;
    fastForward(seconds: number): DeadlaneSnapshot["phase"];
  };
}

test("the wave director launches wave 1 on its own after DEPLOY", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);

  // Fresh-state economy proves we started a clean run (constants.ts: startGold
  // 175, startHp 20, ember selected at cost 50, wave 0 of 10). These read the
  // React HUD DOM, proving the bannerBridge store wiring renders correct values.
  await expect(page.locator("#stat-gold")).toHaveText("175");
  await expect(page.locator("#stat-hp")).toHaveText("20");
  await expect(page.locator("#stat-wave")).toHaveText("0 / 10");
  await expect(page.locator("#stat-tower")).toHaveText("EMBER TURRET (50)");

  // The run opens in the inter-wave build window with the breach economy live.
  const start = await snapshot(page);
  expect(start.phase).toBe("building");
  expect(start.wave).toBe(0);
  expect(start.paused).toBe(false);

  // Drive the sim: the director ends the 7.5s inter-wave window and calls
  // beginWave(), incrementing wave to 1 and flipping phase to "wave" with no
  // input from us. fastForward replays the exact fixed-step update, so this is
  // byte-for-byte identical to live play but FPS-independent.
  const launched = await advanceUntil(page, (s) => s.wave >= 1);
  expect(launched.wave).toBe(1);
  expect(launched.phase).toBe("wave");
  expect(launched.totalWaves).toBe(10);
  expect(launched.paused).toBe(false);

  // The HUD store synced from the same state: #stat-wave reads "1 / 10" (format
  // is `${wave} / ${total}` with spaces around the slash, HudSystem.update).
  await expect(page.locator("#stat-wave")).toHaveText("1 / 10");

  expectNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("undefended creeps breach the base and chip baseHp mid-run", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);

  // With no towers (we can't aim deterministically without pointer lock), every
  // wave-1 shambler walks the lane to the door; moveCreeps() decrements baseHp by
  // breachDamage per arrival. Drive the sim until a strict decrease — captured
  // while still live, so it never races the loss banner.
  const breached = await advanceUntil(page, (s) => s.baseHp < 20);
  expect(breached.baseHp).toBeLessThan(20);
  expect(breached.paused).toBe(false);
  // Still mid-run when the chip lands (building or fighting, never won/lost).
  expect(["building", "wave"]).toContain(breached.phase);

  // The run is still live, so the hint reflects an active-but-unaimed build
  // readiness state (one of buildReadiness's phrases in game.ts) and the run
  // banner stays hidden — the run hasn't ended.
  await expect(page.locator("#hint-text")).toContainText(
    /LOOK AT A BUILD TILE|MOVE TO TILE|CLICK THE GAME TO LOCK VIEW|PRESS E OR CLICK/,
  );
  await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);

  expectNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("clearing wave 1 grants the wave-clear bonus and the director rolls into wave 2", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("deadlane:"), "Deadlane-only lane-defense regression.");

  const { consoleErrors, pageErrors } = await boot(page);
  await deploy(page);
  await expect(page.locator("#stat-gold")).toHaveText("175");

  // Wave 1 launches on its own (director ends the build window).
  await advanceUntil(page, (s) => s.wave >= 1);

  // Undefended, all 6 shamblers breach; once creeps.length hits 0 the director
  // takes the wave-cleared branch (game.ts): +waveClearBonus gold (25), then
  // grantWaveBonus() + beginInterWave() roll into wave 2. We advance until wave 2
  // begins, which proves the full clear -> inter-wave -> next-wave cycle ran end
  // to end. At that instant exactly one clear bonus has been granted and we built
  // nothing, so gold is deterministically startGold + bonus = 175 + 25 = 200.
  const rolled = await advanceUntil(page, (s) => s.wave >= 2);
  expect(rolled.wave).toBe(2);
  expect(rolled.gold).toBe(200);
  expect(rolled.paused).toBe(false);

  // The breach economy chipped HP along the way, but the run still stands — no
  // win/lose banner.
  expect(rolled.baseHp).toBeLessThan(20);
  await expect(page.locator("#hud-banner")).toHaveClass(/hidden/);

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

  // Neutralize pointer lock so the run never auto-pauses. After DEPLOY the rig
  // calls requestPointerLock(); headless behaviour is platform-dependent — on the
  // Linux CI runner the lock briefly engages then releases, which fires the rig
  // "release" handler -> Game.pauseRun() -> pausedForCapture = true, and step()
  // then skips director()/the breach sim (so fastForward would be a no-op). A
  // no-op lock that never changes pointer-lock state keeps pausedForCapture false
  // and the sim drivable on every platform. Must run before the engine wires its
  // pointerlockchange listeners — addInitScript fires pre-navigation.
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = () => Promise.resolve();
  });

  await page.goto("/");

  // Title booted while the splash is still up (matches games.spec assertLoaded).
  await expect(page.getByText("Gold", { exact: true })).toBeVisible();
  await expect(page.getByText("Wave", { exact: true })).toBeVisible();
  await expect(page.getByText("Base HP", { exact: true })).toBeVisible();

  // The scene canvas exists (AppShell.tsx <canvas id="scene" />).
  await expect(page.locator("#scene")).toBeVisible();

  // The dev-only sim driver is installed in the Game constructor at app boot, so
  // it is present by the time the title renders. Wait for it before any deploy.
  await page.waitForFunction(() => Boolean((window as unknown as Partial<DeadlaneWindow>).__deadlaneGame));

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

/** Read the synchronous run-state snapshot off the dev sim driver. */
async function snapshot(page: Page): Promise<DeadlaneSnapshot> {
  return page.evaluate(() => (window as unknown as DeadlaneWindow).__deadlaneGame.snapshot());
}

/**
 * Drive the deterministic sim forward in fixed-step chunks until `predicate`
 * holds, returning the crossing snapshot. fastForward() costs no rendered frames,
 * so this is near-instant in wall time and identical on desktop and mobile. The
 * 8s chunk is well under a single wave's ~45s duration, so a monotonic crossing
 * (wave >= N, baseHp < 20) is caught the chunk it happens and never skips a wave.
 * `maxSeconds` bounds total sim time so a stuck run fails loudly instead of
 * hanging — three waves' worth of run (~180s) is ample headroom for the milestones
 * we assert (wave 1, first breach, wave 2).
 */
async function advanceUntil(
  page: Page,
  predicate: (snap: DeadlaneSnapshot) => boolean,
  { chunk = 8, maxSeconds = 180 }: { chunk?: number; maxSeconds?: number } = {},
): Promise<DeadlaneSnapshot> {
  let elapsed = 0;
  let snap = await snapshot(page);
  if (predicate(snap)) return snap;

  while (elapsed < maxSeconds) {
    snap = await page.evaluate((seconds) => {
      const game = (window as unknown as DeadlaneWindow).__deadlaneGame;
      game.fastForward(seconds);
      return game.snapshot();
    }, chunk);
    elapsed += chunk;
    expect(snap.paused, "run silently paused mid-drive (pointer-lock guard failed)").toBe(false);
    if (predicate(snap)) return snap;
  }

  throw new Error(`predicate never held after ${maxSeconds}s of sim; last snapshot: ${JSON.stringify(snap)}`);
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
