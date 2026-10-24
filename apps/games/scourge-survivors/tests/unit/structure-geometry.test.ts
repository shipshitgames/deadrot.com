// The building half of the v2 layout: turning an ArenaStructure declaration
// (footprint + storeys + openings + floor holes) into axis-aligned solid boxes
// and animatable door/window leaves. Same contract as arena-geometry.test.ts —
// no THREE, no renderer, just the arithmetic ArenaSystem consumes.
//
// The two invariants worth guarding here are structural, not cosmetic:
//   1. A wall must come apart into exactly the pieces an opening leaves behind
//      (lintel / spandrel / jambs) — an over-eager cut punches a hole through a
//      floor the author never opened.
//   2. A door's free edge must travel OUTWARD from the building on every one of
//      the four walls, for either hinge. Get a sign wrong and a door swings into
//      the room it is supposed to open away from.

import {
  type ArenaStructure,
  type ArenaStructureOpening,
  type ArenaStructureSide,
  DEFAULT_ROOF_THICKNESS,
  DEFAULT_STOREY_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WINDOW_SILL,
  GROUND_LEVEL_ID,
  structureInteriorRect,
  structureStoreys,
} from "@deadrot/game-kit/maps";
import { describe, expect, it } from "vitest";
import {
  levelYById,
  type SolidBox,
  structureFloorSlabs,
  structureGeometry,
  structureLeaves,
  structureRoofBox,
  structureWallBoxes,
} from "../../src/game/render/arenaGeometry";

const UPPER_LEVEL_ID = "upper";
const UPPER_Y = DEFAULT_STOREY_HEIGHT; // 3.4 — one storey above the ground

const levelY = levelYById([
  { id: GROUND_LEVEL_ID, y: 0 },
  { id: UPPER_LEVEL_ID, y: UPPER_Y },
]);

/** A 12 × 10 shell centred on the origin, one storey unless told otherwise. */
function building(overrides: Partial<ArenaStructure> = {}): ArenaStructure {
  return {
    id: "hab",
    bounds: { kind: "rect", minX: -6, maxX: 6, minZ: -5, maxZ: 5 },
    levelIds: [GROUND_LEVEL_ID],
    openings: [],
    ...overrides,
  };
}

function door(overrides: Partial<ArenaStructureOpening> = {}): ArenaStructureOpening {
  return { id: "d", kind: "door", side: "south", width: 1.6, height: 2.2, ...overrides };
}

/** Walls of a single side of the ground storey, for the given structure. */
function wallsOf(structure: ArenaStructure, side: ArenaStructureSide): SolidBox[] {
  const storeys = structureStoreys(structure, levelY);
  return structureWallBoxes(structure, side, storeys[0], storeys, DEFAULT_WALL_THICKNESS);
}

/** Rotate an XZ vector by `yaw` using THREE's +Y rotation convention. */
function rotateY(v: { x: number; z: number }, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
}

function contains(box: SolidBox, x: number, z: number): boolean {
  return x > box.x - box.w / 2 && x < box.x + box.w / 2 && z > box.z - box.d / 2 && z < box.z + box.d / 2;
}

/** Solid at a point in 3D. An opening is a hole in elevation, not in plan — a
 *  lintel sits directly over the doorway, so `contains` alone can never tell
 *  "you can walk through here" from "there is a header above your hat". */
function occupies(box: SolidBox, x: number, y: number, z: number): boolean {
  return contains(box, x, z) && y > box.y - box.h / 2 && y < box.y + box.h / 2;
}

describe("structureWallBoxes", () => {
  it("leaves a solid slab when nothing pierces the wall", () => {
    const [box, ...rest] = wallsOf(building(), "south");
    expect(rest).toHaveLength(0);
    expect(box.w).toBeCloseTo(12); // corner to corner
    expect(box.d).toBeCloseTo(DEFAULT_WALL_THICKNESS);
    expect(box.h).toBeCloseTo(DEFAULT_STOREY_HEIGHT);
    expect(box.y - box.h / 2).toBeCloseTo(0); // sits on the storey floor
    // outer face lands exactly on the declared footprint, never past it
    expect(box.z + box.d / 2).toBeCloseTo(5);
  });

  it("splits a doorway into two jambs and a lintel — no piece across the opening", () => {
    const boxes = wallsOf(building({ openings: [door()] }), "south");
    expect(boxes).toHaveLength(3);

    const jambs = boxes.filter((b) => b.h > DEFAULT_STOREY_HEIGHT - 1e-6);
    expect(jambs).toHaveLength(2);
    for (const jamb of jambs) expect(jamb.w).toBeCloseTo(5.2); // (12 - 1.6) / 2
    expect(jambs.map((b) => b.x).sort((a, b) => a - b)).toEqual([expect.closeTo(-3.4), expect.closeTo(3.4)]);

    const lintel = boxes.find((b) => b.h < DEFAULT_STOREY_HEIGHT - 1e-6);
    if (!lintel) throw new Error("expected a lintel above the door");
    expect(lintel.w).toBeCloseTo(1.6); // exactly the clear width
    expect(lintel.y - lintel.h / 2).toBeCloseTo(2.2); // starts at the door head
    expect(lintel.y + lintel.h / 2).toBeCloseTo(DEFAULT_STOREY_HEIGHT); // meets the ceiling

    // the doorway is clear from the floor to the door head, right through the
    // wall — a 1.8m player walks in without clipping anything
    for (const y of [0.1, 1.1, 2.1]) {
      for (const box of boxes) expect(occupies(box, 0, y, 4.8)).toBe(false);
    }
    // and the only thing over the opening is the lintel that closes it off
    expect(occupies(lintel, 0, 2.8, 4.8)).toBe(true);
  });

  it("splits a window into a spandrel and a lintel as well as the jambs", () => {
    const window: ArenaStructureOpening = {
      id: "w",
      kind: "window",
      side: "north",
      width: 1.4,
      height: 1.2,
    };
    const boxes = wallsOf(building({ openings: [window] }), "north");
    expect(boxes).toHaveLength(4);

    const overCut = boxes.filter((b) => b.w < 2).sort((a, b) => a.y - b.y);
    expect(overCut).toHaveLength(2);
    const [spandrel, lintel] = overCut;
    expect(spandrel.y - spandrel.h / 2).toBeCloseTo(0); // wall below the sill
    expect(spandrel.y + spandrel.h / 2).toBeCloseTo(DEFAULT_WINDOW_SILL);
    expect(lintel.y - lintel.h / 2).toBeCloseTo(DEFAULT_WINDOW_SILL + 1.2);
    expect(lintel.y + lintel.h / 2).toBeCloseTo(DEFAULT_STOREY_HEIGHT);
  });

  it("cuts an unscoped opening into the ground storey only", () => {
    // Regression: resolving the owning storey against a single-storey slice made
    // a level-less door punch through every floor of the building.
    const structure = building({
      levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID],
      openings: [door()],
    });
    const storeys = structureStoreys(structure, levelY);
    expect(storeys).toHaveLength(2);

    expect(structureWallBoxes(structure, "south", storeys[0], storeys, DEFAULT_WALL_THICKNESS)).toHaveLength(3);
    const upper = structureWallBoxes(structure, "south", storeys[1], storeys, DEFAULT_WALL_THICKNESS);
    expect(upper).toHaveLength(1); // intact — the upper storey was never opened
    expect(upper[0].y - upper[0].h / 2).toBeCloseTo(UPPER_Y);
  });

  it("emits no hairline lintel for an opening flush with the ceiling", () => {
    const boxes = wallsOf(building({ openings: [door({ height: DEFAULT_STOREY_HEIGHT })] }), "south");
    expect(boxes).toHaveLength(2); // jambs only
  });
});

describe("structureFloorSlabs", () => {
  const structure = building({ levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID] });
  const interior = structureInteriorRect(structure.bounds, DEFAULT_WALL_THICKNESS);

  it("emits nothing for the ground storey (the arena floor plane already covers it)", () => {
    const storeys = structureStoreys(structure, levelY);
    expect(structureFloorSlabs(structure, storeys[0], interior)).toEqual([]);
  });

  it("hangs the upper deck below its walkable surface, spanning the interior only", () => {
    const storeys = structureStoreys(structure, levelY);
    const [slab, ...rest] = structureFloorSlabs(structure, storeys[1], interior);
    expect(rest).toHaveLength(0);
    expect(slab.y + slab.h / 2).toBeCloseTo(UPPER_Y); // you stand exactly on the level
    expect(slab.w).toBeCloseTo(11.2); // 12 - 2 × wall thickness
    expect(slab.d).toBeCloseTo(9.2);
  });

  it("subtracts a stairwell hole without leaving geometry over the shaft", () => {
    const withShaft = building({
      levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID],
      floorHoles: [{ id: "stairwell", x: 4, z: 3, w: 2.4, d: 2.4 }],
    });
    const storeys = structureStoreys(withShaft, levelY);
    const slabs = structureFloorSlabs(withShaft, storeys[1], interior);

    expect(slabs.length).toBeGreaterThan(1); // the deck came apart around the shaft
    for (const slab of slabs) {
      expect(slab.y + slab.h / 2).toBeCloseTo(UPPER_Y); // every piece still walkable
      expect(contains(slab, 4, 3)).toBe(false); // nothing over the shaft
    }
    // and the deck is otherwise intact
    expect(slabs.some((s) => contains(s, -4, -3))).toBe(true);
    expect(slabs.some((s) => contains(s, 5.4, 3))).toBe(true); // the sliver beside the shaft
  });

  it("leaves the ground floor untouched by an unscoped hole", () => {
    const withShaft = building({
      levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID],
      floorHoles: [{ x: 0, z: 0, w: 3, d: 3 }],
    });
    const storeys = structureStoreys(withShaft, levelY);
    expect(structureFloorSlabs(withShaft, storeys[0], interior)).toEqual([]);
    expect(structureFloorSlabs(withShaft, storeys[1], interior).some((s) => contains(s, 0, 0))).toBe(false);
  });
});

describe("structureRoofBox", () => {
  it("rests the cap on top of the highest storey's walls, spanning the outer footprint", () => {
    const structure = building();
    const [top] = structureStoreys(structure, levelY);
    const roof = structureRoofBox(structure, top);
    if (!roof) throw new Error("expected a roof");
    expect(roof.y - roof.h / 2).toBeCloseTo(DEFAULT_STOREY_HEIGHT); // never sunk into the walls
    expect(roof.h).toBeCloseTo(DEFAULT_ROOF_THICKNESS);
    expect(roof.w).toBeCloseTo(12);
    expect(roof.d).toBeCloseTo(10);
  });

  it("honours an open-topped shell", () => {
    const structure = building({ roof: false });
    expect(structureRoofBox(structure, structureStoreys(structure, levelY)[0])).toBeNull();
  });
});

describe("structureGeometry", () => {
  it("keeps walls and decks apart — walls push out, decks are stood on", () => {
    const structure = building({
      levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID],
      openings: [door()],
    });
    const { walls, decks } = structureGeometry(structure, levelY);

    // ground: 3 (door) + 3 solid; upper: 4 solid
    expect(walls).toHaveLength(10);
    // upper deck + roof; the ground storey contributes none
    expect(decks).toHaveLength(2);
    expect(decks.map((d) => d.y + d.h / 2).sort((a, b) => a - b)).toEqual([
      expect.closeTo(UPPER_Y),
      expect.closeTo(UPPER_Y * 2 + DEFAULT_ROOF_THICKNESS),
    ]);
  });

  it("emits nothing for a footprint too small to enclose anything", () => {
    const pillar = building({ bounds: { kind: "square", half: 0.2 } });
    expect(structureGeometry(pillar, levelY)).toEqual({ walls: [], decks: [] });
  });

  it("emits nothing when every level reference is dangling", () => {
    const orphan = building({ levelIds: ["basement"] });
    expect(structureGeometry(orphan, levelY)).toEqual({ walls: [], decks: [] });
  });
});

describe("structureLeaves", () => {
  const SIDES: ArenaStructureSide[] = ["north", "east", "south", "west"];

  it("swings every door's free edge away from the building, on both hinges", () => {
    for (const side of SIDES) {
      for (const hinge of ["left", "right"] as const) {
        const structure = building({ openings: [door({ side, hinge })] });
        const [leaf] = structureLeaves(structure, levelY);
        if (!leaf) throw new Error(`expected a leaf on ${side}/${hinge}`);

        const swung = rotateY(leaf.arm, leaf.openYaw);
        const travel = { x: swung.x - leaf.arm.x, z: swung.z - leaf.arm.z };
        const outward = travel.x * leaf.outward.x + travel.z * leaf.outward.z;
        expect(outward, `${side}/${hinge} swings inward`).toBeGreaterThan(0);

        // and the hinge stays put — the panel pivots, it does not translate
        expect(Math.hypot(swung.x, swung.z)).toBeCloseTo(Math.hypot(leaf.arm.x, leaf.arm.z));
        expect(leaf.openSlide).toEqual({ x: 0, z: 0 });
      }
    }
  });

  it("mirrors the two hinges of the same doorway", () => {
    const left = structureLeaves(building({ openings: [door({ hinge: "left" })] }), levelY)[0];
    const right = structureLeaves(building({ openings: [door({ hinge: "right" })] }), levelY)[0];
    expect(left.pivot.x).toBeCloseTo(-right.pivot.x); // opposite ends of a centred cut
    expect(left.openYaw).toBeCloseTo(-right.openYaw);
    expect(left.box.x).toBeCloseTo(-right.box.x);
    expect(left.box.w).toBeCloseTo(right.box.w);
  });

  it("pockets a sliding door back past its hinge instead of rotating", () => {
    const structure = building({ openings: [door({ motion: "slide" })] });
    const [leaf] = structureLeaves(structure, levelY);
    expect(leaf.openYaw).toBe(0);
    // travels its own clear width, away from the free edge it started at
    expect(Math.abs(leaf.openSlide.x)).toBeCloseTo(leaf.clearWidth);
    expect(leaf.openSlide.z).toBe(0);
    expect(Math.sign(leaf.openSlide.x)).toBe(-Math.sign(leaf.arm.x));
  });

  it("fits the panel inside its cut so it never binds on the jambs", () => {
    const structure = building({ openings: [door()] });
    const [leaf] = structureLeaves(structure, levelY);
    expect(leaf.clearWidth).toBeCloseTo(1.6);
    expect(leaf.box.w).toBeLessThan(leaf.clearWidth);
    expect(leaf.box.h).toBeLessThan(leaf.clearHeight);
    expect(leaf.box.d).toBeLessThan(DEFAULT_WALL_THICKNESS); // sits within the wall
    expect(leaf.center.y).toBeCloseTo(1.1); // 2.2 / 2 — where the prompt anchors
  });

  it("glazes a window with a thin static pane", () => {
    const structure = building({
      openings: [{ id: "w", kind: "window", side: "east", width: 1.4, height: 1.2 }],
    });
    const [leaf] = structureLeaves(structure, levelY);
    expect(leaf.kind).toBe("window");
    expect(leaf.glazed).toBe(true);
    expect(leaf.openYaw).toBe(0); // panes shatter, they do not swing
    expect(leaf.openSlide).toEqual({ x: 0, z: 0 });
    expect(leaf.box.w).toBeLessThan(leaf.box.d); // thin against an east wall
    expect(leaf.center.y).toBeCloseTo(DEFAULT_WINDOW_SILL + 0.6);
  });

  it("emits no leaf for an unglazed window (a permanent hole, not an invisible collider)", () => {
    const structure = building({
      openings: [{ id: "w", kind: "window", side: "east", width: 1.4, height: 1.2, glazed: false }],
    });
    expect(structureLeaves(structure, levelY)).toEqual([]);
  });

  it("carries the authored resting state through to the runtime", () => {
    const structure = building({
      openings: [door({ id: "a", state: "locked" }), door({ id: "b", side: "west", state: "open" })],
    });
    const leaves = structureLeaves(structure, levelY);
    expect(leaves.map((l) => l.openingId)).toEqual(["a", "b"]); // author order
    expect(leaves.map((l) => l.state)).toEqual(["locked", "open"]);
    expect(leaves.map((l) => l.structureId)).toEqual(["hab", "hab"]);
  });

  it("places an upper-storey opening on its own level", () => {
    const structure = building({
      levelIds: [GROUND_LEVEL_ID, UPPER_LEVEL_ID],
      openings: [door({ levelId: UPPER_LEVEL_ID })],
    });
    const [leaf] = structureLeaves(structure, levelY);
    expect(leaf.levelId).toBe(UPPER_LEVEL_ID);
    expect(leaf.box.y - leaf.box.h / 2).toBeGreaterThan(UPPER_Y);
  });
});
