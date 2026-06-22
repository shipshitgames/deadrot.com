import { expect, type Page, test } from "@playwright/test";

// Shared cross-game War-Effort buff (#280) — the *read* side of the loop.
//
// `reportWarlineOperation` banks each game's looted war resource into the shared
// front (covered end-to-end by warline-reporting.spec). This spec proves the
// other half inside a real game build: on load, Scourge Survivors pulls the
// shared War-Effort bonus from the front via `fetchWarEffortBonus`, derives the
// global damage multiplier from the pooled resources, and surfaces it as a
// player-facing buff badge — and that an unreachable front degrades gracefully
// to no buff without ever breaking the game.
//
// Scourge is the reference implementation, so this spec only runs under the
// `scourge-survivors:` project (the shared front GET is mocked, no live server).

const FRONT_GLOB = "**/parties/main/front";
const SCOURGE_PROJECT = "scourge-survivors:";

// A WorldState slice with a pooled resource total of two full tiers
// (2 × WAR_EFFORT.unitPerTier = 10000 → tier 2 → +8% damage). `warEffortBonus`
// reads only `state.resources`, so this minimal slice is enough to drive it.
const TWO_TIER_STATE = { resources: { scrap: 10_000, biomass: 0, fuel: 0, intel: 0 } };

test.describe("Warline shared war-effort buff (#280)", () => {
  test("a pooled front buff is fetched on load and surfaces as a player-facing badge", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith(SCOURGE_PROJECT), "Scourge is the reference implementation.");

    let getCount = 0;
    await page.route(FRONT_GLOB, async (route) => {
      if (route.request().method() === "GET") getCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: TWO_TIER_STATE }),
      });
    });

    // Point the config-gated reader at an interceptable host before any game code runs.
    await page.addInitScript(() => {
      (globalThis as { __warlineReporter?: { host: string } }).__warlineReporter = { host: "warline.e2e.test" };
    });

    await boot(page);

    // The bonus GET fired, and the derived buff is shown to the player.
    await expect.poll(() => getCount, { timeout: 8000 }).toBeGreaterThan(0);
    const badge = page.getByTestId("war-effort-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("T2");
    await expect(badge).toContainText("+8% dmg");
  });

  test("an unreachable front leaves the run unbuffed and never breaks the game", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith(SCOURGE_PROJECT), "Scourge is the reference implementation.");

    // The front is configured but dead: every request fails. `fetchWarEffortBonus`
    // must swallow this and resolve to the neutral 1x bonus (no badge).
    await page.route(FRONT_GLOB, async (route) => {
      await route.abort();
    });
    await page.addInitScript(() => {
      (globalThis as { __warlineReporter?: { host: string } }).__warlineReporter = { host: "warline.e2e.test" };
    });

    await boot(page);

    // Give the failed fetch time to settle, then assert the buff badge never appeared.
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("war-effort-badge")).toHaveCount(0);
    // The game itself booted fine — the offline front cost the player nothing but the buff.
    await expect(page.getByTestId("game-canvas")).toBeVisible();
  });
});

async function boot(page: Page) {
  await page.goto("/");
  // React has mounted and the game is live (the war-effort fetch fires from the
  // WarEffortBadge mount effect that renders alongside the game). The canvas +
  // the DEV debug handle are the stable, menu-independent proof the app booted.
  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const win = window as unknown as { __fpsGame?: unknown };
    return Boolean(win.__fpsGame);
  });
}
