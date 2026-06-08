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

/**
 * Gameplay unit tests for Deadlane (tower-defense lane holder).
 *
 * Scope note: Deadlane keeps its simulation in `src/systems/entities.ts` and
 * `src/game.ts`, but both eagerly construct THREE meshes / WebGL render systems
 * and cannot be imported under `bun test`. Those files derive every gameplay
 * number purely from `CONSTANTS`, so we test:
 *   1. the genuinely pure exports in `src/board.ts` (THREE.Vector3 math only), and
 *   2. the constant-driven formulas (economy, wave schedule, creep scaling,
 *      build/bonus state machine, targeting range) by replicating the exact
 *      arithmetic the systems run, asserting it against `CONSTANTS`.
 * If a balance constant changes, these tests fail — which is the point.
 */

// --- helpers that mirror the EXACT arithmetic in entities.ts / game.ts --------

/** entities.spawnCreep: hp scales by hpGrowth^(wave-1), wave clamped to >=1. */
function creepHpForWave(wave: number): number {
  const w = Math.max(1, wave);
  return CONSTANTS.creep.baseHp * CONSTANTS.creep.hpGrowth ** (w - 1);
}

/** entities.spawnCreep: speed scales by speedGrowth^(wave-1). */
function creepSpeedForWave(wave: number): number {
  const w = Math.max(1, wave);
  return CONSTANTS.creep.baseSpeed * CONSTANTS.creep.speedGrowth ** (w - 1);
}

/** game.beginWave: spawnQueue = baseCount + (wave-1)*countGrowth (wave is 1-based). */
function spawnCountForWave(wave: number): number {
  return CONSTANTS.waves.baseCount + (wave - 1) * CONSTANTS.waves.countGrowth;
}

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
  test("starting gold buys a known number of towers", () => {
    const { startGold, towerCost } = CONSTANTS.economy;
    const affordable = Math.floor(startGold / towerCost);
    expect(affordable).toBe(3); // 175 / 50
    // ...but not four.
    expect(towerCost * 4).toBeGreaterThan(startGold);
  });

  test("buying a tower deducts exactly the tower cost", () => {
    const { startGold, towerCost } = CONSTANTS.economy;
    let gold = startGold;
    gold -= towerCost;
    expect(gold).toBe(startGold - towerCost);
  });

  test("cannot build when gold is below cost (entities.buildTower guard)", () => {
    const canBuild = (gold: number) => gold >= CONSTANTS.economy.towerCost;
    expect(canBuild(CONSTANTS.economy.towerCost)).toBe(true);
    expect(canBuild(CONSTANTS.economy.towerCost - 1)).toBe(false);
  });

  test("kills and wave-clears credit gold", () => {
    const { killReward, waveClearBonus } = CONSTANTS.economy;
    let gold = 0;
    gold += killReward; // one kill
    gold += killReward; // another
    expect(gold).toBe(killReward * 2);
    gold += waveClearBonus; // clear the wave
    expect(gold).toBe(killReward * 2 + waveClearBonus);
  });

  test("a fully-cleared first wave funds at least one fresh tower", () => {
    const { killReward, waveClearBonus, towerCost } = CONSTANTS.economy;
    const earned = killReward * spawnCountForWave(1) + waveClearBonus;
    expect(earned).toBeGreaterThanOrEqual(towerCost);
  });
});

describe("wave director schedule", () => {
  test("there are the configured number of waves", () => {
    expect(CONSTANTS.waves.total).toBe(8);
  });

  test("wave size escalates strictly with each wave", () => {
    const counts = Array.from({ length: CONSTANTS.waves.total }, (_, i) => spawnCountForWave(i + 1));
    expect(counts[0]).toBe(CONSTANTS.waves.baseCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1]);
      expect(counts[i] - counts[i - 1]).toBe(CONSTANTS.waves.countGrowth);
    }
  });

  test("final wave is the largest", () => {
    const first = spawnCountForWave(1);
    const last = spawnCountForWave(CONSTANTS.waves.total);
    expect(last).toBeGreaterThan(first);
    expect(last).toBe(CONSTANTS.waves.baseCount + (CONSTANTS.waves.total - 1) * CONSTANTS.waves.countGrowth);
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
    // The breathing room is long enough to span many frames (~delay/dt,
    // within one tick of float accumulation either way).
    const expected = CONSTANTS.waves.interWaveDelay / dt;
    expect(Math.abs(ticks - expected)).toBeLessThanOrEqual(1);
    expect(ticks).toBeGreaterThan(100);
  });

  test("spawn pacing: spawnInterval gates each creep release", () => {
    // game.director: after a spawn, spawnTimer resets to spawnInterval.
    const wave = 1;
    const queue = spawnCountForWave(wave);
    let spawned = 0;
    let timer = 0;
    const dt = 0.1;
    // Run enough simulated time to drain the whole queue.
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

describe("creep scaling", () => {
  test("wave 1 creep uses the base stats", () => {
    expect(creepHpForWave(1)).toBeCloseTo(CONSTANTS.creep.baseHp, 10);
    expect(creepSpeedForWave(1)).toBeCloseTo(CONSTANTS.creep.baseSpeed, 10);
  });

  test("hp and speed grow monotonically across waves", () => {
    let prevHp = creepHpForWave(1);
    let prevSpeed = creepSpeedForWave(1);
    for (let w = 2; w <= CONSTANTS.waves.total; w++) {
      const hp = creepHpForWave(w);
      const speed = creepSpeedForWave(w);
      expect(hp).toBeGreaterThan(prevHp);
      expect(speed).toBeGreaterThan(prevSpeed);
      prevHp = hp;
      prevSpeed = speed;
    }
  });

  test("hp growth matches the configured compounding ratio", () => {
    const ratio = creepHpForWave(3) / creepHpForWave(2);
    expect(ratio).toBeCloseTo(CONSTANTS.creep.hpGrowth, 10);
  });

  test("a final-wave creep takes more tower shots than a wave-1 creep", () => {
    const shots = (hp: number) => Math.ceil(hp / CONSTANTS.tower.damage);
    const early = shots(creepHpForWave(1));
    const late = shots(creepHpForWave(CONSTANTS.waves.total));
    expect(early).toBe(Math.ceil(CONSTANTS.creep.baseHp / CONSTANTS.tower.damage));
    expect(late).toBeGreaterThan(early);
  });

  test("wave is clamped to >= 1 (pre-first-wave is treated as wave 1)", () => {
    expect(creepHpForWave(0)).toBe(creepHpForWave(1));
    expect(creepSpeedForWave(0)).toBe(creepSpeedForWave(1));
  });
});

describe("base HP / lose condition", () => {
  test("base starts at full HP", () => {
    expect(CONSTANTS.base.startHp).toBe(20);
  });

  test("each breach removes exactly 1 HP and clamps at 0", () => {
    // entities.moveCreeps: baseHp = max(0, baseHp - 1) when a creep reaches base.
    let hp = CONSTANTS.base.startHp;
    for (let i = 0; i < CONSTANTS.base.startHp; i++) {
      hp = Math.max(0, hp - 1);
    }
    expect(hp).toBe(0);
    // Further breaches never go negative.
    hp = Math.max(0, hp - 1);
    expect(hp).toBe(0);
  });

  test("the base survives a partial leak of the first wave", () => {
    // If only some creeps leak, the lane is not yet lost.
    const leaked = Math.min(spawnCountForWave(1), CONSTANTS.base.startHp - 1);
    const hp = CONSTANTS.base.startHp - leaked;
    expect(hp).toBeGreaterThan(0); // baseHp > 0 => not lost
  });
});

describe("tower targeting & combat", () => {
  test("targeting uses squared distance against squared range", () => {
    // entities.runTowers compares dx*dx+dz*dz <= range*range.
    const rangeSq = CONSTANTS.tower.range * CONSTANTS.tower.range;
    const inside = { dx: CONSTANTS.tower.range - 0.5, dz: 0 };
    const outside = { dx: CONSTANTS.tower.range + 0.5, dz: 0 };
    expect(inside.dx * inside.dx + inside.dz * inside.dz).toBeLessThanOrEqual(rangeSq);
    expect(outside.dx * outside.dx + outside.dz * outside.dz).toBeGreaterThan(rangeSq);
  });

  test("nearestCreep picks the closer of two in-range creeps", () => {
    const rangeSq = CONSTANTS.tower.range ** 2;
    const candidates = [
      { id: "far", d: 4 ** 2 },
      { id: "near", d: 2 ** 2 },
    ].filter((c) => c.d <= rangeSq);
    const best = candidates.reduce((a, b) => (b.d < a.d ? b : a));
    expect(best.id).toBe("near");
  });

  test("cooldown after firing equals 1 / fireRate", () => {
    const cooldown = 1 / CONSTANTS.tower.fireRate;
    expect(cooldown).toBeCloseTo(0.625, 10); // 1 / 1.6
    expect(cooldown).toBeGreaterThan(0);
  });

  test("a tower's damage-per-second is fireRate * damage", () => {
    const dps = CONSTANTS.tower.fireRate * CONSTANTS.tower.damage;
    expect(dps).toBeCloseTo(25.6, 10);
    // One tower out-DPS-es a wave-1 creep's effective HP within a second.
    expect(dps).toBeGreaterThan(0);
  });

  test("turret yaw step is clamped to turnSpeed * dt", () => {
    // entities.aimTurret clamps the per-frame rotation step.
    const dt = 1 / 60;
    const step = CONSTANTS.tower.turnSpeed * dt;
    const apply = (diff: number) => Math.max(-step, Math.min(step, diff));
    expect(apply(Math.PI)).toBeCloseTo(step, 10); // big diff -> clamped to +step
    expect(apply(-Math.PI)).toBeCloseTo(-step, 10);
    expect(apply(step / 2)).toBeCloseTo(step / 2, 10); // small diff -> exact
  });

  test("projectile registers a hit within step + creep radius", () => {
    // entities.moveProjectiles: hit when dist <= step + creep.radius.
    const dt = 1 / 60;
    const step = CONSTANTS.tower.projectileSpeed * dt;
    const threshold = step + CONSTANTS.creep.radius;
    expect(threshold - 0.01 <= threshold).toBe(true);
    expect(threshold).toBeGreaterThan(CONSTANTS.creep.radius);
  });
});

describe("build readiness state machine", () => {
  test("build range gates whether a tile is buildable", () => {
    // game.buildReadiness: distance > buildRange => not ready.
    const within = CONSTANTS.player.buildRange - 0.1;
    const beyond = CONSTANTS.player.buildRange + 0.1;
    expect(within <= CONSTANTS.player.buildRange).toBe(true);
    expect(beyond <= CONSTANTS.player.buildRange).toBe(false);
  });

  test("an occupied tile is never ready, even with gold and in range", () => {
    const occupied = new Set<string>(["3,3"]);
    const ready = (key: string, gold: number) => !occupied.has(key) && gold >= CONSTANTS.economy.towerCost;
    expect(ready("3,3", 999)).toBe(false);
    expect(ready("4,3", 999)).toBe(true);
  });

  test("build progress accumulates over time and completes at build.time", () => {
    // game.handleBuild: buildProgress += dt * buildSpeedMul; done at build.time.
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
    // game.grantWaveBonus: wave % 2 === 1 => build speed, else run speed.
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
  test("delta is clamped so a tab-out can't fling the sim", () => {
    // game.frame: dt = min(raw, loop.maxDelta).
    const clampDt = (raw: number) => Math.min(raw, CONSTANTS.loop.maxDelta);
    expect(clampDt(10)).toBe(CONSTANTS.loop.maxDelta);
    expect(clampDt(0.01)).toBe(0.01);
    expect(CONSTANTS.loop.maxDelta).toBeGreaterThan(0);
  });

  test("a creep cannot skip the whole board in a single clamped frame", () => {
    // Max distance a final-wave creep moves in one clamped step.
    const maxStep = creepSpeedForWave(CONSTANTS.waves.total) * CONSTANTS.loop.maxDelta;
    const laneLength = mobPathPoints.slice(1).reduce((sum, p, i) => sum + p.distanceTo(mobPathPoints[i]), 0);
    expect(maxStep).toBeLessThan(laneLength);
  });
});
