import { describe, expect, it } from "vitest";
import { WEAPONS } from "../../src/game/constants";
import {
  SURVIVOR_CLASS_IDS,
  SURVIVOR_CLASSES,
  type SurvivorClassId,
  survivorClassFor,
  survivorStartingWeapon,
} from "../../src/game/data/survivors";

// Issue #72 (Survivors-as-default): storage.ts exposes no exported survivor-class
// persistence helper (loadSettings only carries music/sfx), so per the task
// fallback we cover the public class resolver instead. `survivorClassFor` is the
// function any saved/selected class id is funneled through, and it must:
//   - resolve every real class id,
//   - fall back to the `ranger` default for garbage / null / undefined / empty,
// which is precisely the "ranger as default" behaviour #72 depends on.
describe("survivor class resolution (#72 ranger-default)", () => {
  it("treats ranger as the canonical default class", () => {
    // The default the resolver falls back to must actually be ranger.
    expect(SURVIVOR_CLASSES.ranger).toBeDefined();
    expect(SURVIVOR_CLASSES.ranger.id).toBe("ranger");
    // ranger is listed first so it is the natural / default selection.
    expect(SURVIVOR_CLASS_IDS[0]).toBe("ranger");
  });

  it("resolves a valid stored class id back to its own definition", () => {
    for (const id of SURVIVOR_CLASS_IDS) {
      const resolved = survivorClassFor(id);
      expect(resolved.id, id).toBe(id);
      expect(resolved, id).toBe(SURVIVOR_CLASSES[id]);
    }
  });

  it("falls back to ranger for an invalid / garbage stored value", () => {
    const ranger = SURVIVOR_CLASSES.ranger;
    for (const garbage of ["", "RANGER", "rogue", "not-a-class", "heavyy", "0", "{}"]) {
      const resolved = survivorClassFor(garbage);
      expect(resolved, garbage).toBe(ranger);
      expect(resolved.id, garbage).toBe("ranger");
    }
  });

  it("falls back to ranger for empty / missing storage (null & undefined)", () => {
    const ranger = SURVIVOR_CLASSES.ranger;
    // null mirrors a missing localStorage.getItem result; undefined mirrors no arg.
    expect(survivorClassFor(null)).toBe(ranger);
    expect(survivorClassFor(undefined)).toBe(ranger);
    expect(survivorClassFor()).toBe(ranger);
  });

  it("derives the starting weapon from the resolved class, defaulting to ranger's", () => {
    const rangerWeapon = SURVIVOR_CLASSES.ranger.startingWeapon;
    // Bad input must yield the ranger default weapon, not undefined.
    expect(survivorStartingWeapon("not-a-class")).toBe(rangerWeapon);
    expect(survivorStartingWeapon(null)).toBe(rangerWeapon);
    // Valid input must match that class's own weapon and be a real weapon.
    for (const id of SURVIVOR_CLASS_IDS) {
      const weapon = survivorStartingWeapon(id);
      expect(weapon, id).toBe(SURVIVOR_CLASSES[id].startingWeapon);
      expect(WEAPONS[weapon], id).toBeDefined();
    }
  });

  it("keeps SURVIVOR_CLASS_IDS and SURVIVOR_CLASSES in lockstep with resolvable ids", () => {
    // No stray ids, no missing ids: the id list and the record must agree.
    const recordIds = Object.keys(SURVIVOR_CLASSES) as SurvivorClassId[];
    expect(new Set(SURVIVOR_CLASS_IDS)).toEqual(new Set(recordIds));
    expect(SURVIVOR_CLASS_IDS).toHaveLength(recordIds.length);
    // Every id is unique and every entry is internally consistent (id matches key).
    expect(new Set(SURVIVOR_CLASS_IDS).size).toBe(SURVIVOR_CLASS_IDS.length);
    for (const id of SURVIVOR_CLASS_IDS) {
      const def = SURVIVOR_CLASSES[id];
      expect(def.id, id).toBe(id);
      expect(typeof def.name, id).toBe("string");
      expect(def.name.length, id).toBeGreaterThan(0);
    }
  });
});
