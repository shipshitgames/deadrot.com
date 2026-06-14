import { getLocation } from "@shipshitgames/assets/lore";
import { describe, expect, it } from "vitest";
import {
  BOSS_COLOR,
  PLAYER_MAX_HEALTH,
  REAPER_RESIST_TOTAL_TIERS,
  REAPER_RESIST_VIGOR_TIERS,
  REAPER_RESISTED_TOUCH_DAMAGE,
  REAPER_TOUCH_DAMAGE,
  REAPER_WARNING_LEAD,
} from "../../src/game/constants";
import { SCOURGE_THREAT_TIERS } from "../../src/game/data/enemies";
import {
  canResistReaper,
  REAPER_HOST_TINTS,
  REAPER_LOCATION_SLUG_BY_MAP,
  reaperForMap,
  reaperTouchDamage,
  reaperWarningDue,
  shouldSpawnReaper,
} from "../../src/game/data/reaper";
import {
  SHOP_BY_ID,
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  SURVIVOR_RUN_GOAL_TIME,
  UPGRADE_BY_ID,
} from "../../src/game/data/survivors";

/** Shop-tier helper: spread `total` tiers across dummy ids with an explicit vigor share. */
function tiers(total: number, vigor: number): Record<string, number> {
  return { vigor, might: total - vigor };
}

describe("reaper identity (lore data layer)", () => {
  it("resolves every run map to its canon named boss — never a hardcoded name", () => {
    expect(reaperForMap("ashgate").name).toBe("Lane Tyrant");
    expect(reaperForMap("hollowlanes").name).toBe("Junction Knell");
    expect(reaperForMap("maw").name).toBe("Maw Shepherd");
    expect(reaperForMap("perdition").name).toBe("The Choir Node");
  });

  it("keeps the map → lore-slug seam pointed at real lore locations with bosses (drift test)", () => {
    for (const [mapId, slug] of Object.entries(REAPER_LOCATION_SLUG_BY_MAP)) {
      const location = getLocation(slug);
      expect(location, `${mapId} → ${slug}`).toBeDefined();
      expect(location?.boss, `${mapId} → ${slug} must name a climax boss`).toBeTruthy();

      const identity = reaperForMap(mapId);
      expect(identity.name).toBe(location?.boss?.name);
      expect(identity.entitySlug).toBe(location?.boss?.entitySlug);
      expect(identity.hostFamily).toBe(location?.boss?.hostFamily);
    }
  });

  it("defines a tint for every host family that appears on a run map", () => {
    for (const slug of Object.values(REAPER_LOCATION_SLUG_BY_MAP)) {
      const family = getLocation(slug)?.boss?.hostFamily as string;
      expect(REAPER_HOST_TINTS[family], `tint for ${family}`).toBeTypeOf("number");
    }
    for (const [mapId] of Object.entries(REAPER_LOCATION_SLUG_BY_MAP)) {
      const identity = reaperForMap(mapId);
      expect(identity.tint).toBe(REAPER_HOST_TINTS[identity.hostFamily]);
    }
  });

  it("falls back to the generic Breach-Boss for unknown maps", () => {
    expect(reaperForMap("not-a-map")).toEqual({
      name: SCOURGE_THREAT_TIERS.breachBoss.label,
      entitySlug: "breach-boss",
      hostFamily: "rot-flesh",
      tint: BOSS_COLOR,
    });
  });
});

describe("reaper schedule", () => {
  it("arrives exactly at the goal time, never early, and only once", () => {
    expect(shouldSpawnReaper(SURVIVOR_RUN_GOAL_TIME - 0.01, false)).toBe(false);
    expect(shouldSpawnReaper(SURVIVOR_RUN_GOAL_TIME, false)).toBe(true);
    expect(shouldSpawnReaper(SURVIVOR_RUN_GOAL_TIME + 30, false)).toBe(true);
    // the alreadySpawned latch wins regardless of clock
    expect(shouldSpawnReaper(SURVIVOR_RUN_GOAL_TIME, true)).toBe(false);
    expect(shouldSpawnReaper(SURVIVOR_RUN_GOAL_TIME + 999, true)).toBe(false);
  });

  it("respects a custom arrival time", () => {
    expect(shouldSpawnReaper(99.9, false, 100)).toBe(false);
    expect(shouldSpawnReaper(100, false, 100)).toBe(true);
  });

  it("warns once inside the lead window and hands >= arrival to the spawn", () => {
    const arrival = SURVIVOR_RUN_GOAL_TIME;
    expect(reaperWarningDue(arrival - REAPER_WARNING_LEAD - 0.01, false)).toBe(false);
    expect(reaperWarningDue(arrival - REAPER_WARNING_LEAD, false)).toBe(true);
    expect(reaperWarningDue(arrival - 0.01, false)).toBe(true);
    // at arrival the spawn owns the frame — the warning must stand down
    expect(reaperWarningDue(arrival, false)).toBe(false);
    // the alreadyWarned latch
    expect(reaperWarningDue(arrival - 5, true)).toBe(false);
  });

  it("respects custom arrival and lead overrides", () => {
    expect(reaperWarningDue(89, false, 100, 10)).toBe(false);
    expect(reaperWarningDue(90, false, 100, 10)).toBe(true);
    expect(reaperWarningDue(99.9, false, 100, 10)).toBe(true);
    expect(reaperWarningDue(100, false, 100, 10)).toBe(false);
  });
});

describe("reaper resistance threshold (permanent shop progression)", () => {
  it("requires the full total-tier investment", () => {
    expect(canResistReaper(tiers(REAPER_RESIST_TOTAL_TIERS - 1, REAPER_RESIST_VIGOR_TIERS))).toBe(false);
    expect(canResistReaper(tiers(REAPER_RESIST_TOTAL_TIERS, REAPER_RESIST_VIGOR_TIERS))).toBe(true);
  });

  it("requires the vigor tiers specifically, even at a high total", () => {
    expect(canResistReaper(tiers(REAPER_RESIST_TOTAL_TIERS + 5, REAPER_RESIST_VIGOR_TIERS - 1))).toBe(false);
    expect(canResistReaper(tiers(REAPER_RESIST_TOTAL_TIERS + 5, REAPER_RESIST_VIGOR_TIERS))).toBe(true);
  });

  it("treats an empty shop as unprotected", () => {
    expect(canResistReaper({})).toBe(false);
  });

  it("selects the one-shot below the threshold and the survivable strike at it", () => {
    expect(reaperTouchDamage(tiers(REAPER_RESIST_TOTAL_TIERS - 1, REAPER_RESIST_VIGOR_TIERS))).toBe(
      REAPER_TOUCH_DAMAGE,
    );
    expect(reaperTouchDamage(tiers(REAPER_RESIST_TOTAL_TIERS, REAPER_RESIST_VIGOR_TIERS))).toBe(
      REAPER_RESISTED_TOUCH_DAMAGE,
    );
    // the resisted strike must itself be survivable from full base health
    expect(REAPER_RESISTED_TOUCH_DAMAGE).toBeLessThan(PLAYER_MAX_HEALTH);
  });
});

describe("reaper one-shot guarantee (executable tuning doc)", () => {
  it("out-damages the deepest possible defensive pool through the armor cap", () => {
    // Per-tier values applied by the systems layer (UPGRADES / SHOP_UPGRADES copy):
    const MAXHP_PER_TIER = 30; // "maxhp" — "+30 max health (and heal)"
    const VIGOR_PER_TIER = 18; // shop "vigor" — "+18 starting max health"
    const WARD_PER_TIER = 24; // "ward" — "+24 regenerating shield"
    const ARMOR_CAP = 0.78; // PlayerSystem.damagePlayer: armor = min(0.78, ...)

    const bestClassHp = Math.max(...SURVIVOR_CLASS_IDS.map((id) => SURVIVOR_CLASSES[id].maxHpBonus ?? 0));
    const bestClassShield = Math.max(...SURVIVOR_CLASS_IDS.map((id) => SURVIVOR_CLASSES[id].shieldMax ?? 0));

    // Upper bound on effective HP: base + every maxhp draft + every permanent
    // vigor tier + the best class HP bonus AND the best class shield (these two
    // never co-occur on one class, so the pool is strictly pessimistic) + every
    // ward shield tier.
    const worstCasePool =
      PLAYER_MAX_HEALTH +
      UPGRADE_BY_ID.maxhp.max * MAXHP_PER_TIER +
      SHOP_BY_ID.vigor.max * VIGOR_PER_TIER +
      bestClassHp +
      UPGRADE_BY_ID.ward.max * WARD_PER_TIER +
      bestClassShield;

    expect(worstCasePool).toBe(505); // 100 + 150 + 90 + 45 + 96 + 24
    // Even at the armor cap, the toll's touch must clear the whole pool.
    expect(REAPER_TOUCH_DAMAGE * (1 - ARMOR_CAP)).toBeGreaterThan(worstCasePool);
  });
});
