import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/constants";
import {
  completeEscape,
  createCoreLoopState,
  igniteBreachCore,
  objectiveForPhase,
  progressForPhase,
  shouldCompleteEscape,
  shouldIgniteCore,
} from "../../src/game/coreLoop";
import { buildLevel1 as buildLevel } from "../../src/game/levels";

describe("Rothulk core loop", () => {
  test("starts as an infiltration toward a connected breach-core", () => {
    const level = buildLevel();
    const state = createCoreLoopState();

    expect(state).toEqual({
      phase: "infiltrate",
      coreIgnited: false,
      scourgeSevered: false,
      exitReached: false,
    });
    expect(level.core.ignited).toBe(false);
    expect(level.exit).toEqual({
      x: CONSTANTS.HERO_SPAWN_X,
      y: CONSTANTS.HERO_SPAWN_Y,
      radius: CONSTANTS.EXIT_RADIUS,
      reached: false,
    });
    expect(level.scourge.every((scourge) => !scourge.feral)).toBe(true);
    expect(objectiveForPhase(state.phase)).toBe("REACH + IGNITE THE CORE");
  });

  test("ignites the core once and arms escape instead of winning immediately", () => {
    const level = buildLevel();
    const initial = createCoreLoopState();

    expect(shouldIgniteCore(level.core.x, level.core.y, level.core)).toBe(true);

    const escaping = igniteBreachCore(initial);
    level.core.ignited = escaping.coreIgnited;

    expect(escaping).toEqual({
      phase: "escape",
      coreIgnited: true,
      scourgeSevered: true,
      exitReached: false,
    });
    expect(shouldIgniteCore(level.core.x, level.core.y, level.core)).toBe(false);
    expect(igniteBreachCore(escaping)).toBe(escaping);
    expect(objectiveForPhase(escaping.phase)).toBe("ESCAPE THE SEVERED HULK");
  });

  test("finishes only at the extraction point after ignition", () => {
    const level = buildLevel();
    const escaping = igniteBreachCore(createCoreLoopState());

    expect(shouldCompleteEscape(level.core.x, level.core.y, level.exit)).toBe(false);

    const won = completeEscape(escaping);
    level.exit.reached = won.exitReached;

    expect(won.phase).toBe("won");
    expect(won.exitReached).toBe(true);
    expect(objectiveForPhase(won.phase)).toBe("HULK SEVERED // LANE CLEARED");
  });

  test("progress reverses during the escape runback", () => {
    const level = buildLevel();

    const nearCoreDepth = progressForPhase(level.core.x, level.width, "infiltrate");
    const nearCoreEscapeProgress = progressForPhase(level.core.x, level.width, "escape");
    const nearExitEscapeProgress = progressForPhase(level.exit.x, level.width, "escape");

    expect(nearCoreDepth).toBeGreaterThan(0.9);
    expect(nearCoreEscapeProgress).toBeLessThan(0.1);
    expect(nearExitEscapeProgress).toBeGreaterThan(0.9);
    expect(progressForPhase(level.exit.x, level.width, "won")).toBe(1);
  });
});
