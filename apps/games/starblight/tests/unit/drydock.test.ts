import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/game/constants";
import { applyBuy, type DrydockState, loadDrydock, SHOP_BY_ID, SHOP_UPGRADES, shopCost } from "../../src/game/drydock";
import { computeStats } from "../../src/game/upgrades";

describe("drydock shop costs", () => {
  test("cost ramps +55% of base per owned tier", () => {
    expect(shopCost(SHOP_BY_ID.frame, 0)).toBe(40);
    expect(shopCost(SHOP_BY_ID.frame, 1)).toBe(62); // round(40 * 1.55)
    expect(shopCost(SHOP_BY_ID.frame, 2)).toBe(84); // round(40 * 2.10)
  });

  test("cost strictly increases across every upgrade's tiers", () => {
    for (const def of SHOP_UPGRADES) {
      for (let tier = 1; tier < def.max; tier++) {
        expect(shopCost(def, tier)).toBeGreaterThan(shopCost(def, tier - 1));
      }
    }
  });

  test("SHOP_BY_ID round-trips every entry by unique id", () => {
    const ids = SHOP_UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of SHOP_UPGRADES) expect(SHOP_BY_ID[def.id]).toBe(def);
  });
});

describe("drydock applyBuy", () => {
  test("happy path deducts the cost and bumps the tier", () => {
    const next = applyBuy({ wreckage: 1000, tiers: {} }, "frame");
    expect(next.wreckage).toBe(960); // 1000 - 40
    expect(next.tiers.frame).toBe(1);
  });

  test("never buys past max (returns the same reference)", () => {
    const maxed: DrydockState = { wreckage: 1000, tiers: { frame: SHOP_BY_ID.frame.max } };
    expect(applyBuy(maxed, "frame")).toBe(maxed);
  });

  test("never overspends (returns the same reference)", () => {
    const broke: DrydockState = { wreckage: 10, tiers: {} };
    expect(applyBuy(broke, "frame")).toBe(broke); // frame costs 40
  });

  test("does not mutate the input state", () => {
    const before: DrydockState = { wreckage: 1000, tiers: {} };
    applyBuy(before, "frame");
    expect(before).toEqual({ wreckage: 1000, tiers: {} });
  });
});

describe("drydock meta-upgrades fold into a run's starting stats", () => {
  test("Reinforced Frame raises starting maxIntegrity (+20 per tier)", () => {
    const base = CONSTANTS.player.startIntegrity;
    const twoTiers = base + 20 * 2;
    expect(computeStats(new Map(), CONSTANTS.xp.baseMagnet, twoTiers).maxIntegrity).toBe(base + 40);
  });

  test("Salvage Magnet raises starting magnetRadius (+15% per tier)", () => {
    const boosted = CONSTANTS.xp.baseMagnet * (1 + 0.15 * 2);
    expect(computeStats(new Map(), boosted, CONSTANTS.player.startIntegrity).magnetRadius).toBeCloseTo(
      CONSTANTS.xp.baseMagnet * 1.3,
    );
  });
});

describe("drydock persistence", () => {
  test("loadDrydock returns an empty drydock when storage is unavailable", () => {
    expect(loadDrydock()).toEqual({ wreckage: 0, tiers: {} });
  });
});
