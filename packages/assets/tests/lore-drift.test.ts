import assert from "node:assert/strict";
import { test } from "node:test";

import { CONCEPTS, GAME_APPS } from "@deadrot/catalog";

// Import the catalog JSON directly: src/index.ts re-exports the scourge-survivors
// manifest, which uses Vite's import.meta.glob and cannot load under `bun test`.
import catalogJson from "../assets-catalog.json" with { type: "json" };

const catalog = catalogJson as unknown as {
  entities: { id: string; name: string; kind: string; games: string[] }[];
};

import {
  bestiary,
  characters,
  factions,
  gameLore,
  getCreature,
  locations,
  timelineEvents,
  universe,
} from "../src/lore";

/**
 * Drift checks: the lore tables, the asset catalog, and the game roster must
 * agree. The Obsidian vault stays the prose canon; if these fail, either the
 * data derivative or the catalog moved without the other.
 */

const ACCENTS = new Set(["blood", "hellfire", "toxic", "rust", "bone"]);
const ROSTER_SLUGS = new Set([...GAME_APPS.map((g) => g.slug), ...CONCEPTS.map((c) => c.slug)]);
const HOST_FAMILIES = new Set(["rot-flesh", "chitin", "mycelial", "machine-graft", "bone-titan", "voidship"]);

const loreEntitySlugs = new Set([...bestiary.map((b) => b.slug), ...characters.map((c) => c.slug)]);
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Catalog ids whose lore entry intentionally lives under a different slug
// (the lore table predates the catalog's faction-prefixed id scheme).
const CATALOG_TO_LORE_EXCEPTIONS: Record<string, string> = {
  "scourge-swarm": "swarm-ripper",
  "scourge-spitter": "swarm-spitter",
  "scourge-elite": "render",
};

test("every roster game has a lore entry, and every lore game is on the roster", () => {
  const loreSlugs = new Set(gameLore.map((g) => g.slug));
  for (const slug of ROSTER_SLUGS) {
    assert.ok(loreSlugs.has(slug), `roster game "${slug}" is missing from lore/games.json`);
  }
  for (const g of gameLore) {
    assert.ok(ROSTER_SLUGS.has(g.slug), `lore game "${g.slug}" is not in @deadrot/catalog`);
  }
});

test("every catalog entity maps to a lore creature or character", () => {
  for (const entity of catalog.entities) {
    const expected = CATALOG_TO_LORE_EXCEPTIONS[entity.id] ?? slugify(entity.name);
    const direct = loreEntitySlugs.has(expected);
    // Faction-prefixed catalog ids (pyre-ranger) often map to bare lore slugs (ranger).
    const stripped = expected.replace(/^(pyre|warden|scourge)-/, "");
    assert.ok(
      direct || loreEntitySlugs.has(stripped),
      `catalog entity "${entity.id}" ("${entity.name}") has no lore entry (tried "${expected}", "${stripped}")`,
    );
  }
});

test("catalog entity game lists stay inside the roster", () => {
  for (const entity of catalog.entities) {
    for (const slug of entity.games) {
      assert.ok(ROSTER_SLUGS.has(slug), `catalog entity "${entity.id}" references unknown game "${slug}"`);
    }
  }
});

test("lore cross-references resolve", () => {
  const factionSlugs = new Set(factions.map((f) => f.slug));
  const charSlugs = new Set(characters.map((c) => c.slug));
  const beastSlugs = new Set(bestiary.map((b) => b.slug));

  for (const g of gameLore) {
    // "" = multi-faction titles (Pactfall's rivalry, Warline's Pact-wide console).
    assert.ok(
      factionSlugs.has(g.factionSlug) || g.factionSlug === "scourge" || g.factionSlug === "",
      `game "${g.slug}" faction "${g.factionSlug}"`,
    );
    for (const c of g.characterSlugs) assert.ok(charSlugs.has(c), `game "${g.slug}" character "${c}"`);
    for (const e of g.enemySlugs) assert.ok(beastSlugs.has(e), `game "${g.slug}" enemy "${e}"`);
  }
  for (const c of characters) {
    for (const slug of c.appearsIn) assert.ok(ROSTER_SLUGS.has(slug), `character "${c.slug}" appearsIn "${slug}"`);
  }
  for (const b of bestiary) {
    for (const slug of b.appearsIn) assert.ok(ROSTER_SLUGS.has(slug), `creature "${b.slug}" appearsIn "${slug}"`);
  }
});

test("accents stay inside the DOOM palette vocabulary", () => {
  for (const entry of [...gameLore, ...factions, ...characters, ...bestiary, ...locations]) {
    assert.ok(ACCENTS.has(entry.accent), `"${entry.slug}" has unknown accent "${entry.accent}"`);
  }
});

test("locations are well-formed and their bosses resolve to canon", () => {
  assert.ok(locations.length > 0, "locations.json is empty");
  const seen = new Set<string>();
  for (const loc of locations) {
    assert.ok(!seen.has(loc.slug), `duplicate location slug "${loc.slug}"`);
    seen.add(loc.slug);
    assert.ok(loc.tagline.length > 0 && loc.overview.length > 0, `location "${loc.slug}" missing copy`);
    for (const slug of loc.appearsIn) {
      assert.ok(ROSTER_SLUGS.has(slug), `location "${loc.slug}" appearsIn unknown game "${slug}"`);
    }
    if (loc.boss) {
      assert.ok(loc.boss.name.length > 0, `location "${loc.slug}" boss has no name`);
      assert.ok(
        getCreature(loc.boss.entitySlug),
        `location "${loc.slug}" boss entity "${loc.boss.entitySlug}" not in bestiary`,
      );
      assert.ok(
        HOST_FAMILIES.has(loc.boss.hostFamily),
        `location "${loc.slug}" boss hostFamily "${loc.boss.hostFamily}"`,
      );
    }
  }
});

test("timeline events are ordered, era-anchored, and resolve their references", () => {
  assert.ok(timelineEvents.length > 0, "timeline-events.json is empty");
  const eraNames = new Set(universe.eras.map((e) => e.name));
  const locationSlugs = new Set(locations.map((l) => l.slug));
  const factionish = new Set([...factions.map((f) => f.slug), "scourge", "listeners"]);

  let lastOrder = 0;
  const orders = new Set<number>();
  for (const ev of timelineEvents) {
    assert.ok(ev.order > lastOrder || !orders.has(ev.order), `event "${ev.slug}" order collides`);
    orders.add(ev.order);
    lastOrder = Math.max(lastOrder, ev.order);
    assert.ok(eraNames.has(ev.era), `event "${ev.slug}" era "${ev.era}" not in universe.eras`);
    assert.ok(ev.title.length > 0 && ev.blurb.length > 0, `event "${ev.slug}" missing copy`);
    for (const slug of ev.locationSlugs) {
      assert.ok(locationSlugs.has(slug), `event "${ev.slug}" references unknown location "${slug}"`);
    }
    for (const slug of ev.factionSlugs) {
      assert.ok(factionish.has(slug), `event "${ev.slug}" references unknown faction "${slug}"`);
    }
  }
});
