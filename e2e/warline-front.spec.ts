import { expect, type Page, test } from "@playwright/test";

// Warline deep slice: drive the LOCAL strategy simulation through the Command
// Table and assert observable state transitions. Unlike the boot smoke in
// games.spec.ts (boot + open table + see map/feed), this exercises the pure,
// synchronous reducers in @shipshitgames/warline via real rail-button clicks —
// Warline exposes NO window debug hook, so every drive is a DOM click and every
// assertion reads DOM (text/counts/aria). The LOCAL reducers are deterministic
// per-action (applyCommand/applyOperation run synchronously on click), so deltas
// captured immediately around a click are stable. The one timing hazard is the
// CONNECTING→LOCAL fallback at 2.5s, which re-seeds the world and would wipe an
// early mutation — bootIntoCommandTable gates on the LOCAL indicator so every test
// starts from the settled, re-seeded world. The 15s background tick adds no feed
// event in this window (falls need pressure>=100, narrative beats gate on cadence).
//
// Only runs under the warline:* projects (warline:desktop / warline:mobile) — the
// per-game dev server + port is Warline's own, so this is isolated.

const WARLINE_PROJECT = "warline:";

// The PartyKit dev host (VITE_WARLINE_HOST) defaults to localhost:1999 in DEV.
// The socket never opens in e2e, so the browser logs a console error before the
// 2500ms LOCAL fallback fires. This is the exact pattern games.spec.ts ignores.
const IGNORED_CONSOLE_ERRORS = [/WebSocket connection to .*localhost:1999/i];

// Read the Pact Army value. The army row is the only one labeled "PACT ARMY"
// (other resource cells carry numeric font-mono spans too, so a global numeric
// locator would be ambiguous) — scope to that row, then grab its numeric span.
// NOTE: the label <span> wraps both the text and a nested HelpTooltip button, so
// `exact: true` would NOT match (the span's text content isn't exactly the label).
// Use a substring match: getByText returns the smallest element containing the
// text (the label span), whose parent is the row div holding the value span.
// fmt() uses toLocaleString, but 25/50 are <1000 so no commas: toHaveText is safe.
function pactArmyValue(page: Page) {
  return page
    .getByText("PACT ARMY")
    .locator("..")
    .getByText(/^[\d,]+$/);
}

// Newest-first feed count, parsed from the "{n} events" span.
async function feedCount(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ events$/).textContent();
  return Number(text?.match(/\d+/)?.[0] ?? "0");
}

// Boot the splash, dismiss it by CLICKING the prompt (not Enter — useEnterToReveal
// does not stopPropagation, so a keypress also reaches game input), then take the
// title menu's Command Table action into the war room and confirm the full rail.
// Returns the collected console/pageerror buffers so each test can assert clean.
async function bootIntoCommandTable(page: Page): Promise<{ consoleErrors: string[]; pageErrors: string[] }> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  // Register listeners BEFORE goto so the partykit WS error is captured + filtered.
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto("/");

  // Title splash is up: the strategic-command hero is only visible before reveal.
  await expect(page.getByRole("heading", { name: "WARLINE" })).toBeVisible();
  await expect(page.getByText("Strategic Command")).toBeVisible();

  // Reveal the menu nav by clicking the prompt.
  const enterPrompt = page.getByTestId("main-menu-enter-prompt");
  await expect(enterPrompt).toBeVisible();
  await enterPrompt.click();
  await expect(enterPrompt).toBeHidden();

  // Take the title's Command Table action (scoped /^Command Table\b/i to dodge the
  // HUD + pause-menu "Command Table" collisions) into the war room.
  await page.getByRole("button", { name: /^Command Table\b/i }).click();

  // The full strategy rail mounts — not just the map+feed the smoke checks.
  await expect(page.getByRole("heading", { name: "The Front" })).toBeVisible();
  await expect(page.getByRole("img", { name: "War map of the front" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pact War Pool" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Command" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo · Operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your War Record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "War Feed" })).toBeVisible();

  // Settle the dual-runtime store before any caller mutates state. VITE_WARLINE_HOST
  // defaults to localhost:1999 in DEV, so the store boots in CONNECTING; the socket
  // never opens in e2e, so after CONNECT_TIMEOUT_MS=2500ms it falls back to LOCAL AND
  // RE-SEEDS the world (setState(createInitialWorld(...))). That re-seed wipes
  // pactArmy/feed, so commands issued during CONNECTING are silently discarded by the
  // reset. Gate on the LOCAL indicator here so every test starts from a settled,
  // re-seeded world (slack > the 2.5s fallback timer).
  await expect(page.getByText("LOCAL", { exact: true }).first()).toBeVisible({ timeout: 6000 });

  return { consoleErrors, pageErrors };
}

// Assert no unexpected console/pageerrors fired (filtering the partykit WS error).
function assertNoUnexpectedErrors(consoleErrors: string[], pageErrors: string[]) {
  const unexpected = consoleErrors.filter(
    (message) => !IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(message)),
  );
  expect(pageErrors).toEqual([]);
  expect(unexpected).toEqual([]);
}

test("boots into the Command Table on the LOCAL fallback with a clean front", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(WARLINE_PROJECT), "Warline deep front slice.");

  // bootIntoCommandTable already gated on the LOCAL fallback, so the world is
  // settled and re-seeded by the time we assert the fresh-front baseline below.
  const { consoleErrors, pageErrors } = await bootIntoCommandTable(page);

  // A fresh world starts with an empty feed (createInitialWorld → feed: []).
  await expect(page.getByText(/^0 events$/)).toBeVisible();
  await expect(page.getByText("No activity yet. Run an operation or issue a command.")).toBeVisible();

  // The Pact War Pool seeds at pactArmy 0 (createInitialWorld).
  await expect(pactArmyValue(page)).toHaveText("0");

  // War Record is empty on a fresh Playwright profile (isolated localStorage).
  await expect(page.getByText(/^No operations on record yet/)).toBeVisible();

  assertNoUnexpectedErrors(consoleErrors, pageErrors);
});

test('the "Why Builds Matter" briefing frames previews as operations on the shared front', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(WARLINE_PROJECT), "Warline deep front slice.");

  // The community-build story frame (#362) renders STORY_FRAME from
  // @shipshitgames/warline as a static, render-pure briefing card on the rail.
  // Hardcode the expected copy (matching this spec's existing pattern) so the
  // e2e also guards the briefing prose, not just its presence.
  const { consoleErrors, pageErrors } = await bootIntoCommandTable(page);

  // The card mounts with the rest of the rail. It exposes an accessible name
  // (aria-label) so this scopes cleanly to the briefing region.
  const briefing = page.getByRole("region", { name: "Why Builds Matter briefing" });
  await expect(briefing.getByRole("heading", { name: "Why Builds Matter" })).toBeVisible();

  // Thesis: every preview is an operation feeding one shared war.
  await expect(briefing.getByText("Every preview is an operation.")).toBeVisible();
  // Scope axis 1 — builds report as operations (the operations pillar), with a
  // contract-derived slate naming the real operations the Ops panel fires.
  await expect(briefing.getByText("Builds report as operations")).toBeVisible();
  await expect(briefing.getByText("Every build fields one operation on the front:")).toBeVisible();
  await expect(briefing.getByText("Purge a Breach")).toBeVisible();

  // Scope axis 2 — playtests become provisional field reports, not locked canon.
  await expect(briefing.getByText("Playtests become field reports, not promises.")).toBeVisible();
  await expect(briefing.getByText("provisional", { exact: true })).toBeVisible();

  // Scope axis 3 — Pyre/Warden/Scourge outcomes tied to the weekly release cadence.
  await expect(briefing.getByText("The front keeps the weekly release cadence.")).toBeVisible();
  await expect(briefing.getByText(/thins the nests before the next drop/)).toBeVisible();
  await expect(briefing.getByText(/The Choir escalates every week it runs/)).toBeVisible();

  assertNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("Muster banks exactly +25 army per click and logs faction-credited events", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(WARLINE_PROJECT), "Warline deep front slice.");

  const { consoleErrors, pageErrors } = await bootIntoCommandTable(page);
  const armyLoc = pactArmyValue(page);

  // Muster is enabled at boot: cost biomass80+scrap60 (have 200/500), needs no
  // region. applyCommand adds COMMAND_EFFECT.musterArmy=25 and pushes a command
  // event — both are randomness-free, so the deltas are exact.
  await expect(armyLoc).toHaveText("0");
  // Avoid the HelpTooltip sibling ("Explain Muster") by anchoring on /^Muster/.
  await page.getByRole("button", { name: /^Muster/ }).click();
  await expect(armyLoc).toHaveText("25");
  await expect(page.getByText(/^1 events$/)).toBeVisible();
  // The empty-state row is replaced once the first event lands.
  await expect(page.getByText("No activity yet. Run an operation or issue a command.")).toBeHidden();
  // Newest-first: the top feed entry is the muster line (default faction WARDENS,
  // lowercased in commands.ts: `${cmd.faction} mustered fresh troops.`).
  await expect(page.locator("ol li").first()).toContainText("mustered fresh troops");

  // Muster again → army 50 (cumulative reducer), feed 2 events. This also crosses
  // the army>=40 threshold that Deploy needs, proving the pool is real state.
  await page.getByRole("button", { name: /^Muster/ }).click();
  await expect(armyLoc).toHaveText("50");
  await expect(page.getByText(/^2 events$/)).toBeVisible();

  assertNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("region selection + faction toggle wire the Command panel and persist", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(WARLINE_PROJECT), "Warline deep front slice.");

  const { consoleErrors, pageErrors } = await bootIntoCommandTable(page);

  // Before a selection the Command panel shows the empty target, and Recon is
  // disabled because it needsRegion (even though intel150 covers its 50 cost).
  await expect(page.getByText("None — click the map")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Recon/ })).toBeDisabled();

  // Select the first region by aria-label prefix (seed-agnostic: Recon works on
  // ANY target, so we don't couple to REGION_SEED names). aria-pressed flips true.
  const firstRegion = page.getByRole("button", { name: /^Select / }).first();
  await firstRegion.click();
  await expect(firstRegion).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("None — click the map")).toBeHidden();
  // With a region selected and intel150 in the pool, Recon is now enabled.
  await expect(page.getByRole("button", { name: /^Recon/ })).toBeEnabled();

  // Default faction is WARDENS. Switch to PYRE and prove the toggle is wired by
  // issuing a Recon and reading the faction-credited feed text (recon costs
  // intel50, have 150 → succeeds; commands.ts: `${cmd.faction} reconned ...`).
  // exact:true — a bare "PYRE" also matches the pyre-held region nodes' long
  // aria-labels and the Legend's "Explain Pyre" tooltip; only the toggle is
  // exactly "PYRE".
  await page.getByRole("button", { name: "PYRE", exact: true }).click();
  await page.getByRole("button", { name: /^Recon/ }).click();
  await expect(page.getByText(/^1 events$/)).toBeVisible();
  await expect(page.locator("ol li").first()).toContainText("pyre reconned");

  // setFaction also persists to localStorage (key "warline.faction").
  await expect.poll(() => page.evaluate(() => localStorage.getItem("warline.faction"))).toBe("pyre");

  assertNoUnexpectedErrors(consoleErrors, pageErrors);
});

test("a simulated operation banks into the feed and store state survives a mode round-trip", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith(WARLINE_PROJECT), "Warline deep front slice.");

  const { consoleErrors, pageErrors } = await bootIntoCommandTable(page);
  const armyLoc = pactArmyValue(page);

  // Muster twice to put known state (50) into the store before the round-trip.
  await page.getByRole("button", { name: /^Muster/ }).click();
  await page.getByRole("button", { name: /^Muster/ }).click();
  await expect(armyLoc).toHaveText("50");

  // Fire a simulated operation (the Ops panel = the cross-game loop). simulate()
  // always calls applyOperation, which ALWAYS pushes a feed event regardless of
  // the synth victory/defeat roll. Threat/score AND the run-logistics army bonus
  // (pactArmy += 6×magnitude on victory) use Math.random, so assert feed GROWTH
  // (not an exact count) to stay randomness-proof.
  const before = await feedCount(page);
  // Anchor /^Run Logistics/ to dodge the "Explain Run Logistics" HelpTooltip.
  await page.getByRole("button", { name: /^Run Logistics/ }).click();
  await expect.poll(() => feedCount(page)).toBeGreaterThan(before);
  // The op event always carries the redline slug + outcome text in its lines
  // (victory "delivered war logistics" / defeat "convoy was scattered").
  await expect(page.locator("ol li").first()).toContainText(/redline|delivered|convoy/i);

  // The army is now whatever the op left it (50 on defeat, 50+round(6×m) on a
  // victory) — capture it so the round-trip can prove persistence without coupling
  // to the random op outcome.
  const armyAfterOp = (await pactArmyValue(page).textContent())?.trim() ?? "";
  expect(armyAfterOp).toMatch(/^[\d,]+$/);

  // Mode round-trip: leave to the 3D Front, then re-enter the Command Table. The
  // rail unmounts/remounts but pactArmy lives in the store, not the rail, so it
  // survives. (Re-entry uses the HUD "Command Table" scoped to the front region —
  // there are multiple "Command Table" buttons once command mode has been open;
  // the mode toggle issues no command/op, so the army is unchanged across it.)
  await page.getByRole("button", { name: "Return to Front" }).click();
  await expect(page.getByRole("heading", { name: "The Front" })).toBeHidden();
  const front = page.getByRole("region", { name: "Warline playable front" });
  await expect(front).toBeVisible();
  await front.getByRole("button", { name: "Command Table" }).click();
  await expect(page.getByRole("heading", { name: "The Front" })).toBeVisible();
  await expect(pactArmyValue(page)).toHaveText(armyAfterOp);

  assertNoUnexpectedErrors(consoleErrors, pageErrors);
});
