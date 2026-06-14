// Pure geometry math behind #82's ArenaSystem.buildArena flip: the helpers that
// turn the v2 structural layout (rooms / floor levels / platforms / ramps) into
// axis-aligned solid boxes. No THREE, no renderer — just the elevation + ramp
// arithmetic, so the walkability contract is checkable in isolation.

import { type ArenaPlatform, type ArenaRamp, type ArenaRoom, GROUND_LEVEL_ID } from "@deadrot/game-kit/maps";
import { describe, expect, it } from "vitest";
import type { MapObstacle } from "../../src/game/data/maps";
import { levelYById, platformBox, rampStepBoxes, roomFloorSlab, roomLevelY } from "../../src/game/render/arenaGeometry";

const PLAYER_STEP_HEIGHT = 0.45; // mirrors constants.ts; the ramp step budget

function room(levelId: string | undefined, bounds: ArenaRoom<MapObstacle>["bounds"]): ArenaRoom<MapObstacle> {
  return { id: "r", bounds, levelId, obstacles: [] };
}

describe("levelYById", () => {
  it("maps each level id to its elevation", () => {
    const byId = levelYById([
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "mezzanine", y: 3 },
    ]);
    expect(byId.get(GROUND_LEVEL_ID)).toBe(0);
    expect(byId.get("mezzanine")).toBe(3);
  });

  it("defaults the ground level to 0 even if a layout omits it", () => {
    const byId = levelYById([{ id: "mezzanine", y: 3 }]);
    expect(byId.get(GROUND_LEVEL_ID)).toBe(0);
  });
});

describe("roomLevelY", () => {
  const byId = levelYById([
    { id: GROUND_LEVEL_ID, y: 0 },
    { id: "mezzanine", y: 3 },
  ]);

  it("resolves a room's level elevation", () => {
    expect(roomLevelY(room("mezzanine", { kind: "square", half: 40 }), byId)).toBe(3);
  });

  it("treats a room with no level as ground (0)", () => {
    expect(roomLevelY(room(undefined, { kind: "square", half: 40 }), byId)).toBe(0);
  });

  it("falls back to 0 for an unknown level id", () => {
    expect(roomLevelY(room("attic", { kind: "square", half: 40 }), byId)).toBe(0);
  });
});

describe("roomFloorSlab", () => {
  it("emits no slab for a ground-level room (v1 maps stay geometry-identical)", () => {
    expect(roomFloorSlab(room(GROUND_LEVEL_ID, { kind: "square", half: 40 }), 0)).toBeNull();
  });

  it("fills a raised room from the ground up to its level surface, centred on its bounds", () => {
    const slab = roomFloorSlab(room("mezzanine", { kind: "rect", minX: -40, maxX: 40, minZ: -40, maxZ: -2 }), 3);
    expect(slab).not.toBeNull();
    const s = slab!;
    // top surface lands at the level y, bottom sits on the ground
    expect(s.y + s.h / 2).toBeCloseTo(3); // top
    expect(s.y - s.h / 2).toBeCloseTo(0); // bottom
    expect(s.h).toBeCloseTo(3);
    expect(s.w).toBeCloseTo(80);
    expect(s.d).toBeCloseTo(38);
    expect(s.x).toBeCloseTo(0); // (-40 + 40) / 2
    expect(s.z).toBeCloseTo(-21); // (-40 + -2) / 2
  });
});

describe("platformBox", () => {
  it("places the walkable top at p.y with an explicit thickness", () => {
    const p: ArenaPlatform = { id: "o", x: 4, z: -6, w: 12, d: 6, y: 3.4, thickness: 0.5 };
    const b = platformBox(p);
    expect(b.y + b.h / 2).toBeCloseTo(3.4); // top
    expect(b.h).toBeCloseTo(0.5);
    expect(b.y - b.h / 2).toBeCloseTo(2.9); // you can pass under it
    expect(b.x).toBe(4);
    expect(b.z).toBe(-6);
    expect(b.w).toBe(12);
    expect(b.d).toBe(6);
  });

  it("defaults to a solid plinth filled down to the ground when thickness is omitted", () => {
    const b = platformBox({ id: "o", x: 0, z: 0, w: 5, d: 5, y: 1.2 });
    expect(b.h).toBeCloseTo(1.2);
    expect(b.y - b.h / 2).toBeCloseTo(0); // grounded
    expect(b.y + b.h / 2).toBeCloseTo(1.2); // top
  });
});

describe("rampStepBoxes", () => {
  const ramp: ArenaRamp = {
    id: "ramp",
    kind: "ramp",
    from: { x: 0, z: 4 },
    to: { x: 0, z: -2 },
    width: 6,
    fromLevelId: GROUND_LEVEL_ID,
    toLevelId: "mezzanine",
  };

  it("builds a climbable staircase to the top level, each rise within the step budget", () => {
    const steps = rampStepBoxes(ramp, 0, 3, PLAYER_STEP_HEIGHT);
    expect(steps.length).toBe(Math.ceil(3 / PLAYER_STEP_HEIGHT)); // 7
    // tops strictly increase, every rise ≤ the step budget (so groundUnder can climb)
    for (let i = 1; i < steps.length; i++) {
      const rise = steps[i].h - steps[i - 1].h;
      expect(rise).toBeGreaterThan(0);
      expect(rise).toBeLessThanOrEqual(PLAYER_STEP_HEIGHT + 1e-9);
    }
    expect(steps[0].h).toBeLessThanOrEqual(PLAYER_STEP_HEIGHT + 1e-9); // reachable from the ground
    expect(steps[steps.length - 1].h).toBeCloseTo(3); // top step meets the deck
    // runs along Z (the dominant axis here); width spans X
    for (const s of steps) {
      expect(s.x).toBe(0);
      expect(s.w).toBe(6);
      expect(s.y - s.h / 2).toBeCloseTo(0); // each step is a grounded plinth
    }
    // centres march from the bottom (z≈4) toward the deck (z≈-2)
    expect(steps[0].z).toBeGreaterThan(steps[steps.length - 1].z);
  });

  it("orients along X when from→to is mostly an X run", () => {
    const xr: ArenaRamp = { ...ramp, from: { x: -3, z: 0 }, to: { x: 3, z: 0 } };
    const steps = rampStepBoxes(xr, 0, 1.5, PLAYER_STEP_HEIGHT);
    expect(steps.length).toBe(Math.ceil(1.5 / PLAYER_STEP_HEIGHT)); // 4
    for (const s of steps) {
      expect(s.z).toBe(0);
      expect(s.d).toBe(6); // width spans Z now
    }
    expect(steps[steps.length - 1].h).toBeCloseTo(1.5);
  });

  it("produces a symmetric staircase whether ascending or descending", () => {
    const up = rampStepBoxes(ramp, 0, 3, PLAYER_STEP_HEIGHT)
      .map((s) => s.h)
      .sort((a, b) => a - b);
    const down = rampStepBoxes(ramp, 3, 0, PLAYER_STEP_HEIGHT)
      .map((s) => s.h)
      .sort((a, b) => a - b);
    // same set of step heights, just walked the other way (float noise aside)
    expect(up).toHaveLength(down.length);
    for (let i = 0; i < up.length; i++) expect(up[i]).toBeCloseTo(down[i]);
  });

  it("emits nothing for a flat (zero-rise) connector", () => {
    expect(rampStepBoxes(ramp, 0, 0, PLAYER_STEP_HEIGHT)).toEqual([]);
  });
});
