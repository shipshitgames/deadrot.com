import { expect, test } from "@playwright/test";

// Game-visibility flag layer (#384) — end-to-end coverage for the home gallery.
//
// The playwright.config.ts webServer boots Next with:
//   FLAG_OVERRIDES={"game-rothulk-visible":false}
// PostHog stays unconfigured (NEXT_PUBLIC_POSTHOG_KEY unset), so the only flag
// source is FLAG_OVERRIDES. Therefore:
//   - rothulk  => killed (explicit false override)
//   - every other game => default-ON (game-<slug>-visible defaults true)
//
// These tests assert that selectVisibleGames correctly plumbs through to the
// rendered gallery, with no paywall changes — the flag is a UX toggle only.
//
// Selector note: next.config sets trailingSlash:true, so GameCard's
// `/games/<slug>` href renders as `/games/<slug>/` in the DOM. We match the href
// by PREFIX (^=) so the assertions are robust to that trailing slash — and so the
// "absent" check below is a real negative, not a false pass on a format mismatch.

test.describe("game visibility flags (home gallery)", () => {
  test("a killed game's card is absent from the gallery", async ({ page }) => {
    await page.goto("/");

    const gamesSection = page.locator("#games");

    // Sanity: the gallery actually rendered (so absence below is meaningful, not
    // an empty section). scourge-survivors is default-ON, so its card must exist.
    await expect(gamesSection.locator('a[href^="/games/scourge-survivors"]')).toHaveCount(1);

    // No link to the rothulk detail page should exist anywhere in the gallery.
    await expect(gamesSection.locator('a[href^="/games/rothulk"]')).toHaveCount(0);

    // The rothulk title heading should not appear either.
    await expect(gamesSection.getByRole("heading", { name: /rothulk/i })).toHaveCount(0);
  });

  test("a default-visible game's card is present in the gallery", async ({ page }) => {
    await page.goto("/");

    const gamesSection = page.locator("#games");

    // scourge-survivors is not in FLAG_OVERRIDES, so it defaults ON.
    const card = gamesSection.locator('a[href^="/games/scourge-survivors"]');
    await expect(card).toBeVisible();

    // The h3 title inside the card must render the game name.
    await expect(card.getByRole("heading", { name: /scourge survivors/i })).toBeVisible();
  });

  test("the access legend still renders when the flag layer is active", async ({ page }) => {
    await page.goto("/");

    // The legend lives inside #games — flag filtering must not break the surface.
    const legend = page.locator('#games ul[aria-label="What the game card states mean"]');
    await expect(legend).toBeVisible();
  });
});
