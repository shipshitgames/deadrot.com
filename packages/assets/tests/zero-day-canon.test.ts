import assert from "node:assert/strict";
import { test } from "node:test";

import { getLocation, locations, timelineEvents } from "../src/lore";

/**
 * Zero-Day canon lock (#141): the night humanity lost the sky now names its fleet — the
 * Skywatch — and its two fallen sites: the Lantern (the orbital command ring it died over)
 * and Cradle Field (the ground evacuation that mostly didn't). lore-drift.test.ts already
 * proves the data is *well-formed*; this file pins the *content* of the lock so a future
 * edit cannot silently un-name the fleet or the sites.
 */

const ZERO_DAY_ERA = "Zero Day — the Invasion";

test("the Lantern is the fallen orbital site of Zero Day", () => {
  const lantern = getLocation("the-lantern");
  assert.ok(lantern, "the-lantern is missing from locations.json");
  assert.equal(lantern.name, "The Lantern");
  assert.equal(lantern.kind, "orbital");
  assert.equal(lantern.control, "dead");
  assert.ok(lantern.appearsIn.includes("starblight"), "the Lantern appears in Starblight's Zero Day mode");
  assert.match(lantern.overview, /Skywatch/, "the Lantern overview names the Skywatch fleet");
  assert.match(lantern.overview, /Skyhook/, "the Lantern overview ties to the Skyhook it was salvaged into");
});

test("Cradle Field is the fallen ground evacuation site of Zero Day", () => {
  const cradle = getLocation("cradle-field");
  assert.ok(cradle, "cradle-field is missing from locations.json");
  assert.equal(cradle.name, "Cradle Field");
  assert.equal(cradle.kind, "landmark");
  assert.equal(cradle.control, "dead");
  assert.ok(cradle.appearsIn.includes("starblight"), "Cradle Field appears in Starblight's Zero Day mode");
  assert.match(cradle.overview, /evacuation/i, "Cradle Field overview frames it as the failed evacuation");
});

test("the Zero Day timeline names the Skywatch fleet and links its sites", () => {
  const era = timelineEvents.filter((e) => e.era === ZERO_DAY_ERA);
  assert.ok(era.length >= 2, "the Zero Day era keeps its first-contact + landfall beats");
  assert.ok(
    era.some((e) => /Skywatch/.test(e.blurb)),
    "no Zero Day timeline event names the Skywatch fleet",
  );

  const firstContact = timelineEvents.find((e) => e.slug === "zero-day-first-contact");
  assert.ok(firstContact, "zero-day-first-contact event missing");
  assert.ok(firstContact.locationSlugs.includes("the-lantern"), "first contact links the Lantern");

  const landfall = timelineEvents.find((e) => e.slug === "zero-day-landfall");
  assert.ok(landfall, "zero-day-landfall event missing");
  assert.ok(landfall.locationSlugs.includes("cradle-field"), "landfall links Cradle Field");
});

test("every Zero Day site link resolves to a real location", () => {
  const slugs = new Set(locations.map((l) => l.slug));
  for (const e of timelineEvents.filter((ev) => ev.era === ZERO_DAY_ERA)) {
    for (const slug of e.locationSlugs) {
      assert.ok(slugs.has(slug), `Zero Day event "${e.slug}" links unknown location "${slug}"`);
    }
  }
});
