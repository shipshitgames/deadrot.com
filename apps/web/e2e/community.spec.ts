import { expect, test } from "@playwright/test";

// E2E coverage for the /community ("Community Builds & Feedback") page.
//
// These pages render WITHOUT secrets — Clerk/Stripe are keyless no-ops — so the
// public page is fully renderable in `next dev`. The feedback buttons are
// target=_blank deep links to github.com; we NEVER navigate to them. Instead we
// assert on the href attribute only, decoding the `labels` query param to verify
// the scope/umbrella labels are baked into the pre-filled GitHub issue URL.

const HERO_TITLE = "Build It With Us";
const ISSUE_NEW_PREFIX = "https://github.com/shipshitgames/deadrot.com/issues/new";

// All roster slugs the page is expected to render (PLAYABLE -> "Open Preview").
const EXPECTED_SLUGS = [
  "deadlane",
  "pactfall",
  "redline",
  "rothulk",
  "scourge-survivors",
  "starblight",
  "warline",
  "brawl",
] as const;

/** Decode the `labels` query param of a GitHub "new issue" URL into a list. */
function decodedLabels(href: string): string[] {
  const url = new URL(href);
  const labels = url.searchParams.get("labels") ?? "";
  return labels.split(",").filter((label) => label.length > 0);
}

test.describe("/community", () => {
  test("renders the hero with the page heading", async ({ page }) => {
    await page.goto("/community");

    await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible();
  });

  test("renders a card for every known build", async ({ page }) => {
    await page.goto("/community");

    const cards = page.getByTestId("community-build");
    // Assert a floor (not an exact count) so adding a build never breaks this,
    // then assert every known slug is present so a missing build always does.
    expect(await cards.count()).toBeGreaterThanOrEqual(EXPECTED_SLUGS.length);

    for (const slug of EXPECTED_SLUGS) {
      await expect(page.locator(`[data-testid="community-build"][data-slug="${slug}"]`)).toHaveCount(1);
    }
  });

  test("scourge-survivors and warline cards exist", async ({ page }) => {
    await page.goto("/community");

    await expect(page.locator('[data-testid="community-build"][data-slug="scourge-survivors"]')).toBeVisible();
    await expect(page.locator('[data-testid="community-build"][data-slug="warline"]')).toBeVisible();
  });

  test("scourge-survivors card has correctly-labelled GitHub deep links", async ({ page }) => {
    await page.goto("/community");

    const card = page.locator('[data-testid="community-build"][data-slug="scourge-survivors"]');
    await expect(card).toBeVisible();

    // Report a bug — issues/new deep link, labelled with the umbrella + scope.
    const bugLink = card.getByRole("link", { name: "Report a bug in Scourge Survivors" });
    const bugHref = await bugLink.getAttribute("href");
    expect(bugHref).not.toBeNull();
    expect(bugHref as string).toContain(ISSUE_NEW_PREFIX);
    const bugLabels = decodedLabels(bugHref as string);
    expect(bugLabels).toContain("community-feedback");
    expect(bugLabels).toContain("scourge-survivors");

    // Suggest an idea — also an issues/new deep link.
    const ideaLink = card.getByRole("link", { name: "Suggest an idea for Scourge Survivors" });
    const ideaHref = await ideaLink.getAttribute("href");
    expect(ideaHref).not.toBeNull();
    expect(ideaHref as string).toContain(ISSUE_NEW_PREFIX);
  });

  test("hero 'Send Site Feedback' link is a labelled issues/new deep link", async ({ page }) => {
    await page.goto("/community");

    const feedbackLink = page.getByRole("link", { name: "Send Site Feedback" });
    const href = await feedbackLink.getAttribute("href");
    expect(href).not.toBeNull();
    expect(href as string).toContain(ISSUE_NEW_PREFIX);
    expect(decodedLabels(href as string)).toContain("community-feedback");
  });

  test("footer Community link navigates from home to /community", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("contentinfo").getByRole("link", { name: "Community" }).click();

    // next.config.mjs sets trailingSlash: true, so the canonical URL is /community/.
    await expect(page).toHaveURL(/\/community\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible();
  });
});
