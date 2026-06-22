import assert from "node:assert/strict";
import { test } from "node:test";

import { getGameLore } from "@shipshitgames/assets/lore";
import { GAME_SLUGS, HUMAN_FACTIONS, STORY_FRAME, STORY_FRAME_OPERATIONS } from "@shipshitgames/warline";

/**
 * Cross-package drift check (#362): the Warline "Why Builds Matter" briefing
 * renders an operation slate and claims every preview is an operation feeding a
 * shared front. Pin that to canon — every game the slate fields must resolve to a
 * game with a canon Warline role in @shipshitgames/assets/lore — and pin the
 * framing copy so the "provisional, no false canon promises" contract can't erode.
 *
 * Note the labels are NOT asserted equal across registers on purpose: the slate
 * (GAME_OPERATIONS, what the in-game Ops panel fires) uses imperative action
 * labels like "Purge a Breach", while the canon lore data uses noun phrases like
 * "Breach Purge". Both are intentional; equality would be a false invariant.
 */

test("every operation the briefing fields is backed by a canon Warline role", () => {
  assert.ok(STORY_FRAME_OPERATIONS.length === GAME_SLUGS.length, "the slate covers every reporting game");
  for (const { game, operation } of STORY_FRAME_OPERATIONS) {
    assert.ok(operation.trim().length > 0, `${game} renders a non-empty operation label`);
    const lore = getGameLore(game);
    assert.ok(lore, `canon lore exists for ${game}`);
    assert.ok(lore.warlineRole.operation.trim().length > 0, `${game} has a canon operation label`);
    assert.ok(lore.warlineRole.line.trim().length > 0, `${game} canon explains what its operation buys the front`);
  }
});

test("cadence ties the weekly release to both human factions and the Scourge", () => {
  const factions = STORY_FRAME.cadence.factions.map((f) => f.faction);
  for (const human of HUMAN_FACTIONS) {
    assert.ok(factions.includes(human), `cadence covers the ${human} faction`);
  }
  assert.ok(factions.includes("scourge"), "cadence covers the Scourge");
});

test("the community-build loop stays provisional — no false canon promises", () => {
  // Mirrors the "Warline outcomes are provisional until promoted" canon line in
  // apps/lore/content/Games/Warline.md: a run moves the prototype, never canon.
  assert.equal(STORY_FRAME.reports.provisional, true);
  assert.match(STORY_FRAME.reports.body, /provisional/i);
});
