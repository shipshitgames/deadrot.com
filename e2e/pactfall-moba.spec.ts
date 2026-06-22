import { expect, type Page, test } from "@playwright/test";

// Pactfall single-lane MOBA slice: towers gate the base, and the lane/map model
// already describes top/mid/bot with only mid live. Drives the running Game via
// the window hooks main.ts installs (mirrors the brawl / rothulk e2e patterns).

interface TeamStructureSnapshot {
  towersTotal: number;
  towersStanding: number;
  baseHp: number;
  baseVulnerable: boolean;
}

interface PactfallSnapshot {
  phase: "title" | "playing" | "won" | "lost";
  paused: boolean;
  elapsed: number;
  buffed: boolean;
  map: { id: string; name: string; lanes: number; activeLanes: number; primaryLane: string };
  champion: { hp: number; maxHp: number; mana: number; alive: boolean; x: number; z: number };
  minions: { pyre: number; warden: number };
  structures: { pyre: TeamStructureSnapshot; warden: TeamStructureSnapshot };
}

test("Pactfall map model describes three lanes with only mid live", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("pactfall:"), "Pactfall-only MOBA slice regression.");

  await boot(page);
  const snap = await snapshot(page);

  // The data model represents top/mid/bot even though one lane is active.
  expect(snap.map.lanes).toBe(3);
  expect(snap.map.activeLanes).toBe(1);
  expect(snap.map.primaryLane).toBe("mid");

  // A fresh match deploys a full, symmetric tower line shielding both bases.
  expect(snap.structures.pyre.towersTotal).toBeGreaterThan(0);
  expect(snap.structures.warden.towersTotal).toBe(snap.structures.pyre.towersTotal);
  expect(snap.structures.warden.towersStanding).toBe(snap.structures.warden.towersTotal);
  expect(snap.structures.warden.baseVulnerable).toBe(false);
});

test("towers gate the base, and toppling the base wins the lane", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("pactfall:"), "Pactfall-only MOBA slice regression.");

  await boot(page);
  await beginRun(page);
  await expect.poll(() => field(page, "phase")).toBe("playing");

  // The HUD shows the Warden tower line standing while the base is shielded.
  await expect(page.locator("#towers-enemy")).not.toHaveText("OPEN");
  expect((await snapshot(page)).structures.warden.baseVulnerable).toBe(false);

  // Topple the Warden tower line through the live sim; the base becomes exposed.
  await razeWardenTowers(page);
  await expect.poll(async () => (await snapshot(page)).structures.warden.towersStanding).toBe(0);
  await expect.poll(async () => (await snapshot(page)).structures.warden.baseVulnerable).toBe(true);
  await expect(page.locator("#towers-enemy")).toHaveText("OPEN");

  // Bring the now-vulnerable base down: the lane resolves to a victory.
  await toppleWardenBase(page);
  await expect.poll(() => field(page, "phase")).toBe("won");
  await expect(page.getByText("VICTORY - WARDEN BASE FALLS")).toBeVisible();
});

test("losing the pyre base resolves the lane to a defeat", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("pactfall:"), "Pactfall-only MOBA slice regression.");

  await boot(page);
  await beginRun(page);
  await expect.poll(() => field(page, "phase")).toBe("playing");

  // Topple the Pyre base through the live sim: the lane resolves to a defeat
  // (the lose() path also drives war-result reporting the unit stubs can't reach).
  await topplePyreBase(page);
  await expect.poll(() => field(page, "phase")).toBe("lost");
  await expect(page.getByText("DEFEAT - THE PYRE IS EXTINGUISHED")).toBeVisible();
});

test("a resolved lane can be redeployed to a fresh, fully-shielded match", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("pactfall:"), "Pactfall-only MOBA slice regression.");

  await boot(page);
  await beginRun(page);
  await razeWardenTowers(page);
  await toppleWardenBase(page);
  await expect.poll(() => field(page, "phase")).toBe("won");

  // Redeploy: the tower line is rebuilt and the base is shielded once more.
  await beginRun(page);
  await expect.poll(() => field(page, "phase")).toBe("playing");
  const snap = await snapshot(page);
  expect(snap.structures.warden.towersStanding).toBe(snap.structures.warden.towersTotal);
  expect(snap.structures.warden.baseVulnerable).toBe(false);
});

// ---- helpers ----------------------------------------------------------------

async function boot(page: Page) {
  await page.goto("/");
  // The base meter labels carry a tower readout span ("2/2"), so match the
  // stable meter container rather than the now-composite label text.
  await expect(page.locator("#meter-base-friendly")).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __pactfallGame?: unknown }).__pactfallGame));
}

async function snapshot(page: Page): Promise<PactfallSnapshot> {
  return page.evaluate(() =>
    (window as unknown as { __pactfallSnapshot: () => PactfallSnapshot }).__pactfallSnapshot(),
  );
}

async function field<K extends keyof PactfallSnapshot>(page: Page, key: K): Promise<PactfallSnapshot[K]> {
  return page.evaluate(
    (k) => (window as unknown as { __pactfallSnapshot: () => PactfallSnapshot }).__pactfallSnapshot()[k],
    key,
  );
}

async function beginRun(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { __pactfallGame: { beginRun: () => void } }).__pactfallGame.beginRun(),
  );
}

async function razeWardenTowers(page: Page) {
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __pactfallGame: { entities: { towers: { team: string; alive: boolean; hp: number }[] } };
      }
    ).__pactfallGame;
    for (const t of game.entities.towers) {
      if (t.team === "warden") {
        t.alive = false;
        t.hp = 0;
      }
    }
  });
}

async function toppleWardenBase(page: Page) {
  await page.evaluate(() => {
    const base = (window as unknown as { __pactfallGame: { entities: { enemyBase: { alive: boolean; hp: number } } } })
      .__pactfallGame.entities.enemyBase;
    base.hp = 0;
    base.alive = false;
  });
}

async function topplePyreBase(page: Page) {
  await page.evaluate(() => {
    const base = (
      window as unknown as { __pactfallGame: { entities: { friendlyBase: { alive: boolean; hp: number } } } }
    ).__pactfallGame.entities.friendlyBase;
    base.hp = 0;
    base.alive = false;
  });
}
