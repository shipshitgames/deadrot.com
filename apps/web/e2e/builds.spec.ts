import { expect, test } from "@playwright/test";
import { latestBuildNote } from "../lib/build-notes";

test.describe("/builds", () => {
  test("renders build notes with validation evidence", async ({ page }) => {
    await page.goto("/builds");

    await expect(page.getByRole("heading", { level: 1, name: "Build Notes" })).toBeVisible();
    await expect(page.getByTestId("build-note").filter({ hasText: latestBuildNote.title })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(latestBuildNote.title, "i") }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${latestBuildNote.slug}/?$`));
    await expect(page.getByRole("heading", { level: 1, name: latestBuildNote.title })).toBeVisible();
    await expect(page.getByText("Validation")).toBeVisible();
    await expect(page.getByText("bun run assets:check")).toBeVisible();
  });

  test("community surface links to build notes", async ({ page }) => {
    await page.goto("/community");

    await page.getByRole("link", { name: "Build Notes" }).first().click();

    await expect(page).toHaveURL(/\/builds\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Build Notes" })).toBeVisible();
  });
});
