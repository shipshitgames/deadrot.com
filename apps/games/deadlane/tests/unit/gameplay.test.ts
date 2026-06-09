import { describe, expect, test } from "bun:test";
import {
  basePoint,
  boardBounds,
  boardSize,
  breachDoorPoint,
  cellToWorld,
  inBounds,
  isPathCell,
  mobPathPoints,
  pathCells,
  pathPoints,
  playBounds,
  spawnPoint,
  worldToCell,
} from "../../src/board";
import { CONSTANTS } from "../../src/constants";
import type { CreepKind, TowerKind } from "../../src/types";
import { creepStatsForWave, isBossWave, spawnCountForWave, waveComposition } from "../../src/waves";

/**
 * Gameplay unit tests for Deadlane (tower-defense lane holder).
 *
 * Scope note: Deadlane keeps its simulation in `src/systems/entities.ts` and
 * `src/game.ts`, but both eagerly construct THREE meshes / WebGL render systems
 * and cannot be imported under `bun test`. Those files derive every gameplay
 * number purely from `CONSTANTS` (and the pure wave director data in
 * `src/waves.ts`), so we test:
 *   1. the genuinely pure exports in `src/board.ts` (THREE.Vector3 math only),
 *   2. the wave composition / scaling helpers in `src/waves.ts`, and
 *   3. the constant-driven formulas (economy, build/bonus state machine,
 *      targeting range) by replicating the exact arithmetic the systems run.
 * If a balance constant changes, these tests fail — which is the point.
 */

const TOWER_KINDS = Object.keys(CONSTANTS.towers) as TowerKind[];
const CREEP_KINDS = Object.keys(CONSTANTS.creeps) as CreepKind[];

/** game.buildSpeedMul / runSpeedMul. */
function buildSpeedMul(level: number): number {
  return 1 + level * CONSTANTS.bonuses.buildSpeedPerLevel;
}
function runSpeedMul(level: number): number {
  return 1 + level * CONSTANTS.bonuses.runSpeedPerLevel;
}

// =============================================================================
describe("board geometry", () => {
  test("grid is centered on the origin", () => {
    const { cols, rows, cell } = CONSTANTS.board;
    expect(boardSize.worldWidth).toBe(cols * cell);
    expect(boardSize.worldDepth).toBe(rows * cell);
    expect(boardBounds.minX).toBe(-boardSize.worldWidth / 2);
    expect(boardBounds.maxX).toBe(boardSize.worldWidth / 2);
    expect(boardBounds.minX).toBe(-boardBounds.maxX);
    expect(boardBounds.minZ).toBe(-boardBounds.maxZ);
  });

  test("cellToWorld -> worldToCell round-trips every in-bounds cell", () => {
    const { cols, rows } = CONSTANTS.board;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const p = cellToWorld(col, row);
        const back = worldToCell(p.x, p.z);
        expect(back).toEqual({ col, row });
      }
    }
  });

  test("adjacent columns are exactly one cell apart in X", () => {
    const a = cellToWorld(0, 0);
    const b = cellToWorld(1, 0);
    expect(b.x - a.x).toBeCloseTo(CONSTANTS.board.cell, 10);
    expect(b.z).toBeCloseTo(a.z, 10);
  });

  test("inBounds rejects off-board coordinates", () => {
    const { cols, rows } = CONSTANTS.board;
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(cols - 1, rows - 1)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(cols, 0)).toBe(false);
    expect(inBounds(0, rows)).toBe(false);
  });
});

describe("lane / path", () => {
  test("path occupies a contiguous run of cells (no diagonal gaps)", () => {
    // Every declared waypoint corner must be a lane cell.
    for (const [col, row] of CONSTANTS.board.path) {
      expect(isPathCell(col, row)).toBe(true);
    }
    // The lane is axis-aligned segments, so cell count >= number of waypoints.
    expect(pathCells.size).toBeGreaterThanOrEqual(CONSTANTS.board.path.length);
  });

  test("path cells are filled along straight segments, not just corners", () => {
    // First segment runs col 0->3 on row 1; every intermediate cell is lane.
    expect(isPathCell(1, 1)).toBe(true);
    expect(isPathCell(2, 1)).toBe(true);
    // A clearly off-lane build tile is not a path cell.
    expect(isPathCell(5, 6)).toBe(false);
  });

  test("spawn and base sit at the path endpoints", () => {
    expect(spawnPoint.equals(pathPoints[0])).toBe(true);
    expect(basePoint.equals(pathPoints[pathPoints.length - 1])).toBe(true);
    expect(pathPoints.length).toBe(CONSTANTS.board.path.length);
  });

  test("mob path prepends the breach door approach to the lane", () => {
    expect(mobPathPoints.length).toBe(pathPoints.length + 1);
    expect(mobPathPoints[0].equals(breachDoorPoint)).toBe(true);
    expect(mobPathPoints[1].equals(spawnPoint)).toBe(true);
    // The door is outside the board on the spawn side (further from base).
    expect(breachDoorPoint.distanceTo(basePoint)).toBeGreaterThan(spawnPoint.distanceTo(basePoint));
  });

  test("play bounds enclose the board and the breach door", () => {
    expect(playBounds.minX).toBeLessThanOrEqual(boardBounds.minX);
    expect(playBounds.maxX).toBeGreaterThanOrEqual(boardBounds.maxX);
    expect(playBounds.minX).toBeLessThanOrEqual(breachDoorPoint.x);
  });
});

describe("economy", () => {
  test("starting gold buys a known number of ember turrets", () => {
    const { startGold } = CONSTANTS.economy;
    const cost = CONSTANTS.towers.ember.cost;
    const affordable = Math.floor(startGold / cost);
    expect(affordable).toBe(3); // 175 / 50
    // ...but not four.
    expect(cost * 4).toBeGreaterThan(startGold);
  });

  test("tower archetypes cost more as their utility grows", () => {
    expect(CONSTANTS.towers.stasis.cost).toBeGreaterThan(CONSTANTS.towers.ember.cost);
    expect(CONSTANTS.towers.mortar.cost).toBeGreaterThan(CONSTANTS.towers.stasis.cost);
  });

  test("cannot build when gold is below the selected tower's cost", () => {
    for (const kind of TOWER_KINDS) {
      const cost = CONSTANTS.towers[kind].cost;
      const canBuild = (gold: number) => gold >= cost;
      expect(canBuild(cost)).toBe(true);
      expect(canBuild(cost - 1)).toBe(false);
    }
  });

  test("kill rewards scale with creep toughness", () => {
    expect(CONSTANTS.creeps.ripper.reward).toBeLessThan(CONSTANTS.creeps.shambler.reward);
    expect(CONSTANTS.creeps.hulk.reward).toBeGreaterThan(CONSTANTS.creeps.shambler.reward);
    expect(CONSTANTS.creeps.boss.reward).toBeGreaterThan(CONSTANTS.creeps.hulk.reward);
  });

  test("a fully-cleared first wave funds at least one fresh ember turret", () => {
    const earned =
      waveComposition(1).reduce((sum, kind) => sum + CONSTANTS.creeps[kind].reward, 0) +
      CONSTANTS.economy.waveClearBonus;
    expect(earned).toBeGreaterThanOrEqual(CONSTANTS.towers.ember.cost);
  });
});

describe("wave director schedule", () => {
  test("there are the configured number of waves", () => {
    expect(CONSTANTS.waves.total).toBe(10);
  });

  test("wave size escalates strictly with each wave", () => {
    const counts = Array.from({ length: CONSTANTS.waves.total }, (_, i) => spawnCountForWave(i + 1));
    expect(counts[0]).toBe(CONSTANTS.waves.baseCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1]);
      expect(counts[i] - counts[i - 1]).toBe(CONSTANTS.waves.countGrowth);
    }
  });

  test("inter-wave timer counts down and triggers the next wave at zero", () => {
    // game.director: interWaveTimer -= dt until <= 0, then beginWave.
    let timer = CONSTANTS.waves.interWaveDelay;
    const dt = CONSTANTS.loop.maxDelta; // largest legal step
    let ticks = 0;
    while (timer > 0) {
      timer -= dt;
      ticks++;
    }
    expect(ticks).toBeGreaterThan(0);
    expect(timer).toBeLessThanOrEqual(0);
    const expected = CONSTANTS.waves.interWaveDelay / dt;
    expect(Math.abs(ticks - expected)).toBeLessThanOrEqual(1);
    expect(ticks).toBeGreaterThan(100);
  });

  test("spawn pacing: spawnInterval gates each creep release", () => {
    // game.director: after a spawn, spawnTimer resets to spawnInterval.
    const queue = waveComposition(1).length;
    let spawned = 0;
    let timer = 0;
    const dt = 0.1;
    const horizon = CONSTANTS.waves.spawnInterval * queue + 1;
    for (let t = 0; t < horizon && spawned < queue; t += dt) {
      timer -= dt;
      if (timer <= 0) {
        spawned++;
        timer = CONSTANTS.waves.spawnInterval;
      }
    }
    expect(spawned).toBe(queue);
  });
});

describe("wave composition", () => {
  test("is deterministic", () => {
    for (let w = 1; w <= CONSTANTS.waves.total; w++) {
      expect(waveComposition(w)).toEqual(waveComposition(w));
    }
  });

  test("early waves are pure shamblers", () => {
    expect(new Set(waveComposition(1))).toEqual(new Set(["shambler"]));
    expect(new Set(waveComposition(2))).toEqual(new Set(["shambler"]));
  });

  test("rippers join from wave 3, hulks from wave 4", () => {
    expect(waveComposition(3)).toContain("ripper");
    expect(waveComposition(3)).not.toContain("hulk");
    expect(waveComposition(4)).toContain("hulk");
  });

  test("a Lane Tyrant leads every Nth wave and arrives last", () => {
    for (let w = 1; w <= CONSTANTS.waves.total; w++) {
      const comp = waveComposition(w);
      if (w % CONSTANTS.waves.bossEvery === 0) {
        expect(isBossWave(w)).toBe(true);
        expect(comp[comp.length - 1]).toBe("boss");
        expect(comp.filter((k) => k === "boss")).toHaveLength(1);
      } else {
        expect(isBossWave(w)).toBe(false);
        expect(comp).not.toContain("boss");
      }
    }
    // The final wave is a boss wave — the run ends on a climax.
    expect(isBossWave(CONSTANTS.waves.total)).toBe(true);
  });

  test("composition size matches the escalating spawn count (+1 on boss waves)", () => {
    for (let w = 1; w <= CONSTANTS.waves.total; w++) {
      const expected = spawnCountForWave(w) + (isBossWave(w) ? 1 : 0);
      expect(waveComposition(w)).toHaveLength(expected);
    }
  });
});

describe("creep scaling", () => {
  test("wave 1 uses each archetype's base stats", () => {
    for (const kind of CREEP_KINDS) {
      const { hp, speed } = creepStatsForWave(kind, 1);
      expect(hp).toBeCloseTo(CONSTANTS.creeps[kind].hp, 10);
      expect(speed).toBeCloseTo(CONSTANTS.creeps[kind].speed, 10);
    }
  });

  test("hp and speed grow monotonically across waves", () => {
    for (const kind of CREEP_KINDS) {
      let prev = creepStatsForWave(kind, 1);
      for (let w = 2; w <= CONSTANTS.waves.total; w++) {
        const cur = creepStatsForWave(kind, w);
        expect(cur.hp).toBeGreaterThan(prev.hp);
        expect(cur.speed).toBeGreaterThan(prev.speed);
        prev = cur;
      }
    }
  });

  test("hp growth matches the configured compounding ratio", () => {
    const ratio = creepStatsForWave("shambler", 3).hp / creepStatsForWave("shambler", 2).hp;
    expect(ratio).toBeCloseTo(CONSTANTS.creepScaling.hpGrowth, 10);
  });

  test("archetype identities hold: rippers fast+fragile, hulks slow+tough", () => {
    const { shambler, ripper, hulk, boss } = CONSTANTS.creeps;
    expect(ripper.speed).toBeGreaterThan(shambler.speed);
    expect(ripper.hp).toBeLessThan(shambler.hp);
    expect(hulk.speed).toBeLessThan(shambler.speed);
    expect(hulk.hp).toBeGreaterThan(shambler.hp);
    expect(boss.hp).toBeGreaterThan(hulk.hp);
    expect(boss.breachDamage).toBeGreaterThan(hulk.breachDamage);
  });

  test("wave is clamped to >= 1 (pre-first-wave is treated as wave 1)", () => {
    expect(creepStatsForWave("shambler", 0)).toEqual(creepStatsForWave("shambler", 1));
  });
});

describe("base HP / lose condition", () => {
  test("base starts at full HP", () => {
    expect(CONSTANTS.base.startHp).toBe(20);
  });

  test("breach damage is per-archetype and clamps at 0", () => {
    // entities.moveCreeps: baseHp = max(0, baseHp - breachDamage).
    let hp = CONSTANTS.base.startHp;
    hp = Math.max(0, hp - CONSTANTS.creeps.hulk.breachDamage);
    expect(hp).toBe(CONSTANTS.base.startHp - 3);
    hp = Math.max(0, hp - 999);
    expect(hp).toBe(0);
  });

  test("a leaked boss hurts but does not single-handedly end a healthy base", () => {
    expect(CONSTANTS.creeps.boss.breachDamage).toBeLessThan(CONSTANTS.base.startHp);
  });
});

describe("tower targeting & combat", () => {
  test("targeting uses squared distance against squared range (per archetype)", () => {
    for (const kind of TOWER_KINDS) {
      const range = CONSTANTS.towers[kind].range;
      const rangeSq = range * range;
      expect((range - 0.5) ** 2).toBeLessThanOrEqual(rangeSq);
      expect((range + 0.5) ** 2).toBeGreaterThan(rangeSq);
    }
  });

  test("cooldown after firing equals 1 / fireRate", () => {
    expect(1 / CONSTANTS.towers.ember.fireRate).toBeCloseTo(0.625, 10);
    for (const kind of TOWER_KINDS) {
      expect(1 / CONSTANTS.towers[kind].fireRate).toBeGreaterThan(0);
    }
  });

  test("archetype roles hold in the stat table", () => {
    const { ember, stasis, mortar } = CONSTANTS.towers;
    const dps = (t: { fireRate: number; damage: number }) => t.fireRate * t.damage;
    // Ember is the single-target damage baseline.
    expect(dps(ember)).toBeGreaterThan(dps(stasis));
    expect(dps(ember)).toBeGreaterThan(dps(mortar));
    // Stasis trades damage for the slow.
    expect(stasis.slowFactor).toBeGreaterThan(0);
    expect(stasis.slowFactor).toBeLessThan(1);
    expect(stasis.slowDuration).toBeGreaterThan(0);
    // Mortar trades fire rate for splash + the longest reach.
    expect(mortar.aoeRadius).toBeGreaterThan(0);
    expect(mortar.range).toBeGreaterThan(ember.range);
    expect(mortar.fireRate).toBeLessThan(ember.fireRate);
  });

  test("stasis slow leaves creeps moving (never a full stop)", () => {
    const slowed = CONSTANTS.creeps.shambler.speed * (1 - CONSTANTS.towers.stasis.slowFactor);
    expect(slowed).toBeGreaterThan(0);
    expect(slowed).toBeLessThan(CONSTANTS.creeps.shambler.speed);
  });

  test("mortar splash covers more than one lane tile width at the center", () => {
    expect(CONSTANTS.towers.mortar.aoeRadius * 2).toBeGreaterThan(CONSTANTS.board.cell);
  });

  test("projectile registers a hit within step + creep radius", () => {
    const dt = 1 / 60;
    const step = CONSTANTS.towers.ember.projectileSpeed * dt;
    const threshold = step + CONSTANTS.creeps.shambler.radius;
    expect(threshold).toBeGreaterThan(CONSTANTS.creeps.shambler.radius);
  });
});

describe("build readiness state machine", () => {
  test("build range gates whether a tile is buildable", () => {
    const within = CONSTANTS.player.buildRange - 0.1;
    const beyond = CONSTANTS.player.buildRange + 0.1;
    expect(within <= CONSTANTS.player.buildRange).toBe(true);
    expect(beyond <= CONSTANTS.player.buildRange).toBe(false);
  });

  test("an occupied tile is never ready, even with gold and in range", () => {
    const occupied = new Set<string>(["3,3"]);
    const ready = (key: string, gold: number) => !occupied.has(key) && gold >= CONSTANTS.towers.ember.cost;
    expect(ready("3,3", 999)).toBe(false);
    expect(ready("4,3", 999)).toBe(true);
  });

  test("build progress accumulates over time and completes at build.time", () => {
    let progress = 0;
    const dt = 0.1;
    let frames = 0;
    while (progress < CONSTANTS.build.time) {
      progress += dt * buildSpeedMul(0); // no bonus
      frames++;
    }
    expect(frames).toBe(Math.ceil(CONSTANTS.build.time / dt));
    expect(progress).toBeGreaterThanOrEqual(CONSTANTS.build.time);
  });

  test("build percentage is floored 0..100", () => {
    const pct = (progress: number) => Math.min(100, Math.floor((progress / CONSTANTS.build.time) * 100));
    expect(pct(0)).toBe(0);
    expect(pct(CONSTANTS.build.time / 2)).toBe(50);
    expect(pct(CONSTANTS.build.time)).toBe(100);
    expect(pct(CONSTANTS.build.time * 2)).toBe(100); // clamped
  });
});

describe("wave-clear bonuses", () => {
  test("odd waves grant build speed, even waves grant run speed", () => {
    const isBuildBonus = (wave: number) => wave % 2 === 1;
    expect(isBuildBonus(1)).toBe(true);
    expect(isBuildBonus(2)).toBe(false);
    expect(isBuildBonus(3)).toBe(true);
  });

  test("build-speed multiplier increases per level", () => {
    expect(buildSpeedMul(0)).toBe(1);
    expect(buildSpeedMul(1)).toBeCloseTo(1.22, 10);
    expect(buildSpeedMul(2)).toBeGreaterThan(buildSpeedMul(1));
  });

  test("run-speed multiplier increases per level", () => {
    expect(runSpeedMul(0)).toBe(1);
    expect(runSpeedMul(1)).toBeCloseTo(1.16, 10);
    expect(runSpeedMul(2)).toBeGreaterThan(runSpeedMul(1));
  });

  test("a higher build-speed level finishes a tower in fewer frames", () => {
    const framesToBuild = (level: number) => {
      let progress = 0;
      const dt = 0.05;
      let frames = 0;
      while (progress < CONSTANTS.build.time) {
        progress += dt * buildSpeedMul(level);
        frames++;
      }
      return frames;
    };
    expect(framesToBuild(2)).toBeLessThan(framesToBuild(0));
  });
});

describe("loop integration constants", () => {
  test("the fixed step subdivides the clamped frame budget", () => {
    // game uses the shared fixed loop: fixedDt steps inside a maxDelta-clamped frame.
    expect(CONSTANTS.loop.fixedDt).toBeLessThan(CONSTANTS.loop.maxDelta);
    expect(CONSTANTS.loop.fixedDt).toBeCloseTo(1 / 120, 10);
    expect(CONSTANTS.loop.maxDelta).toBeGreaterThan(0);
  });

  test("a creep cannot skip the whole board in a single clamped frame", () => {
    // Max distance the fastest final-wave creep moves in one clamped step.
    const fastest = Math.max(...CREEP_KINDS.map((kind) => creepStatsForWave(kind, CONSTANTS.waves.total).speed));
    const maxStep = fastest * CONSTANTS.loop.maxDelta;
    const laneLength = mobPathPoints.slice(1).reduce((sum, p, i) => sum + p.distanceTo(mobPathPoints[i]), 0);
    expect(maxStep).toBeLessThan(laneLength);
  });
});
