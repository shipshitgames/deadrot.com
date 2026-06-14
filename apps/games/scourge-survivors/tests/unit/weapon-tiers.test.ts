import { describe, expect, it } from "vitest";
import {
  MAIN_WEAPON_TIER_DAMAGE_MUL,
  MAIN_WEAPON_TIER_LABEL,
  MAIN_WEAPON_VISUAL_TIERS,
  mainWeaponTierDamageMul,
  mainWeaponTierIndex,
  mainWeaponUpgradeScore,
  mainWeaponVisualTier,
  type MainWeaponVisualTier,
  UPGRADE_BY_ID,
  type UpgradeId,
} from "../../src/game/data/survivors";

/** The four offensive draft picks that advance the main-weapon tier (#279). */
const OFFENSIVE: UpgradeId[] = ["dmg", "rate", "multishot", "crit"];

describe("main weapon tier — progression", () => {
  it("derives each tier at the documented upgrade-score threshold", () => {
    expect(mainWeaponVisualTier({})).toBe("base");
    expect(mainWeaponVisualTier({ dmg: 1 })).toBe("tier-2"); // score 1
    expect(mainWeaponVisualTier({ dmg: 3 })).toBe("tier-2"); // score 3 still tier-2
    expect(mainWeaponVisualTier({ dmg: 4 })).toBe("tier-3"); // score 4
    expect(mainWeaponVisualTier({ dmg: 5, rate: 3 })).toBe("tier-4"); // score 8
    expect(mainWeaponVisualTier({ dmg: 5, rate: 5, crit: 2 })).toBe("evolved"); // score 12
  });

  it("only counts the offensive draft picks toward the tier (selectable progression)", () => {
    // A purely defensive build never advances the weapon tier — proving the tier is
    // driven by, and selectable through, the four offensive cards.
    expect(mainWeaponUpgradeScore({ maxhp: 5, armor: 5, ward: 4, regen: 4 })).toBe(0);
    expect(mainWeaponVisualTier({ maxhp: 5, armor: 5, ward: 4 })).toBe("base");

    for (const id of OFFENSIVE) {
      const lv: Partial<Record<UpgradeId, number>> = { [id]: 1 };
      expect(mainWeaponUpgradeScore(lv), id).toBe(1);
      expect(mainWeaponVisualTier(lv), id).toBe("tier-2");
    }
    // The score is exactly the sum of the four offensive levels.
    expect(mainWeaponUpgradeScore({ dmg: 2, rate: 1, multishot: 1, crit: 1, speed: 5 })).toBe(5);
  });

  it("annotates the offensive draft cards as weapon-tier sources", () => {
    // Surfacing the tier path in the draft copy is how the player learns these picks
    // grant tier progression (acceptance: in-run choices grant weapon tier progression).
    for (const id of OFFENSIVE) {
      expect(UPGRADE_BY_ID[id].desc, id).toContain("Weapon Tier");
    }
    // Defensive cards stay silent about the tier so the path reads clearly.
    expect(UPGRADE_BY_ID.armor.desc).not.toContain("Weapon Tier");
    expect(MAIN_WEAPON_VISUAL_TIERS).toEqual(["base", "tier-2", "tier-3", "tier-4", "evolved"]);
  });
});

describe("main weapon tier — damage impact", () => {
  it("base tier is neutral and every higher tier hits strictly harder", () => {
    expect(mainWeaponTierDamageMul("base")).toBe(1);
    const muls = MAIN_WEAPON_VISUAL_TIERS.map((t) => mainWeaponTierDamageMul(t));
    for (let i = 1; i < muls.length; i++) {
      expect(muls[i]).toBeGreaterThan(muls[i - 1]);
    }
    // Evolved is a meaningful spike over base, not a rounding nudge.
    expect(mainWeaponTierDamageMul("evolved")).toBeGreaterThanOrEqual(1.4);
  });

  it("matches the exported multiplier table for every tier", () => {
    for (const tier of MAIN_WEAPON_VISUAL_TIERS) {
      expect(mainWeaponTierDamageMul(tier)).toBe(MAIN_WEAPON_TIER_DAMAGE_MUL[tier]);
    }
  });

  it("a measurable gun-damage gain follows from advancing the build", () => {
    // Integration of the two pure helpers: stacking offensive picks raises the tier,
    // which raises the gun's damage multiplier — a documented, testable stat change.
    const baseTier = mainWeaponVisualTier({});
    const builtTier = mainWeaponVisualTier({ dmg: 4 }); // -> tier-3
    expect(builtTier).toBe("tier-3");
    const gain = mainWeaponTierDamageMul(builtTier) / mainWeaponTierDamageMul(baseTier);
    expect(gain).toBeGreaterThan(1);
    expect(gain).toBeCloseTo(1.18, 5);
  });
});

describe("main weapon tier — readability metadata", () => {
  it("gives every tier a 0..4 index in display order", () => {
    MAIN_WEAPON_VISUAL_TIERS.forEach((tier, i) => {
      expect(mainWeaponTierIndex(tier)).toBe(i);
    });
    expect(mainWeaponTierIndex("base")).toBe(0);
    expect(mainWeaponTierIndex("evolved")).toBe(4);
  });

  it("gives every tier a distinct, non-empty HUD label", () => {
    const labels = MAIN_WEAPON_VISUAL_TIERS.map((t: MainWeaponVisualTier) => MAIN_WEAPON_TIER_LABEL[t]);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
    expect(MAIN_WEAPON_TIER_LABEL.base).toBe("TIER I");
    expect(MAIN_WEAPON_TIER_LABEL.evolved).toBe("EVOLVED");
  });
});
