export type RedlineCinematicSlot = "intro" | "transition" | "delivered" | "caught";
export type RedlineRunOutcome = "delivered" | "caught";

export interface RedlineCinematicBeat {
  id: string;
  slot: RedlineCinematicSlot;
  kicker: string;
  title: string;
  body: string;
  signal: string;
  durationMs: number;
  tone: "pyre" | "scourge" | "delivery";
}

export interface RedlineCinematicAssignment {
  site: string;
  intro: string | null;
  transitions: string[];
  outro: Record<RedlineRunOutcome, string | null>;
}

const CINEMATIC_BEATS: Record<string, RedlineCinematicBeat> = {
  "take-the-message": {
    id: "take-the-message",
    slot: "intro",
    kicker: "The Pyre // Hand Carry",
    title: "The Choir took the wires. Take the message.",
    body: "Comms are dead. The Pact is not. Put the burn order in the next holdout's hands before the lane closes.",
    signal: "Cargo sealed // redline open",
    durationMs: 1600,
    tone: "pyre",
  },
  delivered: {
    id: "delivered",
    slot: "delivered",
    kicker: "Pact Relay // Restored",
    title: "The lane still talks.",
    body: "The order crossed the silence. Another holdout knows where to burn.",
    signal: "Delivery confirmed",
    durationMs: 2600,
    tone: "delivery",
  },
  caught: {
    id: "caught",
    slot: "caught",
    kicker: "Courier Signal // Lost",
    title: "The Choir reached the message.",
    body: "The runner stopped. The next holdout never heard the lane go quiet.",
    signal: "Cargo unrecovered",
    durationMs: 2600,
    tone: "scourge",
  },
};

const DEFAULT_ASSIGNMENT: RedlineCinematicAssignment = {
  site: "The Hollow Lanes // Dead Road",
  intro: "take-the-message",
  transitions: [],
  outro: {
    delivered: "delivered",
    caught: "caught",
  },
};

/** Run framing is declared per route so future courses can swap beats without touching Game. */
export const REDLINE_CINEMATICS: Record<string, RedlineCinematicAssignment> = {
  hollowlanes: DEFAULT_ASSIGNMENT,
};

export function resolveRedlineCinematic(id: string | null | undefined): RedlineCinematicBeat | null {
  return id ? (CINEMATIC_BEATS[id] ?? null) : null;
}

export function cinematicAssignmentForRoute(routeId: string): RedlineCinematicAssignment {
  return REDLINE_CINEMATICS[routeId] ?? DEFAULT_ASSIGNMENT;
}

export function cinematicForRunStart(routeId: string): RedlineCinematicBeat | null {
  return resolveRedlineCinematic(cinematicAssignmentForRoute(routeId).intro);
}

export function cinematicForTransition(routeId: string, transitionIndex: number): RedlineCinematicBeat | null {
  return resolveRedlineCinematic(cinematicAssignmentForRoute(routeId).transitions[transitionIndex]);
}

export function cinematicSlotForOutcome(outcome: RedlineRunOutcome): RedlineRunOutcome {
  return outcome;
}

export function cinematicForRunOutcome(routeId: string, outcome: RedlineRunOutcome): RedlineCinematicBeat | null {
  const assignment = cinematicAssignmentForRoute(routeId);
  return resolveRedlineCinematic(assignment.outro[cinematicSlotForOutcome(outcome)]);
}
