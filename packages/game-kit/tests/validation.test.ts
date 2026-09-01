// ArenaMap v2 validator contract (issue #81): valid layouts pass; malformed
// bounds/references/heights, out-of-bounds/sliver/overlapping obstacles,
// unreachable spawns, and disconnected rooms return stable structured errors.

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ArenaLayout, ArenaObstacle } from "../src/maps/arenaLayout";
import { GROUND_LEVEL_ID } from "../src/maps/arenaLayout";
import {
  ARENA_VALIDATION_DEFAULTS,
  ArenaLayoutValidationError,
  assertValidArenaLayout,
  validateArenaLayout,
} from "../src/maps/validation";

function obstacle(x: number, z: number, w = 2, h = 2, d = 2): ArenaObstacle {
  return { x, z, w, h, d };
}

function validLayout(): ArenaLayout {
  return {
    bounds: { kind: "rect", minX: -20, maxX: 20, minZ: -12, maxZ: 12 },
    rooms: [
      {
        id: "west",
        name: "West Hall",
        bounds: { kind: "rect", minX: -20, maxX: 0, minZ: -12, maxZ: 12 },
        levelId: GROUND_LEVEL_ID,
        obstacles: [obstacle(-12, -5), obstacle(-12, 5)],
      },
      {
        id: "east",
        name: "East Hall",
        bounds: { kind: "rect", minX: 0, maxX: 20, minZ: -12, maxZ: 12 },
        levelId: GROUND_LEVEL_ID,
        obstacles: [obstacle(12, -5), obstacle(12, 5)],
      },
    ],
    levels: [
      { id: GROUND_LEVEL_ID, y: 0 },
      { id: "mezzanine", y: 4 },
    ],
    ramps: [
      {
        id: "mezz-ramp",
        kind: "ramp",
        from: { x: -6, z: 0 },
        to: { x: 6, z: 0 },
        width: 2,
        fromLevelId: GROUND_LEVEL_ID,
        toLevelId: "mezzanine",
      },
    ],
    platforms: [{ id: "overlook", x: 10, z: 0, w: 5, d: 4, y: 4, thickness: 0.5, levelId: "mezzanine" }],
    // Buildings are opt-in; this baseline stays a bare arena so the room,
    // ramp, and anchor rules are exercised without a shell in the way.
    structures: [],
    anchors: [
      { kind: "playerSpawn", id: "player", x: -6, z: 0, levelId: GROUND_LEVEL_ID, roomId: "west" },
      { kind: "breachSpawn", id: "east-breach", x: 18, z: 0, levelId: GROUND_LEVEL_ID, roomId: "east" },
      { kind: "objective", id: "core", x: 4, z: 0, levelId: GROUND_LEVEL_ID, roomId: "east" },
    ],
  };
}

function codes(layout: ArenaLayout): string[] {
  return validateArenaLayout(layout).errors.map((error) => error.code);
}

test("a connected, bounded layout with valid references and a clear player spawn passes", () => {
  const layout = validLayout();
  assert.deepEqual(validateArenaLayout(layout), { ok: true, errors: [] });
  assert.doesNotThrow(() => assertValidArenaLayout(layout));
});

test("validation is pure and deterministic on deeply frozen input", () => {
  const layout = validLayout();
  const clone = structuredClone(layout);
  Object.freeze(layout.anchors);
  Object.freeze(layout.platforms);
  Object.freeze(layout.ramps);
  Object.freeze(layout.levels);
  for (const room of layout.rooms) {
    Object.freeze(room.obstacles);
    Object.freeze(room);
  }
  Object.freeze(layout.rooms);
  Object.freeze(layout);

  const first = validateArenaLayout(layout);
  const second = validateArenaLayout(layout);
  assert.deepEqual(first, second);
  assert.deepEqual(layout, clone);
});

test("invalid map/room bounds and duplicate room/level ids are structured", () => {
  const layout = validLayout();
  layout.bounds = { kind: "rect", minX: 5, maxX: -5, minZ: -10, maxZ: 10 };
  layout.rooms[1] = { ...layout.rooms[1]!, id: "west" };
  layout.levels.push({ id: "mezzanine", y: 8 });
  layout.anchors = [{ kind: "playerSpawn", x: -6, z: 0 }];

  const result = validateArenaLayout(layout);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map(({ code, path, relatedPath }) => ({ code, path, relatedPath })),
    [
      { code: "bounds.invalid", path: "bounds", relatedPath: undefined },
      {
        code: "level.id.duplicate",
        path: "levels[2].id",
        relatedPath: "levels[1].id",
      },
      {
        code: "room.id.duplicate",
        path: "rooms[1].id",
        relatedPath: "rooms[0].id",
      },
    ],
  );
});

test("obstacle dimensions, slivers, bounds, heights, and overlaps are all rejected", () => {
  const layout = validLayout();
  layout.rooms = [
    {
      id: "arena",
      bounds: layout.bounds,
      obstacles: [
        obstacle(0, 0, 3, 2, 3),
        obstacle(1, 0, 3, 2, 3),
        obstacle(19.8, 0, 1, 2, 1),
        obstacle(-8, 0, 0.05, 2, 1),
        obstacle(-4, 0, 1, 65, 1),
        obstacle(4, 0, -1, 2, 1),
      ],
    },
  ];
  layout.anchors = [{ kind: "playerSpawn", x: -10, z: 0 }];

  const resultCodes = codes(layout);
  assert.ok(resultCodes.includes("obstacle.overlap"));
  assert.ok(resultCodes.includes("obstacle.out-of-bounds"));
  assert.ok(resultCodes.includes("obstacle.sliver"));
  assert.ok(resultCodes.includes("obstacle.height.invalid"));
  assert.ok(resultCodes.includes("obstacle.dimension.invalid"));
});

test("touching obstacle faces are legal while three-dimensional penetration is not", () => {
  const layout = validLayout();
  layout.rooms = [
    {
      id: "arena",
      bounds: layout.bounds,
      obstacles: [obstacle(-1, 6, 2, 2, 2), obstacle(1, 6, 2, 2, 2)],
    },
  ];
  assert.equal(codes(layout).includes("obstacle.overlap"), false);

  layout.rooms[0]!.obstacles[1]!.x = 0.99;
  assert.equal(codes(layout).includes("obstacle.overlap"), true);
});

test("disconnected rooms fail; a wide shared edge or authored cross-room ramp connects them", () => {
  const layout = validLayout();
  layout.rooms[1] = {
    ...layout.rooms[1]!,
    bounds: { kind: "rect", minX: 4, maxX: 20, minZ: -12, maxZ: 12 },
  };
  layout.ramps = [];
  assert.ok(codes(layout).includes("room.disconnected"));

  layout.rooms[1] = {
    ...layout.rooms[1]!,
    bounds: { kind: "rect", minX: 0, maxX: 20, minZ: -12, maxZ: 12 },
  };
  assert.equal(codes(layout).includes("room.disconnected"), false);

  layout.rooms[1] = {
    ...layout.rooms[1]!,
    bounds: { kind: "rect", minX: 4, maxX: 20, minZ: -12, maxZ: 12 },
    levelId: "mezzanine",
  };
  layout.ramps = [
    {
      id: "bridge",
      kind: "ramp",
      from: { x: -1, z: 0 },
      to: { x: 6, z: 0 },
      width: 2,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "mezzanine",
    },
  ];
  assert.equal(codes(layout).includes("room.disconnected"), false);
});

test("room connectivity is rooted at the player spawn and marks a spawn in another component unreachable", () => {
  const layout = validLayout();
  layout.rooms = [
    {
      id: "isolated-west",
      bounds: { kind: "rect", minX: -20, maxX: -12, minZ: -12, maxZ: 12 },
      obstacles: [],
    },
    {
      id: "central",
      bounds: { kind: "rect", minX: -8, maxX: 8, minZ: -12, maxZ: 12 },
      obstacles: [],
    },
    {
      id: "east",
      bounds: { kind: "rect", minX: 8, maxX: 20, minZ: -12, maxZ: 12 },
      obstacles: [],
    },
  ];
  layout.ramps = [];
  layout.anchors = [
    { kind: "playerSpawn", id: "primary", x: 0, z: 0, roomId: "central" },
    { kind: "playerSpawn", id: "isolated", x: -16, z: 0, roomId: "isolated-west" },
  ];

  const result = validateArenaLayout(layout);
  assert.deepEqual(
    result.errors.filter(({ code }) => code === "room.disconnected").map(({ path }) => path),
    ["rooms[0].bounds"],
  );
  assert.deepEqual(
    result.errors.filter(({ code }) => code === "player-spawn.unreachable").map(({ path }) => path),
    ["anchors[1]"],
  );
});

test("anchors validate bounds, ids, room/level references, membership, and spawn reachability", () => {
  const layout = validLayout();
  layout.rooms[0]!.obstacles.push(obstacle(-6, 0, 2, 2, 2));
  layout.anchors = [
    { kind: "playerSpawn", id: "dup", x: -6, z: 0, roomId: "west" },
    { kind: "breachSpawn", id: "dup", x: 99, z: 0, levelId: "void", roomId: "missing" },
    { kind: "objective", id: "mismatch", x: 10, z: 0, roomId: "west" },
  ];

  const resultCodes = codes(layout);
  for (const expected of [
    "anchor.blocked",
    "anchor.id.duplicate",
    "anchor.level.missing",
    "anchor.out-of-bounds",
    "anchor.room.mismatch",
    "anchor.room.missing",
    "player-spawn.unreachable",
  ]) {
    assert.ok(resultCodes.includes(expected), expected);
  }
});

test("a missing player spawn is an explicit error", () => {
  const layout = validLayout();
  layout.anchors = [{ kind: "objective", id: "core", x: 0, z: 0 }];
  assert.ok(codes(layout).includes("player-spawn.missing"));
});

test("levels, rooms, platforms, ramps, and anchors reject dangling level references", () => {
  const layout = validLayout();
  layout.rooms[0]!.levelId = "void";
  layout.platforms[0]!.levelId = "void";
  layout.ramps[0]!.fromLevelId = "void";
  layout.anchors[0]!.levelId = "void";

  const resultCodes = codes(layout);
  assert.ok(resultCodes.includes("room.level.missing"));
  assert.ok(resultCodes.includes("platform.level.missing"));
  assert.ok(resultCodes.includes("ramp.level.missing"));
  assert.ok(resultCodes.includes("anchor.level.missing"));
  assert.ok(resultCodes.includes("player-spawn.unreachable"));
});

test("platform and ramp dimensions, bounds, heights, and slope are validated", () => {
  const layout = validLayout();
  layout.platforms = [{ id: "bad-platform", x: 25, z: 0, w: 0.05, d: 3, y: 70, thickness: 80 }];
  layout.ramps = [
    {
      id: "bad-ramp",
      kind: "stairs",
      from: { x: 25, z: 0 },
      to: { x: 25, z: 0 },
      width: 0.2,
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: GROUND_LEVEL_ID,
      steps: 0,
    },
  ];

  const resultCodes = codes(layout);
  assert.ok(resultCodes.includes("platform.dimension.invalid"));
  assert.ok(resultCodes.includes("platform.height.invalid"));
  assert.ok(resultCodes.includes("platform.out-of-bounds"));
  assert.ok(resultCodes.includes("ramp.dimension.invalid"));
  assert.ok(resultCodes.includes("ramp.out-of-bounds"));
  assert.ok(resultCodes.includes("ramp.slope.invalid"));
});

test("ground and maximum-height rules are configurable", () => {
  const layout = validLayout();
  layout.levels[0] = { id: GROUND_LEVEL_ID, y: 1 };
  layout.levels[1] = { id: "mezzanine", y: 4 };
  assert.ok(codes(layout).includes("level.ground.invalid"));

  const result = validateArenaLayout(layout, { groundLevelId: "mezzanine", maxHeight: 5 });
  assert.equal(
    result.errors.some((error) => error.code === "level.ground.invalid"),
    true,
  );
  assert.equal(ARENA_VALIDATION_DEFAULTS.maxHeight, 64);
});

test("assertValidArenaLayout throws one aggregate error with every diagnostic", () => {
  const layout = validLayout();
  layout.anchors = [];
  layout.levels[0]!.y = -1;

  assert.throws(
    () => assertValidArenaLayout(layout),
    (error: unknown) => {
      assert.ok(error instanceof ArenaLayoutValidationError);
      assert.equal(error.errors.length, 3);
      assert.deepEqual(
        error.errors.map(({ code }) => code),
        ["level.height.invalid", "level.ground.invalid", "player-spawn.missing"],
      );
      return true;
    },
  );
});
