export type RothulkCinematicSlot = "intro" | "ignite" | "escape" | "caught";
export type RothulkCinematicOutcome = "escape" | "caught";

export interface RothulkCinematicBeat {
  id: string;
  slot: RothulkCinematicSlot;
  kicker: string;
  title: string;
  body: string;
  signal: string;
  durationMs: number;
  tone: "pyre" | "scourge" | "victory";
}

export interface HulkCinematicAssignment {
  site: string;
  intro: string | null;
  ignite: string | null;
  outro: Record<RothulkCinematicOutcome, string | null>;
}

const CINEMATIC_BEATS: Record<string, RothulkCinematicBeat> = {
  "enter-rothulk": {
    id: "enter-rothulk",
    slot: "intro",
    kicker: "The Pyre // Breach Sabotage",
    title: "Climb the nest. Burn it from inside.",
    body: "The hulk still hears the Choir. Reach its repeater-heart, ignite the core, and run the severed thing feral.",
    signal: "Boarding spike locked",
    durationMs: 3200,
    tone: "pyre",
  },
  "enter-maw-spire": {
    id: "enter-maw-spire",
    slot: "intro",
    kicker: "The Pyre // Deeper Breach",
    title: "One node blind. One more still singing.",
    body: "The Maw Spire carries the Choir farther into the lane. Climb its living signal tower and cut the link.",
    signal: "Second breach-hulk entered",
    durationMs: 3000,
    tone: "pyre",
  },
  "ignite-core": {
    id: "ignite-core",
    slot: "ignite",
    kicker: "Repeater-Heart Burning",
    title: "The local Choir link is collapsing.",
    body: "The lit core is eating through the node. When the signal breaks, every host in this hulk goes blind and feral.",
    signal: "Escape route armed",
    durationMs: 1800,
    tone: "scourge",
  },
  "hulk-severed": {
    id: "hulk-severed",
    slot: "escape",
    kicker: "Isolation Confirmed",
    title: "The nest can no longer call the swarm.",
    body: "One sabotaged hulk is feral and blind on the board. The wider Scourge survives. Move before another node takes its place.",
    signal: "Breach Sabotage filed to Warline",
    durationMs: 3000,
    tone: "victory",
  },
  "saboteur-caught": {
    id: "saboteur-caught",
    slot: "caught",
    kicker: "Pyre Signal // Lost",
    title: "The Choir kept this hulk connected.",
    body: "The saboteur is gone. The breach-core still sings, and every host in the nest knows the lane is open.",
    signal: "No isolation event recorded",
    durationMs: 3000,
    tone: "scourge",
  },
};

const DEFAULT_ASSIGNMENT: HulkCinematicAssignment = {
  site: "Uncharted Breach-Hulk",
  intro: "enter-rothulk",
  ignite: "ignite-core",
  outro: {
    escape: "hulk-severed",
    caught: "saboteur-caught",
  },
};

/** Cinematic slots are declared per authored hulk instead of hardcoded in Game. */
export const ROTHULK_CINEMATICS: Record<string, HulkCinematicAssignment> = {
  rothulk: { ...DEFAULT_ASSIGNMENT, site: "The Rothulk" },
  "maw-spire": {
    ...DEFAULT_ASSIGNMENT,
    site: "The Maw Spire",
    intro: "enter-maw-spire",
  },
};

export function resolveRothulkCinematic(id: string | null | undefined): RothulkCinematicBeat | null {
  return id ? (CINEMATIC_BEATS[id] ?? null) : null;
}

export function cinematicAssignmentForHulk(levelId: string): HulkCinematicAssignment {
  return ROTHULK_CINEMATICS[levelId] ?? DEFAULT_ASSIGNMENT;
}

export function cinematicForLevelStart(levelId: string): RothulkCinematicBeat | null {
  return resolveRothulkCinematic(cinematicAssignmentForHulk(levelId).intro);
}

export function cinematicForCoreIgnite(levelId: string): RothulkCinematicBeat | null {
  return resolveRothulkCinematic(cinematicAssignmentForHulk(levelId).ignite);
}

export function cinematicSlotForOutcome(outcome: RothulkCinematicOutcome): "escape" | "caught" {
  return outcome;
}

export function cinematicForLevelOutcome(
  levelId: string,
  outcome: RothulkCinematicOutcome,
): RothulkCinematicBeat | null {
  const assignment = cinematicAssignmentForHulk(levelId);
  return resolveRothulkCinematic(assignment.outro[cinematicSlotForOutcome(outcome)]);
}
