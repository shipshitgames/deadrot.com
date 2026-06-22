import { describe, expect, test } from "bun:test";
import {
  ARENA_RULES,
  aliveCount,
  arenaCameraFocus,
  chooseArenaRoster,
  clampSlots,
  fighterWeight,
  isOverVoid,
  isRingOut,
  knockback,
  launchBonus,
  nearestTarget,
  rankArena,
  recoveryDir,
  resolveSupport,
  strongerLaunch,
  wouldStepOffEdge,
} from "../../src/game/arena";
import { type FighterId, fighterById } from "../../src/game/roster";

describe("clampSlots", () => {
  test("clamps into the supported 2-4 range and rounds", () => {
    expect(clampSlots(1)).toBe(ARENA_RULES.minSlots);
    expect(clampSlots(0)).toBe(2);
    expect(clampSlots(5)).toBe(ARENA_RULES.maxSlots);
    expect(clampSlots(99)).toBe(4);
    expect(clampSlots(3)).toBe(3);
    expect(clampSlots(2.6)).toBe(3);
  });
});

describe("chooseArenaRoster", () => {
  test("puts the chosen fighter at slot 0 and fills distinct rivals", () => {
    const lineup = chooseArenaRoster("pyre-duelist", 4);
    expect(lineup[0]).toBe("pyre-duelist");
    expect(lineup).toHaveLength(4);
    expect(new Set(lineup).size).toBe(4);
    expect(lineup).not.toContain(undefined);
  });

  test("honours the requested slot count", () => {
    expect(chooseArenaRoster("warden-bastion", 2)).toHaveLength(2);
    expect(chooseArenaRoster("warden-bastion", 3)).toHaveLength(3);
  });

  test("clamps oversize requests rather than throwing", () => {
    expect(chooseArenaRoster("scourge-render", 9)).toHaveLength(4);
  });

  test("cycles a short roster when more slots than fighters are requested", () => {
    const lineup = chooseArenaRoster("a" as FighterId, 4, ["a", "b"] as FighterId[]);
    expect(lineup).toEqual(["a", "b", "b", "b"] as FighterId[]);
  });
});

describe("fighterWeight", () => {
  test("normalises maxHealth and clamps to [min, max]", () => {
    const { min, max } = ARENA_RULES.weight;
    expect(fighterWeight(1)).toBe(min);
    expect(fighterWeight(10_000)).toBe(max);
    expect(fighterWeight(ARENA_RULES.weight.divisor)).toBeCloseTo(1, 5);
  });

  test("heavier roster fighters resist knockback more than light ones", () => {
    const tank = fighterWeight(fighterById("trucebreaker").maxHealth);
    const skirmisher = fighterWeight(fighterById("pyre-duelist").maxHealth);
    expect(tank).toBeGreaterThan(skirmisher);
  });
});

describe("knockback", () => {
  const base = { basePush: 1, weight: 1, facing: 1 as const };

  test("grows with the target's accumulated damage", () => {
    const fresh = knockback({ ...base, damagePercent: 0 });
    const battered = knockback({ ...base, damagePercent: 150 });
    expect(battered.vx).toBeGreaterThan(fresh.vx);
    expect(battered.vy).toBeGreaterThan(fresh.vy);
  });

  test("respects attacker facing", () => {
    expect(knockback({ ...base, damagePercent: 50, facing: 1 }).vx).toBeGreaterThan(0);
    expect(knockback({ ...base, damagePercent: 50, facing: -1 }).vx).toBeLessThan(0);
  });

  test("heavier targets fly less far", () => {
    const light = knockback({ ...base, damagePercent: 80, weight: 0.8 });
    const heavy = knockback({ ...base, damagePercent: 80, weight: 1.3 });
    expect(Math.abs(heavy.vx)).toBeLessThan(Math.abs(light.vx));
  });

  test("launch adds vertical pop on top of the scaled magnitude", () => {
    const grounded = knockback({ ...base, damagePercent: 40 });
    const launched = knockback({ ...base, damagePercent: 40, launch: 3 });
    expect(launched.vy).toBeCloseTo(grounded.vy + 3, 5);
  });

  test("treats negative damage as zero (no shrink below the floor)", () => {
    const floor = knockback({ ...base, damagePercent: 0 });
    const negative = knockback({ ...base, damagePercent: -50 });
    expect(negative.vx).toBeCloseTo(floor.vx, 5);
  });
});

describe("launchBonus", () => {
  test("specials pop higher than heavies, lights add nothing", () => {
    expect(launchBonus("light")).toBe(0);
    expect(launchBonus("special")).toBeGreaterThan(launchBonus("heavy"));
    expect(launchBonus("heavy")).toBeGreaterThan(0);
  });
});

describe("isRingOut", () => {
  const { blast } = ARENA_RULES;

  test("center stage is safe", () => {
    expect(isRingOut(0, 0)).toBe(false);
  });

  test("past any blast boundary is a ring-out", () => {
    expect(isRingOut(blast.left - 1, 0)).toBe(true);
    expect(isRingOut(blast.right + 1, 0)).toBe(true);
    expect(isRingOut(0, blast.bottom - 1)).toBe(true);
    expect(isRingOut(0, blast.top + 1)).toBe(true);
  });
});

describe("resolveSupport", () => {
  test("rising fighters never land", () => {
    const result = resolveSupport({ prevY: 0, y: 1, vy: 5, x: 0 });
    expect(result.grounded).toBe(false);
    expect(result.y).toBe(1);
  });

  test("falling onto the main platform snaps to ground", () => {
    const result = resolveSupport({ prevY: 1.2, y: -0.3, vy: -4, x: 0 });
    expect(result.grounded).toBe(true);
    expect(result.y).toBe(ARENA_RULES.platform.top);
    expect(result.vy).toBe(0);
  });

  test("walking off the ledge finds no floor (sets up the ring-out)", () => {
    const offEdge = ARENA_RULES.platform.right + 2;
    const result = resolveSupport({ prevY: 0, y: -2, vy: -6, x: offEdge });
    expect(result.grounded).toBe(false);
  });

  test("side platforms are one-way: land from above", () => {
    const side = ARENA_RULES.sidePlatforms[0];
    const midX = (side.left + side.right) / 2;
    const landed = resolveSupport({ prevY: side.top + 0.5, y: side.top - 0.2, vy: -3, x: midX });
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(side.top);
  });

  test("side platforms are one-way: pass through from below", () => {
    const side = ARENA_RULES.sidePlatforms[0];
    const midX = (side.left + side.right) / 2;
    const through = resolveSupport({ prevY: side.top - 1, y: side.top - 0.1, vy: -1, x: midX });
    expect(through.y).toBe(side.top - 0.1);
  });

  test("snaps to the highest platform crossed this frame", () => {
    const side = ARENA_RULES.sidePlatforms[0];
    const midX = (side.left + side.right) / 2;
    // Falling from above the side platform while also over the main platform.
    const result = resolveSupport({ prevY: side.top + 1, y: -0.5, vy: -10, x: midX });
    expect(result.y).toBe(side.top);
  });
});

describe("isOverVoid", () => {
  test("over the main platform is solid", () => {
    expect(isOverVoid(0)).toBe(false);
  });

  test("beyond the platform edges is void", () => {
    expect(isOverVoid(ARENA_RULES.platform.right + 0.5)).toBe(true);
    expect(isOverVoid(ARENA_RULES.platform.left - 0.5)).toBe(true);
  });

  test("over a side platform is not void", () => {
    const side = ARENA_RULES.sidePlatforms[0];
    expect(isOverVoid((side.left + side.right) / 2)).toBe(false);
  });
});

describe("rankArena", () => {
  test("orders survivors first, then more stocks, then less damage", () => {
    const fighters = [
      { name: "out", eliminated: true, stocks: 0, damage: 0 },
      { name: "battered", eliminated: false, stocks: 2, damage: 120 },
      { name: "fresh", eliminated: false, stocks: 2, damage: 10 },
      { name: "lead", eliminated: false, stocks: 3, damage: 80 },
    ];
    const ranked = rankArena(fighters).map((f) => f.name);
    expect(ranked).toEqual(["lead", "fresh", "battered", "out"]);
  });

  test("does not mutate the input", () => {
    const input = [
      { eliminated: false, stocks: 1, damage: 5 },
      { eliminated: false, stocks: 3, damage: 5 },
    ];
    const snapshot = [...input];
    rankArena(input);
    expect(input).toEqual(snapshot);
  });
});

describe("aliveCount", () => {
  test("counts non-eliminated fighters", () => {
    expect(
      aliveCount([
        { eliminated: false, stocks: 1, damage: 0 },
        { eliminated: true, stocks: 0, damage: 0 },
        { eliminated: false, stocks: 2, damage: 0 },
      ]),
    ).toBe(2);
  });
});

describe("nearestTarget", () => {
  test("finds the closest living fighter and skips the eliminated", () => {
    const self = { x: 0, y: 0 };
    const near = { x: 1, y: 0, eliminated: false, id: "near" };
    const far = { x: 8, y: 0, eliminated: false, id: "far" };
    const closestButOut = { x: 0.2, y: 0, eliminated: true, id: "out" };
    expect(nearestTarget(self, [far, near, closestButOut])?.id).toBe("near");
  });

  test("returns null when nobody is left", () => {
    expect(nearestTarget({ x: 0, y: 0 }, [{ x: 1, y: 1, eliminated: true }])).toBeNull();
    expect(nearestTarget({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("wouldStepOffEdge", () => {
  test("stepping toward open stage is safe", () => {
    expect(wouldStepOffEdge(0, 1)).toBe(false);
    expect(wouldStepOffEdge(0, -1)).toBe(false);
  });

  test("stepping past the ledge is flagged", () => {
    expect(wouldStepOffEdge(ARENA_RULES.platform.right, 1)).toBe(true);
    expect(wouldStepOffEdge(ARENA_RULES.platform.left, -1)).toBe(true);
  });

  test("a zero direction never steps off", () => {
    expect(wouldStepOffEdge(ARENA_RULES.platform.right, 0)).toBe(false);
  });
});

describe("recoveryDir", () => {
  test("always points back toward stage center", () => {
    expect(recoveryDir(-9)).toBe(1);
    expect(recoveryDir(9)).toBe(-1);
  });
});

describe("strongerLaunch", () => {
  test("keeps the larger-magnitude launch when a second hit lands same frame", () => {
    const weak = { vx: 1, vy: 1 };
    const strong = { vx: 6, vy: 4 };
    expect(strongerLaunch(strong, weak)).toBe(strong);
    expect(strongerLaunch(weak, strong)).toBe(strong);
  });

  test("compares true magnitude, not a single axis", () => {
    // `tall` has the bigger vy but `wide` is the longer vector overall.
    const tall = { vx: 0, vy: 5 };
    const wide = { vx: 7, vy: 1 };
    expect(strongerLaunch(tall, wide)).toBe(wide);
  });

  test("prefers the incoming launch on a tie (latest reflects higher damage)", () => {
    const current = { vx: 3, vy: 4 };
    const next = { vx: -4, vy: 3 };
    expect(strongerLaunch(current, next)).toBe(next);
  });

  test("does not stack — the result is never the sum of both", () => {
    const a = { vx: 4, vy: 0 };
    const b = { vx: 3, vy: 0 };
    const result = strongerLaunch(a, b);
    expect(result.vx).toBe(4);
    expect(result.vx).not.toBe(a.vx + b.vx);
  });
});

describe("arenaCameraFocus", () => {
  const { camera } = ARENA_RULES;

  test("with no fighters the camera rests at the origin", () => {
    expect(arenaCameraFocus([])).toEqual({ x: 0, y: 0 });
  });

  test("a single fighter centers horizontally on it (within clamp)", () => {
    const focus = arenaCameraFocus([{ x: 2, y: 0 }]);
    expect(focus.x).toBeCloseTo(2, 5);
    expect(focus.y).toBe(0);
  });

  test("tracks the horizontal midpoint of the pack", () => {
    const focus = arenaCameraFocus([
      { x: -4, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(focus.x).toBeCloseTo(-1, 5);
  });

  test("clamps horizontal focus so a spread-out pack never over-pans", () => {
    const focus = arenaCameraFocus([
      { x: -40, y: 0 },
      { x: 40, y: 0 },
    ]);
    // Midpoint is 0, which is inside the clamp, so it stays centered.
    expect(focus.x).toBe(0);
    const skewed = arenaCameraFocus([
      { x: 30, y: 0 },
      { x: 50, y: 0 },
    ]);
    expect(skewed.x).toBe(camera.xClamp);
  });

  test("lifts toward the highest fighter, scaled and clamped", () => {
    const low = arenaCameraFocus([{ x: 0, y: 4 }]);
    expect(low.y).toBeCloseTo(4 * camera.yScale, 5);
    const high = arenaCameraFocus([{ x: 0, y: 999 }]);
    expect(high.y).toBe(camera.yClamp);
  });

  test("never drops the focus below the stage floor", () => {
    const focus = arenaCameraFocus([{ x: 0, y: -20 }]);
    expect(focus.y).toBe(0);
  });
});
