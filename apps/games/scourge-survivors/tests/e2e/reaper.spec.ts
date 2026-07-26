import { expect, type Page, test } from "@playwright/test";
import { getLocation } from "@shipshitgames/assets/lore";
import { SURVIVOR_RUN_CHAPTERS } from "../../src/game/data/survivors";

// The Toll (#278): at the 10:00 mark of a structured Survivors run the breach
// sends its named reaper, which ends the run one way or the other. These specs
// fast-forward the run clock to each of the arrival's thresholds (house style:
// direct state surgery on __fpsGame), let real frames deliver every beat, then
// force each ending deterministically.
//
// The run holds its pre-picked arena for the whole descent (#276), and the
// reaper wears that arena's lore-sourced climax boss. These specs clear
// localStorage, so the run lands on the default site, Ashgate — expectations
// come from the lore data layer, never a hardcoded boss banner.
const ARENA_BOSS = getLocation("ashgate")?.boss?.name;
const FINAL_CHAPTER = SURVIVOR_RUN_CHAPTERS[SURVIVOR_RUN_CHAPTERS.length - 1];

type HudSnapshot = {
  status: string;
  outcome: "win" | "dead" | null;
  survivors: boolean;
  runMode: string;
  runDepth: number;
  runDepthTotal: number;
  runDepthName: string;
  bossActive: boolean;
  bossName: string | null;
};

type DevEnemy = {
  alive: boolean;
  group: { position: { x: number; z: number } };
};

type DevGame = {
  startSurvivors: (classId: "ranger") => void;
  ctx: {
    status: string;
    survivorGoalTime: number;
    body: { position: { x: number; z: number } };
  };
  sys: {
    hud: { emit: () => void };
    survivors: {
      survClock: number;
      reaperWarned: boolean;
      reaper: DevEnemy | null;
      autoDamageEnemy: (enemy: DevEnemy, dmg: number) => void;
    };
  };
};

const SHOP_KEY = "scourge-survivors.shop.v1";

async function snapshot(page: Page): Promise<HudSnapshot> {
  return page.evaluate(() => (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot());
}

async function shopGold(page: Page): Promise<number> {
  return page.evaluate((key) => Number(JSON.parse(localStorage.getItem(key) ?? '{"gold":0}').gold) || 0, SHOP_KEY);
}

async function boot(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as unknown as { __fpsGame?: unknown }).__fpsGame);
  // Playwright reuses any listener on the e2e port (reuseExistingServer), so a
  // stale dev server from another checkout can silently serve a bundle without
  // this feature. Fail fast with a clear message instead of timing out on polls.
  const hasReaperFeature = await page.evaluate(() => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    return "reaper" in (game.sys.survivors as object);
  });
  if (!hasReaperFeature) {
    throw new Error(
      "the reused dev server serves a bundle without the reaper feature — kill stale servers on the e2e port (or set E2E_PORT) and re-run",
    );
  }
}

async function startStructuredRun(page: Page) {
  await page.evaluate(async () => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    await game.startSurvivors("ranger");
    // Bypass the pointer-lock gate so the rAF loop actually ticks gameplay.
    game.ctx.status = "playing";
    game.sys.hud.emit();
  });
  await expect.poll(() => snapshot(page).then((state) => state.status)).toBe("playing");
  await expect.poll(() => snapshot(page).then((state) => state.survivors)).toBe(true);
}

/**
 * Walk the run to the toll's arrival, one authored beat at a time: the final
 * chapter advance, the warning inside its lead window, then the arrival itself.
 *
 * Each beat waits on a real frame, never on the run clock *accruing*. That clock
 * is simulated, and the frame loop clamps every delta to 0.1s, so a loaded runner
 * advances the sim well behind wall time — waiting for a whole simulated second
 * to elapse is a race the poll can lose while the director is working perfectly.
 * Writing the clock to each threshold the director tests, rather than to just
 * under it, makes every beat land on the next frame.
 */
async function fastForwardToTheToll(page: Page) {
  // Inside the warning's lead window but before the arrival: the chapter advance
  // early-returns on its own frame, then the warning latches on the next.
  await page.evaluate(() => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.sys.survivors.survClock = game.ctx.survivorGoalTime - 1;
  });
  await expect.poll(() => snapshot(page).then((state) => state.runDepth)).toBe(SURVIVOR_RUN_CHAPTERS.length);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __fpsGame: DevGame }).__fpsGame.sys.survivors.reaperWarned))
    .toBe(true);

  // On the arrival threshold, so the spawn lands on the very next frame.
  await page.evaluate(() => {
    const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
    game.sys.survivors.survClock = game.ctx.survivorGoalTime;
  });
  await expect.poll(() => snapshot(page).then((state) => state.bossActive)).toBe(true);
}

test.describe("the 10:00 reaper (The Toll)", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("the toll arrives at 10:00 and ends the run", async ({ page }) => {
    await boot(page);
    const goldBefore = await shopGold(page);
    await startStructuredRun(page);
    await fastForwardToTheToll(page);

    // The arrival lands on the final chapter and carries the arena's
    // lore-sourced boss name — never a hardcoded generic boss banner.
    expect(ARENA_BOSS, "lore must name Ashgate's climax boss").toBeTruthy();
    const arrival = await snapshot(page);
    expect(arrival).toMatchObject({
      bossActive: true,
      bossName: ARENA_BOSS,
      runMode: "structured",
      runDepth: SURVIVOR_RUN_CHAPTERS.length,
      runDepthTotal: SURVIVOR_RUN_CHAPTERS.length,
      runDepthName: FINAL_CHAPTER.name,
    });
    await expect(page.locator(".scourge-boss-label")).toContainText(ARENA_BOSS as string);

    // Make the one-shot deterministic: stand the reaper next to the player and
    // let its touch attack land on real frames (house style allows mutation).
    await page.evaluate(() => {
      const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
      const reaper = game.sys.survivors.reaper;
      if (!reaper) throw new Error("bossActive without a director-held reaper reference");
      reaper.group.position.x = game.ctx.body.position.x + 1.2;
      reaper.group.position.z = game.ctx.body.position.z;
    });

    await expect
      .poll(() => snapshot(page).then((state) => ({ status: state.status, outcome: state.outcome })), {
        timeout: 15_000,
      })
      .toEqual({ status: "gameover", outcome: "dead" });

    await expect(page.getByText("RUN SUMMARY")).toBeVisible();
    await expect(page.getByText("Structured run — operator signal gone")).toBeVisible();

    // The run still banks gold: persistent shop balance grows and the summary
    // shows the earned amount.
    await expect.poll(() => shopGold(page)).toBeGreaterThan(goldBefore);
    const earned = (await shopGold(page)) - goldBefore;
    await expect(page.getByTestId("summary-gold")).toContainText(`+${earned.toLocaleString()}`);
    await expect(page.getByText("saved to shop")).toBeVisible();
  });

  test("felling the toll seals the breach", async ({ page }) => {
    await boot(page);
    await startStructuredRun(page);
    await fastForwardToTheToll(page);

    // Kill the reaper through the house damage path (autoDamageEnemy routes the
    // death through the director's victory branch). One overwhelming hit kills
    // it; if a boss shield phase blocks, the poll re-strikes on later frames.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (window as unknown as { __fpsGame: DevGame }).__fpsGame;
            const reaper = game.sys.survivors.reaper;
            if (reaper?.alive) game.sys.survivors.autoDamageEnemy(reaper, 1_000_000_000);
            const hud = (window as unknown as { __hudSnapshot: () => HudSnapshot }).__hudSnapshot();
            return { status: hud.status, outcome: hud.outcome };
          }),
        { timeout: 15_000 },
      )
      .toEqual({ status: "gameover", outcome: "win" });

    await expect(page.getByText("RUN SUMMARY")).toBeVisible();
    await expect(page.getByText("Structured run — breach sealed")).toBeVisible();
  });
});
