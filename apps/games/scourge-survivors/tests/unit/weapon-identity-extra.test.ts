import { describe, expect, it } from "vitest";
import { WEAPON_ORDER } from "../../src/game/constants";
import { weaponIdentityFor } from "../../src/game/data/weaponIdentity";

describe("weaponIdentityFor completeness", () => {
  it("returns a complete identity for every weapon in WEAPON_ORDER", () => {
    expect(WEAPON_ORDER.length).toBeGreaterThan(0);

    for (const id of WEAPON_ORDER) {
      const identity = weaponIdentityFor(id);

      // The lookup resolves to a real def keyed by the requested id.
      expect(identity, `${id} identity`).toBeDefined();
      expect(identity.id, `${id} id`).toBe(id);

      // Callsign is a non-empty, trimmed string.
      expect(typeof identity.callsign, `${id} callsign type`).toBe("string");
      expect(identity.callsign.trim().length, `${id} callsign length`).toBeGreaterThan(0);

      // Role is a non-empty, trimmed string.
      expect(typeof identity.role, `${id} role type`).toBe("string");
      expect(identity.role.trim().length, `${id} role length`).toBeGreaterThan(0);

      // Fantasy blurb is present.
      expect(typeof identity.fantasy, `${id} fantasy type`).toBe("string");
      expect(identity.fantasy.trim().length, `${id} fantasy length`).toBeGreaterThan(0);

      // ADS metadata exposes a string label.
      expect(identity.ads, `${id} ads`).toBeDefined();
      expect(typeof identity.ads.label, `${id} ads.label type`).toBe("string");
      expect(identity.ads.label.trim().length, `${id} ads.label length`).toBeGreaterThan(0);

      // dualCompatible is a strict boolean (not just truthy/undefined).
      expect(typeof identity.dualCompatible, `${id} dualCompatible type`).toBe("boolean");
    }
  });

  it("gives each weapon a distinct callsign across WEAPON_ORDER", () => {
    const callsigns = WEAPON_ORDER.map((id) => weaponIdentityFor(id).callsign);

    expect(new Set(callsigns).size).toBe(WEAPON_ORDER.length);
  });

  it("returns the same identity instance on repeated lookups for one id", () => {
    for (const id of WEAPON_ORDER) {
      expect(weaponIdentityFor(id)).toBe(weaponIdentityFor(id));
    }
  });

  it("covers both dual-compatible and dual-incompatible weapons", () => {
    const flags = WEAPON_ORDER.map((id) => weaponIdentityFor(id).dualCompatible);

    expect(flags).toContain(true);
    expect(flags).toContain(false);
  });
});
