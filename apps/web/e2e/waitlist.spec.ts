import { expect, test } from "@playwright/test";

// Smoke coverage for the Deadrot access surface (#355). Runs under both the
// web:desktop and web:mobile projects (playwright.config.ts), so the waitlist
// path is exercised on both viewports per AC5. No auth/sink env is wired: the
// gate reads fully open and the waitlist route structured-logs + returns ok.

test.describe("home access surface", () => {
  test("the game-card access legend distinguishes all four states", async ({ page }) => {
    await page.goto("/");

    const legend = page.locator('ul[aria-label="What the game card states mean"]');
    await expect(legend).toBeVisible();

    // Every player-facing state is named and explained (available / preview /
    // waitlist / locked), so the card badges are legible at a glance.
    for (const label of ["Play now", "Preview", "Waitlist", "Locked"]) {
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    }
    // The keyless game cards never resolve to `locked`, so assert the legend renders
    // the real locked badge — including its distinguishing lock icon (AC2).
    const lockedItem = legend.locator("li", { hasText: "Locked" });
    await expect(lockedItem.locator("svg")).toBeVisible();
    // Honest framing — a preview/community build, never a finished-game promise.
    await expect(legend).toContainText(/preview build/i);
  });

  test("early-buyer / community-build copy is present without promising a finished game", async ({ page }) => {
    await page.goto("/");

    const waitlistSection = page.locator("#waitlist");
    await expect(waitlistSection).toContainText(/built in the open/i);
    await expect(waitlistSection).toContainText(/community/i);
    await expect(waitlistSection.getByRole("link", { name: /unlock the collection/i })).toBeVisible();
  });
});

test.describe("waitlist signup", () => {
  test("a visitor can join the waitlist from the homepage", async ({ page }) => {
    await page.goto("/");

    const email = page.getByLabel("Email address");
    await email.scrollIntoViewIfNeeded();
    await email.fill("survivor@deadrot.com");

    await page.getByRole("button", { name: "Join the waitlist" }).click();

    // The form swaps itself for a polite live-region confirmation on success.
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toContainText(/on the list/i);
  });

  test("an invalid email is rejected client-side (native validation blocks submit)", async ({ page }) => {
    await page.goto("/");

    const email = page.getByLabel("Email address");
    await email.scrollIntoViewIfNeeded();
    await email.fill("not-an-email");
    await page.getByRole("button", { name: "Join the waitlist" }).click();

    // type=email + required => the browser blocks the submit; no success banner.
    await expect(page.getByRole("status")).toHaveCount(0);
    const valid = await email.evaluate((el) => (el as HTMLInputElement).checkValidity());
    expect(valid).toBe(false);
  });
});
