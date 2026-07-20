import { describe, expect, it } from "vitest";
import {
  ARENA_CINEMATICS,
  cinematicAssignmentFor,
  cinematicForRunOutcome,
  cinematicForRunProgress,
  cinematicForRunStart,
  cinematicSlotForOutcome,
  resolveCinematicBeat,
} from "../../src/game/data/cinematics";
import { SURVIVOR_MAP_ORDER } from "../../src/game/data/maps";

describe("breach-drop cinematics", () => {
  it("assigns data-driven intro and outcome slots to every shipped Survivors arena", () => {
    expect(Object.keys(ARENA_CINEMATICS).sort()).toEqual([...SURVIVOR_MAP_ORDER].sort());

    for (const arenaId of SURVIVOR_MAP_ORDER) {
      const assignment = cinematicAssignmentFor(arenaId);
      expect(assignment.site.length).toBeGreaterThan(2);
      expect(cinematicForRunStart(arenaId)?.slot).toBe("intro");
      expect(cinematicForRunOutcome(arenaId, "dead")?.slot).toBe("overrun");
      expect(cinematicForRunOutcome(arenaId, "win")?.slot).toBe("extract");
      expect(assignment.stingers).toEqual([]);
      expect(cinematicForRunProgress(arenaId, 0)).toBeNull();
    }
  });

  it("selects exactly one outro from the pure run outcome", () => {
    expect(cinematicSlotForOutcome("dead")).toBe("overrun");
    expect(cinematicSlotForOutcome("win")).toBe("extract");
    expect(cinematicForRunOutcome("ashgate", "dead")?.id).not.toBe(cinematicForRunOutcome("ashgate", "win")?.id);
  });

  it("fails open when a configured beat is absent", () => {
    expect(resolveCinematicBeat("missing-beat")).toBeNull();
    expect(resolveCinematicBeat(null)).toBeNull();
  });

  it("falls back safely for an unknown arena without blocking a run", () => {
    expect(cinematicAssignmentFor("unknown-arena").site).toBe("Uncharted Breach");
    expect(cinematicForRunStart("unknown-arena")?.slot).toBe("intro");
  });
});
