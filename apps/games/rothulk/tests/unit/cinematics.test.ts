import { describe, expect, it } from "bun:test";
import {
  cinematicAssignmentForHulk,
  cinematicForCoreIgnite,
  cinematicForLevelOutcome,
  cinematicForLevelStart,
  cinematicSlotForOutcome,
  resolveRothulkCinematic,
  ROTHULK_CINEMATICS,
} from "../../src/game/data/cinematics";
import { LEVELS } from "../../src/game/levels";

describe("Rothulk infiltration cinematics (#229)", () => {
  it("declares intro, ignite, and outcome slots for every authored hulk", () => {
    expect(Object.keys(ROTHULK_CINEMATICS).sort()).toEqual(LEVELS.map((level) => level.id).sort());

    for (const level of LEVELS) {
      const assignment = cinematicAssignmentForHulk(level.id);
      expect(assignment.site.length).toBeGreaterThan(3);
      expect(cinematicForLevelStart(level.id)?.slot).toBe("intro");
      expect(cinematicForCoreIgnite(level.id)?.slot).toBe("ignite");
      expect(cinematicForLevelOutcome(level.id, "escape")?.slot).toBe("escape");
      expect(cinematicForLevelOutcome(level.id, "caught")?.slot).toBe("caught");
    }
  });

  it("selects exactly one outro from the pure run outcome", () => {
    expect(cinematicSlotForOutcome("escape")).toBe("escape");
    expect(cinematicSlotForOutcome("caught")).toBe("caught");
    expect(cinematicForLevelOutcome("rothulk", "escape")?.id).not.toBe(
      cinematicForLevelOutcome("rothulk", "caught")?.id,
    );
  });

  it("keeps the ignite beat short and coupled to the core slot", () => {
    const ignite = cinematicForCoreIgnite("rothulk");
    expect(ignite?.slot).toBe("ignite");
    expect(ignite?.durationMs).toBeLessThanOrEqual(2000);
    expect(ignite?.body).toMatch(/feral|blind/i);
  });

  it("fails open for missing beats and safely falls back for an unknown hulk", () => {
    expect(resolveRothulkCinematic("missing-beat")).toBeNull();
    expect(resolveRothulkCinematic(null)).toBeNull();
    expect(cinematicAssignmentForHulk("unknown").site).toBe("Uncharted Breach-Hulk");
    expect(cinematicForLevelStart("unknown")?.slot).toBe("intro");
  });
});
