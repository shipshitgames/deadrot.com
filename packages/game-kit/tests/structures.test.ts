import assert from "node:assert/strict";
import { test } from "node:test";

import type { ArenaBounds } from "../src/maps/arenaLayout";
import type { ArenaStructureOpening, ArenaStructureStorey } from "../src/maps/structures";
import {
  DEFAULT_FLOOR_THICKNESS,
  DEFAULT_STOREY_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WINDOW_SILL,
  holeAppliesToStorey,
  openingBlocksAtRest,
  openingSill,
  openingStorey,
  structureFloorThickness,
  structureInteriorRect,
  structureOpeningPlacement,
  structureSideFacing,
  structureStoreys,
  structureWallAxis,
  structureWallThickness,
} from "../src/maps/structures";

/** A 20×12 footprint on clean binary values, so wall/interior maths stays exact. */
const HOUSE: ArenaBounds = { kind: "rect", minX: -10, maxX: 10, minZ: -6, maxZ: 6 };

function storey(over: Partial<ArenaStructureStorey> = {}): ArenaStructureStorey {
  return { levelId: "ground", index: 0, floorY: 0, height: 3, ceilingY: 3, ...over };
}

function opening(over: Partial<ArenaStructureOpening> = {}): ArenaStructureOpening {
  return { id: "front", kind: "door", side: "south", width: 2, height: 2.4, ...over };
}

test("wall and floor thickness fall back only for values that cannot describe a solid", () => {
  assert.equal(structureWallThickness({ wallThickness: 0.75 }), 0.75);
  assert.equal(structureFloorThickness({ floorThickness: 0.9 }), 0.9);

  // Unset, zero, negative, and non-finite all mean "no usable authored value".
  for (const bad of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(structureWallThickness({ wallThickness: bad }), DEFAULT_WALL_THICKNESS, `wall ${String(bad)}`);
    assert.equal(structureFloorThickness({ floorThickness: bad }), DEFAULT_FLOOR_THICKNESS, `floor ${String(bad)}`);
  }
});

test("sill defaults by kind and an explicit zero survives the defaulting", () => {
  assert.equal(openingSill({ kind: "door" }), 0);
  assert.equal(openingSill({ kind: "window" }), DEFAULT_WINDOW_SILL);
  assert.equal(openingSill({ kind: "window", sill: 2 }), 2);
  // 0 is a legitimate authored sill for a floor-to-ceiling window; it must not
  // read as "unset" and get replaced by the chest-high default.
  assert.equal(openingSill({ kind: "window", sill: 0 }), 0);
  assert.equal(openingSill({ kind: "window", sill: Number.NaN }), DEFAULT_WINDOW_SILL);
});

test("an opening blocks at rest unless it is open, or an unglazed window", () => {
  assert.equal(openingBlocksAtRest(opening({ state: "closed" })), true);
  assert.equal(openingBlocksAtRest(opening()), true, "unset state is closed");
  assert.equal(openingBlocksAtRest(opening({ state: "locked" })), true);
  assert.equal(openingBlocksAtRest(opening({ state: "open" })), false);

  const window = { ...opening({ kind: "window" }), id: "pane" };
  assert.equal(openingBlocksAtRest(window), true, "glazing defaults on");
  assert.equal(openingBlocksAtRest({ ...window, glazed: true }), true);
  assert.equal(openingBlocksAtRest({ ...window, glazed: false }), false, "a missing pane is a hole");
  assert.equal(openingBlocksAtRest({ ...window, glazed: true, state: "open" }), false, "open wins over glazing");
});

test("the interior rect insets by a full wall thickness per side and degenerates when it must", () => {
  assert.deepEqual(structureInteriorRect(HOUSE, 0.5), { minX: -9.5, maxX: 9.5, minZ: -5.5, maxZ: 5.5 });

  // Walls thicker than half the footprint leave no interior. The contract is an
  // inverted rect callers can detect, not a clamp that fakes usable space.
  const crushed = structureInteriorRect({ kind: "square", half: 0.3 }, 0.4);
  assert.ok(crushed.maxX < crushed.minX && crushed.maxZ < crushed.minZ);
});

test("each wall centres on its footprint edge pulled inward by half its thickness", () => {
  // Outer faces stay exactly on the footprint, so a building never spills past
  // its declared bounds however thick its walls are.
  assert.deepEqual(structureWallAxis(HOUSE, "north", 0.5), {
    along: "x",
    center: -5.75,
    mid: 0,
    length: 20,
    outward: -1,
  });
  assert.deepEqual(structureWallAxis(HOUSE, "south", 0.5), {
    along: "x",
    center: 5.75,
    mid: 0,
    length: 20,
    outward: 1,
  });
  assert.deepEqual(structureWallAxis(HOUSE, "west", 0.5), {
    along: "z",
    center: -9.75,
    mid: 0,
    length: 12,
    outward: -1,
  });
  assert.deepEqual(structureWallAxis(HOUSE, "east", 0.5), { along: "z", center: 9.75, mid: 0, length: 12, outward: 1 });

  for (const side of ["north", "south", "east", "west"] as const) {
    const axis = structureWallAxis(HOUSE, side, 0.5);
    const outerFace = axis.center + (axis.outward * 0.5) / 2;
    assert.equal(Math.abs(outerFace), axis.along === "x" ? 6 : 10, `${side} outer face sits on the footprint`);
  }
});

test("storey heights derive from the next storey's elevation, and only the top falls back", () => {
  const levelY = new Map([
    ["ground", 0],
    ["first", 4],
    ["second", 7],
  ]);

  assert.deepEqual(structureStoreys({ levelIds: ["ground", "first", "second"] }, levelY), [
    { levelId: "ground", index: 0, floorY: 0, height: 4, ceilingY: 4 },
    { levelId: "first", index: 1, floorY: 4, height: 3, ceilingY: 7 },
    { levelId: "second", index: 2, floorY: 7, height: DEFAULT_STOREY_HEIGHT, ceilingY: 7 + DEFAULT_STOREY_HEIGHT },
  ]);

  const capped = structureStoreys({ levelIds: ["ground", "first"], storeyHeight: 2.5 }, levelY);
  assert.equal(capped[0]?.height, 4, "a derivable storey ignores storeyHeight");
  assert.equal(capped[1]?.height, 2.5, "only the topmost storey uses it");

  for (const bad of [0, -3, Number.NaN]) {
    const out = structureStoreys({ levelIds: ["second"], storeyHeight: bad }, levelY);
    assert.equal(out[0]?.height, DEFAULT_STOREY_HEIGHT, `storeyHeight ${String(bad)} is not a height`);
  }
});

test("structureStoreys skips dangling levels and refuses to emit a non-positive wall", () => {
  const levelY = new Map([
    ["ground", 0],
    ["first", 4],
    ["broken", Number.NaN],
  ]);

  // A dangling reference is a validator diagnostic, not a crash — and the
  // surviving storeys renumber so `index` still means position in the stack.
  assert.deepEqual(structureStoreys({ levelIds: ["ground", "ghost", "broken", "first"] }, levelY), [
    { levelId: "ground", index: 0, floorY: 0, height: 4, ceilingY: 4 },
    { levelId: "first", index: 1, floorY: 4, height: DEFAULT_STOREY_HEIGHT, ceilingY: 4 + DEFAULT_STOREY_HEIGHT },
  ]);

  // Descending or duplicate levels would derive a zero/negative clearance;
  // every storey falls back rather than inverting its walls.
  for (const levelIds of [
    ["first", "ground"],
    ["ground", "ground"],
  ]) {
    for (const out of structureStoreys({ levelIds }, levelY)) {
      assert.equal(out.height, DEFAULT_STOREY_HEIGHT, levelIds.join(">"));
      assert.equal(out.ceilingY, out.floorY + DEFAULT_STOREY_HEIGHT);
    }
  }

  assert.deepEqual(structureStoreys({ levelIds: [] }, levelY), []);
});

test("an opening without a levelId belongs to the ground-most storey", () => {
  const storeys = [storey(), storey({ levelId: "first", index: 1, floorY: 4, ceilingY: 7 })];

  assert.equal(openingStorey({}, storeys), storeys[0]);
  assert.equal(openingStorey({ levelId: "first" }, storeys), storeys[1]);
  assert.equal(openingStorey({ levelId: "roof" }, storeys), undefined, "dangling reference resolves to nothing");
  assert.equal(openingStorey({}, []), undefined, "a structure with no storeys has no default");
});

test("an opening resolves to a world cut measured from the wall midpoint and its storey floor", () => {
  const structure = { bounds: HOUSE, wallThickness: 0.5 };
  const door = structureOpeningPlacement(structure, opening({ offset: 3 }), storey());

  assert.deepEqual(door, {
    id: "front",
    kind: "door",
    side: "south",
    along: "x",
    wallCenter: 5.75,
    outward: 1,
    thickness: 0.5,
    // `width` is the CLEAR span: min..max is exactly what leaves the wall.
    min: 2,
    max: 4,
    bottom: 0,
    top: 2.4,
    x: 3,
    y: 1.2,
    z: 5.75,
  });
  assert.equal(door.max - door.min, 2);

  // Unset offset centres the cut on the wall.
  assert.equal(structureOpeningPlacement(structure, opening(), storey()).x, 0);
});

test("the same opening declaration lands one storey higher without re-authoring", () => {
  const structure = { bounds: HOUSE, wallThickness: 0.5 };
  const upstairs = storey({ levelId: "first", index: 1, floorY: 4, ceilingY: 7 });
  const window = structureOpeningPlacement(structure, opening({ id: "pane", kind: "window", side: "west" }), upstairs);

  // Sill is relative to the storey floor, so a first-floor window sits a full
  // storey above the identical ground-floor one.
  assert.equal(window.bottom, 4 + DEFAULT_WINDOW_SILL);
  assert.equal(window.top, window.bottom + 2.4);
  assert.equal(window.y, (window.bottom + window.top) / 2);

  // West wall runs along Z, so the running coordinate is z and x is fixed.
  assert.equal(window.along, "z");
  assert.equal(window.x, -9.75);
  assert.equal(window.z, 0);
  assert.equal(window.outward, -1);

  // An unset wallThickness still resolves — placement never depends on authoring
  // every optional field.
  assert.equal(structureOpeningPlacement({ bounds: HOUSE }, opening(), storey()).thickness, DEFAULT_WALL_THICKNESS);
});

test("side facings are outward yaws in Object3D terms, a quarter turn apart", () => {
  assert.equal(structureSideFacing("north"), 0);
  assert.equal(structureSideFacing("south"), Math.PI);
  assert.equal(structureSideFacing("west"), Math.PI / 2);
  assert.equal(structureSideFacing("east"), -Math.PI / 2);

  // The yaw must point along the wall's outward normal: default forward is −Z,
  // so rotating by the facing lands on the axis structureWallAxis calls outward.
  for (const side of ["north", "south", "east", "west"] as const) {
    const yaw = structureSideFacing(side);
    const axis = structureWallAxis(HOUSE, side, 0.5);
    const component = axis.along === "x" ? -Math.cos(yaw) : -Math.sin(yaw);
    assert.ok(Math.abs(component - axis.outward) < 1e-9, `${side} faces out`);
  }
});

test("an unscoped hole is a shaft through every storey above the ground", () => {
  const shaft = { x: 0, z: 0, w: 2, d: 2 };
  const ground = storey();
  const first = storey({ levelId: "first", index: 1, floorY: 4, ceilingY: 7 });

  // The ground slab is the terrain, not a floor to fall through.
  assert.equal(holeAppliesToStorey(shaft, ground), false);
  assert.equal(holeAppliesToStorey(shaft, first), true);

  const scoped = { ...shaft, levelId: "first" };
  assert.equal(holeAppliesToStorey(scoped, first), true);
  assert.equal(holeAppliesToStorey(scoped, ground), false);
  assert.equal(holeAppliesToStorey({ ...shaft, levelId: "ground" }, ground), true, "explicit beats the index rule");
});
