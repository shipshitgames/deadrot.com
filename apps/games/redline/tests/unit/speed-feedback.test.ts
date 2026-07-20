import { describe, expect, test } from "bun:test";

import { FEEDBACK, RUNNER } from "../../src/constants";
import { nextRedlineTransition } from "../../src/systems/speedFeedback";

describe("redline speed feedback", () => {
  test("enters once when the runner reaches the redline threshold", () => {
    const entered = nextRedlineTransition(false, RUNNER.redlineFrac);
    expect(entered).toEqual({ active: true, entered: true, exited: false });

    const held = nextRedlineTransition(entered.active, 1);
    expect(held).toEqual({ active: true, entered: false, exited: false });
  });

  test("uses an exit threshold below entry to avoid cue chatter", () => {
    expect(FEEDBACK.redlineExitFrac).toBeLessThan(RUNNER.redlineFrac);

    const hovering = nextRedlineTransition(true, (FEEDBACK.redlineExitFrac + RUNNER.redlineFrac) / 2);
    expect(hovering).toEqual({ active: true, entered: false, exited: false });
  });

  test("exits below the hysteresis band and can ignite again", () => {
    const exited = nextRedlineTransition(true, FEEDBACK.redlineExitFrac - 0.01);
    expect(exited).toEqual({ active: false, entered: false, exited: true });

    const reentered = nextRedlineTransition(exited.active, RUNNER.redlineFrac + 0.01);
    expect(reentered).toEqual({ active: true, entered: true, exited: false });
  });
});
