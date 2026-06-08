import { type MapBounds, makeBounds } from "@shipshitgames/engine";
import { describe, expect, it } from "vitest";
import { ARENA_HALF } from "../../src/game/constants";
import { type ArenaMap, CAMPAIGN_ORDER, DEFAULT_ARENA_BOUNDS, MAPS } from "../../src/game/data/maps";

describe("world bounds", () => {
  it("keeps current campaign maps on the ARENA_HALF square default", () => {
    expect(DEFAULT_ARENA_BOUNDS).toEqual({ kind: "square", half: ARENA_HALF });

    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const bounds = makeBounds(map.bounds ?? DEFAULT_ARENA_BOUNDS);

      expect(bounds.minX, `${mapId} minX`).toBe(-ARENA_HALF);
      expect(bounds.maxX, `${mapId} maxX`).toBe(ARENA_HALF);
      expect(bounds.minZ, `${mapId} minZ`).toBe(-ARENA_HALF);
      expect(bounds.maxZ, `${mapId} maxZ`).toBe(ARENA_HALF);
      expect(bounds.containsXZ(ARENA_HALF - 0.1, 0), `${mapId} inside edge`).toBe(true);
      expect(bounds.containsXZ(ARENA_HALF + 0.1, 0), `${mapId} outside edge`).toBe(false);
    }
  });

  it("allows future ArenaMap data to declare rectangular bounds", () => {
    const mapBounds: NonNullable<ArenaMap["bounds"]> = {
      kind: "rect",
      minX: -12,
      maxX: 18,
      minZ: -8,
      maxZ: 24,
    };

    const bounds = makeBounds(mapBounds);

    expect(bounds.minX).toBe(-12);
    expect(bounds.maxX).toBe(18);
    expect(bounds.minZ).toBe(-8);
    expect(bounds.maxZ).toBe(24);
    expect(bounds.containsXZ(17, 23, 1)).toBe(true);
    expect(bounds.containsXZ(18, 24, 1)).toBe(false);
  });

  it("keeps square bounds centered around the origin", () => {
    const squareBounds: MapBounds = { kind: "square", half: 7 };
    const bounds = makeBounds(squareBounds);

    expect(bounds.minX).toBe(-7);
    expect(bounds.maxX).toBe(7);
    expect(bounds.minZ).toBe(-7);
    expect(bounds.maxZ).toBe(7);
  });
});
