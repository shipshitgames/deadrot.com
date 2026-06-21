import assert from "node:assert/strict";
import { test } from "node:test";
import { createInitialWorld } from "./map";
import type { Front } from "./types";

// Canon front-taxonomy classes (apps/lore/content/Maps.md frontmatter).
const FRONTS: readonly Front[] = ["holdout", "lane", "breach", "orbital"];

// The canon front for every region id — mirrors the registry table in
// apps/lore/content/Maps.md. The meta-map joins the lore vault on `id` + `front`,
// so this mapping is the contract the registry and the in-code map must agree on.
const CANON_FRONT: Record<string, Front> = {
  spire: "holdout",
  ashgate: "holdout",
  pyregate: "holdout",
  ashreach: "holdout",
  rustmarch: "lane",
  hollowlanes: "lane",
  skyhook: "orbital",
  maw: "breach",
  cinder: "breach",
  perdition: "breach",
};

test("every warline region declares a valid canon front (#140)", () => {
  const world = createInitialWorld(0);
  assert.ok(world.regions.length > 0, "expected the meta-map to seed regions");
  for (const region of world.regions) {
    assert.ok(
      FRONTS.includes(region.front),
      `region ${region.id} has front ${region.front}, not a canon front-taxonomy class`,
    );
  }
});

test("region fronts match the canon Maps.md taxonomy (#140)", () => {
  const world = createInitialWorld(0);
  for (const region of world.regions) {
    assert.equal(
      region.front,
      CANON_FRONT[region.id],
      `front mismatch for region ${region.id} (declared ${region.front})`,
    );
  }
});

test("every canon region id is represented in the seed map (#140)", () => {
  const world = createInitialWorld(0);
  const ids = new Set(world.regions.map((region) => region.id));
  for (const id of Object.keys(CANON_FRONT)) {
    assert.ok(ids.has(id), `canon region ${id} is missing from the meta-map seed`);
  }
});
