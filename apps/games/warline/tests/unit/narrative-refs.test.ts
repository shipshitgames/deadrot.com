import assert from "node:assert/strict";
import { test } from "node:test";

import { timelineEvents } from "@shipshitgames/assets/lore";
import { NARRATIVE_EVENTS } from "@shipshitgames/warline";

/**
 * Cross-package drift check: every narrative beat's canon anchor must exist in
 * the lore timeline (@shipshitgames/assets/lore). The warline package keeps
 * refs as plain strings to stay dependency-free; this app test pins them.
 */
test("every narrative timelineRef resolves to a canon timeline event", () => {
  const canonSlugs = new Set(timelineEvents.map((e) => e.slug));
  for (const def of NARRATIVE_EVENTS) {
    assert.ok(
      canonSlugs.has(def.timelineRef),
      `narrative event "${def.slug}" references unknown timeline slug "${def.timelineRef}"`,
    );
  }
});

test("narrative beats cover more than one era of the war record", () => {
  const eraBySlug = new Map(timelineEvents.map((e) => [e.slug, e.era]));
  const eras = new Set(NARRATIVE_EVENTS.map((d) => eraBySlug.get(d.timelineRef) ?? ""));
  eras.delete("");
  assert.ok(eras.size >= 3, `story beats should span the timeline (got ${eras.size} eras)`);
});
