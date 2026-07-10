import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLoreArtMap, parseManualStatus, renderLoreArtMapMarkdown } from "../scripts/lib/lore-art-map-core.mjs";

test("parseManualStatus reads wiki-linked audit rows", () => {
  const rows = parseManualStatus(`
| Lore note | Preview | Game/use | Good? | Locked? | Current package source | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| [[Ranger]] | img | game | Review | No | \`packages/assets/entities/pyre-ranger/scourge-survivors.webp\` | Regenerate |
`);

  assert.deepEqual(rows.get("ranger"), {
    note: "Ranger",
    good: "Review",
    locked: "No",
    source: "`packages/assets/entities/pyre-ranger/scourge-survivors.webp`",
    nextAction: "Regenerate",
  });
});

test("buildLoreArtMap links lore entries to catalog variants, runtime records, and masters", () => {
  const report = buildLoreArtMap({
    characters: [
      {
        slug: "ranger",
        name: "Ranger",
        appearsIn: ["scourge-survivors"],
        spriteBase: "player-ranger-front",
      },
    ],
    bestiary: [
      {
        slug: "swarm-ripper",
        name: "Swarm Ripper",
        appearsIn: ["scourge-survivors", "deadlane"],
        spriteBase: "enemy-melee",
      },
    ],
    catalog: {
      entities: [
        {
          id: "pyre-ranger",
          name: "Ranger",
          games: ["scourge-survivors"],
          variants: { "scourge-survivors": "entities/pyre-ranger/scourge-survivors.webp" },
        },
        {
          id: "scourge-swarm",
          name: "Swarm Ripper",
          games: ["scourge-survivors", "deadlane"],
          variants: {
            "scourge-survivors": "entities/scourge-swarm/scourge-survivors.webp",
            deadlane: null,
          },
        },
      ],
    },
    assetIndex: {
      assets: [
        { path: "entities/pyre-ranger/scourge-survivors.webp" },
        { path: "games/scourge-survivors/players/pyre/ranger/front.webp" },
        { path: "entities/scourge-swarm/scourge-survivors.webp" },
        { path: "games/scourge-survivors/enemies/scourge/host-grunt/front.webp" },
      ],
    },
    gameManifests: {
      "scourge-survivors": {
        sprites: {
          "player-ranger": {
            views: { front: { path: "games/scourge-survivors/players/pyre/ranger/front.webp" } },
            license: { tool: "mock", kind: "AI generated sprite" },
          },
          "enemy-melee": {
            views: { front: { path: "games/scourge-survivors/enemies/scourge/host-grunt/front.webp" } },
            license: { tool: "mock", kind: "AI generated sprite" },
          },
        },
      },
    },
    assetPaths: [
      "packages/assets/entities/pyre-ranger/scourge-survivors.webp",
      "packages/assets/masters/art/characters/v01/ranger-master-v01.png",
      "packages/assets/sources/generated/2026-06-11/lore/bestiary/swarm-ripper/reference/index.md",
    ],
    notePaths: new Map([
      ["ranger", "Characters/Pyre/Ranger.md"],
      ["swarm-ripper", "Bestiary/Soldiers/Swarm-Ripper.md"],
    ]),
    manualStatusMarkdown:
      "| Lore note | Preview | Game/use | Good? | Locked? | Current package source | Next action |\n| --- | --- | --- | --- | --- | --- | --- |\n| [[Ranger]] | img | game | Good | Yes | source | done |\n",
  });

  const ranger = report.entries.find((entry) => entry.slug === "ranger");
  const ripper = report.entries.find((entry) => entry.slug === "swarm-ripper");

  assert.equal(report.summary.entries, 2);
  assert.equal(ranger?.status, "locked");
  assert.equal(ranger?.catalog.existing, 1);
  assert.equal(ranger?.runtime.existing, 1);
  assert.equal(ranger?.packageAssets.count, 1);
  assert.equal(ranger?.masters.count, 1);
  assert.equal(ripper?.catalog.expected, 2);
  assert.equal(ripper?.catalog.existing, 1);
  assert.equal(ripper?.runtime.existing, 1);
  assert.equal(ripper?.sources.count, 1);
});

test("buildLoreArtMap counts direct package assets without catalog coverage", () => {
  const report = buildLoreArtMap({
    characters: [
      {
        slug: "pyre-courier",
        name: "Pyre Courier",
        appearsIn: ["redline"],
        spriteBase: "portrait-pyre-courier",
      },
    ],
    bestiary: [
      {
        slug: "scourge",
        name: "The Scourge",
        appearsIn: ["scourge-survivors"],
        spriteBase: "portrait-scourge",
      },
    ],
    catalog: { entities: [] },
    assetIndex: { assets: [] },
    gameManifests: {
      "scourge-survivors": {
        sprites: {
          "enemy-melee": {
            views: { front: { path: "games/scourge-survivors/enemies/scourge/host-grunt/front.webp" } },
          },
        },
      },
    },
    assetPaths: [
      "packages/assets/entities/pyre-courier/redline.webp",
      "packages/assets/entities/scourge-host-families/shared.webp",
    ],
    notePaths: new Map(),
    manualStatusMarkdown: "",
  });

  const courier = report.entries.find((entry) => entry.slug === "pyre-courier");
  const scourge = report.entries.find((entry) => entry.slug === "scourge");

  assert.equal(courier?.status, "in-progress");
  assert.equal(courier?.packageAssets.count, 1);
  assert.equal(report.summary.packageLinked, 1);
  assert.equal(scourge?.packageAssets.count, 0);
  assert.equal(scourge?.runtime.existing, 0);
});

test("buildLoreArtMap resolves aliases and leaves planned placeholders pathless", () => {
  const report = buildLoreArtMap({
    characters: [
      { slug: "duelist", name: "Duelist", appearsIn: ["brawl"], spriteBase: "portrait-duelist" },
      { slug: "spitter", name: "Spitter", appearsIn: ["rothulk"], spriteBase: "portrait-spitter" },
    ],
    bestiary: [],
    catalog: {
      entities: [
        {
          id: "pyre-duelist",
          name: "Duelist",
          games: ["pactfall", "brawl"],
          variants: {
            pactfall: "entities/pyre-duelist/pactfall.webp",
            brawl: { type: "alias", sourceGame: "pactfall" },
          },
        },
        {
          id: "scourge-spitter",
          name: "Spitter",
          games: ["rothulk"],
          variants: {
            rothulk: { type: "placeholder", note: "Render is planned." },
          },
        },
      ],
    },
    assetIndex: { assets: [{ path: "entities/pyre-duelist/pactfall.webp" }] },
    gameManifests: {},
    assetPaths: [],
    notePaths: new Map(),
    manualStatusMarkdown: "",
  });

  const duelist = report.entries.find((entry) => entry.slug === "duelist");
  const spitter = report.entries.find((entry) => entry.slug === "spitter");
  assert.equal(duelist?.catalog.variants[0]?.path, "entities/pyre-duelist/pactfall.webp");
  assert.equal(duelist?.catalog.existing, 1);
  assert.equal(spitter?.catalog.variants[0]?.path, null);
  assert.equal(spitter?.catalog.existing, 0);
});

test("renderLoreArtMapMarkdown includes coverage and weak-entry sections", () => {
  const markdown = renderLoreArtMapMarkdown({
    summary: {
      entries: 1,
      locked: 0,
      runtimeLinked: 0,
      inProgress: 0,
      drafted: 0,
      missing: 1,
      catalogLinked: 0,
      runtimeManifestLinked: 0,
      packageLinked: 0,
      hasMasters: 0,
      hasSources: 0,
    },
    entries: [
      {
        type: "character",
        slug: "missing-hero",
        name: "Missing Hero",
        notePath: "Characters/Missing-Hero.md",
        appearsIn: ["deadlane"],
        spriteBase: "portrait-missing-hero",
        catalogEntities: [],
        catalog: { expected: 0, existing: 0, missing: 0, variants: [] },
        runtime: { existing: 0, generated: 0, records: [] },
        packageAssets: { count: 0, paths: [] },
        previews: { count: 0, paths: [] },
        masters: { count: 0, paths: [] },
        sources: { count: 0, paths: [] },
        manual: null,
        status: "missing",
      },
    ],
  });

  assert.match(markdown, /# Lore Asset Map/);
  assert.match(markdown, /\[\[Missing-Hero\|Missing Hero\]\]/);
  assert.match(markdown, /Missing Or Draft Only/);
});
