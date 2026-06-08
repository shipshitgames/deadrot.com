import { describe, expect, it } from "vitest";
import {
  availableEvolutionChoice,
  EVOLUTIONS,
  mainWeaponUpgradeScore,
  mainWeaponVisualTier,
  runGold,
  survivorBuildList,
  UPGRADE_BY_ID,
  type UpgradeId,
  type WeaponUpgradeId,
  xpForLevel,
} from "../../src/game/data/survivors";

const noEvolutions: Record<WeaponUpgradeId, boolean> = {
  orbit: false,
  bolt: false,
  nova: false,
};

describe("survivors progression data", () => {
  it("only offers an evolution after the weapon and paired passive are maxed", () => {
    const levels: Partial<Record<UpgradeId, number>> = {
      orbit: UPGRADE_BY_ID.orbit.max,
      dmg: UPGRADE_BY_ID.dmg.max - 1,
    };

    expect(availableEvolutionChoice(levels, noEvolutions)).toBeNull();

    levels.dmg = UPGRADE_BY_ID.dmg.max;

    expect(availableEvolutionChoice(levels, noEvolutions)).toMatchObject({
      id: "evo-orbit",
      name: EVOLUTIONS.orbit.name,
      golden: true,
      max: 1,
    });
  });

  it("does not offer an already-owned evolution again", () => {
    const levels: Partial<Record<UpgradeId, number>> = {
      orbit: UPGRADE_BY_ID.orbit.max,
      dmg: UPGRADE_BY_ID.dmg.max,
    };

    expect(availableEvolutionChoice(levels, { ...noEvolutions, orbit: true })).toBeNull();
  });

  it("reports evolved build names while leaving ordinary upgrades unchanged", () => {
    const build = survivorBuildList(
      {
        orbit: UPGRADE_BY_ID.orbit.max,
        bolt: 1,
        dmg: 2,
      },
      { ...noEvolutions, orbit: true },
    );

    expect(build.find((entry) => entry.id === "orbit")).toMatchObject({
      name: "CYCLONE",
      evolved: true,
      level: UPGRADE_BY_ID.orbit.max,
    });
    expect(build.find((entry) => entry.id === "bolt")).toMatchObject({
      name: "Seeker Bolts",
      evolved: false,
      level: 1,
    });
    expect(build.find((entry) => entry.id === "dmg")).toMatchObject({
      name: "Heavy Rounds",
      evolved: false,
      level: 2,
    });
  });

  it("keeps XP and run gold progression increasing with run performance", () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(12)).toBeGreaterThan(xpForLevel(6));
    expect(runGold(50, 8, 180, 0)).toBeGreaterThan(runGold(20, 4, 90, 0));
    expect(runGold(50, 8, 180, 2)).toBeGreaterThan(runGold(50, 8, 180, 0));
  });

  it("maps gun-affecting upgrades onto visible main weapon sprite tiers", () => {
    expect(mainWeaponUpgradeScore({})).toBe(0);
    expect(mainWeaponVisualTier({})).toBe("base");
    expect(mainWeaponVisualTier({ dmg: 1 })).toBe("tier-2");
    expect(mainWeaponVisualTier({ dmg: 2, rate: 2 })).toBe("tier-3");
    expect(mainWeaponVisualTier({ dmg: 5, rate: 3 })).toBe("tier-4");
    expect(mainWeaponVisualTier({ dmg: 5, rate: 4, multishot: 3 })).toBe("evolved");
  });
});
