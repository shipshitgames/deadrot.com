import { describe, expect, it } from "vitest";
import { type ArenaMap, MAPS, SANDBOX_MAPS } from "../../src/game/data/maps";
import {
  auditArenaReadability,
  boxOverlapsPlayArea,
  isInCorePlayArea,
  luminance,
  playAreaDiagonal,
  playAreaExtents,
  READABILITY_BUDGET,
} from "../../src/game/render/readability";

// Issue #35 — combat readability. The arena dressing test (arena-environment +
// assets-manifest) validates that dressing EXISTS and is numerically valid; this
// file validates it stays READABLE: no map buries enemies/pickups/projectiles
// behind opaque dressing, carpets the floor, over-hazes the skyline, tightens
// fog onto the play space, lightens the background, or drops a silhouette into
// the arena. The same budget is read back off the live scene by
// tests/e2e/arena-readability.spec.ts.

const allMaps = { ...MAPS, ...SANDBOX_MAPS };

describe("arena combat readability (#35)", () => {
  it("freezes the readability budget so the contract can't drift at runtime", () => {
    expect(Object.isFrozen(READABILITY_BUDGET)).toBe(true);
  });

  it("passes every campaign + sandbox map against the readability budget", () => {
    for (const [mapId, map] of Object.entries(allMaps)) {
      const audit = auditArenaReadability(map);
      // Surface the offending rules in the failure message, not just "false".
      expect(audit.violations, `${mapId}: ${JSON.stringify(audit.violations)}`).toEqual([]);
      expect(audit.ok, mapId).toBe(true);
    }
  });

  it("keeps in-core props strictly below the distant-prop ceiling everywhere", () => {
    // The two-tier policy only means something if the stricter in-core cap is
    // actually tighter than the global one.
    expect(READABILITY_BUDGET.maxInPlayPropOpacity).toBeLessThan(READABILITY_BUDGET.maxPropOpacity);
    for (const [mapId, map] of Object.entries(allMaps)) {
      const m = auditArenaReadability(map).metrics;
      expect(m.maxInPlayPropOpacity, `${mapId} in-core prop opacity`).toBeLessThanOrEqual(
        READABILITY_BUDGET.maxInPlayPropOpacity,
      );
      // Fog reaches at least to the play-area diagonal on every map.
      expect(m.fogFar, `${mapId} fogFar`).toBeGreaterThanOrEqual(m.fogFarRequired);
    }
  });

  // The audit is only meaningful if each invariant actually bites a regression.
  // Mutate one shipped map per rule (never the registry object) and prove it now
  // fails on exactly that rule.
  describe("catches a regression on each invariant", () => {
    const base = MAPS.ashgate;
    const env = base.environment;

    function expectRule(map: typeof base, rule: string) {
      const audit = auditArenaReadability(map);
      expect(audit.ok).toBe(false);
      expect(
        audit.violations.map((v) => v.rule),
        JSON.stringify(audit.violations),
      ).toContain(rule);
    }

    it("an over-opaque in-core prop", () => {
      const map = {
        ...base,
        environment: { ...env, props: [{ ...env.props[0], x: 0, z: 0, opacity: 0.99 }] },
      };
      expectRule(map, "inPlayPropOpacity");
      expectRule(map, "propOpacity");
    });

    it("a near-opaque floor decal", () => {
      const map = {
        ...base,
        environment: { ...env, decals: [{ ...env.decals[0], opacity: 0.85 }] },
      };
      expectRule(map, "decalOpacity");
    });

    it("decals carpeting the floor", () => {
      const big = { ...env.decals[0], x: 0, z: 0, w: 70, d: 70 };
      const map = { ...base, environment: { ...env, decals: [big, big] } };
      expectRule(map, "decalCoverage");
    });

    it("an over-dense horizon haze", () => {
      const map = { ...base, environment: { ...env, horizonOpacity: 0.6 } };
      expectRule(map, "horizonOpacity");
    });

    it("a silhouette intruding into the play area", () => {
      const map = {
        ...base,
        environment: { ...env, silhouettes: [{ ...env.silhouettes[0], x: 0, z: 0, w: 10, d: 10 }] },
      };
      expectRule(map, "silhouetteIntrusion");
    });

    it("fog tightened in front of the farthest target", () => {
      const map = { ...base, theme: { ...base.theme, fogFar: 50 } };
      expectRule(map, "fogFar");
    });

    it("fog starting inside the combat bubble", () => {
      const map = { ...base, theme: { ...base.theme, fogNear: 4 } };
      expectRule(map, "fogNear");
    });

    it("a background too light for bright targets to pop", () => {
      const map = { ...base, theme: { ...base.theme, bg: 0xffffff } };
      expectRule(map, "backgroundLuminance");
    });

    it("a map whose presentation theme never resolved (fog + bg unaudited)", () => {
      // The registry always resolves a theme, but a raw ArenaMap — or a future
      // path that forgets to normalize — must not sail through with fog and
      // background unscored (every such metric reads 0, which passes every
      // numeric check). Fail closed instead.
      const themeless: ArenaMap = { ...base, theme: undefined };
      const audit = auditArenaReadability(themeless);
      expect(audit.ok, JSON.stringify(audit.violations)).toBe(false);
      expect(audit.violations.map((v) => v.rule)).toContain("missingTheme");
      // The unaudited metrics sit at their floor — exactly the silent pass we reject.
      expect(audit.metrics.fogFar).toBe(0);
      expect(audit.metrics.fogNear).toBe(0);
      expect(audit.metrics.backgroundLuminance).toBe(0);
    });
  });

  // The two caps only earn their keep if there is a band of opacity that's legal
  // out in the backdrop yet illegal in the core, where a prop can stand directly
  // in front of a target. Every shipped prop sits inside the core, so prove the
  // divergence with synthetic outer-ring placements: the stricter in-core cap
  // must bite a value the global cap waves through, and vice-versa.
  describe("the two-tier prop policy diverges between core and outer ring", () => {
    const base = MAPS.ashgate; // no authored bounds → default ±40, so core is ±34
    const env = base.environment;
    const BETWEEN = 0.88; // above the 0.85 in-core cap, below the 0.9 global cap

    function auditWithSoleProp(prop: (typeof env.props)[number]) {
      return auditArenaReadability({ ...base, environment: { ...env, props: [prop] } });
    }

    it("waves a mid-band prop through in the outer ring but fails the SAME value in the core", () => {
      const outer = auditWithSoleProp({ ...env.props[0], x: 38, z: 0, opacity: BETWEEN });
      expect(outer.ok, JSON.stringify(outer.violations)).toBe(true);
      // It was never counted as an in-core prop, so that metric stays at its floor.
      expect(outer.metrics.maxInPlayPropOpacity).toBe(0);
      expect(outer.metrics.maxPropOpacity).toBe(BETWEEN);

      const core = auditWithSoleProp({ ...env.props[0], x: 0, z: 0, opacity: BETWEEN });
      expect(core.ok).toBe(false);
      const rules = core.violations.map((v) => v.rule);
      expect(rules, JSON.stringify(core.violations)).toContain("inPlayPropOpacity"); // stricter cap bit
      expect(rules).not.toContain("propOpacity"); // global cap did not
    });

    it("still enforces the global ceiling on an outer-ring prop the in-core cap never sees", () => {
      const outer = auditWithSoleProp({ ...env.props[0], x: 38, z: 0, opacity: 0.95 });
      const rules = outer.violations.map((v) => v.rule);
      expect(rules, JSON.stringify(outer.violations)).toContain("propOpacity"); // global cap fires...
      expect(rules).not.toContain("inPlayPropOpacity"); // ...but the in-core cap never sees it
      expect(outer.metrics.maxInPlayPropOpacity).toBe(0);
    });
  });
});

describe("readability geometry + colour helpers", () => {
  it("derives extents from square and rect bounds (and the default)", () => {
    expect(playAreaExtents(undefined)).toEqual({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 });
    expect(playAreaExtents({ kind: "square", half: 16 })).toEqual({ minX: -16, maxX: 16, minZ: -16, maxZ: 16 });
    expect(playAreaExtents({ kind: "rect", minX: -12, maxX: 18, minZ: -8, maxZ: 24 })).toEqual({
      minX: -12,
      maxX: 18,
      minZ: -8,
      maxZ: 24,
    });
  });

  it("measures the play-area diagonal", () => {
    expect(playAreaDiagonal({ minX: -40, maxX: 40, minZ: -40, maxZ: 40 })).toBeCloseTo(Math.sqrt(80 * 80 * 2), 5);
  });

  it("classifies core vs outer-ring positions with the inset margin", () => {
    const ext = playAreaExtents(undefined); // ±40
    expect(isInCorePlayArea(0, 0, ext, 6)).toBe(true);
    expect(isInCorePlayArea(34, 0, ext, 6)).toBe(true); // exactly on the inset edge
    expect(isInCorePlayArea(36, 0, ext, 6)).toBe(false); // outer ring near the wall
    expect(isInCorePlayArea(0, 39, ext, 6)).toBe(false);
  });

  it("detects only boxes that overlap the play-area AABB", () => {
    const ext = playAreaExtents(undefined); // ±40
    expect(boxOverlapsPlayArea(0, 0, 10, 10, ext)).toBe(true); // dead centre
    expect(boxOverlapsPlayArea(52, 34, 16, 5, ext)).toBe(false); // distant silhouette
    expect(boxOverlapsPlayArea(0, 66, 36, 5, ext)).toBe(false); // far skyline band
  });

  it("scores luminance on the Rec.601 0..1 scale", () => {
    expect(luminance(0x000000)).toBe(0);
    expect(luminance(0xffffff)).toBeCloseTo(1, 5);
    expect(luminance(0x181818)).toBeCloseTo(24 / 255, 5); // the lightest shipped biome bg
  });
});
