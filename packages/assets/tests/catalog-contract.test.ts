import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { PLAYABLE_GAME_SLUGS } from "@deadrot/catalog";

import catalog from "../assets-catalog.json" with { type: "json" };
import schema from "../assets-catalog.schema.json" with { type: "json" };

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const BRAWL_ALIAS_ENTITIES = new Set(["pyre-duelist", "warden-bastion", "scourge-elite", "trucebreaker"]);
const PACTFALL_MISMATCH_FIXES = new Set([
  "scourge-swarm",
  "scourge-elite",
  "breach-boss",
  "pyre-ranger",
  "pyre-bulwark",
  "pyre-vector",
  "pyre-patch",
  "warden-field-engineer",
  "warden-lane-gunner",
  "warden-wallwright",
]);

function isAlias(variant: unknown): variant is { type: "alias"; sourceGame: string } {
  return (
    typeof variant === "object" &&
    variant !== null &&
    "type" in variant &&
    variant.type === "alias" &&
    "sourceGame" in variant &&
    typeof variant.sourceGame === "string"
  );
}

function isPlaceholder(variant: unknown): variant is { type: "placeholder"; note: string } {
  return (
    typeof variant === "object" &&
    variant !== null &&
    "type" in variant &&
    variant.type === "placeholder" &&
    "note" in variant &&
    typeof variant.note === "string"
  );
}

function resolvedPath(variants: Record<string, unknown>, game: string): string | null {
  let currentGame = game;
  const visited = new Set<string>();
  while (true) {
    assert.ok(!visited.has(currentGame), `variant alias cycle at ${game}`);
    visited.add(currentGame);
    const variant = variants[currentGame];
    if (typeof variant === "string") return variant;
    if (isAlias(variant)) {
      currentGame = variant.sourceGame;
      continue;
    }
    return null;
  }
}

test("catalog schema and every entity variant record cover the playable roster", () => {
  const schemaGames = schema.definitions.gameSlug.enum;
  const requiredVariantGames = schema.definitions.variants.required;
  assert.deepEqual(schemaGames, PLAYABLE_GAME_SLUGS, "schema game enum must derive from the playable roster");
  assert.deepEqual(requiredVariantGames, PLAYABLE_GAME_SLUGS, "schema required variants must derive from the playable roster");

  for (const entity of catalog.entities) {
    assert.deepEqual(Object.keys(entity.variants), PLAYABLE_GAME_SLUGS, `${entity.id} variant keys`);
  }
});

test("catalog intent, variants, aliases, placeholders, and paths stay coherent", () => {
  for (const entity of catalog.entities) {
    for (const game of PLAYABLE_GAME_SLUGS) {
      const variant = entity.variants[game];
      assert.equal(
        variant !== null,
        entity.games.includes(game),
        `${entity.id}.${game}: non-null variant and intended-game metadata must agree`,
      );

      assert.ok(
        variant === null || typeof variant === "string" || isAlias(variant) || isPlaceholder(variant),
        `${entity.id}.${game}: unsupported variant form`,
      );

      if (isAlias(variant)) {
        assert.notEqual(variant.sourceGame, game, `${entity.id}.${game}: alias cannot target itself`);
        assert.ok(PLAYABLE_GAME_SLUGS.includes(variant.sourceGame), `${entity.id}.${game}: unknown alias source`);
      }

      const path = resolvedPath(entity.variants, game);
      if (path) assert.ok(existsSync(resolve(PACKAGE_ROOT, path)), `${entity.id}.${game}: missing ${path}`);
    }
  }
});

test("Brawl's roster reuses Pactfall art through declared aliases", () => {
  const aliases = catalog.entities.filter((entity) => isAlias(entity.variants.brawl));
  assert.deepEqual(new Set(aliases.map((entity) => entity.id)), BRAWL_ALIAS_ENTITIES);
  for (const entity of aliases) {
    const variant = entity.variants.brawl;
    assert.ok(isAlias(variant));
    assert.equal(variant.sourceGame, "pactfall", `${entity.id}: Brawl source`);
    assert.ok(entity.games.includes("brawl"), `${entity.id}: Brawl must be intended`);
  }

  const rosterSource = readFileSync(resolve(PACKAGE_ROOT, "../../apps/games/brawl/src/game/roster.ts"), "utf8");
  assert.match(rosterSource, /@shipshitgames\/assets\/brawl/);
  assert.doesNotMatch(rosterSource, /@shipshitgames\/assets\/entities\/.+\/pactfall\.webp/);
});

test("the ten pre-existing Pactfall paths are now marked as intended", () => {
  for (const id of PACTFALL_MISMATCH_FIXES) {
    const entity = catalog.entities.find((candidate) => candidate.id === id);
    assert.ok(entity, `missing catalog entity ${id}`);
    assert.ok(entity.games.includes("pactfall"), `${id}: Pactfall is intended`);
    assert.equal(typeof entity.variants.pactfall, "string", `${id}: Pactfall render path exists`);
  }
});
