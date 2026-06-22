// The Gantry (#82): the sandbox-only v2 STRUCTURAL demonstrator. It must light up
// every layout path ArenaSystem/PlayerSystem now consume (rooms, a raised level,
// a ramp, platforms, breach anchors) WITHOUT leaking into the campaign registry
// or shipping new texture ids. These tests lock those properties at the data layer.

import { anchorsOfKind, boundsToRect, flattenObstacles, GROUND_LEVEL_ID } from "@deadrot/game-kit/maps";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_ORDER, getMap, MAP_PICKER, MAPS, SANDBOX_MAP_PICKER, SANDBOX_MAPS } from "../../src/game/data/maps";

describe("The Gantry — sandbox registry isolation", () => {
  it("stays OUT of the campaign registry so MAPS/CAMPAIGN_ORDER invariants hold", () => {
    expect(Object.keys(MAPS)).toEqual(CAMPAIGN_ORDER);
    expect(MAPS.gantry).toBeUndefined();
    expect(SANDBOX_MAPS.gantry).toBeDefined();
  });

  it("resolves through getMap's sandbox fallthrough, with the default as the floor", () => {
    expect(getMap("gantry")).toBe(SANDBOX_MAPS.gantry);
    expect(getMap("does-not-exist")).toBe(MAPS.ashgate); // DEFAULT_MAP_ID
  });

  it("reuses The Maw's presentation so it ships no new texture ids", () => {
    const gantry = SANDBOX_MAPS.gantry;
    expect(gantry.loreId).toBe("maw");
    expect(gantry.materials).toEqual(MAPS.maw.materials); // same arena-maw-* ids
  });
});

describe("The Gantry — structural layout", () => {
  const layout = SANDBOX_MAPS.gantry.layout;

  it("authors multiple rooms across a ground yard and a raised deck", () => {
    expect(layout.rooms).toHaveLength(2);
    const yard = layout.rooms.find((r) => r.id === "yard");
    const deck = layout.rooms.find((r) => r.id === "gantry-deck");
    expect(yard?.levelId).toBe(GROUND_LEVEL_ID);
    expect(deck?.levelId).toBe("mezzanine");
  });

  it("guarantees the ground level plus the raised mezzanine at y=3", () => {
    expect(layout.levels).toHaveLength(2);
    expect(layout.levels.find((l) => l.id === GROUND_LEVEL_ID)?.y).toBe(0);
    expect(layout.levels.find((l) => l.id === "mezzanine")?.y).toBe(3);
  });

  it("declares one climbable ramp from the ground up to the mezzanine", () => {
    expect(layout.ramps).toHaveLength(1);
    const ramp = layout.ramps[0];
    expect(ramp.fromLevelId).toBe(GROUND_LEVEL_ID);
    expect(ramp.toLevelId).toBe("mezzanine");
  });

  it("declares step-up platforms on both levels", () => {
    expect(layout.platforms.map((p) => p.id).sort()).toEqual(["deck-overlook", "yard-step"]);
  });

  it("homes all obstacles in rooms (flat list empty → no synthesized root room)", () => {
    // 5 in the yard (2 retaining walls + 3 cover) + 3 on the deck = 8
    expect(flattenObstacles(layout)).toHaveLength(8);
  });

  it("authors breach mouths + a player spawn + an objective, no extraction", () => {
    expect(anchorsOfKind(layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(layout, "breachSpawn")).toHaveLength(3);
    expect(anchorsOfKind(layout, "objective")).toHaveLength(1);
    expect(anchorsOfKind(layout, "extraction")).toHaveLength(0);
  });

  it("keeps the default 80x80 arena footprint", () => {
    expect(boundsToRect(layout.bounds)).toEqual({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 });
  });
});

describe("The Gantry — sandbox picker wiring", () => {
  it("appears in the sandbox picker but not the campaign picker", () => {
    expect(MAP_PICKER.map((m) => m.id)).toEqual(CAMPAIGN_ORDER); // campaign list untouched
    expect(SANDBOX_MAP_PICKER).toHaveLength(MAP_PICKER.length + 1);
    expect(SANDBOX_MAP_PICKER.some((m) => m.id === "gantry")).toBe(true);
    expect(MAP_PICKER.some((m) => m.id === "gantry")).toBe(false);
  });
});
