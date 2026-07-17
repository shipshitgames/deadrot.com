import manifest from "@shipshitgames/assets/games/scourge-survivors/assets.json";
import { describe, expect, it } from "vitest";
import { MAIN_WEAPON_VISUAL_TIERS } from "../../src/game/data/survivors";
import {
  dualWeaponViewActive,
  MAIN_WEAPON_TIER_VIEW_SCALE,
  mainWeaponTierViewScale,
  type TierCellUv,
  weaponTierCellUv,
} from "../../src/game/data/weaponView";

/** Where along a UV window u∈[0,1] lands once the texture wrap is applied. */
const sampleAt = (uv: TierCellUv, u: number) => uv.offset + u * uv.repeat;

describe("weapon view-model — tier size ramp (#265)", () => {
  it("starts neutral at base and grows strictly each tier", () => {
    expect(mainWeaponTierViewScale("base")).toBe(1);
    const sizes = MAIN_WEAPON_VISUAL_TIERS.map((t) => mainWeaponTierViewScale(t));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], MAIN_WEAPON_VISUAL_TIERS[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it("dials EVOLVED back from the oversized 1.24 so the top-tier gun no longer crowds the view", () => {
    // The regression this card fixes: evolved at 1.24 read as oversized. The dialed-back
    // ramp keeps evolved a clear notch above tier-4 but well under the old value.
    expect(mainWeaponTierViewScale("evolved")).toBeLessThan(1.24);
    expect(mainWeaponTierViewScale("evolved")).toBeLessThanOrEqual(1.16);
    expect(mainWeaponTierViewScale("evolved")).toBeGreaterThan(mainWeaponTierViewScale("tier-4"));
  });

  it("ramps in an even step so no single tier jumps in size", () => {
    const sizes = MAIN_WEAPON_VISUAL_TIERS.map((t) => mainWeaponTierViewScale(t));
    const steps = sizes.slice(1).map((s, i) => s - sizes[i]);
    for (const step of steps) expect(step).toBeCloseTo(steps[0], 6);
    expect(steps[0]).toBeCloseTo(0.04, 6);
  });

  it("exposes the exact multiplier table for every tier", () => {
    for (const tier of MAIN_WEAPON_VISUAL_TIERS) {
      expect(mainWeaponTierViewScale(tier)).toBe(MAIN_WEAPON_TIER_VIEW_SCALE[tier]);
    }
  });
});

describe("weapon view-model — tier-sheet cell UV (#265)", () => {
  it("selects exactly one cell of a multi-column sheet", () => {
    const cols = 5;
    for (let cell = 0; cell < cols; cell++) {
      const uv = weaponTierCellUv(cell, cols);
      expect(uv.repeat).toBeCloseTo(1 / cols, 9);
      expect(uv.offset).toBeCloseTo(cell / cols, 9);
      // The window spans precisely [cell/cols, (cell+1)/cols].
      expect(sampleAt(uv, 0)).toBeCloseTo(cell / cols, 9);
      expect(sampleAt(uv, 1)).toBeCloseTo((cell + 1) / cols, 9);
    }
  });

  it("is a no-op full-image window for a single-column (non-sheet) weapon", () => {
    const uv = weaponTierCellUv(0, 1);
    expect(uv.repeat).toBe(1);
    expect(uv.offset).toBe(0);
    expect(sampleAt(uv, 0)).toBe(0);
    expect(sampleAt(uv, 1)).toBe(1);
  });
});

describe("weapon view-model — dedicated dual-art lifetime (#258)", () => {
  it("uses dual art only while a compatible weapon has a live bonus", () => {
    expect(dualWeaponViewActive(12, true, true)).toBe(true);
    expect(dualWeaponViewActive(0.01, true, true)).toBe(true);
  });

  it("returns to the primary view immediately when the timer expires", () => {
    expect(dualWeaponViewActive(0, true, true)).toBe(false);
    expect(dualWeaponViewActive(-0.01, true, true)).toBe(false);
  });

  it("never falls back to duplicated primary art for incompatible or uncovered weapons", () => {
    expect(dualWeaponViewActive(12, false, true)).toBe(false);
    expect(dualWeaponViewActive(12, true, false)).toBe(false);
  });

  it("lets the scoped ADS view win while the dual gameplay bonus stays live", () => {
    expect(dualWeaponViewActive(12, true, true, true)).toBe(false);
  });
});

describe("weapon view-model — per-weapon footprint (#265)", () => {
  const WEAPON_SPRITE_IDS = [
    "weapon-pistol",
    "weapon-smg",
    "weapon-sniper",
    "weapon-shotgun",
    "weapon-cannon",
  ] as const;
  const scaleOf = (id: (typeof WEAPON_SPRITE_IDS)[number]): [number, number] => {
    const entry = manifest.sprites[id] as { scale: [number, number] };
    return entry.scale;
  };

  it("gives every weapon a positive 2-tuple view scale", () => {
    for (const id of WEAPON_SPRITE_IDS) {
      const scale = scaleOf(id);
      expect(scale, id).toHaveLength(2);
      expect(scale[0], id).toBeGreaterThan(0);
      expect(scale[1], id).toBeGreaterThan(0);
    }
  });

  it("differentiates by uniform scaling — every weapon keeps the same 0.6 view aspect", () => {
    // Tuning is a per-weapon size knob, NOT a stretch: x/y stays constant so no gun is
    // squashed or elongated relative to its art.
    for (const id of WEAPON_SPRITE_IDS) {
      const [x, y] = scaleOf(id);
      expect(x / y, id).toBeCloseTo(0.6, 6);
    }
  });

  it("orders on-screen heft by weapon bulk (pistol < smg < sniper < shotgun < cannon)", () => {
    const order = WEAPON_SPRITE_IDS.map((id) => scaleOf(id)[1]);
    for (let i = 1; i < order.length; i++) {
      expect(order[i], WEAPON_SPRITE_IDS[i]).toBeGreaterThanOrEqual(order[i - 1]);
    }
    // The compact pistol is the smallest read and the heavy cannon the largest.
    expect(scaleOf("weapon-cannon")[1]).toBeGreaterThan(scaleOf("weapon-pistol")[1]);
  });

  it("keeps every footprint within a safe, non-clipping band around the baseline", () => {
    for (const id of WEAPON_SPRITE_IDS) {
      const [x, y] = scaleOf(id);
      expect(x, id).toBeGreaterThanOrEqual(0.5);
      expect(x, id).toBeLessThanOrEqual(0.7);
      expect(y, id).toBeGreaterThanOrEqual(0.9);
      expect(y, id).toBeLessThanOrEqual(1.1);
    }
  });
});
