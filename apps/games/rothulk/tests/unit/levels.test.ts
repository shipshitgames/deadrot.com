import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/constants";
import { buildLevelAt, LEVELS, levelCount } from "../../src/game/levels";
import type { LevelData, Platform } from "../../src/game/types";

// Top surface of a slab platform (platforms store center + extents).
const top = (p: Platform) => p.y + p.h / 2;

// True when some slab sits under x at-or-below y — i.e. the point has footing.
function hasFootingUnder(level: LevelData, x: number, y: number): boolean {
  return level.platforms.some(
    (p) => p.kind === "slab" && Math.abs(x - p.x) <= p.w / 2 && top(p) <= y && top(p) > CONSTANTS.KILL_FLOOR_Y,
  );
}

describe("Rothulk level list", () => {
  test("ships a campaign of at least two levels", () => {
    expect(levelCount()).toBeGreaterThanOrEqual(2);
    expect(LEVELS.length).toBe(levelCount());
    const ids = LEVELS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("buildLevelAt rejects out-of-range indices", () => {
    expect(() => buildLevelAt(levelCount())).toThrow();
    expect(() => buildLevelAt(-1)).toThrow();
  });

  for (let i = 0; i < LEVELS.length; i++) {
    test(`level ${i + 1} (${LEVELS[i].id}) has sane geometry and goals`, () => {
      const level = buildLevelAt(i);

      expect(level.width).toBeGreaterThan(0);
      expect(level.front).toBe("hulk");
      expect(level.name.length).toBeGreaterThan(0);
      expect(level.platforms.some((p) => p.kind === "slab")).toBe(true);

      // Spawn, checkpoint, core, and exit all exist inside the level and have
      // footing beneath them (no goal floats over the kill floor).
      expect(level.spawn.x).toBeGreaterThanOrEqual(0);
      expect(level.spawn.x).toBeLessThanOrEqual(level.width);
      expect(hasFootingUnder(level, level.spawn.x, level.spawn.y)).toBe(true);

      expect(level.checkpoint.reached).toBe(false);
      expect(level.checkpoint.x).toBeGreaterThan(0);
      expect(level.checkpoint.x).toBeLessThan(level.width);
      expect(hasFootingUnder(level, level.checkpoint.x, level.checkpoint.y)).toBe(true);

      expect(level.core.ignited).toBe(false);
      expect(level.core.x).toBeGreaterThan(level.checkpoint.x); // checkpoint precedes the core
      expect(level.core.x).toBeLessThanOrEqual(level.width);
      expect(hasFootingUnder(level, level.core.x, level.core.y)).toBe(true);

      expect(level.exit.reached).toBe(false);
      expect(level.exit.radius).toBeGreaterThan(0);
      expect(hasFootingUnder(level, level.exit.x, level.exit.y)).toBe(true);

      // Collectibles + enemies all live inside the level bounds.
      expect(level.embers.length).toBeGreaterThan(0);
      for (const e of level.embers) {
        expect(e.collected).toBe(false);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThanOrEqual(level.width);
      }
      for (const s of level.scourge) {
        expect(s.minX).toBeLessThan(s.maxX);
        expect(s.minX).toBeGreaterThanOrEqual(0);
        expect(s.maxX).toBeLessThanOrEqual(level.width);
        expect(s.alive).toBe(true);
      }
      for (const sp of level.spitters) {
        expect(sp.alive).toBe(true);
        expect(sp.cooldown).toBeGreaterThanOrEqual(0);
        expect(hasFootingUnder(level, sp.x, sp.y)).toBe(true);
      }
      for (const c of level.chargers) {
        expect(c.alive).toBe(true);
        expect(c.state).toBe("patrol");
        expect(c.minX).toBeLessThan(c.maxX);
        expect(c.x).toBeGreaterThanOrEqual(c.minX);
        expect(c.x).toBeLessThanOrEqual(c.maxX);
        expect(hasFootingUnder(level, c.x, c.y)).toBe(true);
      }
    });
  }

  test("level 1 keeps the original Rothulk layout (gameplay-identical)", () => {
    const level = buildLevelAt(0);
    expect(level.name).toBe("The Rothulk");
    expect(level.width).toBe(130);
    expect(level.spawn).toEqual({ x: CONSTANTS.HERO_SPAWN_X, y: CONSTANTS.HERO_SPAWN_Y });
    expect(level.checkpoint).toEqual({ x: 60, y: 2.6, reached: false });
    expect(level.core).toEqual({ x: 122.5, y: 6.2, ignited: false });
    expect(level.platforms.filter((p) => p.kind === "slab").length).toBe(14);
    expect(level.platforms.filter((p) => p.kind === "flesh").length).toBe(14);
    expect(level.movers.length).toBe(2);
    expect(level.hazards.length).toBe(4);
    expect(level.scourge.length).toBe(6);
    expect(level.embers.length).toBe(11);
    // The original level has no second-roster enemies.
    expect(level.spitters).toEqual([]);
    expect(level.chargers).toEqual([]);
  });

  test("level 2 introduces both new enemy types", () => {
    const level = buildLevelAt(1);
    expect(level.name).toBe("The Maw Spire");
    expect(level.spitters.length).toBeGreaterThan(0);
    expect(level.chargers.length).toBeGreaterThan(0);
    expect(level.scourge.length).toBeGreaterThan(0);
    // Same hazard vocabulary as level 1.
    expect(level.hazards.some((h) => h.kind === "acid")).toBe(true);
    expect(level.hazards.some((h) => h.kind === "spikes")).toBe(true);
    expect(level.movers.length).toBeGreaterThan(0);
    // More vertical than level 1: the core sits far higher.
    const level1 = buildLevelAt(0);
    expect(level.core.y).toBeGreaterThan(level1.core.y);
  });
});
