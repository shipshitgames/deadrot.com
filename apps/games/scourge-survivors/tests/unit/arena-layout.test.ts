// ArenaMap v2 schema backward-compat + integration suite (issue #79): the 4
// shipped v1 maps must normalize through @deadrot/game-kit/maps at registry
// load with exact synthesized values, zero changes to the v1 surface, and the
// flattenObstacles order/identity invariant #82's buildArena flip depends on.

import {
  type ArenaBounds,
  anchorsOfKind,
  boundsToRect,
  firstAnchor,
  flattenObstacles,
  GROUND_LEVEL_ID,
  normalizeArenaLayout,
  ROOT_ROOM_ID,
  SYNTH_PLAYER_SPAWN_ID,
} from "@deadrot/game-kit/maps";
import { makeBounds } from "@shipshitgames/engine";
import { describe, expect, it } from "vitest";
import { ARENA_HALF } from "../../src/game/constants";
import {
  ARENA_BOUNDS_PARITY,
  type ArenaMap,
  CAMPAIGN_ORDER,
  campaignSequence,
  DEFAULT_ARENA_BOUNDS,
  DEFAULT_ARENA_MATERIALS,
  DEFAULT_MAP_ID,
  getMap,
  MAP_PICKER,
  MAPS,
  type MapObstacle,
} from "../../src/game/data/maps";

describe("v1 maps normalize through the v2 adapter at registry load", () => {
  it("attaches a layout with the default bounds while map.bounds stays undefined", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(map.layout, `${mapId} layout`).toBeDefined();
      expect(map.bounds, `${mapId} keeps bounds undefined (world-bounds contract)`).toBeUndefined();
      expect(map.layout.bounds, `${mapId} layout bounds`).toEqual(DEFAULT_ARENA_BOUNDS);
    }
  });

  it("synthesizes exactly one whole-bounds root room aliasing the flat obstacles", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(map.layout.rooms, `${mapId} room count`).toHaveLength(1);
      expect(map.layout.rooms[0], `${mapId} root room`).toMatchObject({
        id: ROOT_ROOM_ID,
        levelId: GROUND_LEVEL_ID,
      });
      // Reference identity, not a copy — the #82 buildArena invariant.
      expect(map.layout.rooms[0].obstacles, `${mapId} obstacles alias`).toBe(map.obstacles);
    }
  });

  it("flattenObstacles preserves count, order, and element identity vs the flat list", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const flat = flattenObstacles(map.layout);
      expect(flat, `${mapId} flattened count`).toHaveLength(map.obstacles.length);
      map.obstacles.forEach((obstacle, i) => {
        expect(flat[i], `${mapId} obstacle ${i} identity`).toBe(obstacle);
      });
    }
  });

  it("keeps elevated (render-only) obstacles in the flattened list", () => {
    const elevatedTotal = CAMPAIGN_ORDER.flatMap((id) =>
      flattenObstacles(MAPS[id].layout).filter((o) => o.elevated),
    ).length;
    expect(elevatedTotal, "ashgate + perdition each ship one elevated crate").toBe(2);
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const flatElevated = flattenObstacles(map.layout).filter((o) => o.elevated);
      const srcElevated = map.obstacles.filter((o) => o.elevated);
      expect(flatElevated, `${mapId} elevated entries survive`).toEqual(srcElevated);
    }
  });

  it("synthesizes exactly the ground level and nothing else", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(map.layout.levels, `${mapId} levels`).toEqual([{ id: GROUND_LEVEL_ID, y: 0, name: "Ground" }]);
      expect(map.layout.ramps, `${mapId} ramps`).toEqual([]);
      expect(map.layout.platforms, `${mapId} platforms`).toEqual([]);
    }
  });

  it("matches engine makeBounds numbers via boundsToRect (square parity)", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const engineBounds = makeBounds(map.bounds ?? DEFAULT_ARENA_BOUNDS);
      const rect = boundsToRect(map.layout.bounds);
      expect(rect.minX, `${mapId} minX`).toBe(engineBounds.minX);
      expect(rect.maxX, `${mapId} maxX`).toBe(engineBounds.maxX);
      expect(rect.minZ, `${mapId} minZ`).toBe(engineBounds.minZ);
      expect(rect.maxZ, `${mapId} maxZ`).toBe(engineBounds.maxZ);
      expect(rect.maxX, `${mapId} stays on the ARENA_HALF square`).toBe(ARENA_HALF);
    }
  });

  it("matches engine makeBounds numbers for the rect bounds variant too", () => {
    const rectBounds: ArenaBounds = { kind: "rect", minX: -12, maxX: 18, minZ: -8, maxZ: 24 };
    const engineBounds = makeBounds(rectBounds);
    expect(boundsToRect(rectBounds)).toEqual({
      minX: engineBounds.minX,
      maxX: engineBounds.maxX,
      minZ: engineBounds.minZ,
      maxZ: engineBounds.maxZ,
    });
  });

  it("is idempotent: re-normalizing a registry layout reproduces it exactly", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const again = normalizeArenaLayout<MapObstacle>(map.layout, { defaultBounds: DEFAULT_ARENA_BOUNDS });
      expect(again, `${mapId} idempotent`).toEqual(map.layout);
    }
  });
});

describe("typed anchors", () => {
  it("lifts the v1 spawn into the single playerSpawn anchor", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(map.layout.anchors, `${mapId} anchors`).toEqual([
        {
          kind: "playerSpawn",
          id: SYNTH_PLAYER_SPAWN_ID,
          x: map.spawn.x,
          z: map.spawn.z,
          levelId: GROUND_LEVEL_ID,
        },
      ]);
      const spawn = firstAnchor(map.layout, "playerSpawn");
      expect(spawn?.x, `${mapId} spawn x`).toBe(map.spawn.x);
      expect(spawn?.z, `${mapId} spawn z`).toBe(map.spawn.z);
    }
  });

  it("never invents breach/objective/extraction anchors (empty = procedural scatter)", () => {
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(anchorsOfKind(map.layout, "breachSpawn"), `${mapId} breachSpawn`).toEqual([]);
      expect(anchorsOfKind(map.layout, "objective"), `${mapId} objective`).toEqual([]);
      expect(anchorsOfKind(map.layout, "extraction"), `${mapId} extraction`).toEqual([]);
      expect(firstAnchor(map.layout, "objective"), `${mapId} firstAnchor miss`).toBeUndefined();
    }
  });
});

describe("registry backward compatibility", () => {
  it("keeps the canonical campaign descent and default map", () => {
    expect(CAMPAIGN_ORDER).toEqual(["ashgate", "hollowlanes", "maw", "perdition"]);
    expect(DEFAULT_MAP_ID).toBe("ashgate");
    expect(Object.keys(MAPS)).toEqual(CAMPAIGN_ORDER);
  });

  it("keeps the v1 defaults and every v1 field on the shipped maps, with no v2 authoring", () => {
    expect(DEFAULT_ARENA_BOUNDS).toEqual({ kind: "square", half: ARENA_HALF });
    expect(DEFAULT_ARENA_MATERIALS).toEqual({
      floor: "arena-floor",
      wall: "arena-wall",
      block: "arena-block",
      column: "arena-column",
    });
    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      expect(map.id, `${mapId} id`).toBe(mapId);
      for (const field of [
        "loreId",
        "front",
        "name",
        "subtitle",
        "icon",
        "accent",
        "theme",
        "materials",
        "environment",
        "spawn",
        "obstacles",
      ] as const) {
        expect(map[field], `${mapId} keeps v1 field ${field}`).toBeDefined();
      }
      // Shipped maps author no v2 fields — everything structural is synthesized.
      expect(map.rooms, `${mapId} authors no rooms`).toBeUndefined();
      expect(map.levels, `${mapId} authors no levels`).toBeUndefined();
      expect(map.ramps, `${mapId} authors no ramps`).toBeUndefined();
      expect(map.platforms, `${mapId} authors no platforms`).toBeUndefined();
      expect(map.anchors, `${mapId} authors no anchors`).toBeUndefined();
    }
  });

  it("getMap keeps the silent unknown-id fallback and hands out normalized maps", () => {
    expect(getMap("no-such-map")).toBe(getMap(DEFAULT_MAP_ID));
    expect(getMap("no-such-map")).toBe(MAPS.ashgate);
    expect(getMap("maw").layout).toBeDefined();
  });

  it("campaignSequence wraps in canonical order with normalized maps by reference", () => {
    const fromMaw = campaignSequence("maw");
    expect(fromMaw.map((m) => m.id)).toEqual(["maw", "perdition", "ashgate", "hollowlanes"]);
    for (const map of fromMaw) {
      expect(map, `${map.id} sequence entry is the registry object`).toBe(MAPS[map.id]);
      expect(map.layout, `${map.id} sequence entry normalized`).toBeDefined();
    }
    expect(campaignSequence("unknown").map((m) => m.id)).toEqual(CAMPAIGN_ORDER);
  });

  it("keeps MAP_PICKER shape in campaign order", () => {
    expect(MAP_PICKER).toEqual(
      CAMPAIGN_ORDER.map((id) => {
        const map = MAPS[id];
        return { id: map.id, name: map.name, subtitle: map.subtitle, icon: map.icon, accent: map.accent };
      }),
    );
  });

  it("pins engine MapBounds ⇄ game-kit ArenaBounds mutual assignability", () => {
    expect(ARENA_BOUNDS_PARITY).toBe(true);
  });
});

describe("v2 authoring fields on ArenaMap", () => {
  // Hand-built v2 fixture typed against ArenaMap's own optional fields: 2 rooms
  // with per-room MapObstacles, a mezzanine level, a ramp, a platform, and
  // typed anchors — proving the authoring surface flows through the adapter.
  const northObstacles: MapObstacle[] = [
    { x: -20, z: -20, w: 4, h: 3, d: 4, mat: "crate" },
    { x: -16, z: -20, w: 2, h: 2, d: 2, mat: "crate", elevated: true },
  ];
  const southObstacles: MapObstacle[] = [{ x: 20, z: 20, w: 2, h: 6, d: 2, mat: "pillar" }];
  const courtyardExtra: MapObstacle = { x: 0, z: 8, w: 8, h: 1, d: 2, mat: "wall" };

  const fixture: Pick<
    ArenaMap,
    "bounds" | "spawn" | "obstacles" | "rooms" | "levels" | "ramps" | "platforms" | "anchors"
  > = {
    spawn: { x: 0, z: -30 },
    obstacles: [...northObstacles, courtyardExtra],
    rooms: [
      {
        id: "north-hall",
        bounds: { kind: "rect", minX: -40, maxX: 0, minZ: -40, maxZ: 0 },
        obstacles: northObstacles,
      },
      {
        id: "south-yard",
        bounds: { kind: "rect", minX: 0, maxX: 40, minZ: 0, maxZ: 40 },
        obstacles: southObstacles,
        levelId: "mezzanine",
      },
    ],
    levels: [{ id: "mezzanine", y: 3, name: "Mezzanine" }],
    ramps: [
      {
        id: "main-ramp",
        kind: "ramp",
        from: { x: 0, z: -6 },
        to: { x: 0, z: 6 },
        width: 4,
        fromLevelId: GROUND_LEVEL_ID,
        toLevelId: "mezzanine",
      },
    ],
    platforms: [{ id: "overlook", x: 24, z: 24, w: 8, d: 8, y: 3, thickness: 0.5, levelId: "mezzanine" }],
    anchors: [
      { kind: "breachSpawn", id: "east-breach", x: 36, z: 0, laneId: "east" },
      { kind: "objective", id: "core", x: 0, z: 0 },
    ],
  };

  const layout = normalizeArenaLayout<MapObstacle>(fixture, { defaultBounds: DEFAULT_ARENA_BOUNDS });

  it("applies the default bounds and prepends a root room holding only the unhomed extras", () => {
    expect(layout.bounds).toBe(DEFAULT_ARENA_BOUNDS);
    expect(layout.rooms).toHaveLength(3);
    expect(layout.rooms[0]).toMatchObject({ id: ROOT_ROOM_ID, levelId: GROUND_LEVEL_ID });
    expect(layout.rooms[0].obstacles, "root holds only the courtyard extra").toEqual([courtyardExtra]);
    expect(layout.rooms[1], "authored rooms keep reference identity").toBe(fixture.rooms?.[0]);
    expect(layout.rooms[2]).toBe(fixture.rooms?.[1]);
  });

  it("flattens rooms-in-order with author order and no duplicated homed obstacles", () => {
    const flat = flattenObstacles(layout);
    expect(flat).toHaveLength(4);
    expect(flat[0], "extras first (synthesized root is prepended)").toBe(courtyardExtra);
    expect(flat[1]).toBe(northObstacles[0]);
    expect(flat[2], "elevated entry survives with identity").toBe(northObstacles[1]);
    expect(flat[3]).toBe(southObstacles[0]);
    expect(
      flat.filter((o) => o === northObstacles[0]),
      "homed obstacle appears once",
    ).toHaveLength(1);
  });

  it("keeps elevation data: ground prepended, mezzanine/ramp/platform pass through", () => {
    expect(layout.levels).toEqual([
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "mezzanine", y: 3, name: "Mezzanine" },
    ]);
    expect(layout.ramps[0]).toBe(fixture.ramps?.[0]);
    expect(layout.platforms[0]).toBe(fixture.platforms?.[0]);
  });

  it("appends the synthesized playerSpawn after the authored anchors", () => {
    expect(layout.anchors.map((a) => a.kind)).toEqual(["breachSpawn", "objective", "playerSpawn"]);
    expect(layout.anchors[2]).toEqual({
      kind: "playerSpawn",
      id: SYNTH_PLAYER_SPAWN_ID,
      x: 0,
      z: -30,
      levelId: GROUND_LEVEL_ID,
    });
    expect(anchorsOfKind(layout, "breachSpawn")).toHaveLength(1);
    expect(firstAnchor(layout, "playerSpawn")?.id).toBe(SYNTH_PLAYER_SPAWN_ID);
  });

  it("is idempotent for the authored v2 fixture", () => {
    expect(normalizeArenaLayout<MapObstacle>(layout, { defaultBounds: DEFAULT_ARENA_BOUNDS })).toEqual(layout);
  });
});
