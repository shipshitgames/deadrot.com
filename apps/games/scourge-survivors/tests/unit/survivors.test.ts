import { describe, expect, it } from "vitest";
import { STARTING_WEAPON, WEAPONS } from "../../src/game/constants";
import { ENEMY_ARCHETYPES, SCOURGE_THREAT_TIERS } from "../../src/game/data/enemies";
import {
  availableEvolutionChoice,
  EVOLUTIONS,
  runGold,
  SHOP_BY_ID,
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  survivorBuildList,
  survivorStartingWeapon,
  UPGRADE_BY_ID,
  UPGRADES,
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
  it("defines an explicit valid starting weapon for every survivor class", () => {
    for (const id of SURVIVOR_CLASS_IDS) {
      const startingWeapon = SURVIVOR_CLASSES[id].startingWeapon;

      expect(startingWeapon, id).toBeTruthy();
      expect(WEAPONS[startingWeapon], id).toBeDefined();
      expect(survivorStartingWeapon(id), id).toBe(startingWeapon);
    }
  });

  it("keeps the default non-class fallback on the sidearm", () => {
    expect(STARTING_WEAPON).toBe("pistol");
    expect(survivorStartingWeapon("not-a-class")).toBe(STARTING_WEAPON);
  });

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
      name: "PYRE CYCLONE",
      evolved: true,
      level: UPGRADE_BY_ID.orbit.max,
    });
    expect(build.find((entry) => entry.id === "bolt")).toMatchObject({
      name: "Ember-Seeker Bolts",
      evolved: false,
      level: 1,
    });
    expect(build.find((entry) => entry.id === "dmg")).toMatchObject({
      name: "Incendiary Rounds",
      evolved: false,
      level: 2,
    });
  });

  it("keeps auto-weapon draft copy in Pyre fire vocabulary", () => {
    expect(UPGRADES.filter((upgrade) => upgrade.kind === "weapon").map((upgrade) => upgrade.name)).toEqual([
      "Cautery Ring",
      "Ember-Seeker Bolts",
      "Breachfire Nova",
    ]);
    expect(UPGRADE_BY_ID.amp.desc).toContain("Pyre auto-weapons");
    expect(EVOLUTIONS.orbit).toMatchObject({
      name: "PYRE CYCLONE",
      desc: expect.stringContaining("Cautery blades"),
    });
    expect(EVOLUTIONS.bolt).toMatchObject({
      name: "EMBER STORM",
      desc: expect.stringContaining("Pyre bolts"),
    });
    expect(EVOLUTIONS.nova).toMatchObject({
      name: "FURNACE HEART",
      desc: expect.stringContaining("Breachfire"),
    });
    expect(SHOP_BY_ID.arsenal.desc).toContain("Cautery Ring");
    expect(SHOP_BY_ID.munitions.desc).toContain("Ember-Seeker Bolts");
    expect(SHOP_BY_ID.pulsar.desc).toContain("Breachfire Nova");
  });

  it("maps current Scourge run threats onto canon tiers", () => {
    expect(new Set(Object.values(ENEMY_ARCHETYPES).map((enemy) => enemy.loreTier))).toEqual(new Set(["swarm"]));
    expect(SCOURGE_THREAT_TIERS.swarm).toMatchObject({
      label: "Scourge Swarm",
      banner: "SCOURGE SWARM",
    });
    expect(SCOURGE_THREAT_TIERS.elite).toMatchObject({
      label: "Scourge Elite",
      banner: "SCOURGE ELITE",
    });
    expect(SCOURGE_THREAT_TIERS.breachBoss).toMatchObject({
      label: "Breach-Boss",
      banner: "BREACH-BOSS",
    });
  });

  it("keeps XP and run gold progression increasing with run performance", () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(12)).toBeGreaterThan(xpForLevel(6));
    expect(runGold(50, 8, 180, 0)).toBeGreaterThan(runGold(20, 4, 90, 0));
    expect(runGold(50, 8, 180, 2)).toBeGreaterThan(runGold(50, 8, 180, 0));
  });
});
