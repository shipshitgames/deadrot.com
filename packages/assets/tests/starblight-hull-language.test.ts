import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { dimensionsFromFile } from "../scripts/lib/image-size.mjs";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const design = readFileSync(path("../../../apps/games/starblight/DESIGN.md"), "utf8");
const master = path("../masters/sprites/starblight/hull-language-v01/hull-silhouette-sheet-v01.png");
const gameplayScaleProof = path(
  "../masters/sprites/starblight/hull-language-v01/hull-silhouette-gameplay-scale-1080p-v01.png",
);
const source = path("../sources/generated/2026-07-22/games/starblight/hull-silhouettes/hull-silhouette-sheet-v01.png");

test("Starblight locks four faction-readable hull bodies", () => {
  for (const id of ["pyre-razor", "pyre-furnace", "warden-bastion", "warden-shepherd"]) {
    assert.ok(design.includes(`\`${id}\``), `missing hull body ${id}`);
  }
  assert.match(design, /2\.6` world units tall in a `48` world-unit-high view/);
  assert.match(design, /pure-black test/);
});

test("human hull glow preserves the Scourge toxic-green monopoly", () => {
  assert.match(design, /toxic green and its hot variant are forbidden on every human hull/);
  assert.match(design, /Toxic light means\s+Scourge infection/);
  assert.match(design, /blood-hot\/hellfire/);
  assert.match(design, /hazard-yellow\/ember/);
});

test("the approved hull master and curated source are the same full-resolution sheet", () => {
  assert.deepEqual(dimensionsFromFile(master), { width: 1672, height: 941 });
  assert.deepEqual(dimensionsFromFile(source), { width: 1672, height: 941 });
  assert.deepEqual(dimensionsFromFile(gameplayScaleProof), { width: 1920, height: 1080 });
  assert.deepEqual(readFileSync(master), readFileSync(source));
});
