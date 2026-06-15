import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONCEPTS,
  GAME_APPS,
  gameDeploys,
  gameDevPorts,
  gameRoute,
  gameSlugs,
  LOBBY_SLUG,
  PLAYABLE_GAME_SLUGS,
} from "../index.js";

// The roster is the single source of truth (next.config rewrites, the e2e
// fan-out, the lobby router). These tests pin the shape + every derived map so a
// careless roster edit fails here before it drifts a consumer.

test("GAME_APPS lists 8 apps, each fully specified", () => {
  assert.equal(GAME_APPS.length, 8);
  for (const app of GAME_APPS) {
    assert.equal(typeof app.slug, "string");
    assert.ok(app.slug.length > 0, `slug present for ${app.title}`);
    assert.equal(typeof app.title, "string");
    assert.ok(app.title.length > 0, `title present for ${app.slug}`);
    assert.match(app.accent, /^#[0-9a-f]{3,8}$/i, `accent is a hex color for ${app.slug}`);
    assert.equal(typeof app.devPort, "number");
    assert.match(app.deployUrl, /^https:\/\//, `deployUrl is https for ${app.slug}`);
    assert.equal(app.status, "PLAYABLE");
  }
});

test("dev ports are unique and ascend 5174..5181 in array order", () => {
  const ports = GAME_APPS.map((g) => g.devPort);
  assert.deepEqual(ports, [5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181]);
  assert.equal(new Set(ports).size, ports.length, "no duplicate dev ports");
});

test("slugs are unique", () => {
  assert.equal(new Set(gameSlugs).size, gameSlugs.length);
});

test("gameRoute returns the same-origin hub path", () => {
  assert.equal(gameRoute("warline"), "/warline/");
  assert.equal(gameRoute("scourge-survivors"), "/scourge-survivors/");
  for (const slug of gameSlugs) {
    assert.equal(gameRoute(slug), `/${slug}/`);
  }
});

test("gameDeploys maps every slug to its deploy URL", () => {
  assert.deepEqual(Object.keys(gameDeploys).sort(), [...gameSlugs].sort());
  for (const app of GAME_APPS) {
    assert.equal(gameDeploys[app.slug], app.deployUrl);
  }
});

test("gameDevPorts maps every slug to its dev port", () => {
  assert.deepEqual(Object.keys(gameDevPorts).sort(), [...gameSlugs].sort());
  for (const app of GAME_APPS) {
    assert.equal(gameDevPorts[app.slug], app.devPort);
  }
});

test("gameSlugs mirrors GAME_APPS order", () => {
  assert.deepEqual(
    gameSlugs,
    GAME_APPS.map((g) => g.slug),
  );
});

test("LOBBY_SLUG is warline and is a real app", () => {
  assert.equal(LOBBY_SLUG, "warline");
  assert.ok(gameSlugs.includes(LOBBY_SLUG), "lobby slug exists in the roster");
});

test("CONCEPTS is currently empty", () => {
  assert.deepEqual(CONCEPTS, []);
});

test("PLAYABLE_GAME_SLUGS is the 7 front games, excluding the lobby", () => {
  assert.equal(PLAYABLE_GAME_SLUGS.length, 7);
  assert.ok(!PLAYABLE_GAME_SLUGS.includes(LOBBY_SLUG), "lobby is not a playable front game");
  assert.equal(new Set(PLAYABLE_GAME_SLUGS).size, PLAYABLE_GAME_SLUGS.length, "no duplicates");
  for (const slug of PLAYABLE_GAME_SLUGS) {
    assert.ok(gameSlugs.includes(slug), `${slug} is a real app`);
  }
  // Every app except the lobby is playable.
  assert.deepEqual([...PLAYABLE_GAME_SLUGS].sort(), gameSlugs.filter((s) => s !== LOBBY_SLUG).sort());
});
