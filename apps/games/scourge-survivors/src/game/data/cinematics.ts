export type CinematicSlot = "intro" | "stinger" | "overrun" | "extract";

export interface CinematicBeat {
  id: string;
  slot: CinematicSlot;
  kicker: string;
  title: string;
  body: string;
  signal: string;
  durationMs: number;
  tone: "pyre" | "scourge" | "victory";
}

export interface ArenaCinematicAssignment {
  site: string;
  intro: string | null;
  stingers: string[];
  outro: {
    overrun: string | null;
    extract: string | null;
  };
}

const CINEMATIC_BEATS: Record<string, CinematicBeat> = {
  "breach-drop": {
    id: "breach-drop",
    slot: "intro",
    kicker: "The Pyre // Breach Drop",
    title: "Descend. Cauterize. Return if able.",
    body: "A live breach is rooted below. Sever the Choir's repeaters. Burn what feeds it.",
    signal: "Drop vector locked",
    durationMs: 4200,
    tone: "pyre",
  },
  "descent-pressure": {
    id: "descent-pressure",
    slot: "stinger",
    kicker: "Choir Pressure Rising",
    title: "The nest heard you.",
    body: "Scourge mass is converging to keep the node inside the Choir. Keep descending.",
    signal: "Relay density increasing",
    durationMs: 2200,
    tone: "scourge",
  },
  overrun: {
    id: "overrun",
    slot: "overrun",
    kicker: "Pyre Signal // Lost",
    title: "Operator overrun.",
    body: "The breach remains. The Choir closes over the dead. Your descent still bought the front time.",
    signal: "Final telemetry recovered",
    durationMs: 3600,
    tone: "scourge",
  },
  extract: {
    id: "extract",
    slot: "extract",
    kicker: "Isolation Confirmed",
    title: "Local node severed.",
    body: "This nest is blind to the Choir. The wider Scourge survives. Move before the signal reconnects.",
    signal: "Extraction window open",
    durationMs: 3600,
    tone: "victory",
  },
};

const DEFAULT_ASSIGNMENT: ArenaCinematicAssignment = {
  site: "Uncharted Breach",
  intro: "breach-drop",
  stingers: [],
  outro: {
    overrun: "overrun",
    extract: "extract",
  },
};

/**
 * Per-arena cinematic slots. Mid-run stingers are intentionally authored but
 * off by default; they can be enabled later without changing gameplay systems.
 */
export const ARENA_CINEMATICS: Record<string, ArenaCinematicAssignment> = {
  ashgate: { ...DEFAULT_ASSIGNMENT, site: "Ashgate" },
  hollowlanes: { ...DEFAULT_ASSIGNMENT, site: "The Hollow Lanes" },
  maw: { ...DEFAULT_ASSIGNMENT, site: "The Maw" },
  perdition: { ...DEFAULT_ASSIGNMENT, site: "Perdition" },
  "foundry-wards": { ...DEFAULT_ASSIGNMENT, site: "Foundry Wards" },
  "breach-primus": { ...DEFAULT_ASSIGNMENT, site: "Breach Primus" },
  "reactor-verge": { ...DEFAULT_ASSIGNMENT, site: "Reactor Verge" },
  "choir-node": { ...DEFAULT_ASSIGNMENT, site: "Choir Node" },
};

export function resolveCinematicBeat(id: string | null | undefined): CinematicBeat | null {
  return id ? (CINEMATIC_BEATS[id] ?? null) : null;
}

export function cinematicAssignmentFor(arenaId: string): ArenaCinematicAssignment {
  return ARENA_CINEMATICS[arenaId] ?? DEFAULT_ASSIGNMENT;
}

export function cinematicForRunStart(arenaId: string): CinematicBeat | null {
  return resolveCinematicBeat(cinematicAssignmentFor(arenaId).intro);
}

export function cinematicForRunProgress(arenaId: string, progressIndex: number): CinematicBeat | null {
  const stingerId = cinematicAssignmentFor(arenaId).stingers[progressIndex];
  return resolveCinematicBeat(stingerId);
}

export function cinematicSlotForOutcome(outcome: "win" | "dead"): "extract" | "overrun" {
  return outcome === "win" ? "extract" : "overrun";
}

export function cinematicForRunOutcome(arenaId: string, outcome: "win" | "dead"): CinematicBeat | null {
  const assignment = cinematicAssignmentFor(arenaId);
  return resolveCinematicBeat(assignment.outro[cinematicSlotForOutcome(outcome)]);
}
