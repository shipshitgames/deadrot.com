import manifest from "@shipshitgames/assets/games/scourge-survivors/assets.json";
import { describe, expect, it } from "vitest";
import { STARTING_WEAPON, WEAPON_ORDER, WEAPONS, type WeaponId } from "../../src/game/constants";
import { SURVIVOR_CLASS_IDS, SURVIVOR_CLASSES } from "../../src/game/data/survivors";
import {
  WEAPON_IDENTITIES,
  WEAPON_IDENTITY_PHASES,
  WEAPON_IDENTITY_TRACKER,
  weaponIdentityFor,
} from "../../src/game/data/weaponIdentity";

describe("weapon identity tracker", () => {
  it("tracks every runtime weapon with sprite, sound, ADS, and dual-policy metadata", () => {
    expect(Object.keys(WEAPON_IDENTITIES).sort()).toEqual([...WEAPON_ORDER].sort());

    for (const id of WEAPON_ORDER) {
      const identity = weaponIdentityFor(id);
      const spec = WEAPONS[id];

      expect(identity.id).toBe(id);
      expect(identity.displayName).toBe(spec.name);
      expect(identity.ads.zoomLevels).toBe(spec.adsFovs.length);
      expect(identity.dualCompatible).toBe(spec.dualCompatible);
      expect(manifest.sprites[identity.assetIds.sprite as keyof typeof manifest.sprites], `${id} sprite`).toBeDefined();
      expect(manifest.audio[identity.assetIds.sfx as keyof typeof manifest.audio], `${id} sfx`).toBeDefined();
      expect(identity.issuePhaseIds.length, `${id} phases`).toBeGreaterThan(0);
    }
  });

  it("locks the source issue decisions around pistol default and sniper identity", () => {
    expect(WEAPON_IDENTITY_TRACKER.issue).toBe(112);
    expect(WEAPON_IDENTITY_TRACKER.decisions).toEqual(
      expect.arrayContaining([
        "The Pyre sidearm is the default/base weapon.",
        "The old rifle direction is preserved as sniper/marksman identity, not default weapon identity.",
      ]),
    );

    expect(STARTING_WEAPON).toBe("pistol");
    expect(SURVIVOR_CLASSES.ranger.startingWeapon).toBe("pistol");
    expect(WEAPON_ORDER).not.toContain("rifle" as WeaponId);
    expect(WEAPON_IDENTITIES.sniper.role).toMatch(/marksman/i);
    expect(WEAPON_IDENTITIES.sniper.ads.scoped).toBe(true);
    expect(WEAPONS.sniper.adsFovs).toHaveLength(2);
  });

  it("keeps selectable classes on unique starting weapons and mirrors tracker ownership", () => {
    const startingWeapons = SURVIVOR_CLASS_IDS.map((id) => SURVIVOR_CLASSES[id].startingWeapon);

    expect(new Set(startingWeapons).size).toBe(SURVIVOR_CLASS_IDS.length);

    for (const classId of SURVIVOR_CLASS_IDS) {
      const weapon = SURVIVOR_CLASSES[classId].startingWeapon;
      expect(WEAPON_IDENTITIES[weapon].starterClassIds, classId).toContain(classId);
    }
  });

  it("keeps dual weapon as a pickup bonus instead of fixed dual-pistol identity", () => {
    const phase = WEAPON_IDENTITY_PHASES.find((entry) => entry.id === "dual-pickup-bonus");

    expect(phase?.status).toBe("implemented");
    expect(manifest.sprites["pickup-dual"]).toBeDefined();
    expect(WEAPON_IDENTITIES.pistol.dualCompatible).toBe(true);
    expect(WEAPON_IDENTITIES.cannon.dualCompatible).toBe(false);
    expect(WEAPON_IDENTITIES.pistol.callsign.toLowerCase()).not.toContain("dual");
  });

  it("marks every migrated tracker phase as implemented with evidence", () => {
    expect(WEAPON_IDENTITY_PHASES).toHaveLength(7);
    expect(WEAPON_IDENTITY_PHASES.map((phase) => phase.status)).toEqual(
      WEAPON_IDENTITY_PHASES.map(() => "implemented"),
    );
    for (const phase of WEAPON_IDENTITY_PHASES) {
      expect(phase.sourceIssue).toMatch(/^shipshitgames\/scourge-survivors#/);
      expect(phase.evidence.length).toBeGreaterThan(20);
    }
  });
});
