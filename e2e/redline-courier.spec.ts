import { expect, type Page, test } from "@playwright/test";

// REDLINE — deep courier-run regression. The shared boot smoke (games.spec.ts)
// only covers boot + a 250ms ArrowRight to prove time ticks. This spec drives
// the live Game instance deterministically through the running fixed-step loop:
// it reads/writes the runner+course the loop actually mutates and asserts the
// resolved phase + HUD/overlay DOM via expect.poll — no real-time gameplay, no
// arbitrary long waits.
//
// Redline exposes NO dedicated debug API (unlike rothulk's debugSnapshot or
// pactfall's __pactfallSnapshot). The only hook is `window.__REDLINE__`, the raw
// Game (main.ts:41). `phase` is genuinely public; `debug` is a public getter
// returning the LIVE runner + course references. TS `private` is erased in the
// emitted JS, so `startRun`/`paused` are runtime-reachable. We drive through the
// stable `debug` getter where possible (mirrors pactfall poking entity fields).

type Phase = "ready" | "running" | "won" | "dead";

// WORLD/COURSE constants mirrored from constants.ts so the drives stay readable.
const BEACON_X = 520; // WORLD.levelLength === course.beaconX
const PIT_Y = -20; // below WORLD.groundY - 8 (= -8) → physics flags fellInPit
const BASE_SPEED = 6; // RUN.baseSpeed; vx at rest / after reset

test("ignite starts a live courier run and the HUD ticks", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("redline:"), "Redline-only courier-run regression.");

  const errors = collectErrors(page);
  await boot(page);

  // Real wiring: the IGNITE click is a user gesture (also unlocks audio without
  // console noise) and must hide the start card + flip phase to running.
  await page.getByRole("button", { name: "IGNITE" }).click();
  await expect(page.locator("#overlay")).toHaveClass(/is-hidden/);
  await expect.poll(() => phase(page)).toBe("running");

  // The take-message intro overlays a run that is already live. Time advances
  // underneath it, then one explicit input dismisses it before acceleration.
  await expect(page.getByTestId("cinematic-intro")).toBeVisible();
  await expect.poll(() => page.locator("#hud-time").textContent()).not.toBe("0.00");
  await page
    .getByTestId("cinematic-intro")
    .getByRole("button", { name: /^Run the lane/ })
    .click();
  await expect(page.getByTestId("cinematic-intro")).toHaveCount(0);

  // Hold accelerate: vx climbs off baseSpeed (6) toward topSpeed (34) and the
  // HUD speed readout follows it — proves the input → runner → HUD chain.
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => runnerField(page, "vx")).toBeGreaterThan(BASE_SPEED);
  await expect.poll(async () => Number(await page.locator("#hud-speed").textContent())).toBeGreaterThan(BASE_SPEED);

  // The run timer and distance advance off their at-rest zeros.
  await expect.poll(() => page.locator("#hud-time").textContent()).not.toBe("0.00");
  await expect.poll(async () => Number(await page.locator("#hud-dist").textContent())).toBeGreaterThan(0);

  await page.keyboard.up("ArrowRight");
  // Status word is one of the live-run states (never STAGGER on a clean hold).
  await expect(page.locator("#hud-status")).toHaveText(/RUN|AIRBORNE|ROLL/);

  expectNoErrors(errors);
});

test("reaching the beacon completes the delivery and shows a graded win", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("redline:"), "Redline-only courier-run regression.");

  const errors = collectErrors(page);
  await boot(page);
  await page.getByRole("button", { name: "IGNITE" }).click();
  await expect.poll(() => phase(page)).toBe("running");

  // Drive the runner past the BEACON. The next fixedStep sees runner.x >=
  // course.beaconX → reachedBeacon → win() runs the REAL victory path (records,
  // war-result reporting, showWin) rather than us calling win() directly.
  const bx = await beaconX(page);
  expect(bx).toBe(BEACON_X);
  await setRunnerX(page, bx + 1);
  await expect.poll(() => phase(page)).toBe("won");

  // Outcome is selected directly from the run result before the grade card.
  await expect(page.getByTestId("cinematic-delivered")).toContainText("The lane still talks.");
  await page
    .getByTestId("cinematic-delivered")
    .getByRole("button", { name: /^Continue/ })
    .click();

  // showWin re-shows the overlay as a graded delivery summary.
  await expect(page.locator("#overlay")).not.toHaveClass(/is-hidden/);
  await expect(page.locator("#overlay-kicker")).toHaveText(/Delivery Complete|New Personal Best|New High Score/);
  await expect(page.locator("#overlay-grade")).toBeVisible();
  await expect(page.locator("#overlay-stats")).toContainText("Score");
  await expect(page.getByRole("button", { name: "RUN AGAIN" })).toBeVisible();

  // submitRun banked a best, so the HUD best readout is no longer the empty "--.--".
  await expect(page.locator("#hud-best")).not.toHaveText("--.--");

  expectNoErrors(errors);
});

test("falling into the rot loses the run with the cargo-lost message", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("redline:"), "Redline-only courier-run regression.");

  const errors = collectErrors(page);
  await boot(page);
  await page.getByRole("button", { name: "IGNITE" }).click();
  await expect.poll(() => phase(page)).toBe("running");

  // Force a pit fall. Physics resolves vertically by surfaceAt(x): over a
  // platform/ramp it re-lands an airborne runner and snaps y back to the
  // surface (so a bare y=-20 poke is clobbered before the pit check). Over a
  // gap (no platform, no ramp) surfaceAt returns null → the runner stays
  // airborne and y is never snapped, so y < groundY-8 (=-8) sticks and
  // fellInPit fires. We compute a real gap X from the LIVE course, park the
  // runner there off-ground at y=-20, and let the next fixedStep run die().
  const pitFound = await page.evaluate((pitY) => {
    const game = (
      window as unknown as {
        __REDLINE__: {
          debug: {
            runner: { x: number; y: number; vy: number; onGround: boolean };
            course: {
              platforms: { x0: number; x1: number }[];
              ramps: { x0: number; x1: number }[];
              beaconX: number;
            };
          };
        };
      }
    ).__REDLINE__;
    const { platforms, ramps, beaconX } = game.debug.course;
    const covered = (x: number) =>
      platforms.some((p) => x >= p.x0 && x <= p.x1) || ramps.some((r) => x >= r.x0 && x <= r.x1);
    // Scan forward from the spawn for the first uncovered X (a pit gap), staying
    // short of the beacon so we don't accidentally trigger a win instead.
    let pitX: number | null = null;
    for (let x = 6; x < beaconX - 1; x += 0.25) {
      if (!covered(x)) {
        pitX = x;
        break;
      }
    }
    if (pitX === null) return false;
    const runner = game.debug.runner;
    runner.x = pitX;
    runner.onGround = false;
    runner.vy = -1; // already falling, so the airborne branch won't try to land
    runner.y = pitY;
    return true;
  }, PIT_Y);
  expect(pitFound).toBe(true);
  await expect.poll(() => phase(page)).toBe("dead");

  await expect(page.getByTestId("cinematic-caught")).toContainText("The Choir reached the message.");
  await page
    .getByTestId("cinematic-caught")
    .getByRole("button", { name: /^Continue/ })
    .click();

  // showDead carries the verbatim die() reason (the only die() call in game.ts).
  await expect(page.locator("#overlay-kicker")).toHaveText("Run Failed");
  await expect(page.locator("#overlay-body")).toHaveText("Cargo lost to the rot below. The lane swallowed the run.");
  await expect(page.getByRole("button", { name: "RETRY" })).toBeVisible();

  expectNoErrors(errors);
});

test("retry from a finished run re-arms a fresh courier run", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("redline:"), "Redline-only courier-run regression.");

  const errors = collectErrors(page);
  await boot(page);
  await page.getByRole("button", { name: "IGNITE" }).click();
  await expect.poll(() => phase(page)).toBe("running");

  // Finish the run via a beacon win, then re-deploy from the win card.
  await setRunnerX(page, (await beaconX(page)) + 1);
  await expect.poll(() => phase(page)).toBe("won");
  await page
    .getByTestId("cinematic-delivered")
    .getByRole("button", { name: /^Continue/ })
    .click();

  // RUN AGAIN routes through startRun(): resets the runner/course/score, flips
  // phase back to running, and hides the overlay (mirrors pactfall's redeploy).
  await page.getByRole("button", { name: "RUN AGAIN" }).click();
  await expect.poll(() => phase(page)).toBe("running");
  await expect(page.locator("#overlay")).toHaveClass(/is-hidden/);
  await expect(page.getByTestId("cinematic-intro")).toBeVisible();
  await expect.poll(async () => Number(await page.locator("#hud-time").textContent())).toBeLessThan(2);
  await page
    .getByTestId("cinematic-intro")
    .getByRole("button", { name: /^Run the lane/ })
    .click();

  // runner.reset() put us back at the spawn (WORLD.startX=4) at baseSpeed (6),
  // and the fresh run timer reset inside the live intro window.
  await expect.poll(() => runnerField(page, "x")).toBeLessThan(10);
  await expect.poll(() => runnerField(page, "vx")).toBeCloseTo(BASE_SPEED, 0);

  expectNoErrors(errors);
});

// ---- helpers ----------------------------------------------------------------

async function boot(page: Page) {
  await page.goto("/");
  // Title kicker + HUD spans must be up while the start card is still visible
  // (mirrors gameSpecs.redline.assertLoaded). No "Press Enter" gate — redline
  // paints the Ignite card imperatively, so there's no React splash to dismiss.
  await expect(page.getByText("Pyre Courier Run")).toBeVisible();
  await expect(page.locator("#hud-speed")).toBeVisible();
  await expect(page.locator("#hud-dist")).toBeVisible();
  // The window hook is installed AFTER game.start() (main.ts:41); wait for it
  // before poking state, then confirm we're parked on the start phase.
  await page.waitForFunction(() => Boolean((window as unknown as { __REDLINE__?: unknown }).__REDLINE__));
  await expect.poll(() => phase(page)).toBe("ready");
}

async function phase(page: Page): Promise<Phase> {
  return page.evaluate(() => (window as unknown as { __REDLINE__: { phase: Phase } }).__REDLINE__.phase);
}

async function runnerField(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (k) =>
      (window as unknown as { __REDLINE__: { debug: { runner: Record<string, number> } } }).__REDLINE__.debug.runner[k],
    key,
  );
}

async function setRunnerX(page: Page, x: number) {
  await page.evaluate((value) => {
    (window as unknown as { __REDLINE__: { debug: { runner: { x: number } } } }).__REDLINE__.debug.runner.x = value;
  }, x);
}

async function beaconX(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __REDLINE__: { debug: { course: { beaconX: number } } } }).__REDLINE__.debug.course
        .beaconX,
  );
}

// Collect console + page errors like games.spec; redline has no ignored-error
// entry, so any unexpected error fails the test. win()/die() reporting is
// config-gated + offline-safe, so a clean run should surface nothing.
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

function expectNoErrors(errors: string[]) {
  expect(errors).toEqual([]);
}
