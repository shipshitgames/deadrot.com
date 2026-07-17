import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/game/constants";
import { HitStopController, shakeFor } from "../../src/game/feedback";

describe("Starblight combat feedback language", () => {
  test("shake tiers are strictly ordered from tap through slam", () => {
    const { tap, pop, thump, slam } = CONSTANTS.fx.shake.tiers;
    expect(tap).toBeLessThan(pop);
    expect(pop).toBeLessThan(thump);
    expect(thump).toBeLessThan(slam);
    expect(slam).toBeLessThanOrEqual(CONSTANTS.fx.shakeMax);
  });

  test("routine, dangerous, and marquee events resolve to consistent tiers", () => {
    expect(shakeFor("weaponFire")).toBe(CONSTANTS.fx.shake.tiers.tap);
    expect(shakeFor("gruntKill")).toBe(CONSTANTS.fx.shake.tiers.tap);
    expect(shakeFor("eliteSpawn")).toBe(CONSTANTS.fx.shake.tiers.pop);
    expect(shakeFor("eliteKill")).toBe(CONSTANTS.fx.shake.tiers.thump);
    expect(shakeFor("playerHit")).toBe(CONSTANTS.fx.shake.tiers.thump);
    expect(shakeFor("bossPhase")).toBe(CONSTANTS.fx.shake.tiers.slam);
    expect(shakeFor("bossDeath")).toBe(CONSTANTS.fx.shake.tiers.slam);
  });
});

describe("Starblight marquee hit-stop", () => {
  test("scales only the affected slice and preserves a long frame remainder", () => {
    const hitStop = new HitStopController();
    hitStop.trigger({ duration: 0.05, timeScale: 0.1 });

    expect(hitStop.scaleDelta(0.02)).toBeCloseTo(0.002, 9);
    expect(hitStop.scaleDelta(0.04)).toBeCloseTo(0.013, 9);
    expect(hitStop.scaleDelta(0.02)).toBeCloseTo(0.02, 9);
  });

  test("overlapping impacts keep the longer duration and strongest slowdown", () => {
    const hitStop = new HitStopController();
    hitStop.trigger({ duration: 0.04, timeScale: 0.1 });
    hitStop.trigger({ duration: 0.08, timeScale: 0.25 });

    expect(hitStop.scaleDelta(0.08)).toBeCloseTo(0.008, 9);
    expect(hitStop.scaleDelta(0.02)).toBeCloseTo(0.02, 9);
  });

  test("reset clears a pending impact", () => {
    const hitStop = new HitStopController();
    hitStop.trigger(CONSTANTS.fx.hitStop.bossDeath);
    hitStop.reset();
    expect(hitStop.scaleDelta(0.02)).toBeCloseTo(0.02, 9);
  });
});
