import { describe, expect, test } from "bun:test";
import {
  cinematicAssignmentForRoute,
  cinematicForRunOutcome,
  cinematicForRunStart,
  cinematicForTransition,
  cinematicSlotForOutcome,
  REDLINE_CINEMATICS,
  resolveRedlineCinematic,
} from "../../src/cinematics";
import { COURSE } from "../../src/constants";

describe("courier-run cinematics (#156)", () => {
  test("declares intro and outcome slots for the shipped route", () => {
    expect(Object.keys(REDLINE_CINEMATICS)).toEqual([COURSE.loreId]);

    const assignment = cinematicAssignmentForRoute(COURSE.loreId);
    expect(assignment.site).toContain("Hollow Lanes");
    expect(cinematicForRunStart(COURSE.loreId)?.slot).toBe("intro");
    expect(cinematicForRunOutcome(COURSE.loreId, "delivered")?.slot).toBe("delivered");
    expect(cinematicForRunOutcome(COURSE.loreId, "caught")?.slot).toBe("caught");
  });

  test("selects exactly one outro from the pure run outcome", () => {
    expect(cinematicSlotForOutcome("delivered")).toBe("delivered");
    expect(cinematicSlotForOutcome("caught")).toBe("caught");
    expect(cinematicForRunOutcome(COURSE.loreId, "delivered")?.id).not.toBe(
      cinematicForRunOutcome(COURSE.loreId, "caught")?.id,
    );
  });

  test("keeps the intro brief and every optional transition sub-second", () => {
    expect(cinematicForRunStart(COURSE.loreId)?.durationMs).toBeLessThanOrEqual(2000);

    const assignment = cinematicAssignmentForRoute(COURSE.loreId);
    for (let index = 0; index < assignment.transitions.length; index++) {
      expect(cinematicForTransition(COURSE.loreId, index)?.durationMs).toBeLessThanOrEqual(1000);
    }
  });

  test("fails open for missing beats and safely falls back for an unknown route", () => {
    expect(resolveRedlineCinematic("missing-beat")).toBeNull();
    expect(resolveRedlineCinematic(null)).toBeNull();
    expect(cinematicForTransition(COURSE.loreId, 0)).toBeNull();
    expect(cinematicAssignmentForRoute("unknown-route").site).toBe("The Hollow Lanes // Dead Road");
    expect(cinematicForRunStart("unknown-route")?.slot).toBe("intro");
  });
});
