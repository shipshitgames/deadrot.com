import { describe, expect, test } from "bun:test";
import { CONSTANTS, type Team } from "../../src/game/constants";
import {
  ASHGATE_MAP,
  activeLanes,
  activeTowersFor,
  enemyOf,
  LANE_IDS,
  type LaneId,
  type MapDef,
  primaryLane,
  totalActiveTowers,
  towerZ,
} from "../../src/game/map";

// ---------------------------------------------------------------------------
// The lane / map data model. These tests pin the *contract* the sim builds
// from: the model must already describe top/mid/bot (even with one lane live),
// and every derived position must come from the data — not a magic number.
// ---------------------------------------------------------------------------

describe("pactfall map — three-lane model with a single live lane", () => {
  test("the model names all three canonical lanes, ordered top → mid → bot", () => {
    expect(LANE_IDS).toEqual(["top", "mid", "bot"]);
    const ids = ASHGATE_MAP.lanes.map((lane) => lane.id);
    expect(ids).toEqual([...LANE_IDS]);
  });

  test("exactly one lane (mid) is active in the shipped slice", () => {
    const live = activeLanes(ASHGATE_MAP);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe("mid");
    expect(primaryLane(ASHGATE_MAP).id).toBe("mid");
  });

  test("top/mid/bot are all described so a lane can be activated without reshaping data", () => {
    const byId = new Map<LaneId, (typeof ASHGATE_MAP.lanes)[number]>(ASHGATE_MAP.lanes.map((l) => [l.id, l]));
    for (const id of LANE_IDS) {
      const lane = byId.get(id);
      expect(lane).toBeDefined();
      // Each lane already carries a full, symmetric tower line for both teams.
      expect(lane?.towers.pyre.length).toBeGreaterThan(0);
      expect(lane?.towers.warden.length).toBe(lane?.towers.pyre.length);
    }
  });

  test("the dormant lanes run parallel to mid, offset laterally", () => {
    const mid = ASHGATE_MAP.lanes.find((l) => l.id === "mid");
    const top = ASHGATE_MAP.lanes.find((l) => l.id === "top");
    const bot = ASHGATE_MAP.lanes.find((l) => l.id === "bot");
    expect(mid?.xOffset).toBe(0);
    // Top and bot sit on opposite sides of mid, the same distance out.
    expect(top?.xOffset).toBe(-(bot?.xOffset ?? Number.NaN));
    expect(Math.abs(top?.xOffset ?? 0)).toBeGreaterThan(0);
  });
});

describe("pactfall map — derived geometry", () => {
  test("enemyOf flips the team", () => {
    expect(enemyOf("pyre")).toBe("warden");
    expect(enemyOf("warden")).toBe("pyre");
  });

  test("bases sit at the canonical lane ends", () => {
    expect(ASHGATE_MAP.bases.pyre.z).toBe(CONSTANTS.base.friendlyZ);
    expect(ASHGATE_MAP.bases.warden.z).toBe(CONSTANTS.base.enemyZ);
  });

  test("a tower's Z lerps from its owner's base toward the enemy base", () => {
    const mid = primaryLane(ASHGATE_MAP);
    for (const team of ["pyre", "warden"] as Team[]) {
      const own = ASHGATE_MAP.bases[team].z;
      const enemy = ASHGATE_MAP.bases[enemyOf(team)].z;
      for (const def of mid.towers[team]) {
        const z = towerZ(ASHGATE_MAP, team, def);
        const fraction = (z - own) / (enemy - own);
        expect(fraction).toBeCloseTo(def.t, 5);
        // Every tower sits strictly between the two bases.
        expect(Math.min(own, enemy)).toBeLessThan(z);
        expect(z).toBeLessThan(Math.max(own, enemy));
      }
    }
  });

  test("each team's towers are ordered outer → inner (the inner tower hugs its base)", () => {
    const mid = primaryLane(ASHGATE_MAP);
    for (const team of ["pyre", "warden"] as Team[]) {
      const own = ASHGATE_MAP.bases[team].z;
      const zs = mid.towers[team].map((def) => towerZ(ASHGATE_MAP, team, def));
      // The last tower in the list is the closest to the owner's base.
      const distances = zs.map((z) => Math.abs(z - own));
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeLessThan(distances[i - 1]);
      }
    }
  });

  test("tower tallies count only active lanes and split evenly per team", () => {
    const live = activeLanes(ASHGATE_MAP);
    const perLanePyre = live[0].towers.pyre.length;
    expect(activeTowersFor(ASHGATE_MAP, "pyre")).toBe(perLanePyre * live.length);
    expect(activeTowersFor(ASHGATE_MAP, "warden")).toBe(perLanePyre * live.length);
    expect(totalActiveTowers(ASHGATE_MAP)).toBe(
      activeTowersFor(ASHGATE_MAP, "pyre") + activeTowersFor(ASHGATE_MAP, "warden"),
    );
  });

  test("objectives include the decisive base outcomes and the optional scourge", () => {
    const ids = ASHGATE_MAP.objectives.map((o) => o.id);
    expect(ids).toContain("destroy-enemy-base");
    expect(ids).toContain("defend-base");
    expect(ASHGATE_MAP.objectives.find((o) => o.id === "destroy-enemy-base")?.decisive).toBe(true);
    expect(ASHGATE_MAP.objectives.find((o) => o.id === "slay-scourge")?.decisive).toBe(false);
  });

  test("primaryLane throws if a map somehow has no active lane (fail loud, not silent)", () => {
    const dead: MapDef = { ...ASHGATE_MAP, lanes: ASHGATE_MAP.lanes.map((l) => ({ ...l, active: false })) };
    expect(activeLanes(dead)).toHaveLength(0);
    expect(() => primaryLane(dead)).toThrow();
  });
});
