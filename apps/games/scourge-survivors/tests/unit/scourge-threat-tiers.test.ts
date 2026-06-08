import { describe, expect, it } from "vitest";
import {
  campaignArchetypeForWave,
  ENEMY_ARCHETYPES,
  type EnemyArchetypeId,
  pickWeightedEnemyArchetype,
  SCOURGE_THREAT_TIERS,
  type ScourgeThreatTier,
  SURVIVORS_ARCHETYPE_IDS,
} from "../../src/game/data/enemies";

const EXPECTED_TIER_IDS: ScourgeThreatTier[] = ["swarm", "elite", "breachBoss"];

describe("Scourge canon threat tiers (#77)", () => {
  it("defines exactly the three canon threat tiers", () => {
    expect(Object.keys(SCOURGE_THREAT_TIERS).sort()).toEqual([...EXPECTED_TIER_IDS].sort());
  });

  it("gives every tier non-empty canon label, banner, and summary fields", () => {
    for (const tierId of EXPECTED_TIER_IDS) {
      const tier = SCOURGE_THREAT_TIERS[tierId];
      expect(tier, tierId).toBeDefined();
      expect(Object.keys(tier).sort()).toEqual(["banner", "label", "summary"]);

      expect(typeof tier.label, `${tierId} label`).toBe("string");
      expect(typeof tier.banner, `${tierId} banner`).toBe("string");
      expect(typeof tier.summary, `${tierId} summary`).toBe("string");

      expect(tier.label.trim().length, `${tierId} label`).toBeGreaterThan(0);
      expect(tier.banner.trim().length, `${tierId} banner`).toBeGreaterThan(0);
      expect(tier.summary.trim().length, `${tierId} summary`).toBeGreaterThan(0);
    }
  });

  it("uses an uppercase banner string for the breach-boss tier", () => {
    const breach = SCOURGE_THREAT_TIERS.breachBoss;

    expect(breach.banner.length).toBeGreaterThan(0);
    expect(breach.banner).toBe("BREACH-BOSS");
    // Banner is the on-screen shout: it must be the uppercased form (allowing punctuation).
    expect(breach.banner).toBe(breach.banner.toUpperCase());
    expect(breach.label).toBe("Breach-Boss");
    expect(breach.summary.toLowerCase()).toContain("breach");
  });

  it("maps each tier banner to the canon Scourge reskin copy", () => {
    expect(SCOURGE_THREAT_TIERS.swarm.banner).toBe("SCOURGE SWARM");
    expect(SCOURGE_THREAT_TIERS.elite.banner).toBe("SCOURGE ELITE");
    expect(SCOURGE_THREAT_TIERS.breachBoss.banner).toBe("BREACH-BOSS");

    expect(SCOURGE_THREAT_TIERS.swarm.label).toBe("Scourge Swarm");
    expect(SCOURGE_THREAT_TIERS.elite.label).toBe("Scourge Elite");
  });

  it("keeps every tier banner an uppercase rendering of its label", () => {
    for (const tierId of EXPECTED_TIER_IDS) {
      const tier = SCOURGE_THREAT_TIERS[tierId];
      const normalize = (value: string) => value.replace(/[^A-Z0-9]/g, "");
      expect(normalize(tier.banner), `${tierId} banner vs label`).toBe(normalize(tier.label.toUpperCase()));
    }
  });
});

describe("Scourge enemy archetype canon lookup (#77)", () => {
  it("exposes every survivors archetype id with a matching definition", () => {
    expect(SURVIVORS_ARCHETYPE_IDS.length).toBeGreaterThan(0);
    // No duplicate ids in the spawn roster.
    expect(new Set(SURVIVORS_ARCHETYPE_IDS).size).toBe(SURVIVORS_ARCHETYPE_IDS.length);

    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      const def = ENEMY_ARCHETYPES[id];
      expect(def, id).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name.trim().length, `${id} name`).toBeGreaterThan(0);
    }
  });

  it("tags every archetype with the canon swarm lore tier that exists in the tier map", () => {
    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      const def = ENEMY_ARCHETYPES[id];
      expect(def.loreTier, `${id} loreTier`).toBe("swarm");
      // The lore tier must be a real key of the canon threat-tier map.
      expect(SCOURGE_THREAT_TIERS[def.loreTier], `${id} loreTier resolves`).toBeDefined();
    }
  });

  it("keeps archetype stat multipliers in sane, positive ranges", () => {
    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      const def = ENEMY_ARCHETYPES[id];
      expect(def.speedMul, `${id} speedMul`).toBeGreaterThan(0);
      expect(def.hpMul, `${id} hpMul`).toBeGreaterThan(0);
      expect(def.scale, `${id} scale`).toBeGreaterThan(0);
      expect(def.mass, `${id} mass`).toBeGreaterThan(0);
      expect(def.xp, `${id} xp`).toBeGreaterThan(0);
      expect(def.attackDamage, `${id} attackDamage`).toBeGreaterThan(0);
      expect(def.spawnAfter, `${id} spawnAfter`).toBeGreaterThanOrEqual(0);
    }
  });

  it("marks ranged-only-by-flag archetypes consistently", () => {
    expect(ENEMY_ARCHETYPES.shooter.ranged).toBe(true);
    expect(ENEMY_ARCHETYPES.flier.ranged).toBe(true);
    expect(ENEMY_ARCHETYPES.flier.flying).toBe(true);
    // Pure melee grunt should not carry ranged/projectile data.
    expect(ENEMY_ARCHETYPES.grunt.ranged).toBeUndefined();
    expect(ENEMY_ARCHETYPES.grunt.projectileDamage).toBeUndefined();
    // Any ranged archetype must declare projectile damage.
    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      const def = ENEMY_ARCHETYPES[id];
      if (def.ranged) {
        expect(def.projectileDamage, `${id} projectileDamage`).toBeGreaterThan(0);
      }
    }
  });
});

describe("Scourge archetype selection helpers (#77)", () => {
  it("returns a canon archetype definition for the earliest run time", () => {
    const def = pickWeightedEnemyArchetype(0, 0);
    expect(SURVIVORS_ARCHETYPE_IDS).toContain(def.id as EnemyArchetypeId);
    // At time 0 only grunt has spawned, so it must be the only eligible pick.
    expect(def.id).toBe("grunt");
  });

  it("only ever returns archetypes that have already met their spawn gate", () => {
    const runTime = 30;
    for (let i = 0; i < 200; i++) {
      const def = pickWeightedEnemyArchetype(runTime, 0);
      expect(SURVIVORS_ARCHETYPE_IDS).toContain(def.id as EnemyArchetypeId);
      expect(def.spawnAfter, `${def.id} spawnAfter at ${runTime}`).toBeLessThanOrEqual(runTime);
    }
  });

  it("maps campaign waves to canon archetype definitions deterministically", () => {
    const first = campaignArchetypeForWave(0, 0, 0);
    const repeat = campaignArchetypeForWave(0, 0, 0);
    expect(first.id).toBe(repeat.id);
    expect(SURVIVORS_ARCHETYPE_IDS).toContain(first.id as EnemyArchetypeId);

    // Early wave with cadence 0 should still be a real, defined archetype, not undefined.
    for (let wave = 0; wave < 4; wave++) {
      for (let spawn = 0; spawn < 8; spawn++) {
        const def = campaignArchetypeForWave(wave, spawn, 0);
        expect(def, `wave ${wave} spawn ${spawn}`).toBeDefined();
        expect(ENEMY_ARCHETYPES[def.id]).toBe(def);
      }
    }
  });

  it("introduces tank and splitter only from wave 2 onward in the campaign cadence", () => {
    // wave 0 should never schedule tank or splitter (both gated on waveIndex >= 2).
    const wave0 = Array.from({ length: 8 }, (_, spawn) => campaignArchetypeForWave(0, spawn, 0).id);
    expect(wave0).not.toContain("tank");
    expect(wave0).not.toContain("splitter");
  });
});
