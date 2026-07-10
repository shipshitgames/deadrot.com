import { expect, type Page, test } from "@playwright/test";

// Root-harness deep spec (#35): proves Scourge Survivors stays COMBAT-READABLE on
// the live renderer once each arena is dressed (#34). The unit test
// (apps/games/scourge-survivors/tests/unit/arena-readability.test.ts) audits the
// authored map data; this boots each map and reads ArenaSystem's `readability`
// block back off the BUILT scene — opacity maxima measured on the real
// decal/prop/haze materials plus the scene's fog + background — so a regression
// that only surfaces once the arena is dressed (a clamp dropped, a theme
// override darkened, a stray opaque sprite, fog tightened onto the play space)
// fails here too. Runs on desktop + Pixel-7 mobile via the shared game-matrix
// projects. Mobile-safe: it never waits on wall-clock sim time, only on
// startSandbox() rebuilding the arena (synchronous), so the frame-throttled
// mobile shard can't time out.

// Budget limits inlined (no src import) to keep this runnable in the Playwright
// context without alias resolution — they mirror READABILITY_BUDGET, which the
// unit test asserts is frozen so the two copies can't silently drift.
const BUDGET = {
  maxDecalOpacity: 0.3,
  maxPropOpacity: 0.9,
  maxInPlayPropOpacity: 0.85,
  maxHorizonOpacity: 0.3,
  minFogNear: 12,
  maxBackgroundLuminance: 0.2,
} as const;

type ReadabilityReport = {
  ok: boolean;
  violations: number;
  maxDecalOpacity: number;
  maxPropOpacity: number;
  maxInPlayPropOpacity: number;
  horizonOpacity: number;
  fogNear: number;
  fogFar: number;
  fogFarRequired: number;
  backgroundLuminance: number;
};

type HudSnapshot = { status: string; sandbox: boolean; mapName: string };

async function hud(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function arenaMapId(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __fpsGame: { arenaDebugSnapshot: () => { mapId: string } } }
      ).__fpsGame.arenaDebugSnapshot().mapId,
  );
}

async function readability(page: Page): Promise<ReadabilityReport | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __fpsGame: { arenaDebugSnapshot: () => { readability: ReadabilityReport | null } } }
      ).__fpsGame.arenaDebugSnapshot().readability,
  );
}

function expectWithinBudget(report: ReadabilityReport | null, label: string) {
  expect(report, `${label} readability block`).not.toBeNull();
  if (!report) return;
  // The scene's own verdict — the renderer scored itself legible.
  expect(report.violations, `${label}: ${JSON.stringify(report)}`).toBe(0);
  expect(report.ok, label).toBe(true);
  // Independent inline checks so this spec fails loudly even if the in-engine
  // scorer ever drifts from the budget it claims to enforce.
  expect(report.maxDecalOpacity, `${label} decal opacity`).toBeLessThanOrEqual(BUDGET.maxDecalOpacity);
  expect(report.maxPropOpacity, `${label} prop opacity`).toBeLessThanOrEqual(BUDGET.maxPropOpacity);
  expect(report.maxInPlayPropOpacity, `${label} in-core prop opacity`).toBeLessThanOrEqual(BUDGET.maxInPlayPropOpacity);
  expect(report.horizonOpacity, `${label} horizon haze opacity`).toBeLessThanOrEqual(BUDGET.maxHorizonOpacity);
  expect(report.fogNear, `${label} fog near`).toBeGreaterThanOrEqual(BUDGET.minFogNear);
  expect(report.fogFar, `${label} fog far`).toBeGreaterThanOrEqual(report.fogFarRequired);
  expect(report.backgroundLuminance, `${label} background luminance`).toBeLessThanOrEqual(
    BUDGET.maxBackgroundLuminance,
  );
}

async function bootSandbox(page: Page) {
  await page.goto("/?sandbox=1");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  await expect(page.getByTestId("game-canvas")).toBeVisible();
}

async function loadMap(page: Page, mapId: string) {
  await page.evaluate(async (id) => {
    await (
      window as unknown as { __fpsGame: { startSandbox: (mapId: string) => Promise<void> } }
    ).__fpsGame.startSandbox(id);
  }, mapId);
  // Poll mapId before reading the readback — a rebuild races the snapshot.
  await expect.poll(() => hud(page).then((s) => s.sandbox)).toBe(true);
  await expect.poll(() => arenaMapId(page)).toBe(mapId);
}

test("Scourge campaign arenas stay within the combat-readability budget on the live scene (#35)", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-only readability regression.");

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await bootSandbox(page);

  for (const id of ["ashgate", "hollowlanes", "maw", "perdition"] as const) {
    await loadMap(page, id);
    expectWithinBudget(await readability(page), id);
  }

  expect(consoleErrors, "no console/page errors").toEqual([]);
});

test("The Gantry (sandbox structural map) stays within the readability budget (#35)", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("scourge-survivors:"), "Scourge-only readability regression.");

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await bootSandbox(page);
  await loadMap(page, "gantry");
  expectWithinBudget(await readability(page), "gantry");

  expect(consoleErrors, "no console/page errors").toEqual([]);
});
