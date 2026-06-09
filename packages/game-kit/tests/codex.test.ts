import assert from "node:assert/strict";
import { test } from "node:test";

import { bestiary, characters, locations } from "@shipshitgames/assets/lore";
import { CODEX_ACCENT_HEX, codexEntriesForGame } from "../src/codex";

test("includes exactly the lore that lists the game in appearsIn", () => {
  const entries = codexEntriesForGame("deadlane");
  const slugs = new Set(entries.map((e) => e.slug));

  const expected = [
    ...bestiary.filter((c) => c.appearsIn.includes("deadlane")),
    ...characters.filter((c) => c.appearsIn.includes("deadlane")),
    ...locations.filter((l) => l.appearsIn.includes("deadlane")),
  ];
  assert.equal(entries.length, expected.length);
  for (const item of expected) assert.ok(slugs.has(item.slug), `missing ${item.slug}`);
});

test("deadlane discovery slugs exist in the bestiary and appear in deadlane", () => {
  // The creep-kind → bestiary mapping deadlane persists (apps/games/deadlane).
  for (const slug of ["scourge", "swarm-ripper", "graft-breacher", "breach-boss"]) {
    const creature = bestiary.find((c) => c.slug === slug);
    assert.ok(creature, `bestiary slug ${slug} missing`);
    assert.ok(creature.appearsIn.includes("deadlane"), `${slug} does not appear in deadlane`);
  }
});

test("creature entries carry tier kicker + threat/visual sections", () => {
  const entries = codexEntriesForGame("deadlane");
  const ripper = entries.find((e) => e.slug === "swarm-ripper");
  assert.ok(ripper);
  assert.equal(ripper.kicker, "SCOURGE — TIER SWARM");
  assert.equal(ripper.accentHex, CODEX_ACCENT_HEX.blood);
  assert.deepEqual(
    ripper.sections?.map((s) => s.label),
    ["Threat Read", "Recognize It"],
  );
  for (const section of ripper.sections ?? []) assert.ok(section.items.length > 0);
});

test("character kickers come from the faction, locations from control", () => {
  const entries = codexEntriesForGame("deadlane");

  const engineer = entries.find((e) => e.slug === "field-engineer");
  assert.ok(engineer);
  assert.match(engineer.kicker ?? "", /^THE WARDENS — /);

  const spire = entries.find((e) => e.slug === "the-spire");
  assert.ok(spire);
  assert.equal(spire.kicker, "LOCATION — WARDENS");
  assert.deepEqual(
    spire.sections?.map((s) => s.label),
    ["War Role"],
  );
});

test("everything is unlocked when no unlockedSlugs set is given", () => {
  for (const entry of codexEntriesForGame("starblight")) {
    assert.equal(entry.locked, false, `${entry.slug} should be unlocked`);
  }
});

test("unlockedSlugs locks undiscovered creatures but never characters/locations", () => {
  const entries = codexEntriesForGame("deadlane", { unlockedSlugs: new Set(["swarm-ripper"]) });
  const bestiarySlugs = new Set(bestiary.map((c) => c.slug));

  for (const entry of entries) {
    if (!bestiarySlugs.has(entry.slug)) {
      assert.equal(entry.locked, false, `${entry.slug} (character/location) should stay unlocked`);
    } else if (entry.slug === "swarm-ripper") {
      assert.equal(entry.locked, false);
    } else {
      assert.equal(entry.locked, true, `${entry.slug} should be locked until discovered`);
    }
  }
});

test("accent map stays on the DOOM palette and never fabricates sprite URLs", () => {
  assert.deepEqual(CODEX_ACCENT_HEX, {
    blood: "#c1121f",
    hellfire: "#ff6a00",
    toxic: "#8bdc1f",
    rust: "#8a4b2a",
    bone: "#e9e3d6",
  });
  for (const game of ["deadlane", "starblight", "scourge-survivors"]) {
    for (const entry of codexEntriesForGame(game)) {
      assert.equal(entry.spriteUrl, null);
      assert.ok(Object.values(CODEX_ACCENT_HEX).includes(entry.accentHex ?? ""), `${entry.slug} off-palette accent`);
    }
  }
});
