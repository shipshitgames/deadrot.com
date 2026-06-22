import { describe, expect, it } from "vitest";
import { STARTING_WEAPON, WEAPONS } from "../../src/game/constants";
import { ENEMY_ARCHETYPES, SCOURGE_THREAT_TIERS } from "../../src/game/data/enemies";
import {
  availableEvolutionChoice,
  EVOLUTIONS,
  mainWeaponUpgradeScore,
  mainWeaponVisualTier,
  runGold,
  SHOP_BY_ID,
  SURV_HP_RAMP_PER_SEC,
  SURV_SPEED_RAMP_PER_SEC,
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_CHAPTERS,
  SURVIVOR_RUN_GOAL_TIME,
  survivorBuildList,
  survivorChapterAt,
  survivorChapterStart,
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

  it("maps gun-affecting upgrades onto visible main weapon sprite tiers", () => {
    expect(mainWeaponUpgradeScore({})).toBe(0);
    expect(mainWeaponVisualTier({})).toBe("base");
    expect(mainWeaponVisualTier({ dmg: 1 })).toBe("tier-2");
    expect(mainWeaponVisualTier({ dmg: 2, rate: 2 })).toBe("tier-3");
    expect(mainWeaponVisualTier({ dmg: 5, rate: 3 })).toBe("tier-4");
    expect(mainWeaponVisualTier({ dmg: 5, rate: 4, multishot: 3 })).toBe("evolved");
  });
});

describe("survivors run timeline (#278 — the Toll)", () => {
  it("runs four chapters that sum to the 10:00 reaper arrival", () => {
    expect(SURVIVOR_RUN_CHAPTERS.map((chapter) => chapter.duration)).toEqual([135, 145, 155, 165]);
    expect(SURVIVOR_RUN_GOAL_TIME).toBe(600);
  });

  it("keeps chapter lookups consistent across the stretched boundaries", () => {
    expect(survivorChapterStart(0)).toBe(0);
    expect(survivorChapterStart(1)).toBe(135);
    expect(survivorChapterStart(2)).toBe(280);
    expect(survivorChapterStart(3)).toBe(435);

    expect(survivorChapterAt(0)).toBe(0);
    expect(survivorChapterAt(134.9)).toBe(0);
    expect(survivorChapterAt(135)).toBe(1);
    expect(survivorChapterAt(280)).toBe(2);
    expect(survivorChapterAt(435)).toBe(3);
    // past the toll the run is reaper territory, still the final chapter
    expect(survivorChapterAt(600)).toBe(3);
  });

  it("preserves the old 270s difficulty endpoint at the new 600s goal", () => {
    // Renormalization (see data/survivors.ts): the curve is stretched, not
    // raised — the ramp × goal-time product matches the pre-#278 values.
    expect(SURVIVOR_RUN_GOAL_TIME * SURV_HP_RAMP_PER_SEC).toBeCloseTo(270 * 0.01, 1);
    expect(SURVIVOR_RUN_GOAL_TIME * SURV_SPEED_RAMP_PER_SEC).toBeCloseTo(270 * 0.0035, 1);
  });
});
