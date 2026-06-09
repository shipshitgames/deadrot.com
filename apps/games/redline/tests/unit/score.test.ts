/**
 * REDLINE — score/style system unit tests.
 *
 * Scope: the PURE scoring logic in systems/score.ts (no DOM, no Three.js):
 *   - ember chain build + window decay math
 *   - near-miss detection over hazard crossings
 *   - run-score composition (embers*chain + style + time bonus) and grades
 *   - best-run persistence: legacy-payload migration + record folding
 */

import { describe, expect, test } from "bun:test";

import { COURSE, RUNNER, SCORE, WORLD } from "../../src/constants";
import {
  applyRunRecord,
  bestFor,
  detectNearMisses,
  gradeFor,
  migrateBests,
  type NearMissProbe,
  ScoreSystem,
  timeBonus,
} from "../../src/systems/score";
import type { Hazard } from "../../src/types";

describe("constants — score invariants", () => {
  test("chain band is sane: x1 floor, cap above it, a real decay window", () => {
    expect(SCORE.chainMax).toBeGreaterThan(1);
    expect(SCORE.chainWindow).toBeGreaterThan(0);
    expect(SCORE.emberPoints).toBeGreaterThan(0);
  });

  test("near-miss margins are tight but positive", () => {
    expect(SCORE.nearMissMargin.spike).toBeGreaterThan(0);
    expect(SCORE.nearMissMargin.bar).toBeGreaterThan(0);
    // tighter than the runner is tall — it must be a skim, not a flyover
    expect(SCORE.nearMissMargin.spike).toBeLessThan(RUNNER.height);
    // a grounded upright runner always has barClearance - 2*radius of headroom
    // under a bar; the bar margin must sit below that or plain running farms style
    expect(SCORE.nearMissMargin.bar).toBeLessThan(COURSE.barClearance - 2 * RUNNER.radius);
  });

  test("grade thresholds are strictly descending and end at a C floor of 0", () => {
    for (let i = 1; i < SCORE.grades.length; i++) {
      expect(SCORE.grades[i].min).toBeLessThan(SCORE.grades[i - 1].min);
    }
    expect(SCORE.grades[SCORE.grades.length - 1].min).toBe(0);
  });
});

describe("score — ember chain build", () => {
  test("first ember scores at x1, then the chain heats one step", () => {
    const s = new ScoreSystem();
    expect(s.chain).toBe(1);
    const pts = s.collectEmber();
    expect(pts).toBe(SCORE.emberPoints);
    expect(s.chain).toBe(2);
    expect(s.embers).toBe(1);
    expect(s.emberPoints).toBe(SCORE.emberPoints);
  });

  test("consecutive embers score at the climbing multiplier", () => {
    const s = new ScoreSystem();
    expect(s.collectEmber()).toBe(SCORE.emberPoints * 1);
    expect(s.collectEmber()).toBe(SCORE.emberPoints * 2);
    expect(s.collectEmber()).toBe(SCORE.emberPoints * 3);
    expect(s.emberPoints).toBe(SCORE.emberPoints * 6);
  });

  test("the chain clamps at chainMax no matter how many embers follow", () => {
    const s = new ScoreSystem();
    for (let i = 0; i < SCORE.chainMax + 5; i++) s.collectEmber();
    expect(s.chain).toBe(SCORE.chainMax);
    expect(s.collectEmber()).toBe(SCORE.emberPoints * SCORE.chainMax);
  });

  test("each pickup refreshes the chain window", () => {
    const s = new ScoreSystem();
    s.collectEmber();
    s.update(SCORE.chainWindow * 0.9); // almost expired...
    s.collectEmber(); // ...refreshed
    expect(s.chainTimer).toBeCloseTo(SCORE.chainWindow, 5);
  });
});

describe("score — chain decay", () => {
  test("the multiplier survives inside the window", () => {
    const s = new ScoreSystem();
    s.collectEmber();
    s.collectEmber();
    const hot = s.chain;
    s.update(SCORE.chainWindow * 0.5);
    expect(s.chain).toBe(hot);
  });

  test("the multiplier collapses to x1 once the window runs dry", () => {
    const s = new ScoreSystem();
    s.collectEmber();
    s.collectEmber();
    expect(s.chain).toBeGreaterThan(1);
    s.update(SCORE.chainWindow + 0.01);
    expect(s.chain).toBe(1);
    expect(s.chainTimer).toBe(0);
  });

  test("decay never claws back already-banked ember points", () => {
    const s = new ScoreSystem();
    s.collectEmber();
    s.collectEmber();
    const banked = s.emberPoints;
    s.update(SCORE.chainWindow * 2);
    expect(s.emberPoints).toBe(banked);
  });

  test("chainFrac reports the remaining window for the HUD meter (0 when cold)", () => {
    const s = new ScoreSystem();
    expect(s.chainFrac).toBe(0); // cold chain shows no meter
    s.collectEmber();
    expect(s.chainFrac).toBeCloseTo(1, 5);
    s.update(SCORE.chainWindow / 2);
    expect(s.chainFrac).toBeCloseTo(0.5, 5);
  });

  test("update is a no-op on a cold chain (no negative timers)", () => {
    const s = new ScoreSystem();
    s.update(10);
    expect(s.chain).toBe(1);
    expect(s.chainTimer).toBe(0);
  });
});

describe("score — near-miss detection", () => {
  const spike: Hazard = {
    kind: "spike",
    x: 10,
    width: COURSE.spikeWidth,
    baseY: WORLD.groundY,
    height: COURSE.spikeHeight,
    clearance: 0,
  };
  const bar: Hazard = {
    kind: "bar",
    x: 10,
    width: COURSE.barWidth,
    baseY: WORLD.groundY,
    height: 3.4,
    clearance: COURSE.barClearance,
  };

  /** A probe crossing x=10 with feet `gap` above the spike tip. */
  function spikeProbe(gap: number, overrides: Partial<NearMissProbe> = {}): NearMissProbe {
    return {
      prevX: 9.8,
      x: 10.1,
      y: WORLD.groundY + COURSE.spikeHeight + gap + RUNNER.radius,
      crouch: 1,
      radius: RUNNER.radius,
      staggered: false,
      invulnerable: false,
      ...overrides,
    };
  }

  test("skimming a spike's tip within the margin counts", () => {
    expect(detectNearMisses(spikeProbe(SCORE.nearMissMargin.spike * 0.5), [spike])).toBe(1);
  });

  test("clearing a spike comfortably is not style", () => {
    expect(detectNearMisses(spikeProbe(SCORE.nearMissMargin.spike + 0.5), [spike])).toBe(0);
  });

  test("the margin boundary itself still counts (inclusive)", () => {
    // Exact binary fractions so the boundary comparison has no float drift.
    const margin = 0.25;
    const radius = 0.5;
    const probe: NearMissProbe = {
      prevX: 9.8,
      x: 10.1,
      y: spike.baseY + spike.height + margin + radius, // feet exactly margin above the tip
      crouch: 1,
      radius,
      staggered: false,
      invulnerable: false,
    };
    expect(detectNearMisses(probe, [spike], { spike: margin, bar: margin })).toBe(1);
  });

  test("clipping the hazard (negative clearance) is a hit, never a near miss", () => {
    expect(detectNearMisses(spikeProbe(-0.1), [spike])).toBe(0);
  });

  test("no crossing this step -> no near miss, even when close", () => {
    expect(detectNearMisses(spikeProbe(0.1, { prevX: 4, x: 5 }), [spike])).toBe(0);
  });

  test("staggered or invulnerable passes never count as style", () => {
    expect(detectNearMisses(spikeProbe(0.1, { staggered: true }), [spike])).toBe(0);
    expect(detectNearMisses(spikeProbe(0.1, { invulnerable: true }), [spike])).toBe(0);
  });

  test("threading a bar with the head skimming the underside counts", () => {
    const crouch = RUNNER.dashCrouchScale;
    const barBottom = bar.baseY + bar.clearance;
    // rolled head sits just under the bar
    const probe: NearMissProbe = {
      prevX: 9.8,
      x: 10.1,
      y: barBottom - RUNNER.radius * crouch - SCORE.nearMissMargin.bar * 0.5,
      crouch,
      radius: RUNNER.radius,
      staggered: false,
      invulnerable: false,
    };
    expect(detectNearMisses(probe, [bar])).toBe(1);
  });

  test("an upright grounded pass under a bar is routine, not style", () => {
    // head at groundY + 2*radius leaves barClearance - 2*radius of headroom,
    // which the bar margin is tuned to sit below — no free style from running.
    const probe: NearMissProbe = {
      prevX: 9.8,
      x: 10.1,
      y: WORLD.groundY + RUNNER.radius,
      crouch: 1,
      radius: RUNNER.radius,
      staggered: false,
      invulnerable: false,
    };
    expect(detectNearMisses(probe, [bar])).toBe(0);
  });

  test("rolling low to the ground under a bar (lots of headroom) is not style", () => {
    const crouch = RUNNER.dashCrouchScale;
    const probe: NearMissProbe = {
      prevX: 9.8,
      x: 10.1,
      y: WORLD.groundY + RUNNER.radius * crouch, // rolled along the floor
      crouch,
      radius: RUNNER.radius,
      staggered: false,
      invulnerable: false,
    };
    // only counts if the bar clearance leaves less than the margin of headroom
    const headroom = bar.baseY + bar.clearance - (probe.y + RUNNER.radius * crouch);
    expect(headroom).toBeGreaterThan(SCORE.nearMissMargin.bar);
    expect(detectNearMisses(probe, [bar])).toBe(0);
  });

  test("two hazards crossed in one step can both score", () => {
    const second: Hazard = { ...spike, x: 10.05 };
    expect(detectNearMisses(spikeProbe(0.1), [spike, second])).toBe(2);
  });

  test("addNearMisses banks style points (and ignores zero counts)", () => {
    const s = new ScoreSystem();
    expect(s.addNearMisses(0)).toBe(0);
    expect(s.addNearMisses(2)).toBe(SCORE.nearMissPoints * 2);
    expect(s.nearMisses).toBe(2);
    expect(s.stylePoints).toBe(SCORE.nearMissPoints * 2);
  });
});

describe("score — composition, time bonus & grades", () => {
  test("time bonus: faster is more, floored at zero", () => {
    expect(timeBonus(0)).toBe(SCORE.timeBonusMax);
    expect(timeBonus(10)).toBeLessThan(timeBonus(5));
    const flooredAt = SCORE.timeBonusMax / SCORE.timeBonusPerSecond;
    expect(timeBonus(flooredAt + 1)).toBe(0);
    expect(timeBonus(10_000)).toBe(0);
  });

  test("run score composes embers*chain + style + time bonus", () => {
    const s = new ScoreSystem();
    s.collectEmber(); // x1
    s.collectEmber(); // x2
    s.addNearMisses(1);
    const t = 30;
    expect(s.earned).toBe(SCORE.emberPoints * 3 + SCORE.nearMissPoints);
    expect(s.total(t)).toBe(s.earned + timeBonus(t));

    const summary = s.summary(t);
    expect(summary.total).toBe(s.total(t));
    expect(summary.embers).toBe(2);
    expect(summary.emberPoints).toBe(SCORE.emberPoints * 3);
    expect(summary.nearMisses).toBe(1);
    expect(summary.stylePoints).toBe(SCORE.nearMissPoints);
    expect(summary.timeBonus).toBe(timeBonus(t));
    expect(summary.grade).toBe(gradeFor(summary.total));
  });

  test("letter grades follow the configured thresholds exactly", () => {
    for (const g of SCORE.grades) {
      expect(gradeFor(g.min)).toBe(g.grade);
      expect(gradeFor(g.min + 1)).toBe(g.grade);
    }
    // just under each threshold falls to the next grade down
    for (let i = 0; i < SCORE.grades.length - 1; i++) {
      expect(gradeFor(SCORE.grades[i].min - 1)).toBe(SCORE.grades[i + 1].grade);
    }
    expect(gradeFor(0)).toBe("C");
  });

  test("reset returns the system to a cold start", () => {
    const s = new ScoreSystem();
    s.collectEmber();
    s.addNearMisses(3);
    s.reset();
    expect(s.chain).toBe(1);
    expect(s.chainTimer).toBe(0);
    expect(s.embers).toBe(0);
    expect(s.emberPoints).toBe(0);
    expect(s.nearMisses).toBe(0);
    expect(s.stylePoints).toBe(0);
    expect(s.earned).toBe(0);
  });
});

describe("score — bests persistence & legacy migration", () => {
  test("legacy raw best-time payload migrates into the default seed's slot", () => {
    // hud.ts used to store `localStorage.setItem(key, String(t))`; the store
    // JSON-parses that to a bare number before handing it to migrate.
    const data = migrateBests(23.45);
    const best = bestFor(data, COURSE.seed);
    expect(best.time).toBe(23.45);
    expect(best.score).toBeNull();
  });

  test("garbage / absent legacy payloads migrate to an empty table", () => {
    for (const raw of [null, undefined, "fast", -3, 0, Number.NaN, { v: 1 }]) {
      expect(migrateBests(raw)).toEqual({ bests: {} });
    }
  });

  test("an unknown seed reads as no-record", () => {
    expect(bestFor({ bests: {} }, 42)).toEqual({ time: null, score: null });
  });

  test("first finish sets both records", () => {
    const { next, newBestTime, newBestScore } = applyRunRecord({ bests: {} }, COURSE.seed, 30, 4000);
    expect(newBestTime).toBe(true);
    expect(newBestScore).toBe(true);
    expect(bestFor(next, COURSE.seed)).toEqual({ time: 30, score: 4000 });
  });

  test("records split independently: faster-but-sloppier keeps the old score", () => {
    const start = applyRunRecord({ bests: {} }, COURSE.seed, 30, 4000).next;
    const { next, newBestTime, newBestScore } = applyRunRecord(start, COURSE.seed, 25, 3000);
    expect(newBestTime).toBe(true);
    expect(newBestScore).toBe(false);
    expect(bestFor(next, COURSE.seed)).toEqual({ time: 25, score: 4000 });
  });

  test("a worse run on both axes changes nothing", () => {
    const start = applyRunRecord({ bests: {} }, COURSE.seed, 30, 4000).next;
    const { next, newBestTime, newBestScore } = applyRunRecord(start, COURSE.seed, 40, 1000);
    expect(newBestTime).toBe(false);
    expect(newBestScore).toBe(false);
    expect(bestFor(next, COURSE.seed)).toEqual({ time: 30, score: 4000 });
  });

  test("a migrated legacy best-time still beats slower new runs", () => {
    const migrated = migrateBests(23.45);
    const { next, newBestTime, newBestScore } = applyRunRecord(migrated, COURSE.seed, 28, 5000);
    expect(newBestTime).toBe(false); // legacy 23.45 survives
    expect(newBestScore).toBe(true); // first score ever recorded
    expect(bestFor(next, COURSE.seed)).toEqual({ time: 23.45, score: 5000 });
  });

  test("seeds are tracked independently", () => {
    const a = applyRunRecord({ bests: {} }, 1, 30, 4000).next;
    const b = applyRunRecord(a, 2, 50, 1000).next;
    expect(bestFor(b, 1)).toEqual({ time: 30, score: 4000 });
    expect(bestFor(b, 2)).toEqual({ time: 50, score: 1000 });
  });
});
