import assert from "node:assert/strict";
import { test } from "node:test";

import { GAME_OPERATIONS, GAME_SLUGS } from "./operations";
import { STORY_FRAME, STORY_FRAME_OPERATIONS } from "./storyFrame";
import { HUMAN_FACTIONS } from "./world";

test("the story frame has a non-empty headline and thesis", () => {
  assert.ok(STORY_FRAME.headline.trim().length > 0, "headline is set");
  assert.ok(STORY_FRAME.thesis.trim().length > 0, "thesis is set");
});

test("pillars are the three story-frame scope axes, each unique and fleshed out", () => {
  const slugs = STORY_FRAME.pillars.map((p) => p.slug);
  // Scope bullet 1: operations, resources, provisional front movement.
  assert.deepEqual([...slugs].sort(), ["front-movement", "operations", "resources"]);
  assert.equal(new Set(slugs).size, slugs.length, "pillar slugs are unique");
  for (const pillar of STORY_FRAME.pillars) {
    assert.ok(pillar.title.trim().length > 0, `${pillar.slug} has a title`);
    assert.ok(pillar.body.trim().length >= 40, `${pillar.slug} body is substantive`);
  }
});

test("the reports loop is explicitly provisional — no false canon promises", () => {
  // Scope bullet 2: feedback/playtests become reports without locking canon.
  assert.equal(STORY_FRAME.reports.provisional, true);
  assert.match(STORY_FRAME.reports.body, /provisional/i);
  assert.match(STORY_FRAME.reports.body, /never auto-promoted|authored lore/i);
});

test("cadence ties the weekly release to Pyre, Wardens, and the Scourge", () => {
  // Scope bullet 3: connect Pyre/Warden/Scourge outcomes to release cadence.
  const factions = STORY_FRAME.cadence.factions.map((f) => f.faction);
  assert.deepEqual([...factions].sort(), ["pyre", "scourge", "wardens"]);
  // Every human faction in the sim is represented.
  for (const human of HUMAN_FACTIONS) {
    assert.ok(factions.includes(human), `cadence covers ${human}`);
  }
  for (const line of STORY_FRAME.cadence.factions) {
    assert.ok(line.label.trim().length > 0, `${line.faction} has a label`);
    assert.ok(line.outcome.trim().length >= 40, `${line.faction} outcome is substantive`);
  }
  assert.match(`${STORY_FRAME.cadence.lead} ${STORY_FRAME.cadence.note}`, /week/i);
});

test("the operation slate is derived from the operation contract, never hand-drifted", () => {
  // One entry per game, in declaration order, labels straight from GAME_OPERATIONS.
  assert.deepEqual(
    STORY_FRAME_OPERATIONS.map((o) => o.game),
    GAME_SLUGS,
  );
  for (const { game, operation } of STORY_FRAME_OPERATIONS) {
    assert.equal(operation, GAME_OPERATIONS[game].label, `${game} operation label matches the contract`);
  }
});
