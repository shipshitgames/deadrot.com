import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RUN_GOLD_CAP,
  runGold,
  SHOP_BY_ID,
  SHOP_TOTAL_TIERS,
  SHOP_UPGRADES,
  shopCost,
  shopRemainingCost,
  shopTiersOwned,
  shopTotalCost,
  shopUpgradeCost,
} from "../../src/game/data/survivors";
import { loadShop, type ShopState, saveShop } from "../../src/game/storage";

// A map with every shop upgrade pushed to its max tier.
function fullyMaxedTiers(): Record<string, number> {
  return Object.fromEntries(SHOP_UPGRADES.map((def) => [def.id, def.max]));
}

describe("gold-shop economy (#277)", () => {
  describe("core invariant: one run cannot buy out the shop", () => {
    it("hard-caps a single run's gold well below the full shop cost", () => {
      const total = shopTotalCost();
      expect(RUN_GOLD_CAP).toBeLessThan(total);
      // The cap should be a real fraction — not 'basically the whole shop'.
      expect(RUN_GOLD_CAP).toBeLessThan(total * 0.5);
    });

    it("never pays out more than the cap, even for an absurd run", () => {
      expect(runGold(1_000_000, 1_000_000, 1_000_000, 999)).toBe(RUN_GOLD_CAP);
      // Sweep a wide range of plausible-to-extreme runs: none may exceed the cap.
      for (const kills of [0, 50, 200, 600, 2000]) {
        for (const level of [1, 20, 60, 200]) {
          for (const time of [30, 300, 900, 5000]) {
            for (const greed of [0, 2, 4, 10]) {
              expect(runGold(kills, level, time, greed)).toBeLessThanOrEqual(RUN_GOLD_CAP);
            }
          }
        }
      }
    });

    it("cannot complete the shop in a single max-gold run via the real buy loop", () => {
      // Seed the wallet with the most a single run could ever yield, then greedily
      // buy every affordable next tier until nothing is affordable.
      const tiers: Record<string, number> = {};
      let gold = RUN_GOLD_CAP;
      let bought = true;
      while (bought) {
        bought = false;
        for (const def of SHOP_UPGRADES) {
          const tier = tiers[def.id] ?? 0;
          if (tier >= def.max) continue;
          const cost = shopCost(def, tier);
          if (gold >= cost) {
            gold -= cost;
            tiers[def.id] = tier + 1;
            bought = true;
          }
        }
      }
      // Some upgrades must remain unfinished and gold still owed.
      expect(shopTiersOwned(tiers)).toBeLessThan(SHOP_TOTAL_TIERS);
      expect(shopRemainingCost(tiers)).toBeGreaterThan(0);
    });
  });

  describe("runGold", () => {
    it("returns 0 for an empty run and clamps negatives to 0", () => {
      expect(runGold(0, 0, 0, 0)).toBe(0);
      expect(runGold(-100, -100, -100, 0)).toBe(0);
      expect(runGold(10, 10, 10, -5)).toBeGreaterThanOrEqual(0);
    });

    it("rewards more kills, level, and survival time monotonically", () => {
      expect(runGold(200, 20, 300, 0)).toBeGreaterThan(runGold(100, 20, 300, 0)); // kills
      expect(runGold(100, 40, 300, 0)).toBeGreaterThan(runGold(100, 20, 300, 0)); // level
      expect(runGold(100, 20, 600, 0)).toBeGreaterThan(runGold(100, 20, 300, 0)); // time
    });

    it("greed tiers increase payout (until the cap)", () => {
      expect(runGold(120, 15, 300, 4)).toBeGreaterThan(runGold(120, 15, 300, 0));
      expect(runGold(120, 15, 300, 2)).toBeGreaterThan(runGold(120, 15, 300, 0));
    });

    it("advertises the exact greed bonus the formula applies (#277)", () => {
      // base = 200*5 = 1000 (under RUN_GOLD_CAP) keeps the per-tier ratio clean.
      const noGreed = runGold(0, 200, 0, 0);
      const oneTier = runGold(0, 200, 0, 1);
      expect(noGreed).toBe(1000);
      expect(oneTier).toBeGreaterThan(noGreed);
      // Effective per-tier bonus in whole percent, derived straight from runGold.
      const pct = Math.round(((oneTier - noGreed) / noGreed) * 100);
      expect(pct).toBeGreaterThan(0);
      // The shop card renders greed.desc verbatim, so the advertised percentage
      // must equal the bonus the formula actually pays — they cannot drift apart.
      expect(SHOP_BY_ID.greed.desc).toContain(`+${pct}% gold`);
    });

    it("keeps the documented progression relations from the legacy suite", () => {
      expect(runGold(50, 8, 180, 0)).toBeGreaterThan(runGold(20, 4, 90, 0));
      expect(runGold(50, 8, 180, 2)).toBeGreaterThan(runGold(50, 8, 180, 0));
    });

    it("lands a typical 5-minute run in the documented band", () => {
      // ~120 kills, level 15, 300s, no greed -> a few hundred gold, far from the cap.
      const typical = runGold(120, 15, 300, 0);
      expect(typical).toBeGreaterThan(150);
      expect(typical).toBeLessThan(RUN_GOLD_CAP);
      // A whole typical run buys at most a small slice of the full armory.
      expect(typical).toBeLessThan(shopTotalCost() * 0.15);
    });
  });

  describe("shopCost escalation", () => {
    it("charges the base cost for the first tier", () => {
      for (const def of SHOP_UPGRADES) {
        expect(shopCost(def, 0)).toBe(def.baseCost);
      }
    });

    it("strictly increases with each owned tier", () => {
      for (const def of SHOP_UPGRADES) {
        for (let tier = 0; tier < def.max; tier++) {
          expect(shopCost(def, tier + 1)).toBeGreaterThan(shopCost(def, tier));
        }
      }
    });

    it("treats negative tiers as the base tier (defensive)", () => {
      for (const def of SHOP_UPGRADES) {
        expect(shopCost(def, -3)).toBe(def.baseCost);
      }
    });
  });

  describe("cost helpers", () => {
    it("shopUpgradeCost sums every per-tier cost to max", () => {
      for (const def of SHOP_UPGRADES) {
        let sum = 0;
        for (let tier = 0; tier < def.max; tier++) sum += shopCost(def, tier);
        expect(shopUpgradeCost(def, 0)).toBe(sum);
      }
    });

    it("shopUpgradeCost is 0 once an upgrade is maxed and respects fromTier", () => {
      const might = SHOP_BY_ID.might;
      expect(shopUpgradeCost(might, might.max)).toBe(0);
      expect(shopUpgradeCost(might, might.max + 5)).toBe(0);
      expect(shopUpgradeCost(might, 1)).toBeLessThan(shopUpgradeCost(might, 0));
    });

    it("shopTotalCost equals remaining-from-empty and the sum of all upgrades", () => {
      const sum = SHOP_UPGRADES.reduce((acc, def) => acc + shopUpgradeCost(def, 0), 0);
      expect(shopTotalCost()).toBe(sum);
      expect(shopRemainingCost({})).toBe(shopTotalCost());
      // Sanity floor: the armory is a long-haul goal.
      expect(shopTotalCost()).toBeGreaterThan(3000);
    });

    it("shopRemainingCost reaches 0 only when everything is maxed and shrinks as you buy", () => {
      expect(shopRemainingCost(fullyMaxedTiers())).toBe(0);
      const partial = { might: 2, vigor: 1 };
      expect(shopRemainingCost(partial)).toBeLessThan(shopTotalCost());
      expect(shopRemainingCost(partial)).toBeGreaterThan(0);
    });
  });

  describe("tier accounting", () => {
    it("SHOP_TOTAL_TIERS equals the sum of every upgrade's max", () => {
      const sum = SHOP_UPGRADES.reduce((acc, def) => acc + def.max, 0);
      expect(SHOP_TOTAL_TIERS).toBe(sum);
    });

    it("shopTiersOwned counts owned tiers, clamps to max, and ignores garbage", () => {
      expect(shopTiersOwned({})).toBe(0);
      expect(shopTiersOwned(fullyMaxedTiers())).toBe(SHOP_TOTAL_TIERS);
      // Over-max, negative, fractional, and unknown ids are all handled.
      expect(shopTiersOwned({ might: 999, vigor: -4, swift: 2.9, bogus: 5 })).toBe(SHOP_BY_ID.might.max + 2);
    });
  });
});

describe("shop save compatibility", () => {
  class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string): string | null {
      return this.store.has(key) ? (this.store.get(key) as string) : null;
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
  }
  const SHOP_KEY = "scourge-survivors.shop.v1";
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memory;
  });

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
  });

  it("preserves the { gold, tiers } shape across save/load", () => {
    const state: ShopState = { gold: 420, tiers: { might: 2, vigor: 1 } };
    saveShop(state);
    const loaded = loadShop();
    expect(loaded.gold).toBe(420);
    expect(loaded.tiers).toEqual({ might: 2, vigor: 1 });
  });

  it("returns a clean empty state when nothing is stored", () => {
    expect(loadShop()).toEqual({ gold: 0, tiers: {} });
  });

  it("sanitizes legacy/tampered tiers without changing the shape", () => {
    memory.setItem(
      SHOP_KEY,
      JSON.stringify({ gold: -50, tiers: { might: 3, vigor: -2, swift: 1.9, broken: Number.NaN, scholar: "x" } }),
    );
    const loaded = loadShop();
    expect(loaded.gold).toBe(0); // negative gold clamped
    expect(loaded.tiers).toEqual({ might: 3, swift: 1 }); // negatives/NaN/non-numeric dropped, floats floored
  });

  it("survives malformed JSON", () => {
    memory.setItem(SHOP_KEY, "{not json");
    expect(loadShop()).toEqual({ gold: 0, tiers: {} });
  });
});
