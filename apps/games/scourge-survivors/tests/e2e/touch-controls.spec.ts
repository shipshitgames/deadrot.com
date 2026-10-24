import { expect, type Page, test } from "@playwright/test";

// The on-screen pad shipped with unit coverage over its maths and its DOM seam,
// but nothing ever drove it in a browser — every other spec in this suite runs
// at Desktop Chrome and plays with the keyboard. So the one claim that matters
// on a phone, "a thumb can move, look and shoot", was never actually tested.
//
// This file runs under the `mobile` project (Pixel 7) and is the *only* file
// that does. It plays the game exclusively through the surfaces a thumb can
// reach — the menu, the cinematic, the start prompt, then the pad itself. No
// keyboard is pressed anywhere in this file, and nothing reaches into a system
// to fake input. The dev handle is read, never driven: it is the only way to
// see where the player actually is in the world.
//
// Gestures are driven with `page.mouse` rather than `page.touchscreen`, which
// only offers `tap()` and cannot drag. Both produce trusted pointer events with
// a live pointerId — which is what the pad listens to, and what
// `setPointerCapture` needs. The touch-specific half (coarse-pointer detection,
// the pad rendering at all) is proven by the Pixel 7 device profile itself:
// `touch.enabled` is false on any desktop project, and every assertion below
// depends on it being true.
//
// That equivalence holds only while no pointer lock is held, because a lock makes
// the browser retarget every pointer event to the locked element. `bootTouchRun`
// asserts the absence, and it is not a test detail: a real thumb on a real phone
// is retargeted the same way. Any coarse-pointer device where a lock is grantable
// — an emulated device profile, a touchscreen laptop — loses the whole pad.

type HudSnapshot = {
  status: string;
  ammo: number;
  reserve: number;
  reloading: boolean;
};

type Pose = {
  /** Player position in world units. */
  x: number;
  y: number;
  z: number;
  /** Unit forward vector, decomposed from the rig quaternion (see `pose`). */
  fx: number;
  fy: number;
  fz: number;
  /** Compass heading in radians, for signed turn comparisons. */
  heading: number;
};

type Point = { x: number; y: number };

/** Pixel 7 is 412×915 CSS px; the stick zone is the bottom-left quarter. */
const STICK_HOME: Point = { x: 100, y: 700 };
/** Clear of the pad's own hit areas, so the drag lands on the canvas. */
const LOOK_HOME: Point = { x: 260, y: 260 };

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

/**
 * Read the player's transform.
 *
 * The forward vector is derived from the quaternion rather than from
 * `body.rotation`, because the rig writes its orientation in YXZ order while
 * `Object3D.rotation` reads back in XYZ — the two only agree while pitch is
 * zero, and these specs deliberately pitch the camera. Rotating (0, 0, −1) by
 * the quaternion is order-free and gives an unambiguous "where is the player
 * actually looking".
 */
async function pose(page: Page): Promise<Pose> {
  return page.evaluate(() => {
    type Rig = {
      body: {
        position: { x: number; y: number; z: number };
        quaternion: { x: number; y: number; z: number; w: number };
      };
    };
    const game = (window as unknown as { __fpsGame: { ctx: { rig: Rig } } }).__fpsGame;
    const { position, quaternion } = game.ctx.rig.body;
    const { x, y, z, w } = quaternion;
    const fx = -2 * (w * y + x * z);
    const fy = 2 * (w * x - y * z);
    const fz = -1 + 2 * (x * x + y * y);
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      fx,
      fy,
      fz,
      heading: Math.atan2(fx, fz),
    };
  });
}

/** Shortest signed angle from `from` to `to`, so ±π never reads as a huge turn. */
function turnBetween(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function planarDistance(a: Pose, b: Pose): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Press, drag and hold — the caller releases. */
async function pressAndDrag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Stepped so the look accumulator sees a stream of deltas, exactly as a real
  // finger delivers several pointermoves per animation frame.
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

async function dragAndRelease(page: Page, from: Point, to: Point): Promise<void> {
  await pressAndDrag(page, from, to);
  await page.mouse.up();
}

/** Tap one of the pad's buttons. They act on pointerdown, so a tap is enough. */
async function tapPad(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).tap();
}

/** Read the game's own status, which the HUD mirrors but does not own. */
async function status(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __fpsGame: { ctx: { status: string } } }).__fpsGame.ctx.status);
}

/**
 * Walk the campaign route from cold load to live run, using nothing but taps.
 *
 * Deliberately not the `?sandbox=1` shortcut the rest of this suite leans on:
 * the sandbox mounts a developer panel at `z-30`, directly over the `z-20` pad,
 * and on a 412px-wide screen its controls sit on top of the pad's buttons and
 * swallow every gesture aimed at them. Beyond being untestable, testing through
 * it would prove the wrong thing — no phone player ever sees that panel, and
 * the sandbox also suppresses the menu chrome that owns the real start button.
 *
 * So this takes the route a player takes, which incidentally proves the whole
 * pre-run journey is reachable without a keyboard: the title splash reveals on
 * a tap rather than only on Enter, the class and map screens are hittable at
 * phone width, and the intro hands over to live play on its own.
 */
async function bootTouchRun(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);

  // The title screen is gated behind an arcade splash whose prompt names the
  // gesture. On a phone there is no Enter key to press, so it must not ask for
  // one — the desktop specs pin the other half of this copy.
  await expect(page.getByText("Tap to continue", { exact: true })).toBeVisible();

  // It reveals on any pointerdown, so a tap is the phone equivalent of Enter.
  // Deliberately on dead space near the top rather than on the prompt itself:
  // the prompt unmounts on pointerdown and the browser then delivers that
  // gesture's compatibility click to whatever has taken its place, which here
  // would be the menu nav that the next line is about to drive on purpose.
  await page.mouse.click(206, 120);

  await page.getByRole("button", { name: /play a run/i }).tap();
  await page.getByRole("button", { name: /choose breach site/i }).tap();
  await page.getByRole("button", { name: /^play a run$/i }).tap();

  // Let the intro run itself out rather than tapping through it, and let its
  // completion hand over to the run. That handover is `requestLock()`, which on
  // a coarse pointer is `enterPlayFromTouch()` — so a phone reaches live play
  // with no lock to grant and no extra gesture. Skipping the intro by tapping
  // works too, but the overlay unmounts on pointerdown and the browser then
  // delivers that gesture's compatibility click to whatever has taken its
  // place, which muddles what any following assertion is actually about.
  const intro = page.getByTestId("cinematic-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toBeHidden({ timeout: 15_000 });

  await expect.poll(() => status(page), { timeout: 30_000 }).toBe("playing");

  // Asserted here rather than in one test because every gesture below depends on
  // it. A held pointer lock makes the browser retarget every pointer event to
  // the locked canvas, so the pad's buttons stop receiving taps at all and its
  // setPointerCapture calls throw — a phone pad that is rendered, live, and
  // completely deaf. Reaching `playing` does not prove no lock was requested on
  // the way: whether the browser grants one is platform-dependent, so this is
  // the only assertion that fails on the machine where it is granted.
  expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(false);
}

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("PointerLockControls")) consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  await bootTouchRun(page);
});

test.afterEach(() => {
  // A pad that works but throws on every gesture is not a shipped pad.
  expect(consoleErrors).toEqual([]);
});

test("a coarse pointer raises the pad over the live run", async ({ page }) => {
  // This is the load-bearing precondition for the whole file: on a desktop
  // project `isCoarsePointer()` is false, TouchPad returns null, and every
  // locator below would miss.
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __fpsGame: { touch: { enabled: boolean } } }).__fpsGame.touch.enabled,
      ),
    )
    .toBe(true);

  await expect(page.getByTestId("touch-pad")).toBeVisible();
  await expect(page.getByTestId("touch-stick-zone")).toBeVisible();
  for (const control of ["touch-fire", "touch-jump", "touch-reload", "touch-melee", "touch-ads", "touch-weapon"]) {
    await expect(page.getByTestId(control)).toBeVisible();
  }
});

test("the left stick walks the player and a lifted thumb stops them", async ({ page }) => {
  const start = await pose(page);

  // Up the glass is forward. 80px past the origin saturates the ring, so this
  // is a full-deflection sprint rather than a nudge.
  await pressAndDrag(page, STICK_HOME, { x: STICK_HOME.x, y: STICK_HOME.y - 80 });
  await expect.poll(async () => planarDistance(start, await pose(page)), { timeout: 5_000 }).toBeGreaterThan(0.75);

  await page.mouse.up();

  // Releasing must clear the whole move intent, not latch the last direction.
  // Sample after a beat so any deceleration has already played out.
  const settling = await pose(page);
  await expect.poll(async () => planarDistance(settling, await pose(page)), { timeout: 3_000 }).toBeLessThan(0.6);
  const settled = await pose(page);
  await page.waitForTimeout(400);
  expect(planarDistance(settled, await pose(page))).toBeLessThan(0.05);
});

test("dragging the canvas turns the view, and the same drag back undoes it", async ({ page }) => {
  const start = await pose(page);

  await dragAndRelease(page, LOOK_HOME, { x: LOOK_HOME.x + 140, y: LOOK_HOME.y });
  await expect.poll(async () => Math.abs(turnBetween(start.heading, (await pose(page)).heading))).toBeGreaterThan(0.3);
  const turned = await pose(page);

  await dragAndRelease(page, LOOK_HOME, { x: LOOK_HOME.x - 140, y: LOOK_HOME.y });
  await expect.poll(async () => Math.abs(turnBetween(start.heading, (await pose(page)).heading))).toBeLessThan(0.05);

  // Convention-free proof the axis is neither inverted nor stuck: the two drags
  // are mirror images, so the turns they produce must be too.
  const back = await pose(page);
  const out = turnBetween(start.heading, turned.heading);
  const home = turnBetween(turned.heading, back.heading);
  expect(Math.sign(out)).toBe(-Math.sign(home));
});

test("a vertical drag pitches the view and stops at the clamp", async ({ page }) => {
  const start = await pose(page);

  // Down the glass looks down.
  await dragAndRelease(page, LOOK_HOME, { x: LOOK_HOME.x, y: LOOK_HOME.y + 160 });
  await expect.poll(async () => (await pose(page)).fy).toBeLessThan(start.fy - 0.05);

  // Now drive it far past vertical. One drag cannot reach the limit — the pad
  // trades ~0.0038rad per pixel and the glass is shorter than a half-turn — so
  // this stacks several, all of them starting above the pad's own button row so
  // the gesture lands on the canvas rather than on a control.
  const swingUp = () => dragAndRelease(page, { x: LOOK_HOME.x, y: 420 }, { x: LOOK_HOME.x, y: 40 });
  for (let swing = 0; swing < 4; swing += 1) await swingUp();

  // PITCH_LIMIT must absorb every bit of that overshoot: the view ends up
  // looking almost straight up and stays there.
  const firstClamp = await pose(page);
  expect(firstClamp.fy).toBeGreaterThan(0.9);
  expect(firstClamp.fy).toBeLessThanOrEqual(1);

  // Two more swings past a limit that is already reached must change nothing.
  // Without the clamp they would carry the view over the top and `fy` would
  // fall back down the far side — the classic inverted-horizon bug.
  await swingUp();
  await swingUp();
  const secondClamp = await pose(page);
  expect(Math.abs(secondClamp.fy - firstClamp.fy)).toBeLessThan(0.01);
});

test("the fire button spends a round and the reload button puts it back", async ({ page }) => {
  const armed = await snapshot(page);
  expect(armed.ammo).toBeGreaterThan(0);

  await tapPad(page, "touch-fire");
  // A tap queues the trigger, so the shot survives the button lifting before
  // the next tick — which is exactly what a real thumb does.
  await expect.poll(() => snapshot(page).then((state) => state.ammo)).toBeLessThan(armed.ammo);

  await tapPad(page, "touch-reload");
  await expect.poll(() => snapshot(page).then((state) => state.reloading)).toBe(true);
  await expect.poll(() => snapshot(page).then((state) => state.ammo), { timeout: 10_000 }).toBe(armed.ammo);
});

test("the jump button leaves the ground", async ({ page }) => {
  const grounded = await pose(page);

  await tapPad(page, "touch-jump");

  await expect.poll(async () => (await pose(page)).y, { timeout: 3_000 }).toBeGreaterThan(grounded.y + 0.15);
  // And gravity still owns the way down.
  await expect.poll(async () => (await pose(page)).y, { timeout: 5_000 }).toBeLessThan(grounded.y + 0.05);
});

test("ADS is a toggle on touch, not a hold", async ({ page }) => {
  const ads = page.getByTestId("touch-ads");
  await expect(ads).toHaveAttribute("aria-pressed", "false");

  await ads.tap();
  await expect(ads).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => (window as unknown as { __fpsGame: { touch: { aiming: boolean } } }).__fpsGame.touch.aiming,
    ),
  ).toBe(true);

  await ads.tap();
  await expect(ads).toHaveAttribute("aria-pressed", "false");
});
