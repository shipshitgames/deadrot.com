import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

// Pins the canon side of the cross-game map cohesion contract (#140): the
// Maps.md registry is the single source of truth that every game's in-code map
// joins on (`loreId` + `front`). The matching game-side checks live next to the
// games (apps/games/brawl/tests/unit/map.test.ts, packages/warline/src/canon.test.ts).

const testDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(testDir, "../content");
const repoRoot = path.resolve(testDir, "../../.."); // apps/lore/tests -> repo root
const mapsPath = path.join(contentRoot, "Maps.md");

// The canon front-taxonomy classes (declared in the Maps.md frontmatter).
const FRONTS = ["holdout", "lane", "breach", "orbital"];

function readMaps(): string {
  return readFileSync(mapsPath, "utf8");
}

interface RegistryRow {
  location: string;
  id: string;
  front: string;
  games: string;
}

/** Parse the registry table rows (skipping the header + separator). */
function parseRows(md: string): RegistryRow[] {
  const rows: RegistryRow[] = [];
  for (const line of md.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 7) continue;
    if (cells[0] === "Location" || /^-+$/.test(cells[0])) continue; // header / separator
    const id = cells[1].replace(/`/g, "").trim();
    if (!id || id === "—") continue;
    rows.push({ location: cells[0], id, front: cells[2], games: cells[6] });
  }
  return rows;
}

describe("Cross-game map cohesion — Maps.md registry (#140)", () => {
  test("frontmatter declares the canon front-taxonomy", () => {
    const md = readMaps();
    assert.match(md, /front-taxonomy:/, "expected a front-taxonomy block in the frontmatter");
    for (const front of FRONTS) {
      assert.match(md, new RegExp(`-\\s+${front}\\b`), `expected front-taxonomy to list ${front}`);
    }
  });

  test("every registry row uses a canon front-taxonomy class", () => {
    const rows = parseRows(readMaps());
    assert.ok(rows.length > 0, "expected to parse at least one registry row");
    for (const row of rows) {
      assert.ok(
        FRONTS.includes(row.front),
        `row ${row.id} declares front "${row.front}", not a canon front-taxonomy class`,
      );
    }
  });

  test("every registry row id is a clean canon slug", () => {
    for (const row of parseRows(readMaps())) {
      assert.match(row.id, /^[a-z][a-z0-9-]*$/, `row id "${row.id}" is not a clean canon slug`);
    }
  });

  test("Brawl is placed at The Hollow Lanes — No-Man's-Land Pocket", () => {
    const hollow = parseRows(readMaps()).find((row) => row.id === "hollowlanes");
    assert.ok(hollow, "expected a hollowlanes row in the registry");
    assert.equal(hollow.front, "lane", "The Hollow Lanes is a lane front");
    assert.match(hollow.games, /\[\[Brawl\]\]/, "expected the hollowlanes row to list [[Brawl]]");
    assert.match(hollow.games, /No-Man's-Land Pocket/, "expected Brawl's in-game map name in the registry");
  });

  test("the registry points at the live warline meta-map file and it exists", () => {
    const md = readMaps();
    assert.match(md, /packages\/warline\/src\/map\.ts/, "expected Maps.md to reference the warline meta-map file");
    assert.ok(
      existsSync(path.join(repoRoot, "packages/warline/src/map.ts")),
      "the referenced warline meta-map file should exist on disk",
    );
  });
});
