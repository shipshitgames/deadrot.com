import assert from "node:assert/strict";
import { test } from "node:test";

import { GAME_OPERATIONS, GAME_SLUGS, operationKindFor, WAR_RESOURCE, warResourceFor } from "./operations";
import { RESOURCE_KINDS } from "./types";

test("every game maps to a known operation kind", () => {
  for (const slug of GAME_SLUGS) {
    assert.equal(GAME_OPERATIONS[slug].game, slug);
    assert.equal(operationKindFor(slug), GAME_OPERATIONS[slug].kind);
  }
});

test("warResourceFor returns the game's primary credited resource", () => {
  for (const slug of GAME_SLUGS) {
    const res = warResourceFor(slug);
    assert.ok(RESOURCE_KINDS.includes(res), `${slug} war resource is a real ResourceKind`);
    assert.equal(res, GAME_OPERATIONS[slug].resources[0], `${slug} drops its primary operation resource`);
  }
});

test("WAR_RESOURCE table covers every slug and matches warResourceFor", () => {
  assert.deepEqual(Object.keys(WAR_RESOURCE).sort(), [...GAME_SLUGS].sort());
  for (const slug of GAME_SLUGS) {
    assert.equal(WAR_RESOURCE[slug], warResourceFor(slug));
  }
});

test("the canonical anchors hold (scourge → biomass, deadlane → scrap)", () => {
  assert.equal(WAR_RESOURCE["scourge-survivors"], "biomass");
  assert.equal(WAR_RESOURCE.deadlane, "scrap");
});
