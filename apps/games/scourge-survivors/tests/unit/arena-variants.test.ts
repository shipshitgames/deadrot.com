import { anchorsOfKind, boundsToRect, flattenObstacles, GROUND_LEVEL_ID } from "@deadrot/game-kit/maps";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_ORDER,
  getMap,
  MAPS,
  type MapObstacle,
  type NormalizedArenaMap,
  SURVIVOR_MAP_ORDER,
  SURVIVOR_MAPS,
} from "../../src/game/data/maps";
import { walkableSurfaceHeight } from "../../src/game/entities/PlayerSystem";

const VARIANT_IDS = ["foundry-wards", "breach-primus"] as const;

function overlaps(a: MapObstacle, b: MapObstacle): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
}

function expectValidGeometry(map: NormalizedArenaMap) {
  const bounds = boundsToRect(map.layout.bounds);
  const levelIds = new Set(map.layout.levels.map((level) => level.id));

  for (const room of map.layout.rooms) {
    const roomBounds = boundsToRect(room.bounds);
    expect(roomBounds.minX, `${map.id}/${room.id} minX`).toBeGreaterThanOrEqual(bounds.minX);
    expect(roomBounds.maxX, `${map.id}/${room.id} maxX`).toBeLessThanOrEqual(bounds.maxX);
    expect(roomBounds.minZ, `${map.id}/${room.id} minZ`).toBeGreaterThanOrEqual(bounds.minZ);
    expect(roomBounds.maxZ, `${map.id}/${room.id} maxZ`).toBeLessThanOrEqual(bounds.maxZ);
    expect(levelIds.has(room.levelId ?? GROUND_LEVEL_ID), `${map.id}/${room.id} level`).toBe(true);
  }

  for (const room of map.layout.rooms) {
    const roomBounds = boundsToRect(room.bounds);
    for (const [index, obstacle] of room.obstacles.entries()) {
      expect(obstacle.x - obstacle.w / 2, `${map.id}/${room.id} obstacle ${index} minX`).toBeGreaterThanOrEqual(
        roomBounds.minX,
      );
      expect(obstacle.x + obstacle.w / 2, `${map.id}/${room.id} obstacle ${index} maxX`).toBeLessThanOrEqual(
        roomBounds.maxX,
      );
      expect(obstacle.z - obstacle.d / 2, `${map.id}/${room.id} obstacle ${index} minZ`).toBeGreaterThanOrEqual(
        roomBounds.minZ,
      );
      expect(obstacle.z + obstacle.d / 2, `${map.id}/${room.id} obstacle ${index} maxZ`).toBeLessThanOrEqual(
        roomBounds.maxZ,
      );
      for (let other = index + 1; other < room.obstacles.length; other++) {
        expect(
          overlaps(obstacle, room.obstacles[other]),
          `${map.id}/${room.id} obstacles ${index}/${other} overlap`,
        ).toBe(false);
      }
    }
  }

  const roomsById = new Map(map.layout.rooms.map((room) => [room.id, room]));
  for (const anchor of map.layout.anchors) {
    expect(anchor.x, `${map.id}/${anchor.id} x`).toBeGreaterThanOrEqual(bounds.minX);
    expect(anchor.x, `${map.id}/${anchor.id} x`).toBeLessThanOrEqual(bounds.maxX);
    expect(anchor.z, `${map.id}/${anchor.id} z`).toBeGreaterThanOrEqual(bounds.minZ);
    expect(anchor.z, `${map.id}/${anchor.id} z`).toBeLessThanOrEqual(bounds.maxZ);
    expect(levelIds.has(anchor.levelId ?? GROUND_LEVEL_ID), `${map.id}/${anchor.id} level`).toBe(true);

    if (anchor.roomId) {
      const room = roomsById.get(anchor.roomId);
      expect(room, `${map.id}/${anchor.id} room`).toBeDefined();
      const roomBounds = boundsToRect(room!.bounds);
      expect(anchor.x, `${map.id}/${anchor.id} room x`).toBeGreaterThanOrEqual(roomBounds.minX);
      expect(anchor.x, `${map.id}/${anchor.id} room x`).toBeLessThanOrEqual(roomBounds.maxX);
      expect(anchor.z, `${map.id}/${anchor.id} room z`).toBeGreaterThanOrEqual(roomBounds.minZ);
      expect(anchor.z, `${map.id}/${anchor.id} room z`).toBeLessThanOrEqual(roomBounds.maxZ);
      expect(
        room!.obstacles.some(
          (obstacle) =>
            Math.abs(anchor.x - obstacle.x) < obstacle.w / 2 && Math.abs(anchor.z - obstacle.z) < obstacle.d / 2,
        ),
        `${map.id}/${anchor.id} is inside solid geometry`,
      ).toBe(false);
    }
  }

  for (const ramp of map.layout.ramps) {
    expect(levelIds.has(ramp.fromLevelId), `${map.id}/${ramp.id} from level`).toBe(true);
    expect(levelIds.has(ramp.toLevelId), `${map.id}/${ramp.id} to level`).toBe(true);
  }
}

describe("shipped Survivors arena variants (#503)", () => {
  it("extends the Survivors registry without changing the canon campaign", () => {
    expect(CAMPAIGN_ORDER).toEqual(["ashgate", "hollowlanes", "maw", "perdition"]);
    expect(Object.keys(MAPS)).toEqual(CAMPAIGN_ORDER);
    expect(SURVIVOR_MAP_ORDER).toEqual([...CAMPAIGN_ORDER, ...VARIANT_IDS]);
    expect(Object.keys(SURVIVOR_MAPS)).toEqual(SURVIVOR_MAP_ORDER);
    for (const id of VARIANT_IDS) expect(getMap(id)).toBe(SURVIVOR_MAPS[id]);
  });

  it("keeps the variants joined to their canon locations and registered presentation", () => {
    const foundry = SURVIVOR_MAPS["foundry-wards"];
    expect(foundry).toMatchObject({ loreId: "ashgate", front: "holdout", biomeId: "foundry" });
    expect(foundry.materials).toBe(MAPS.ashgate.materials);
    expect(foundry.environment).toBe(MAPS.ashgate.environment);

    const primus = SURVIVOR_MAPS["breach-primus"];
    expect(primus).toMatchObject({ loreId: "maw", front: "breach", biomeId: "rot" });
    expect(primus.materials).toBe(MAPS.maw.materials);
    expect(primus.environment).toBe(MAPS.maw.environment);
  });

  it("authors Foundry Wards as two ground rooms with an open central traversal", () => {
    const foundry = SURVIVOR_MAPS["foundry-wards"];
    expect(foundry.layout.rooms.map((room) => room.id)).toEqual(["assembly-yard", "furnace-yard"]);
    expect(foundry.layout.rooms.every((room) => room.levelId === GROUND_LEVEL_ID)).toBe(true);
    expect(foundry.layout.ramps).toEqual([]);
    expect(foundry.layout.platforms).toEqual([]);

    const bulkheads = flattenObstacles(foundry.layout).filter((obstacle) => obstacle.x === -1);
    expect(bulkheads).toHaveLength(2);
    expect(bulkheads.every((wall) => Math.abs(wall.z) - wall.d / 2 === 12)).toBe(true);
    expect(bulkheads.every((wall) => Math.abs(wall.z) + wall.d / 2 === 40)).toBe(true);
    expect(anchorsOfKind(foundry.layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(foundry.layout, "breachSpawn")).toHaveLength(2);
  });

  it("authors Breach Primus as a connected ground-to-span layout", () => {
    const primus = SURVIVOR_MAPS["breach-primus"];
    expect(primus.layout.rooms.map((room) => room.id)).toEqual(["breach-lip", "primus-span"]);
    expect(primus.layout.levels).toEqual([
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "throat-span", y: 3, name: "Breach Primus Span" },
    ]);
    expect(primus.layout.ramps).toHaveLength(1);
    expect(primus.layout.ramps[0]).toMatchObject({
      id: "primus-ramp",
      fromLevelId: GROUND_LEVEL_ID,
      toLevelId: "throat-span",
    });
    expect(primus.layout.platforms.map((platform) => platform.id)).toEqual(["throat-overlook"]);
    expect(anchorsOfKind(primus.layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(primus.layout, "breachSpawn")).toHaveLength(3);
  });

  it("resolves the highest authored walkable surface for horde grounding", () => {
    const surfaces = [
      new THREE.Box3(new THREE.Vector3(-4, -0.2, -4), new THREE.Vector3(4, 3, 4)),
      new THREE.Box3(new THREE.Vector3(-1, 3, -1), new THREE.Vector3(1, 3.4, 1)),
    ];

    expect(walkableSurfaceHeight(surfaces, 10, 10)).toBe(0);
    expect(walkableSurfaceHeight(surfaces, 3, 3)).toBe(3);
    expect(walkableSurfaceHeight(surfaces, 0, 0)).toBe(3.4);
  });

  it("passes focused room, obstacle, anchor, and connector geometry contracts", () => {
    for (const id of VARIANT_IDS) {
      expectValidGeometry(SURVIVOR_MAPS[id]);
    }
  });
});
