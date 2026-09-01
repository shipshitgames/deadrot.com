import {
  type ArenaRamp,
  type ArenaRect,
  type ArenaStructureHole,
  anchorsOfKind,
  boundsToRect,
  flattenObstacles,
  GROUND_LEVEL_ID,
  structureInteriorRect,
  structureWallThickness,
  validateArenaLayout,
} from "@deadrot/game-kit/maps";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLAYER_STEP_HEIGHT } from "../../src/game/constants";
import {
  campaignSequence,
  DEFAULT_ARENA_BOUNDS,
  DEFAULT_JOURNEY_MAP_IDS,
  FOUNDRY_WARDS_BOUNDS,
  getMap,
  MAP_PICKER,
  MAPS,
  type MapObstacle,
  type NormalizedArenaMap,
  SURVIVOR_MAP_ORDER,
  SURVIVOR_MAPS,
} from "../../src/game/data/maps";
import { walkableSurfaceHeight, walkableSurfaceHeightNear } from "../../src/game/entities/PlayerSystem";
import { auditArenaReadability } from "../../src/game/render/readability";

const VARIANT_IDS = [
  "foundry-wards",
  "breach-primus",
  "reactor-verge",
  "choir-node",
  "warren-blocks",
  "cinder-stacks",
] as const;

function overlaps(a: MapObstacle, b: MapObstacle): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
}

/** World-space rect swept by a connector: the from→to run widened by `width`
 *  perpendicular to it. Both shipped stair kits run axis-aligned, so the
 *  perpendicular axis is whichever one the endpoints share. */
function rampFootprint(ramp: ArenaRamp): ArenaRect {
  const halfWidth = ramp.width / 2;
  const alongZ = Math.abs(ramp.to.x - ramp.from.x) < Math.abs(ramp.to.z - ramp.from.z);
  const spreadX = alongZ ? halfWidth : 0;
  const spreadZ = alongZ ? 0 : halfWidth;
  return {
    minX: Math.min(ramp.from.x, ramp.to.x) - spreadX,
    maxX: Math.max(ramp.from.x, ramp.to.x) + spreadX,
    minZ: Math.min(ramp.from.z, ramp.to.z) - spreadZ,
    maxZ: Math.max(ramp.from.z, ramp.to.z) + spreadZ,
  };
}

function holeRect(hole: ArenaStructureHole): ArenaRect {
  return {
    minX: hole.x - hole.w / 2,
    maxX: hole.x + hole.w / 2,
    minZ: hole.z - hole.d / 2,
    maxZ: hole.z + hole.d / 2,
  };
}

function rectContainsRect(outer: ArenaRect, inner: ArenaRect): boolean {
  return (
    inner.minX >= outer.minX - 1e-6 &&
    inner.maxX <= outer.maxX + 1e-6 &&
    inner.minZ >= outer.minZ - 1e-6 &&
    inner.maxZ <= outer.maxZ + 1e-6
  );
}

function rectContainsPoint(rect: ArenaRect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
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

describe("shipped Survivors arena variants (#503, #505)", () => {
  it("extends the Survivors registry without changing the canon campaign", () => {
    expect(DEFAULT_JOURNEY_MAP_IDS).toEqual(["ashgate", "hollowlanes", "maw", "perdition"]);
    expect(Object.keys(MAPS)).toEqual(DEFAULT_JOURNEY_MAP_IDS);
    expect(SURVIVOR_MAP_ORDER).toEqual([...DEFAULT_JOURNEY_MAP_IDS, ...VARIANT_IDS]);
    expect(Object.keys(SURVIVOR_MAPS)).toEqual(SURVIVOR_MAP_ORDER);
    expect(MAP_PICKER.map((map) => map.id)).toEqual(SURVIVOR_MAP_ORDER);
    expect(campaignSequence("ashgate").map((map) => map.id)).toEqual(DEFAULT_JOURNEY_MAP_IDS);
    for (const id of VARIANT_IDS) expect(getMap(id)).toBe(SURVIVOR_MAPS[id]);
  });

  it("keeps the variants joined to their canon locations and registered presentation", () => {
    const foundry = SURVIVOR_MAPS["foundry-wards"];
    expect(foundry).toMatchObject({ loreId: "ashgate", front: "holdout", biomeId: "foundry" });
    expect(foundry.materials).toBe(MAPS.ashgate.materials);
    expect(foundry.environment).not.toBe(MAPS.ashgate.environment);
    expect(foundry.environment.decals.map((decal) => decal.texture)).toEqual(
      MAPS.ashgate.environment.decals.map((decal) => decal.texture),
    );
    expect(foundry.environment.props.map((prop) => prop.texture)).toEqual(
      MAPS.ashgate.environment.props.map((prop) => prop.texture),
    );

    const primus = SURVIVOR_MAPS["breach-primus"];
    expect(primus).toMatchObject({ loreId: "maw", front: "breach", biomeId: "rot" });
    expect(primus.materials).toBe(MAPS.maw.materials);
    expect(primus.environment).toBe(MAPS.maw.environment);

    const reactor = SURVIVOR_MAPS["reactor-verge"];
    expect(reactor).toMatchObject({ loreId: "ashgate", front: "holdout", biomeId: "cinderwell" });
    expect(reactor.materials).toBe(MAPS.ashgate.materials);
    expect(reactor.environment).toBe(MAPS.ashgate.environment);

    const choir = SURVIVOR_MAPS["choir-node"];
    expect(choir).toMatchObject({ loreId: "perdition", front: "breach", biomeId: "perdition" });
    expect(choir.materials).toBe(MAPS.perdition.materials);
    expect(choir.environment).toBe(MAPS.perdition.environment);

    // The two building maps author their own dressing rather than borrowing the
    // canon map's object, but they still draw from that location's registered
    // texture set — no new asset ids, so `assets:check` stays green.
    const warren = SURVIVOR_MAPS["warren-blocks"];
    expect(warren).toMatchObject({ loreId: "hollowlanes", front: "lane", biomeId: "bone" });
    expect(warren.materials).toBe(MAPS.hollowlanes.materials);
    expect(warren.environment).not.toBe(MAPS.hollowlanes.environment);
    expect(new Set(warren.environment.decals.map((decal) => decal.texture))).toEqual(
      new Set(["arena-hollowlanes-decal"]),
    );
    expect(new Set(warren.environment.props.map((prop) => prop.texture))).toEqual(new Set(["arena-hollowlanes-prop"]));

    const cinder = SURVIVOR_MAPS["cinder-stacks"];
    expect(cinder).toMatchObject({ loreId: "ashgate", front: "holdout", biomeId: "foundry" });
    expect(cinder.materials).toBe(MAPS.ashgate.materials);
    expect(cinder.environment).not.toBe(MAPS.ashgate.environment);
    expect(new Set(cinder.environment.decals.map((decal) => decal.texture))).toEqual(new Set(["arena-ashgate-decal"]));
    expect(new Set(cinder.environment.props.map((prop) => prop.texture))).toEqual(new Set(["arena-ashgate-prop"]));
  });

  it("authors Foundry Wards as two ground rooms with an open central traversal", () => {
    const foundry = SURVIVOR_MAPS["foundry-wards"];
    expect(foundry.bounds).toEqual(FOUNDRY_WARDS_BOUNDS);
    expect(boundsToRect(foundry.layout.bounds)).toEqual({ minX: -72, maxX: 72, minZ: -56, maxZ: 56 });
    const defaultRect = boundsToRect(DEFAULT_ARENA_BOUNDS);
    const defaultArea = (defaultRect.maxX - defaultRect.minX) * (defaultRect.maxZ - defaultRect.minZ);
    const foundryRect = boundsToRect(foundry.layout.bounds);
    const foundryArea = (foundryRect.maxX - foundryRect.minX) * (foundryRect.maxZ - foundryRect.minZ);
    expect(foundryArea / defaultArea).toBeCloseTo(2.52, 2);
    expect(foundry.layout.rooms.map((room) => room.id)).toEqual(["assembly-yard", "furnace-yard"]);
    expect(foundry.layout.rooms.every((room) => room.levelId === GROUND_LEVEL_ID)).toBe(true);
    expect(foundry.layout.ramps).toEqual([]);
    expect(foundry.layout.platforms).toEqual([]);

    const bulkheads = flattenObstacles(foundry.layout).filter((obstacle) => obstacle.x === -1);
    expect(bulkheads).toHaveLength(2);
    expect(bulkheads.every((wall) => Math.abs(wall.z) - wall.d / 2 === 20)).toBe(true);
    expect(bulkheads.every((wall) => Math.abs(wall.z) + wall.d / 2 === 56)).toBe(true);
    expect(anchorsOfKind(foundry.layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(foundry.layout, "breachSpawn")).toHaveLength(2);
    expect(anchorsOfKind(foundry.layout, "playerSpawn")[0]).toMatchObject({ x: -62, z: 0 });
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

  it("keeps horde grounding on the storey it is standing on inside a building", () => {
    // Terrain is flat under the shell; the building stacks a first-floor deck at
    // 3.4 and a roof at 6.8 over the SAME footprint.
    const terrain: THREE.Box3[] = [];
    const decks = [
      new THREE.Box3(new THREE.Vector3(-10, 3.1, -8), new THREE.Vector3(10, 3.4, 8)),
      new THREE.Box3(new THREE.Vector3(-10, 6.5, -8), new THREE.Vector3(10, 6.8, 8)),
    ];
    const at = (x: number, z: number, fromY: number) =>
      walkableSurfaceHeightNear(terrain, decks, x, z, fromY, PLAYER_STEP_HEIGHT);

    // Ground floor: both decks are overhead, so the walker stays under them.
    // This is the regression the naive max got wrong — it put spawns on the roof.
    expect(at(0, 0, 0)).toBe(0);
    // Climbing the stairwell: once a tread is within a step of the deck, it lands.
    expect(at(0, 0, 3.4 - PLAYER_STEP_HEIGHT)).toBe(3.4);
    // Standing on the first floor, the roof is still a storey away.
    expect(at(0, 0, 3.4)).toBe(3.4);
    expect(at(0, 0, 6.8 - PLAYER_STEP_HEIGHT)).toBe(6.8);
    // Outside the footprint there is nothing to stand on at any height.
    expect(at(40, 40, 3.4)).toBe(0);
  });

  it("prefers terrain over a deck the walker cannot reach", () => {
    const terrain = [new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 1.2, 4))];
    const decks = [new THREE.Box3(new THREE.Vector3(-4, 5, -4), new THREE.Vector3(4, 5.3, 4))];

    // A raised room floor is a height field: it resolves regardless of `fromY`,
    // so existing maps keep their exact grounding behaviour.
    expect(walkableSurfaceHeightNear(terrain, decks, 0, 0, 0, PLAYER_STEP_HEIGHT)).toBe(1.2);
    expect(walkableSurfaceHeightNear(terrain, [], 0, 0, 0, PLAYER_STEP_HEIGHT)).toBe(1.2);
  });

  it("authors Reactor Verge as a single-room cross-route hazard layout", () => {
    const reactor = SURVIVOR_MAPS["reactor-verge"];
    expect(reactor.layout.rooms.map((room) => [room.id, room.name])).toEqual([["exchanger-verge", "Exchanger Verge"]]);
    expect(reactor.layout.ramps).toEqual([]);
    expect(reactor.layout.platforms).toEqual([]);

    const exchangerBanks = flattenObstacles(reactor.layout).filter((obstacle) => obstacle.w === 6 && obstacle.d === 6);
    expect(exchangerBanks.map(({ x, z }) => [x, z])).toEqual([
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ]);
    expect(anchorsOfKind(reactor.layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(reactor.layout, "breachSpawn")).toHaveLength(2);
    expect(anchorsOfKind(reactor.layout, "objective")[0]).toMatchObject({
      id: "exchanger-control",
      x: 0,
      z: 0,
    });
  });

  it("authors Choir Node as a named three-room route through Perdition", () => {
    const choir = SURVIVOR_MAPS["choir-node"];
    expect(choir.layout.rooms.map((room) => [room.id, room.name])).toEqual([
      ["pressure-throat", "Pressure Throat"],
      ["signal-nave", "Signal Nave"],
      ["repeater-heart", "Repeater Heart"],
    ]);
    expect(choir.layout.rooms.every((room) => room.levelId === GROUND_LEVEL_ID)).toBe(true);

    const throat = boundsToRect(choir.layout.rooms[0].bounds);
    const nave = boundsToRect(choir.layout.rooms[1].bounds);
    const heart = boundsToRect(choir.layout.rooms[2].bounds);
    expect(throat.minZ).toBe(nave.maxZ);
    expect(nave.minZ).toBe(heart.maxZ);
    expect(anchorsOfKind(choir.layout, "playerSpawn")[0]?.roomId).toBe("pressure-throat");
    expect(anchorsOfKind(choir.layout, "objective")[0]?.roomId).toBe("repeater-heart");
    expect(anchorsOfKind(choir.layout, "breachSpawn")).toHaveLength(3);
  });

  it("authors Warren Blocks as a flat room graph whose only vertical play is interior", () => {
    const warren = SURVIVOR_MAPS["warren-blocks"];
    expect(boundsToRect(warren.layout.bounds)).toEqual({ minX: -56, maxX: 56, minZ: -48, maxZ: 48 });
    expect(warren.layout.rooms.map((room) => [room.id, room.name])).toEqual([
      ["north-warren", "North Warren"],
      ["warren-plaza", "Warren Plaza"],
      ["south-warren", "South Warren"],
    ]);
    // Every room is ground: the upper storey exists only inside the blocks, so
    // no phantom raised terrain is built outdoors.
    expect(warren.layout.rooms.every((room) => room.levelId === GROUND_LEVEL_ID)).toBe(true);
    expect(warren.layout.levels).toEqual([
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "warren-upper", y: 3.4, name: "Warren Upper Floors" },
    ]);
    expect(warren.layout.platforms).toEqual([]);

    // The three rooms tile the arena front to back with no gap between them.
    const north = boundsToRect(warren.layout.rooms[0].bounds);
    const plaza = boundsToRect(warren.layout.rooms[1].bounds);
    const south = boundsToRect(warren.layout.rooms[2].bounds);
    expect(north.maxZ).toBe(plaza.minZ);
    expect(plaza.maxZ).toBe(south.minZ);

    // One habitat block per room, each a two-storey roofed shell reached by its
    // own flight of stairs.
    expect(warren.layout.structures.map((structure) => structure.id)).toEqual(["hab-north", "hab-east", "hab-south"]);
    for (const structure of warren.layout.structures) {
      expect(structure.levelIds, structure.id).toEqual([GROUND_LEVEL_ID, "warren-upper"]);
      expect(structure.roof, structure.id).toBe(true);
    }
    expect(warren.layout.ramps.map((ramp) => ramp.id)).toEqual([
      "hab-north-stairs",
      "hab-east-stairs",
      "hab-south-stairs",
    ]);
    expect(warren.layout.ramps.every((ramp) => ramp.kind === "stairs")).toBe(true);
    expect(warren.layout.ramps.every((ramp) => ramp.toLevelId === "warren-upper")).toBe(true);

    // The objective sits in the open plaza, not behind a door — the horde has no
    // navmesh and cannot open one, so an interior objective would be campable.
    const objective = anchorsOfKind(warren.layout, "objective")[0];
    expect(objective).toMatchObject({ id: "warren-node", roomId: "warren-plaza" });
    expect(
      warren.layout.structures.some((structure) =>
        rectContainsPoint(boundsToRect(structure.bounds), objective.x, objective.z),
      ),
    ).toBe(false);
    expect(anchorsOfKind(warren.layout, "playerSpawn")).toHaveLength(1);
    expect(anchorsOfKind(warren.layout, "breachSpawn")).toHaveLength(3);
  });

  it("authors Cinder Stacks as a three-storey tower flanked by two-storey annexes", () => {
    const cinder = SURVIVOR_MAPS["cinder-stacks"];
    expect(boundsToRect(cinder.layout.bounds)).toEqual({ minX: -48, maxX: 48, minZ: -44, maxZ: 44 });
    expect(cinder.layout.rooms.map((room) => [room.id, room.name])).toEqual([
      ["stack-west", "West Stacks"],
      ["stack-east", "East Stacks"],
    ]);
    expect(cinder.layout.rooms.every((room) => room.levelId === GROUND_LEVEL_ID)).toBe(true);
    expect(cinder.layout.levels).toEqual([
      { id: GROUND_LEVEL_ID, y: 0, name: "Ground" },
      { id: "stack-mid", y: 3.6, name: "Stack Mid Deck" },
      { id: "stack-top", y: 7.2, name: "Stack Top Deck" },
    ]);
    expect(boundsToRect(cinder.layout.rooms[0].bounds).maxX).toBe(boundsToRect(cinder.layout.rooms[1].bounds).minX);

    const byId = new Map(cinder.layout.structures.map((structure) => [structure.id, structure]));
    expect([...byId.keys()]).toEqual(["cinder-tower", "cinder-annex-west", "cinder-annex-east"]);
    expect(byId.get("cinder-tower")!.levelIds).toEqual([GROUND_LEVEL_ID, "stack-mid", "stack-top"]);
    expect(byId.get("cinder-annex-west")!.levelIds).toEqual([GROUND_LEVEL_ID, "stack-mid"]);
    expect(byId.get("cinder-annex-east")!.levelIds).toEqual([GROUND_LEVEL_ID, "stack-mid"]);

    // The tower's two shafts sit in opposite corners, so taking the top deck is a
    // full diagonal traverse of the interior rather than one straight climb.
    const shafts = byId.get("cinder-tower")!.floorHoles ?? [];
    expect(shafts.map((hole) => hole.id)).toEqual(["tower-shaft-mid", "tower-shaft-top"]);
    expect(Math.sign(shafts[0].x)).toBe(-Math.sign(shafts[1].x));
    expect(Math.sign(shafts[0].z)).toBe(-Math.sign(shafts[1].z));
    expect(shafts.map((hole) => hole.levelId)).toEqual(["stack-mid", "stack-top"]);

    // Four flights: two stacked inside the tower, one per annex.
    expect(cinder.layout.ramps.map((ramp) => [ramp.id, ramp.fromLevelId, ramp.toLevelId])).toEqual([
      ["tower-stairs-lower", GROUND_LEVEL_ID, "stack-mid"],
      ["tower-stairs-upper", "stack-mid", "stack-top"],
      ["annex-west-stairs", GROUND_LEVEL_ID, "stack-mid"],
      ["annex-east-stairs", GROUND_LEVEL_ID, "stack-mid"],
    ]);

    const objective = anchorsOfKind(cinder.layout, "objective")[0];
    expect(objective).toMatchObject({ id: "stacks-node", roomId: "stack-east" });
    expect(
      cinder.layout.structures.some((structure) =>
        rectContainsPoint(boundsToRect(structure.bounds), objective.x, objective.z),
      ),
    ).toBe(false);
    expect(anchorsOfKind(cinder.layout, "breachSpawn")).toHaveLength(3);
  });

  it("keeps every building enterable, climbable, and clear of the outdoor obstacle field", () => {
    for (const id of VARIANT_IDS) {
      const map = SURVIVOR_MAPS[id];
      const mapRect = boundsToRect(map.layout.bounds);

      for (const structure of map.layout.structures) {
        const label = `${id}/${structure.id}`;
        const outer = boundsToRect(structure.bounds);
        const interior = structureInteriorRect(structure.bounds, structureWallThickness(structure));
        expect(rectContainsRect(mapRect, outer), `${label} inside map`).toBe(true);

        // Enterable from more than one facade. Enemies steer straight at the
        // player with no navmesh, so a single door piles the horde on a blank
        // wall instead of funnelling it inside.
        const groundLevelId = structure.levelIds[0];
        const doorSides = new Set(
          structure.openings
            .filter((opening) => opening.kind === "door" && (opening.levelId ?? groundLevelId) === groundLevelId)
            .map((opening) => opening.side),
        );
        expect(doorSides.size, `${label} ground door sides`).toBeGreaterThanOrEqual(2);

        // Every opening pierces a storey the structure actually has.
        for (const opening of structure.openings) {
          expect(structure.levelIds, `${label}/${opening.id} storey`).toContain(opening.levelId ?? groundLevelId);
        }

        // Structure walls are game-side geometry, invisible to the validator's
        // obstacle-overlap pass — so the footprint has to be kept clear of the
        // outdoor obstacle field by hand, and this is what proves it stayed that way.
        for (const room of map.layout.rooms) {
          for (const obstacle of room.obstacles) {
            const overlapsFootprint =
              Math.abs(obstacle.x - (outer.minX + outer.maxX) / 2) < (obstacle.w + (outer.maxX - outer.minX)) / 2 &&
              Math.abs(obstacle.z - (outer.minZ + outer.maxZ) / 2) < (obstacle.d + (outer.maxZ - outer.minZ)) / 2;
            expect(overlapsFootprint, `${label} vs ${room.id} obstacle at ${obstacle.x},${obstacle.z}`).toBe(false);
          }
        }

        // Each storey above the ground floor is reached by a flight whose swept
        // footprint lands inside a floor hole on the destination storey —
        // otherwise the climb terminates in the underside of a solid deck.
        const holes = structure.floorHoles ?? [];
        for (const hole of holes) {
          expect(rectContainsRect(interior, holeRect(hole)), `${label} hole ${hole.id ?? ""} inside interior`).toBe(
            true,
          );
        }
        for (const levelId of structure.levelIds.slice(1)) {
          const flight = map.layout.ramps.find(
            (ramp) => ramp.toLevelId === levelId && rectContainsPoint(outer, ramp.to.x, ramp.to.z),
          );
          expect(flight, `${label} flight up to ${levelId}`).toBeDefined();
          const footprint = rampFootprint(flight!);
          const shaft = holes.find(
            (hole) => (hole.levelId ?? levelId) === levelId && rectContainsRect(holeRect(hole), footprint),
          );
          expect(shaft, `${label} shaft over ${flight!.id}`).toBeDefined();
        }
      }
    }
  });

  it("passes focused room, obstacle, anchor, and connector geometry contracts", () => {
    for (const id of VARIANT_IDS) {
      expectValidGeometry(SURVIVOR_MAPS[id]);
    }
  });

  it("passes the shared validator and readability contracts for every shipped variant", () => {
    for (const id of VARIANT_IDS) {
      const map = SURVIVOR_MAPS[id];
      expect(validateArenaLayout(map.layout), id).toEqual({ ok: true, errors: [] });
      expect(auditArenaReadability(map).violations, id).toEqual([]);
    }
  });
});
