// Adapter-contract matrix for normalizeArenaLayout (issue #79): one test per
// rule — bounds resolution, root-room synthesis/aliasing/merge, ground-level
// prepend, playerSpawn lift, never-invented anchors, pass-through ramps and
// platforms, purity on frozen input, idempotence, and the flattenObstacles
// order/identity invariant #82 depends on.

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ArenaAnchor,
  ArenaBounds,
  ArenaFloorLevel,
  ArenaObstacle,
  ArenaPlatform,
  ArenaRamp,
  ArenaRoom,
} from "../src/maps/arenaLayout";
import { GROUND_LEVEL_ID, ROOT_ROOM_ID, SYNTH_PLAYER_SPAWN_ID } from "../src/maps/arenaLayout";
import type { ArenaLayoutSource } from "../src/maps/normalize";
import { anchorsOfKind, firstAnchor, flattenObstacles, normalizeArenaLayout } from "../src/maps/normalize";

const SQUARE: ArenaBounds = { kind: "square", half: 40 };
const RECT: ArenaBounds = { kind: "rect", minX: -10, maxX: 10, minZ: -5, maxZ: 5 };

function box(x: number, z: number): ArenaObstacle {
  return { x, z, w: 2, h: 2, d: 2 };
}

function v1Source(): ArenaLayoutSource {
  return {
    bounds: SQUARE,
    spawn: { x: -26, z: 28 },
    obstacles: [box(0, 0), box(5, -3), box(-9, 7)],
  };
}

/** A fully-authored v2 source exercising every optional field. */
function v2Source(): ArenaLayoutSource {
  return {
    bounds: SQUARE,
    rooms: [
      {
        id: "north-hall",
        bounds: { kind: "rect", minX: -40, maxX: 0, minZ: -40, maxZ: 0 },
        obstacles: [box(-20, -20)],
      },
      {
        id: "south-yard",
        bounds: { kind: "rect", minX: 0, maxX: 40, minZ: 0, maxZ: 40 },
        obstacles: [box(20, 20)],
        levelId: "mezzanine",
      },
    ],
    levels: [
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "mezzanine", y: 3, name: "Mezzanine" },
    ],
    ramps: [
      {
        id: "main-ramp",
        kind: "stairs",
        from: { x: 0, z: -6 },
        to: { x: 0, z: 6 },
        width: 4,
        fromLevelId: GROUND_LEVEL_ID,
        toLevelId: "mezzanine",
        steps: 8,
      },
    ],
    platforms: [{ id: "overlook", x: 24, z: 24, w: 8, d: 8, y: 3, thickness: 0.5, levelId: "mezzanine" }],
    anchors: [
      { kind: "playerSpawn", id: "alpha", x: 0, z: -30, facing: Math.PI },
      { kind: "breachSpawn", id: "east-breach", x: 36, z: 0, laneId: "east" },
      { kind: "objective", id: "core", x: 0, z: 0 },
      { kind: "extraction", id: "exit", x: -36, z: 36 },
    ],
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

// --- rule 1: bounds resolution ----------------------------------------------

test("src.bounds wins over opts.defaultBounds", () => {
  const layout = normalizeArenaLayout({ bounds: SQUARE }, { defaultBounds: RECT });
  assert.equal(layout.bounds, SQUARE);
});

test("defaultBounds is used when src.bounds is omitted", () => {
  const layout = normalizeArenaLayout({}, { defaultBounds: RECT });
  assert.equal(layout.bounds, RECT);
  const root = layout.rooms[0];
  assert.ok(root);
  assert.equal(root.bounds, RECT, "synthesized root room shares the resolved bounds");
});

test("throws TypeError when neither src.bounds nor defaultBounds exists", () => {
  assert.throws(() => normalizeArenaLayout({}), TypeError);
  assert.throws(
    () => normalizeArenaLayout({ spawn: { x: 0, z: 0 } }),
    /src\.bounds or opts\.defaultBounds is required/,
  );
});

// --- rule 2a: v1 root-room synthesis ----------------------------------------

test("v1 source synthesizes one whole-bounds root room that ALIASES the flat obstacles", () => {
  const src = v1Source();
  const layout = normalizeArenaLayout(src);

  assert.equal(layout.bounds, SQUARE);
  assert.equal(layout.rooms.length, 1);
  const root = layout.rooms[0];
  assert.ok(root);
  assert.equal(root.id, ROOT_ROOM_ID);
  assert.equal(root.bounds, SQUARE);
  assert.equal(root.levelId, GROUND_LEVEL_ID);
  // Reference identity, not a copy — the invariant #82's buildArena flip rests on.
  assert.equal(root.obstacles, src.obstacles);
});

test("v1 source synthesizes the ground level, the playerSpawn anchor, and empty ramps/platforms", () => {
  const layout = normalizeArenaLayout(v1Source());

  assert.deepEqual(layout.levels, [{ id: GROUND_LEVEL_ID, y: 0, name: "Ground" }]);
  assert.deepEqual(layout.anchors, [
    { kind: "playerSpawn", id: SYNTH_PLAYER_SPAWN_ID, x: -26, z: 28, levelId: GROUND_LEVEL_ID },
  ]);
  assert.deepEqual(layout.ramps, []);
  assert.deepEqual(layout.platforms, []);
});

test("missing flat obstacles become an empty root room", () => {
  const layout = normalizeArenaLayout({ bounds: SQUARE });
  assert.equal(layout.rooms.length, 1);
  assert.deepEqual(layout.rooms[0]?.obstacles, []);
});

// --- rule 2b: fully room-authored maps pass through --------------------------

test("authored rooms with no flat obstacles are used as-is (same array reference)", () => {
  const rooms: ArenaRoom[] = [
    { id: "north", bounds: RECT, obstacles: [box(1, 1)] },
    { id: "south", bounds: RECT, obstacles: [box(2, 2)] },
  ];
  const byOmission = normalizeArenaLayout({ bounds: SQUARE, rooms });
  assert.equal(byOmission.rooms, rooms);
  const byEmptyList = normalizeArenaLayout({ bounds: SQUARE, rooms, obstacles: [] });
  assert.equal(byEmptyList.rooms, rooms);
});

test("flat obstacles already homed in a room (by identity) trigger no merge and no duplication", () => {
  const shared = box(3, 3);
  const rooms: ArenaRoom[] = [{ id: "north", bounds: RECT, obstacles: [shared] }];
  const layout = normalizeArenaLayout({ bounds: SQUARE, rooms, obstacles: [shared] });

  assert.equal(layout.rooms, rooms, "all flat obstacles homed → authored rooms pass through");
  const flat = flattenObstacles(layout);
  assert.deepEqual(flat, [shared]);
  assert.equal(flat[0], shared);
});

// --- rule 2c: mixed authoring merges extras into the root room ---------------

test("unhomed flat obstacles land in a PREPENDED synthesized root room, in flat order", () => {
  const homed = box(1, 1);
  const extraA = box(2, 2);
  const extraB = box(3, 3);
  const authored: ArenaRoom = { id: "north", bounds: RECT, obstacles: [homed] };
  const layout = normalizeArenaLayout({
    bounds: SQUARE,
    rooms: [authored],
    obstacles: [extraA, homed, extraB],
  });

  assert.equal(layout.rooms.length, 2);
  const root = layout.rooms[0];
  assert.ok(root);
  assert.equal(root.id, ROOT_ROOM_ID);
  assert.equal(root.bounds, SQUARE);
  assert.equal(root.levelId, GROUND_LEVEL_ID);
  assert.equal(root.obstacles.length, 2, "only the identity-deduped extras");
  assert.equal(root.obstacles[0], extraA);
  assert.equal(root.obstacles[1], extraB);
  assert.equal(layout.rooms[1], authored, "authored room kept by reference, after the root");
});

test("an authored root-id room absorbs extras at its position, without mutation", () => {
  const authoredObstacle = box(1, 1);
  const extra = box(9, 9);
  const north: ArenaRoom = { id: "north", bounds: RECT, obstacles: [] };
  const rootRoom: ArenaRoom = { id: ROOT_ROOM_ID, bounds: SQUARE, obstacles: [authoredObstacle] };
  const rooms = [north, rootRoom];
  const layout = normalizeArenaLayout({ bounds: SQUARE, rooms, obstacles: [authoredObstacle, extra] });

  assert.equal(layout.rooms.length, 2, "no extra room synthesized");
  assert.equal(layout.rooms[0], north, "non-root rooms keep reference identity");
  const merged = layout.rooms[1];
  assert.ok(merged);
  assert.notEqual(merged, rootRoom, "merged root is a fresh object");
  assert.equal(merged.id, ROOT_ROOM_ID);
  assert.equal(merged.obstacles.length, 2);
  assert.equal(merged.obstacles[0], authoredObstacle, "authored obstacles first");
  assert.equal(merged.obstacles[1], extra, "extras appended after");
  // The authored objects/arrays were never touched.
  assert.deepEqual(rootRoom.obstacles, [authoredObstacle]);
  assert.equal(rooms.length, 2);
  assert.equal(rooms[1], rootRoom);
});

// --- rule 3: ground level ----------------------------------------------------

test("ground level is prepended ahead of authored non-ground levels", () => {
  const mezzanine: ArenaFloorLevel = { id: "mezzanine", y: 3, name: "Mezzanine" };
  const layout = normalizeArenaLayout({ bounds: SQUARE, levels: [mezzanine] });

  assert.equal(layout.levels.length, 2);
  assert.deepEqual(layout.levels[0], { id: GROUND_LEVEL_ID, y: 0, name: "Ground" });
  assert.equal(layout.levels[1], mezzanine, "authored level kept by reference");
});

test("an authored ground level is trusted verbatim, even off-zero", () => {
  const levels: ArenaFloorLevel[] = [{ id: GROUND_LEVEL_ID, y: 1.5 }];
  const layout = normalizeArenaLayout({ bounds: SQUARE, levels });
  assert.equal(layout.levels, levels, "same array reference — no prepend, no rewrite");
});

// --- rule 4: anchors ---------------------------------------------------------

test("an authored playerSpawn suppresses synthesis from the v1 spawn", () => {
  const authored: ArenaAnchor = { kind: "playerSpawn", id: "alpha", x: 1, z: 2 };
  const layout = normalizeArenaLayout({ bounds: SQUARE, spawn: { x: -26, z: 28 }, anchors: [authored] });

  assert.equal(layout.anchors.length, 1);
  assert.equal(layout.anchors[0], authored);
  assert.equal(
    layout.anchors.some((anchor) => anchor.id === SYNTH_PLAYER_SPAWN_ID),
    false,
  );
});

test("the synthesized playerSpawn is APPENDED after authored non-player anchors", () => {
  const breach: ArenaAnchor = { kind: "breachSpawn", id: "east-door", x: 30, z: 0, laneId: "east" };
  const objective: ArenaAnchor = { kind: "objective", id: "core", x: 0, z: 0 };
  const layout = normalizeArenaLayout({ bounds: SQUARE, spawn: { x: 1, z: 2 }, anchors: [breach, objective] });

  assert.equal(layout.anchors.length, 3);
  assert.equal(layout.anchors[0], breach);
  assert.equal(layout.anchors[1], objective);
  assert.deepEqual(layout.anchors[2], {
    kind: "playerSpawn",
    id: SYNTH_PLAYER_SPAWN_ID,
    x: 1,
    z: 2,
    levelId: GROUND_LEVEL_ID,
  });
});

test("breachSpawn/objective/extraction are NEVER invented (empty set = v1 procedural scatter)", () => {
  const layout = normalizeArenaLayout(v1Source());
  assert.deepEqual(anchorsOfKind(layout, "breachSpawn"), []);
  assert.deepEqual(anchorsOfKind(layout, "objective"), []);
  assert.deepEqual(anchorsOfKind(layout, "extraction"), []);

  const bare = normalizeArenaLayout({ bounds: SQUARE });
  assert.deepEqual(bare.anchors, [], "no spawn at all → no anchors at all");
});

// --- rule 5: ramps/platforms pass through ------------------------------------

test("ramps and platforms pass through into fresh arrays, dangling levelIds tolerated", () => {
  const ramp: ArenaRamp = {
    id: "r1",
    kind: "stairs",
    from: { x: 0, z: 0 },
    to: { x: 0, z: 6 },
    width: 3,
    fromLevelId: GROUND_LEVEL_ID,
    toLevelId: "missing-level", // not rejected — geometry validation is #81's contract
    steps: 8,
  };
  const platform: ArenaPlatform = { id: "p1", x: 10, z: 10, w: 6, d: 6, y: 3, thickness: 0.4, levelId: "mezzanine" };
  const src: ArenaLayoutSource = { bounds: SQUARE, ramps: [ramp], platforms: [platform] };
  const layout = normalizeArenaLayout(src);

  assert.notEqual(layout.ramps, src.ramps, "fresh array");
  assert.notEqual(layout.platforms, src.platforms, "fresh array");
  assert.equal(layout.ramps[0], ramp, "element identity preserved");
  assert.equal(layout.platforms[0], platform, "element identity preserved");
});

// --- full v2 fixture: rooms + elevation survive normalization ----------------

test("a fully-authored v2 source (2 rooms, mezzanine, ramp, platform, 4 anchors) normalizes losslessly", () => {
  const src = v2Source();
  const layout = normalizeArenaLayout(src);

  assert.equal(layout.rooms, src.rooms, "no flat obstacles → rooms as-is");
  assert.equal(layout.levels, src.levels, "authored ground present → levels verbatim");
  assert.equal(layout.ramps[0], src.ramps?.[0]);
  assert.equal(layout.platforms[0], src.platforms?.[0]);
  assert.deepEqual(layout.anchors, src.anchors ?? []);
  assert.equal(layout.anchors.length, 4, "authored playerSpawn → nothing synthesized");

  const flat = flattenObstacles(layout);
  assert.equal(flat.length, 2, "rooms in layout order, author order within each room");
  assert.equal(flat[0], src.rooms?.[0]?.obstacles[0]);
  assert.equal(flat[1], src.rooms?.[1]?.obstacles[0]);
});

// --- rule 6: purity ----------------------------------------------------------

test("never mutates the source: deeply frozen v1 and merge-path inputs normalize fine", () => {
  const v1 = v1Source();
  const v1Clone = structuredClone(v1);
  deepFreeze(v1);
  const v1Layout = normalizeArenaLayout(v1);
  assert.equal(v1Layout.rooms.length, 1);
  assert.deepEqual(v1, v1Clone);

  // The merge branch (authored root + extras) is the riskiest path for mutation.
  const homed = box(1, 1);
  const mixed: ArenaLayoutSource = {
    bounds: SQUARE,
    spawn: { x: 0, z: 0 },
    obstacles: [homed, box(2, 2)],
    rooms: [{ id: ROOT_ROOM_ID, bounds: SQUARE, obstacles: [homed] }],
    levels: [{ id: "mezzanine", y: 3 }],
  };
  const mixedClone = structuredClone(mixed);
  deepFreeze(mixed);
  const mixedLayout = normalizeArenaLayout(mixed);
  assert.equal(mixedLayout.rooms[0]?.obstacles.length, 2);
  assert.deepEqual(mixed, mixedClone);
});

// --- rule 7: idempotence ------------------------------------------------------

test("idempotent: normalizing an already-normalized layout is stable (v1 and v2)", () => {
  const v1Layout = normalizeArenaLayout(v1Source());
  assert.deepEqual(normalizeArenaLayout(v1Layout), v1Layout);

  const v2Layout = normalizeArenaLayout(v2Source());
  assert.deepEqual(normalizeArenaLayout(v2Layout), v2Layout);
  assert.deepEqual(normalizeArenaLayout(normalizeArenaLayout(v2Layout)), v2Layout);
});

// --- options: custom reserved ids ---------------------------------------------

test("custom rootRoomId/groundLevelId options are honored end-to-end", () => {
  const layout = normalizeArenaLayout(
    { bounds: SQUARE, spawn: { x: 0, z: 0 }, obstacles: [box(1, 1)] },
    { rootRoomId: "board", groundLevelId: "deck" },
  );
  assert.equal(layout.rooms[0]?.id, "board");
  assert.equal(layout.rooms[0]?.levelId, "deck");
  assert.equal(layout.levels[0]?.id, "deck");
  assert.equal(layout.anchors[0]?.levelId, "deck");

  // The merge rule keys off the custom root id, not the default.
  const authoredRoot: ArenaRoom = { id: "board", bounds: SQUARE, obstacles: [] };
  const extra = box(2, 2);
  const merged = normalizeArenaLayout(
    { bounds: SQUARE, rooms: [authoredRoot], obstacles: [extra] },
    { rootRoomId: "board" },
  );
  assert.equal(merged.rooms.length, 1);
  assert.deepEqual(merged.rooms[0]?.obstacles, [extra]);
});

// --- helpers: flattenObstacles / anchorsOfKind / firstAnchor -------------------

test("flattenObstacles always returns a fresh array with element identity preserved", () => {
  const src = v1Source();
  const layout = normalizeArenaLayout(src);
  const flat = flattenObstacles(layout);

  assert.notEqual(flat, layout.rooms[0]?.obstacles, "fresh array, not the room's");
  assert.notEqual(flat, src.obstacles, "fresh array, not the source's");
  assert.equal(flat.length, src.obstacles?.length);
  src.obstacles?.forEach((obstacle, i) => {
    assert.equal(flat[i], obstacle, `element ${i} identity`);
  });
});

test("anchorsOfKind filters in layout order into a fresh array; firstAnchor matches", () => {
  const player: ArenaAnchor = { kind: "playerSpawn", x: 0, z: 0 };
  const breachA: ArenaAnchor = { kind: "breachSpawn", id: "a", x: 1, z: 0 };
  const breachB: ArenaAnchor = { kind: "breachSpawn", id: "b", x: 2, z: 0 };
  const objective: ArenaAnchor = { kind: "objective", x: 3, z: 0 };
  const layout = { anchors: [player, breachA, objective, breachB] };

  const breaches = anchorsOfKind(layout, "breachSpawn");
  assert.equal(breaches.length, 2);
  assert.equal(breaches[0], breachA);
  assert.equal(breaches[1], breachB);
  assert.notEqual(breaches, layout.anchors);
  assert.deepEqual(anchorsOfKind(layout, "extraction"), []);

  assert.equal(firstAnchor(layout, "breachSpawn"), breachA);
  assert.equal(firstAnchor(layout, "playerSpawn"), player);
  assert.equal(firstAnchor(layout, "extraction"), undefined);
});
