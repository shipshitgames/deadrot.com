import { describe, expect, test } from "bun:test";
import { SpatialGrid, type SpatialTarget } from "../../src/systems/entities/spatialGrid";

interface Target extends SpatialTarget {
  id: string;
}

function target(id: string, x: number, y: number, radius = 1): Target {
  return { id, mesh: { position: { x, y } }, radius, dead: false };
}

describe("Starblight enemy spatial grid", () => {
  test("queries intersecting targets across cell boundaries in source order", () => {
    const grid = new SpatialGrid<Target>(200, 200, 8);
    const first = target("first", 8.4, 0, 1);
    const second = target("second", 7.6, 0, 1);
    const far = target("far", 30, 0, 1);
    const out: Target[] = [];

    grid.rebuild([first, second, far]);

    expect(grid.queryCircle(8, 0, 0.5, out).map((item) => item.id)).toEqual(["first", "second"]);
    expect(out).toBe(grid.queryCircle(30, 0, 0.5, out));
    expect(out.map((item) => item.id)).toEqual(["far"]);
  });

  test("supports center-only effects without inflating by target radius", () => {
    const grid = new SpatialGrid<Target>(200, 200, 8);
    const edge = target("edge", 5.5, 0, 2);
    const out: Target[] = [];
    grid.rebuild([edge]);

    expect(grid.queryCircle(0, 0, 4, out).map((item) => item.id)).toEqual(["edge"]);
    expect(grid.queryCircle(0, 0, 4, out, false)).toEqual([]);
  });

  test("preserves nearest-target range, exclusion, and array-order ties", () => {
    const grid = new SpatialGrid<Target>(200, 200, 8);
    const first = target("first", -3, 0);
    const second = target("second", 3, 0);
    const farther = target("farther", 9, 0);
    grid.rebuild([first, second, farther]);

    expect(grid.nearest(0, 0)?.id).toBe("first");
    expect(grid.nearest(0, 0, 4, [first])?.id).toBe("second");
    expect(grid.nearest(0, 0, Infinity, [first, second])?.id).toBe("farther");
    expect(grid.nearest(0, 0, 2)).toBeNull();
  });

  test("rebuilds moved targets and omits dead targets without replacing buffers", () => {
    const grid = new SpatialGrid<Target>(200, 200, 8);
    const moving = target("moving", -40, -40, 1.5);
    const dead = target("dead", 0, 0, 5);
    const out: Target[] = [];
    grid.rebuild([moving, dead]);
    expect(grid.maxRadius).toBe(5);

    moving.mesh.position.x = 40;
    moving.mesh.position.y = 40;
    dead.dead = true;
    grid.rebuild([moving, dead]);

    expect(grid.maxRadius).toBe(1.5);
    expect(grid.queryCircle(-40, -40, 2, out)).toEqual([]);
    expect(grid.queryCircle(40, 40, 1, out).map((item) => item.id)).toEqual(["moving"]);
  });

  test("bounds a dense local query instead of returning the whole swarm", () => {
    const grid = new SpatialGrid<Target>(200, 200, 8);
    const swarm = Array.from({ length: 160 }, (_, index) => {
      const column = index % 16;
      const row = Math.floor(index / 16);
      return target(String(index), -90 + column * 12, -54 + row * 12, 0.8);
    });
    const out: Target[] = [];
    grid.rebuild(swarm);

    grid.queryCircle(0, 0, 8, out);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(swarm.length / 10);
  });
});
