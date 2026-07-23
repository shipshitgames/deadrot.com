import { expect, type Page, test } from "@playwright/test";

// Deep lifecycle spec for starblight. The boot smoke in games.spec.ts only opens
// the Drydock once + ENGAGE + 3 HUD asserts; this file exercises the FULL
// menu -> drydock -> run -> pause -> resume -> exit-to-title -> re-engage loop.
//
// This lifecycle suite deliberately stays black-box and reads DOM state written
// by HudSystem plus the shared React PauseMenu. Deterministic combat, draft, and
// boss coverage belongs to starblight-headless.spec.ts and its dev-only adapter.

// starblight does not connect to PartyKit/WebSocket (unlike warline), so the
// console should be entirely clean — keep the ignore list empty.
const ignoredConsoleErrors: RegExp[] = [];

/**
 * Boot the title screen and dismiss the shared splash by CLICKING the prompt.
 *
 * We must NOT press Enter/Space: useEnterToReveal (packages/ui/src/MainMenuEnter
 * .tsx) listens for keydown Enter/Space without stopPropagation, so the keypress
 * also reaches the game's InputSystem (window keydown -> confirmQueued) and the
 * title-phase loop's consumeConfirm() would auto-start the run, skipping the
 * menu nav entirely (Drydock/menu assertions would then fail).
 */
async function bootToMenu(page: Page) {
  await page.goto("/");

  // Title hero copy is only visible BEFORE the menu reveal. The composite
  // "STARBLIGHT" matches the split STAR+BLIGHT title lines in #banner-title.
  await expect(page.getByText("STARBLIGHT")).toBeVisible();
  await expect(page.locator("#int-text")).toContainText("100/100");

  const enterPrompt = page.getByText("Press Enter to continue");
  await expect(enterPrompt).toBeVisible();
  await enterPrompt.click();
  await expect(enterPrompt).toBeHidden();
}

/** Wire console/pageerror capture exactly like games.spec's smoke harness. */
function captureConsole(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { consoleErrors, pageErrors };
}

function assertCleanConsole(consoleErrors: string[], pageErrors: string[]) {
  const unexpected = consoleErrors.filter((message) => !ignoredConsoleErrors.some((pattern) => pattern.test(message)));
  expect(pageErrors).toEqual([]);
  expect(unexpected).toEqual([]);
}

test.describe("starblight deep lifecycle", () => {
  test("drydock round-trip surfaces every meta-upgrade and a fresh dock is unaffordable", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "starblight deep spec");
    const { consoleErrors, pageErrors } = captureConsole(page);

    await bootToMenu(page);

    // Open the Drydock (meta-upgrade shop) from the Upgrades action.
    await page.getByRole("button", { name: /^Upgrades\b/i }).click();
    await expect(page.getByRole("dialog", { name: "Drydock" })).toBeVisible();

    // All four shop cards render verbatim (DrydockScreen maps SHOP_UPGRADES).
    // Match the card TITLE element specifically: a bare getByText("SALVAGE
    // MAGNET") is ambiguous because the SALVAGE MAGNET card's own description
    // ("+15% starting salvage magnet per tier") also contains the word "magnet",
    // tripping strict mode. The title lives in <b class="ssg-upgrade-card__title">.
    for (const name of ["REINFORCED FRAME", "SALVAGE MAGNET", "SALVAGE TITHE", "PHALANX CACHE"]) {
      await expect(page.locator(".ssg-upgrade-card__title", { hasText: name })).toBeVisible();
    }

    // A fresh dock has banked 0 wreckage (MainMenuTopBar meta), so the cheapest
    // card (REINFORCED FRAME, tier-0 cost 40) is unaffordable -> disabled. The
    // tier-0 cost meta "40 ◆" is shown on the card.
    await expect(page.getByText("0 wreckage")).toBeVisible();
    await expect(page.getByText("40 ◆")).toBeVisible();
    // UpgradeCard (packages/ui/src/Menu.tsx) renders a native <button> with the
    // `disabled` attr forwarded, so the disabled state is assertable.
    const frameCard = page.locator(".ssg-upgrade-card").filter({ hasText: "REINFORCED FRAME" });
    await expect(frameCard).toBeDisabled();

    // Close via Back -> Drydock unmounts, cards gone.
    await page.getByRole("button", { name: /^Back\b/i }).click();
    await expect(page.getByRole("dialog", { name: "Drydock" })).toBeHidden();
    await expect(page.getByText("REINFORCED FRAME")).toBeHidden();

    assertCleanConsole(consoleErrors, pageErrors);
  });

  test("engage starts a fresh run and the HUD reflects a clean sortie", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "starblight deep spec");
    const { consoleErrors, pageErrors } = captureConsole(page);

    await bootToMenu(page);

    // Engage -> HudSystem wires #banner-btn click -> Game.startRun() -> phase
    // "playing". The banner hides off-title and the HUD shows a fresh run.
    await page.getByRole("button", { name: "ENGAGE" }).click();
    await expect(page.locator("#banner")).toHaveClass(/hidden/);

    await expect(page.locator("#level")).toHaveText("1");
    await expect(page.locator("#kills")).toContainText("0 kills");
    await expect(page.locator("#int-text")).toContainText("100/100");
    await expect(page.locator("#salvage")).toHaveText("0");

    // The pause button is un-hidden ONLY while phase === "playing"
    // (HudSystem.renderPause toggles `hidden` on phase !== "playing"). This
    // proves the run actually entered the playing phase.
    await expect(page.locator("#pause-btn")).not.toHaveClass(/hidden/);

    // Clean up the run we started so no banked state leaks into later tests.
    await returnToTitleViaPause(page);

    assertCleanConsole(consoleErrors, pageErrors);
  });

  test("full pause -> resume -> exit-to-title -> re-engage loop is deterministic and replayable", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "starblight deep spec");
    const { consoleErrors, pageErrors } = captureConsole(page);

    await bootToMenu(page);

    // --- Start a run ---
    await page.getByRole("button", { name: "ENGAGE" }).click();
    await expect(page.locator("#banner")).toHaveClass(/hidden/);
    await expect(page.locator("#level")).toHaveText("1");
    await expect(page.locator("#pause-btn")).not.toHaveClass(/hidden/);

    // --- Pause (click #pause-btn -> Game.pauseRun() -> shared React PauseMenu) ---
    await page.getByRole("button", { name: "Pause" }).click();
    const pauseDialog = page.getByRole("dialog", { name: "Paused" });
    await expect(pauseDialog).toBeVisible();
    // Status line is `${fmtTime} - LVL ${level} - ${kills} kills`. The run clock
    // ticks in real time, so assert the stable substrings (not the exact "0:00")
    // to dodge timer flake.
    await expect(pauseDialog).toContainText("LVL 1");
    await expect(pauseDialog).toContainText("0 kills");
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Main menu" })).toBeVisible();
    // Banner stays hidden while paused (renderBanner only un-hides on title/
    // gameover/victory).
    await expect(page.locator("#banner")).toHaveClass(/hidden/);

    // --- Resume (-> Game.resumeRun() -> phase "playing") ---
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(pauseDialog).toBeHidden();
    await expect(page.locator("#pause-btn")).not.toHaveClass(/hidden/);

    // --- Pause again, then exit to title (-> Game.returnToTitle() -> "title") ---
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(pauseDialog).toBeVisible();
    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(pauseDialog).toBeHidden();

    // Title banner is back up and the run state reset to a fresh sortie.
    await expect(page.locator("#banner")).not.toHaveClass(/hidden/);
    await expect(page.locator("#pause-btn")).toHaveClass(/hidden/); // re-hid off-playing
    await expect(page.locator("#int-text")).toContainText("100/100");

    // The splash GATE returns too: useEnterToReveal (packages/ui/src/
    // MainMenuEnter.tsx) resets `revealed` to false whenever `active` goes false
    // — and `active` (onTitle) went false the moment the run started. So exiting
    // to title puts us back at the "Press Enter to continue" splash with the
    // menu nav hidden, NOT at the revealed menu. Dismiss it again by CLICKING
    // (never a keypress — see bootToMenu) to re-mount the ENGAGE nav.
    const splashPrompt = page.getByText("Press Enter to continue");
    await expect(splashPrompt).toBeVisible();
    await splashPrompt.click();
    await expect(splashPrompt).toBeHidden();
    await expect(page.getByRole("button", { name: "ENGAGE" })).toBeVisible();

    // --- Re-engage from title proves the loop is replayable ---
    await page.getByRole("button", { name: "ENGAGE" }).click();
    await expect(page.locator("#banner")).toHaveClass(/hidden/);
    await expect(page.locator("#level")).toHaveText("1");
    await expect(page.locator("#pause-btn")).not.toHaveClass(/hidden/);

    // Clean up the run we re-started.
    await returnToTitleViaPause(page);

    assertCleanConsole(consoleErrors, pageErrors);
  });

  test("keyboard KeyP pauses a live run (InputSystem pause path)", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("starblight:"), "starblight deep spec");
    const { consoleErrors, pageErrors } = captureConsole(page);

    await bootToMenu(page);

    await page.getByRole("button", { name: "ENGAGE" }).click();
    await expect(page.locator("#banner")).toHaveClass(/hidden/);
    await expect(page.locator("#pause-btn")).not.toHaveClass(/hidden/);

    // KeyP -> InputSystem `pauseQueued` -> loop consumePause() -> Game.pauseRun().
    // Safe here because we are in the "playing" phase (the Enter/Space confirm
    // leak only matters on the title screen).
    await page.keyboard.press("KeyP");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();

    // Clean up.
    await page.getByRole("button", { name: "Main menu" }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeHidden();
    await expect(page.locator("#banner")).not.toHaveClass(/hidden/);

    assertCleanConsole(consoleErrors, pageErrors);
  });
});

/**
 * Tear down an in-progress run: pause via #pause-btn then take "Main menu" back
 * to the title. We never let a run actually END (the deep flow never triggers
 * gameover/victory), so no wreckage is ever banked to localStorage — but
 * returning to title keeps each test's exit state clean regardless.
 */
async function returnToTitleViaPause(page: Page) {
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Main menu" }).click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeHidden();
  await expect(page.locator("#banner")).not.toHaveClass(/hidden/);
}
