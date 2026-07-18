import { FEEDBACK, RUNNER } from "../constants";

export interface RedlineTransition {
  active: boolean;
  entered: boolean;
  exited: boolean;
}

/**
 * Resolve the top-speed feedback band with an exit threshold below the entry
 * threshold. This keeps audio and one-shot visual cues stable while velocity
 * jitters around the redline.
 */
export function nextRedlineTransition(previous: boolean, speedFrac: number): RedlineTransition {
  const active = previous ? speedFrac >= FEEDBACK.redlineExitFrac : speedFrac >= RUNNER.redlineFrac;
  return {
    active,
    entered: active && !previous,
    exited: !active && previous,
  };
}
