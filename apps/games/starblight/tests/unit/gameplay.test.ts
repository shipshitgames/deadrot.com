import { describe, expect, test } from "bun:test";
import { CONSTANTS, ENEMIES, type EnemyType, SPITTER, WORLD } from "../../src/game/constants";
import {
  ALL_UPGRADES,
  atLevel,
  computeStats,
  defOf,
  maxLevelOf,
  PASSIVES,
  type PassiveId,
  type UpgradeId,
  WEAPONS,
  type WeaponId,
  xpForLevel,
} from "../../src/game/upgrades";

// These tests import ONLY the pure data/logic modules (constants.ts, upgrades.ts),
// neither of which imports THREE, assets, CSS, or DOM. The director/leveling
// formulas that live inside Game.ts (which is render-entangled) are replicated
// here as the small pure helpers below and asserted against the canonical
// CONSTANTS tunables so the tests track real gameplay behavior.

// --- Pure helpers mirroring Game.ts gameplay math (kept in lockstep) --------

/** Director spawn interval: shrinks with clock, never below the floor. (Game.ts:275) */
function spawnInterval(clock: number): number {
  const d = CONSTANTS.director;
  return Math.max(d.spawnFloor, d.spawnBase - clock * d.spawnSlope);
}

/** Director batch size: grows in steps, capped. (Game.ts:278) */
function spawnBatch(clock: number): number {
  const d = CONSTANTS.director;
  return Math.min(d.batchCap, d.batchBase + Math.floor(clock / d.batchPer));
}

/** Alive-cap ramp from aliveMin to aliveMax over aliveRampTime. (Game.ts:269) */
function aliveCap(clock: number): number {
  const d = CONSTANTS.director;
  const ramp = Math.min(1, clock / d.aliveRampTime);
  return d.aliveMin + (d.aliveMax - d.aliveMin) * ramp;
}

/** Enemy HP multiplier from elapsed clock. (Game.ts:341) */
function hpMul(clock: number): number {
  return 1 + clock * CONSTANTS.director.hpSlope;
}

/** Enemy speed multiplier, capped. (Game.ts:342) */
function speedMul(clock: number): number {
  const d = CONSTANTS.director;
  return Math.min(d.speedCap, 1 + clock * d.speedSlope);
}

/** Frame-delta clamp from the run loop. (Game.ts:183) */
function clampDelta(dt: number): number {
  return Math.min(dt, CONSTANTS.maxDelta);
}

/** Total XP to climb from level 1 up to (but not into) `target`. */
function cumulativeXp(target: number): number {
  let total = 0;
  for (let lv = 1; lv < target; lv++) total += xpForLevel(lv);
  return total;
}

/** Replicates Game.gainXp leveling: consume XP, count levels gained. (Game.ts:448) */
function applyXp(
  start: { level: number; currentXP: number },
  raw: number,
  xpGainMul: number,
): { level: number; currentXP: number; pendingLevels: number } {
  let { level, currentXP } = start;
  currentXP += raw * xpGainMul;
  let pendingLevels = 0;
  while (currentXP >= xpForLevel(level)) {
    currentXP -= xpForLevel(level);
    level++;
    pendingLevels++;
  }
  return { level, currentXP, pendingLevels };
}

// ---------------------------------------------------------------------------

describe("Starblight director — time-driven escalation", () => {
  test("spawn interval shrinks as the run progresses", () => {
    const early = spawnInterval(0);
    const mid = spawnInterval(40);
    const late = spawnInterval(120);
    expect(early).toBe(CONSTANTS.director.spawnBase);
    expect(mid).toBeLessThan(early);
    expect(late).toBeLessThan(mid);
  });

  test("spawn interval never drops below the floor (protects pacing)", () => {
    // Far past the point where the linear term would go negative.
    expect(spawnInterval(100_000)).toBe(CONSTANTS.director.spawnFloor);
    // Verify the floor actually bites: base - slope*clock would be negative here.
    const d = CONSTANTS.director;
    expect(d.spawnBase - 100_000 * d.spawnSlope).toBeLessThan(d.spawnFloor);
  });

  test("spawn batch escalates in integer steps and caps", () => {
    expect(spawnBatch(0)).toBe(CONSTANTS.director.batchBase);
    // After one batchPer window, the batch has grown by exactly one.
    expect(spawnBatch(CONSTANTS.director.batchPer)).toBe(CONSTANTS.director.batchBase + 1);
    expect(spawnBatch(CONSTANTS.director.batchPer * 2)).toBe(CONSTANTS.director.batchBase + 2);
    // Monotonic non-decreasing.
    expect(spawnBatch(50)).toBeGreaterThanOrEqual(spawnBatch(10));
    // Hard cap holds.
    expect(spawnBatch(100_000)).toBe(CONSTANTS.director.batchCap);
  });

  test("alive-cap ramps from min at t=0 to max at the ramp time, then holds", () => {
    const d = CONSTANTS.director;
    expect(aliveCap(0)).toBe(d.aliveMin);
    expect(aliveCap(d.aliveRampTime)).toBe(d.aliveMax);
    // Halfway through the ramp sits at the midpoint.
    expect(aliveCap(d.aliveRampTime / 2)).toBeCloseTo((d.aliveMin + d.aliveMax) / 2, 6);
    // Clamped past the ramp — never exceeds max.
    expect(aliveCap(d.aliveRampTime * 10)).toBe(d.aliveMax);
    expect(d.aliveMax).toBeGreaterThan(d.aliveMin);
  });

  test("enemy HP scales up unbounded with clock", () => {
    expect(hpMul(0)).toBe(1);
    expect(hpMul(100)).toBeGreaterThan(hpMul(10));
    expect(hpMul(20)).toBeCloseTo(1 + 20 * CONSTANTS.director.hpSlope, 6);
  });

  test("enemy speed scales but is hard-capped (so chasers stay outrunnable)", () => {
    const d = CONSTANTS.director;
    expect(speedMul(0)).toBe(1);
    expect(speedMul(10)).toBeGreaterThan(1);
    expect(speedMul(100_000)).toBe(d.speedCap);
    // The cap is reachable only well into a run, and exceeds 1.
    expect(d.speedCap).toBeGreaterThan(1);
  });

  test("the boss warps in only after a long survival window", () => {
    expect(CONSTANTS.boss.spawnAt).toBeGreaterThan(120);
    // Boss arrives well after enemies have meaningfully escalated.
    expect(speedMul(CONSTANTS.boss.spawnAt)).toBeGreaterThan(1.5);
  });

  test("boss phase thresholds are ordered (full > phase2 > phase3 > 0)", () => {
    const b = CONSTANTS.boss;
    expect(b.phase2Pct).toBeLessThan(1);
    expect(b.phase3Pct).toBeLessThan(b.phase2Pct);
    expect(b.phase3Pct).toBeGreaterThan(0);
    expect(b.baseHP).toBeGreaterThan(0);
  });
});

describe("Starblight loop / movement clamps", () => {
  test("frame delta is clamped so a stutter cannot teleport entities", () => {
    expect(clampDelta(0.001)).toBe(0.001);
    expect(clampDelta(5)).toBe(CONSTANTS.maxDelta);
    expect(clampDelta(CONSTANTS.maxDelta)).toBe(CONSTANTS.maxDelta);
    expect(CONSTANTS.maxDelta).toBeCloseTo(1 / 30, 6);
  });

  test("the play-field is a square arena with consistent half-extents", () => {
    expect(WORLD.width).toBe(WORLD.height);
    expect(WORLD.halfW).toBe(WORLD.width / 2);
    expect(WORLD.halfH).toBe(WORLD.height / 2);
    expect(WORLD.loreId).toBe("skyhook");
  });

  test("ship is clamped inside the world border by edgeMargin", () => {
    const lim = WORLD.halfW - CONSTANTS.player.edgeMargin;
    expect(lim).toBeLessThan(WORLD.halfW);
    expect(lim).toBeGreaterThan(0);
  });

  test("base movement tunables are coherent (top speed reachable, deadzone small)", () => {
    const p = CONSTANTS.player;
    expect(p.maxSpeed).toBeGreaterThan(0);
    expect(p.accel).toBeGreaterThan(0);
    expect(p.drag).toBeGreaterThan(0);
    expect(p.drag).toBeLessThan(1); // coasting decays velocity
    expect(p.followDeadzone).toBeGreaterThan(0);
    expect(p.startIntegrity).toBe(100);
    expect(p.invulnTime).toBeGreaterThan(0);
  });
});

describe("Starblight enemy archetypes", () => {
  const types: EnemyType[] = ["grunt", "swarmling", "weaver", "spitter", "elite"];

  test("every archetype is defined with positive combat stats", () => {
    for (const t of types) {
      const e = ENEMIES[t];
      expect(e).toBeDefined();
      expect(e.baseHP).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.contactDmg).toBeGreaterThan(0);
      expect(e.gem).toBeGreaterThan(0);
      expect(e.size).toBeGreaterThan(0);
    }
  });

  test("swarmlings are the fastest, fragile chaff; elites are slow, tanky payouts", () => {
    expect(ENEMIES.swarmling.speed).toBeGreaterThan(ENEMIES.grunt.speed);
    expect(ENEMIES.swarmling.baseHP).toBe(1); // dies to a single bolt
    // Elite is the slowest archetype but the biggest gem reward and hardest hit.
    const slowest = Math.min(...types.map((t) => ENEMIES[t].speed));
    expect(ENEMIES.elite.speed).toBe(slowest);
    expect(ENEMIES.elite.gem).toBe(Math.max(...types.map((t) => ENEMIES[t].gem)));
    expect(ENEMIES.elite.contactDmg).toBe(Math.max(...types.map((t) => ENEMIES[t].contactDmg)));
  });

  test("only the spitter is ranged; its bullet is weaker than its contact", () => {
    expect(ENEMIES.spitter.behavior).toBe("spit");
    expect(ENEMIES.grunt.behavior).toBe("chase");
    expect(ENEMIES.weaver.behavior).toBe("weave");
    expect(SPITTER.range).toBeGreaterThan(0);
    expect(SPITTER.fireEvery).toBeGreaterThan(0);
    expect(SPITTER.bulletSpeed).toBeGreaterThan(0);
    expect(SPITTER.bulletDmg).toBeGreaterThan(0);
    // A spitter shot stings less than ramming it.
    expect(SPITTER.bulletDmg).toBeLessThan(ENEMIES.spitter.contactDmg);
  });

  test("the elite reward dwarfs trash mobs (incentivizing the risk)", () => {
    expect(ENEMIES.elite.gem).toBeGreaterThanOrEqual(ENEMIES.grunt.gem * 10);
  });
});

describe("Starblight XP curve & leveling", () => {
  test("xpForLevel grows strictly with level", () => {
    for (let lv = 1; lv < 30; lv++) {
      expect(xpForLevel(lv + 1)).toBeGreaterThan(xpForLevel(lv));
    }
  });

  test("xpForLevel matches the documented quadratic formula", () => {
    // 6 + level*4 + level^2*0.7, floored.
    expect(xpForLevel(1)).toBe(Math.floor(6 + 1 * 4 + 1 * 1 * 0.7));
    expect(xpForLevel(5)).toBe(Math.floor(6 + 5 * 4 + 25 * 0.7));
    expect(xpForLevel(10)).toBe(Math.floor(6 + 10 * 4 + 100 * 0.7));
  });

  test("a single gem under the threshold accrues XP without leveling", () => {
    const need = xpForLevel(1);
    const out = applyXp({ level: 1, currentXP: 0 }, need - 1, 1);
    expect(out.level).toBe(1);
    expect(out.pendingLevels).toBe(0);
    expect(out.currentXP).toBe(need - 1);
  });

  test("exactly the threshold worth of XP levels up once and resets the bar", () => {
    const need = xpForLevel(1);
    const out = applyXp({ level: 1, currentXP: 0 }, need, 1);
    expect(out.level).toBe(2);
    expect(out.pendingLevels).toBe(1);
    expect(out.currentXP).toBe(0);
  });

  test("a huge XP dump can chain multiple levels in one pickup", () => {
    // Enough to vault from level 1 into level 4 (consumes L1+L2+L3 thresholds).
    const dump = cumulativeXp(4);
    const out = applyXp({ level: 1, currentXP: 0 }, dump, 1);
    expect(out.level).toBe(4);
    expect(out.pendingLevels).toBe(3);
    expect(out.currentXP).toBe(0);
  });

  test("BIOMASS SIPHON multiplies XP gain, leveling the pilot faster", () => {
    const need = xpForLevel(1);
    // Half the raw XP needed, but a 2x siphon multiplier still hits the threshold.
    const half = Math.ceil(need / 2);
    const without = applyXp({ level: 1, currentXP: 0 }, half, 1);
    const withSiphon = applyXp({ level: 1, currentXP: 0 }, half, 2);
    expect(without.level).toBe(1);
    expect(withSiphon.level).toBe(2);
  });
});

describe("Starblight buildcraft — weapons & passives", () => {
  test("every weapon's per-level arrays are exactly maxLevel long", () => {
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const w = WEAPONS[id];
      expect(w.damage.length).toBe(w.maxLevel);
      for (const arr of [w.interval, w.count, w.radius, w.pierce, w.width, w.length, w.knockback]) {
        if (arr) expect(arr.length).toBe(w.maxLevel);
      }
    }
  });

  test("weapon damage is monotonically non-decreasing across levels", () => {
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const dmg = WEAPONS[id].damage;
      for (let i = 1; i < dmg.length; i++) {
        expect(dmg[i]).toBeGreaterThanOrEqual(dmg[i - 1]);
      }
    }
  });

  test("weapon fire intervals shrink with level (faster firing)", () => {
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const iv = WEAPONS[id].interval;
      if (!iv) continue;
      for (let i = 1; i < iv.length; i++) {
        expect(iv[i]).toBeLessThanOrEqual(iv[i - 1]);
      }
    }
  });

  test("maxLevelOf resolves both weapons and passives", () => {
    expect(maxLevelOf("seeker")).toBe(WEAPONS.seeker.maxLevel);
    expect(maxLevelOf("hull")).toBe(PASSIVES.hull.max);
  });

  test("defOf returns the matching definition for any upgrade id", () => {
    expect(defOf("nova").kind).toBe("weapon");
    expect(defOf("reactor").kind).toBe("passive");
    expect((defOf("seeker") as { id: UpgradeId }).id).toBe("seeker");
  });

  test("ALL_UPGRADES is the full draftable pool with unique ids", () => {
    const ids = ALL_UPGRADES.map((u) => u.id);
    expect(ids.length).toBe(Object.keys(WEAPONS).length + Object.keys(PASSIVES).length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("atLevel reads per-level arrays and clamps past the end", () => {
    const dmg = WEAPONS.seeker.damage; // length 7
    expect(atLevel(dmg, 1)).toBe(dmg[0]);
    expect(atLevel(dmg, 3)).toBe(dmg[2]);
    expect(atLevel(dmg, 7)).toBe(dmg[6]);
    // Past the array end clamps to the last entry instead of returning undefined.
    expect(atLevel(dmg, 99)).toBe(dmg[6]);
    // Missing/empty arrays fall back to the provided default.
    expect(atLevel(undefined, 3, -1)).toBe(-1);
    expect(atLevel([], 3, 42)).toBe(42);
  });
});

describe("Starblight derived stats from passive levels", () => {
  const base = () => computeStats(new Map(), CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);

  test("with no passives, every multiplier is neutral and bases pass through", () => {
    const s = base();
    expect(s.damageMul).toBe(1);
    expect(s.fireRateMul).toBe(1);
    expect(s.moveMul).toBe(1);
    expect(s.accelMul).toBe(1);
    expect(s.critChance).toBe(0);
    expect(s.areaMul).toBe(1);
    expect(s.xpGainMul).toBe(1);
    expect(s.maxIntegrity).toBe(CONSTANTS.player.startIntegrity);
    expect(s.magnetRadius).toBe(CONSTANTS.xp.baseMagnet);
  });

  test("FOCUSING COILS add +25% damage per level", () => {
    const lv = new Map<UpgradeId, number>([["focusingcoils", 3]]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.damageMul).toBeCloseTo(1 + 0.25 * 3, 6);
  });

  test("REINFORCED HULL adds +25 max integrity per level", () => {
    const lv = new Map<UpgradeId, number>([["hull", 4]]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.maxIntegrity).toBe(CONSTANTS.player.startIntegrity + 25 * 4);
  });

  test("ION THRUSTERS raise both move and accel multipliers", () => {
    const lv = new Map<UpgradeId, number>([["thrusters", 5]]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.moveMul).toBeCloseTo(1 + 0.12 * 5, 6);
    expect(s.accelMul).toBeCloseTo(1 + 0.15 * 5, 6);
  });

  test("SALVAGE SCOOP scales magnet radius off the base, not absolutely", () => {
    const lv = new Map<UpgradeId, number>([["scoop", 2]]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.magnetRadius).toBeCloseTo(CONSTANTS.xp.baseMagnet * (1 + 0.45 * 2), 6);
  });

  test("PHASE FOCUSING grants crit chance and blast area together", () => {
    const lv = new Map<UpgradeId, number>([["focusing", 2]]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.critChance).toBeCloseTo(0.12 * 2, 6);
    expect(s.areaMul).toBeCloseTo(1 + 0.1 * 2, 6);
  });

  test("OVERCLOCKED REACTOR and BIOMASS SIPHON stack their own multipliers", () => {
    const lv = new Map<UpgradeId, number>([
      ["reactor", 2],
      ["siphon", 3],
    ]);
    const s = computeStats(lv, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.fireRateMul).toBeCloseTo(1 + 0.18 * 2, 6);
    expect(s.xpGainMul).toBeCloseTo(1 + 0.2 * 3, 6);
  });

  test("maxing every passive compounds correctly and stays internally consistent", () => {
    const maxed = new Map<UpgradeId, number>(
      (Object.keys(PASSIVES) as PassiveId[]).map((id) => [id, PASSIVES[id].max]),
    );
    const s = computeStats(maxed, CONSTANTS.xp.baseMagnet, CONSTANTS.player.startIntegrity);
    expect(s.damageMul).toBeCloseTo(1 + 0.25 * 5, 6);
    expect(s.maxIntegrity).toBe(CONSTANTS.player.startIntegrity + 25 * 5);
    expect(s.magnetRadius).toBeGreaterThan(CONSTANTS.xp.baseMagnet);
    expect(s.critChance).toBeCloseTo(0.6, 6);
  });
});
