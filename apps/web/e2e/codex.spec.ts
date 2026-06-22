import { GAME_APPS } from "@deadrot/catalog";
import { expect, test } from "@playwright/test";

test.describe("/codex", () => {
  test("renders generated codex sections and canonical game cards", async ({ page }) => {
    await page.goto("/codex");

    await expect(page.getByRole("heading", { level: 1, name: "Deadrot Codex" })).toBeVisible();

    const main = page.getByRole("main");
    for (const section of ["Games", "Factions", "Characters", "Bestiary", "Locations", "Timeline"]) {
      await expect(main.getByRole("link", { name: section, exact: true })).toBeVisible();
    }

    for (const game of GAME_APPS) {
      await expect(page.locator(`[data-testid="codex-entry"][data-kind="game"][data-slug="${game.slug}"]`)).toHaveCount(
        1,
      );
    }

    await expect(page.locator('[data-testid="codex-entry"][data-kind="location"]')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="codex-entry"][data-kind="timeline"]')).not.toHaveCount(0);
  });

  test("renders the Zero Day fall sites and the Skywatch fleet (#141)", async ({ page }) => {
    await page.goto("/codex");

    for (const slug of ["the-lantern", "cradle-field"]) {
      await expect(page.locator(`[data-testid="codex-entry"][data-kind="location"][data-slug="${slug}"]`)).toHaveCount(
        1,
      );
    }

    await expect(
      page.locator('[data-testid="codex-entry"][data-kind="location"][data-slug="the-lantern"]'),
    ).toContainText("The Lantern");
    await expect(
      page.locator('[data-testid="codex-entry"][data-kind="location"][data-slug="cradle-field"]'),
    ).toContainText("Cradle Field");

    await expect(
      page.locator('[data-testid="codex-entry"][data-kind="timeline"][data-slug="zero-day-first-contact"]'),
    ).toContainText("Skywatch");
  });

  test("site header navigates to the public codex", async ({ page }) => {
    await page.goto("/");

    const codexLink = page.getByRole("link", { name: "Codex" });
    if ((await codexLink.count()) === 0 || !(await codexLink.first().isVisible())) {
      await page.getByRole("button", { name: "Toggle menu" }).click();
    }
    await page.getByRole("link", { name: "Codex" }).first().click();

    await expect(page).toHaveURL(/\/codex\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Deadrot Codex" })).toBeVisible();
  });
});
