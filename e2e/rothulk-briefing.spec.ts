import { expect, type Page, test } from "@playwright/test";

// Rothulk lore pass (#364): the title menu surfaces the Breach Sabotage mission
// briefing — the canon Warline operation frame plus the three sabotage beats
// (ignite → collapse → escape) tied to Choir isolation and the Warline sabotage
// report. This is a render-pure surface (no game sim, no wall-clock), so it is
// safe on the frame-throttled Pixel 7 mobile project as well as desktop. We
// hardcode the canon copy so the e2e guards the prose, not just the presence.

const ROTHULK_PROJECT = "rothulk:";

// Reveal the main-menu nav (the briefing is hidden on the splash, shown with the
// menu) WITHOUT starting a run — the briefing lives on the menu, not in-game.
async function revealMenu(page: Page) {
  await page.goto("/");
  await expect(page.getByText("ROTHULK")).toBeVisible();
  await page.getByTestId("main-menu-enter-prompt").click();
  // The Breach action proves the nav revealed; the briefing reveals alongside it.
  await expect(page.getByRole("button", { name: /^Breach\b/i })).toBeVisible();
}

test("the title menu surfaces the Breach Sabotage briefing", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(ROTHULK_PROJECT), "Rothulk-only lore briefing surface.");

  await revealMenu(page);

  // The briefing exposes an accessible name (aria-label) so this scopes cleanly.
  const briefing = page.getByRole("region", { name: "Breach Sabotage briefing" });
  await expect(briefing).toBeVisible();

  // Canon operation name (from games.json warlineRole) heads the card.
  await expect(briefing.getByText("Breach Sabotage", { exact: true })).toBeVisible();
  // The one-line operation frame: the climb severs the local node.
  await expect(briefing.getByText(/sever the local node/)).toBeVisible();
});

test("the briefing frames the three sabotage beats tied to Choir isolation", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(ROTHULK_PROJECT), "Rothulk-only lore briefing surface.");

  await revealMenu(page);
  const briefing = page.getByRole("region", { name: "Breach Sabotage briefing" });

  // Beat 1 — ignite the breach-core (the Choir repeater-heart).
  await expect(briefing.getByText("Ignite the core")).toBeVisible();
  // Beat 2 — collapse the node, severing it from the Choir.
  await expect(briefing.getByText("Collapse the node")).toBeVisible();
  // Beat 3 — run it feral, handing the lane back to the war.
  await expect(briefing.getByText("Run it feral")).toBeVisible();

  // The closing Warline sabotage report — the canon front dispatch. Scoped to the
  // beat's report line: the operation summary line above quotes the same canon
  // sentence, so a bare text match would be ambiguous.
  const report = briefing.locator(".op-briefing-beat-report", { hasText: /one sabotaged nest goes feral and blind/i });
  await expect(report).toBeVisible();
});
