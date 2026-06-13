import assert from "node:assert/strict";
import { test } from "node:test";

import { createInitialWorld } from "./map";
import type { ResourceBag } from "./types";
import { WAR_EFFORT } from "./types";
import { NEUTRAL_WAR_EFFORT, warEffortBonus, warEffortPool } from "./warEffort";

function bag(partial: Partial<ResourceBag>): ResourceBag {
  return { scrap: 0, biomass: 0, fuel: 0, intel: 0, ...partial };
}

test("warEffortPool sums every resource and floors at zero", () => {
  assert.equal(warEffortPool(bag({ scrap: 10, biomass: 20, fuel: 30, intel: 40 })), 100);
  // Negative members (should never happen, but be defensive) never produce a negative pool.
  assert.equal(warEffortPool(bag({ scrap: -1000 })), 0);
});

test("an empty pool is the neutral bonus — exactly 1x, tier 0", () => {
  const b = warEffortBonus({ resources: bag({}) });
  assert.equal(b.total, 0);
  assert.equal(b.tier, 0);
  assert.equal(b.damageMult, 1);
  assert.equal(b.progress, 0);
  assert.deepEqual(b, NEUTRAL_WAR_EFFORT);
});

test("each unitPerTier raises the tier by one and adds perTier damage", () => {
  const oneTier = warEffortBonus({ resources: bag({ scrap: WAR_EFFORT.unitPerTier }) });
  assert.equal(oneTier.tier, 1);
  assert.ok(Math.abs(oneTier.damageMult - (1 + WAR_EFFORT.perTier)) < 1e-9);

  const threeTiers = warEffortBonus({ resources: bag({ fuel: WAR_EFFORT.unitPerTier * 3 }) });
  assert.equal(threeTiers.tier, 3);
  assert.ok(Math.abs(threeTiers.damageMult - (1 + 3 * WAR_EFFORT.perTier)) < 1e-9);
});

test("the bonus is monotonic non-decreasing in the pool", () => {
  let prev = -1;
  for (let total = 0; total <= WAR_EFFORT.unitPerTier * (WAR_EFFORT.maxTier + 4); total += 777) {
    const m = warEffortBonus({ resources: bag({ scrap: total }) }).damageMult;
    assert.ok(m >= prev, `damageMult dipped at total=${total}: ${m} < ${prev}`);
    prev = m;
  }
});

test("the bonus is hard-capped at maxTier and progress saturates to 1", () => {
  const huge = warEffortBonus({ resources: bag({ scrap: WAR_EFFORT.unitPerTier * (WAR_EFFORT.maxTier + 10) }) });
  assert.equal(huge.tier, WAR_EFFORT.maxTier);
  assert.ok(Math.abs(huge.damageMult - (1 + WAR_EFFORT.maxTier * WAR_EFFORT.perTier)) < 1e-9);
  assert.equal(huge.progress, 1);
});

test("progress reports the fraction toward the next tier", () => {
  const half = warEffortBonus({ resources: bag({ scrap: WAR_EFFORT.unitPerTier * 1.5 }) });
  assert.equal(half.tier, 1);
  assert.ok(Math.abs(half.progress - 0.5) < 1e-9);
});

test("accepts a full WorldState slice (initial world has a positive pool)", () => {
  const b = warEffortBonus(createInitialWorld(1_700_000_000_000));
  // Seed pool is scrap500+biomass200+fuel300+intel150 = 1150 < unitPerTier → tier 0.
  assert.equal(b.total, 1150);
  assert.equal(b.tier, 0);
  assert.equal(b.damageMult, 1);
});
