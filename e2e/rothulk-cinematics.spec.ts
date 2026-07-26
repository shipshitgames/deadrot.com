import { expect, type Page, test } from "@playwright/test";

interface RothulkCinematicSnapshot {
  mode: string;
  phase: string;
  cinematicId: string | null;
  feralScourge: number;
}

test("Rothulk cinematics frame and safely skip the infiltration arc", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("rothulk:"), "Rothulk-only cinematic regression.");

  await page.goto("/");
  await expect(page.getByText("ROTHULK")).toBeVisible();
  await page.getByTestId("main-menu-enter-prompt").click();
  await page.getByRole("button", { name: /^Breach\b/i }).click();

  await expect(page.getByTestId("cinematic-intro")).toContainText("Breach Sabotage");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cinematic-intro")).toBeHidden();

  await page.evaluate(() => {
    (
      window as unknown as {
        __rothulkGame: { teleportToCore: () => void };
      }
    ).__rothulkGame.teleportToCore();
  });
  await expect(page.getByTestId("cinematic-ignite")).toContainText("Choir link is collapsing");
  await expectSnapshot(page, {
    phase: "escape",
    cinematicId: "ignite-core",
  });

  await page.keyboard.press("Space");
  await expect(page.getByTestId("cinematic-ignite")).toBeHidden();
  await page.waitForFunction(() => {
    const game = (
      window as unknown as {
        __rothulkGame?: { debugSnapshot: () => RothulkCinematicSnapshot };
      }
    ).__rothulkGame;
    return (game?.debugSnapshot().feralScourge ?? 0) > 0;
  });

  await page.evaluate(() => {
    (
      window as unknown as {
        __rothulkGame: { teleportToExit: () => void };
      }
    ).__rothulkGame.teleportToExit();
  });
  await expect(page.getByTestId("cinematic-escape")).toContainText("Isolation Confirmed");
  await page.keyboard.press("Enter");
  await expect(page.locator("#toast")).toContainText("HULK SEVERED");
});

async function expectSnapshot(page: Page, expected: Partial<RothulkCinematicSnapshot>) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        return (
          window as unknown as {
            __rothulkGame: { debugSnapshot: () => RothulkCinematicSnapshot };
          }
        ).__rothulkGame.debugSnapshot();
      }),
    )
    .toMatchObject(expected);
}
