import assert from "node:assert/strict";
import { test } from "node:test";

import type { ArenaBounds } from "../src/maps/arenaLayout";
import { boundsToRect, GROUND_LEVEL_ID, ROOT_ROOM_ID, SYNTH_PLAYER_SPAWN_ID } from "../src/maps/arenaLayout";

test("boundsToRect resolves a square to ±half on both axes", () => {
  assert.deepEqual(boundsToRect({ kind: "square", half: 40 }), {
    minX: -40,
    maxX: 40,
    minZ: -40,
    maxZ: 40,
  });
  assert.deepEqual(boundsToRect({ kind: "square", half: 7.5 }), {
    minX: -7.5,
    maxX: 7.5,
    minZ: -7.5,
    maxZ: 7.5,
  });
});

test("boundsToRect copies a rect verbatim (no kind key, asymmetric values kept)", () => {
  const rect: ArenaBounds = { kind: "rect", minX: -12, maxX: 18, minZ: -8, maxZ: 24 };
  assert.deepEqual(boundsToRect(rect), { minX: -12, maxX: 18, minZ: -8, maxZ: 24 });
});

test("boundsToRect always returns a fresh object", () => {
  const rect: ArenaBounds = { kind: "rect", minX: -1, maxX: 1, minZ: -2, maxZ: 2 };
  const out = boundsToRect(rect);
  assert.notEqual(out, rect);
  // Mutating the result must never corrupt the declarative bounds.
  out.maxX = 999;
  assert.equal(rect.maxX, 1);
  assert.deepEqual(boundsToRect({ kind: "square", half: 3 }), boundsToRect({ kind: "square", half: 3 }));
  assert.notEqual(boundsToRect({ kind: "square", half: 3 }), boundsToRect({ kind: "square", half: 3 }));
});

test("reserved ids are stable strings (persisted-data + adapter contract)", () => {
  assert.equal(ROOT_ROOM_ID, "arena");
  assert.equal(GROUND_LEVEL_ID, "ground");
  assert.equal(SYNTH_PLAYER_SPAWN_ID, "player-spawn");
});
