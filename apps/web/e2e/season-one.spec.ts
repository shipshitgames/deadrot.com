import { expect, test } from "@playwright/test";

// E2E coverage for the Season One story spine + game operation surface.
//
// The home page renders WITHOUT secrets — Clerk/Stripe are keyless no-ops — so
// it is fully renderable in `next dev`. The Season One section ties every game
// to a single front operation; detail pages echo that same operation. We assert
// on the spine, the per-game front operations, a detail page's Warline op, and
// the operation label on the game cards. We NEVER navigate external links.

// The SEASON_ONE.title rendered as the section heading on the home spine.
const SEASON_ONE_TITLE = "Join the Front";

// Every game the spine is expected to render a front operation for, one per game.
const EXPECTED_SLUGS = [
  "scourge-survivors",
  "deadlane",
  "pactfall",
  "brawl",
  "starblight",
  "redline",
  "rothulk",
  "warline",
] as const;

test.describe("season one spine", () => {
  test("home renders the Season One story spine", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("season-one")).toBeVisible();
    await expect(page.getByRole("heading", { name: SEASON_ONE_TITLE })).toBeVisible();
    await expect(page.getByTestId("season-one-lede")).toBeVisible();
  });

  test("every game shows a front operation on the home spine", async ({ page }) => {
    await page.goto("/");

    for (const slug of EXPECTED_SLUGS) {
      await expect(page.locator(`[data-testid="front-operation"][data-slug="${slug}"]`)).toHaveCount(1);
    }

    // Assert a floor (not an exact count) so adding a game never breaks this.
    expect(await page.locator('[data-testid="front-operation"]').count()).toBeGreaterThanOrEqual(EXPECTED_SLUGS.length);
  });

  test("game detail page surfaces its Warline operation", async ({ page }) => {
    // next.config.mjs sets trailingSlash: true, so the canonical URL is /games/<slug>/.
    await page.goto("/games/scourge-survivors");

    const operation = page.getByTestId("warline-operation");
    await expect(operation).toBeVisible();
    await expect(operation).toContainText("Breach Purge");
  });

  test("game card shows the operation label", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("game-card-operation").first()).toBeVisible();
  });
});
