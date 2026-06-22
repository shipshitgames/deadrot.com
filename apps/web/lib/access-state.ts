import type { GameStatus } from "@/lib/content";

// Player-facing access state for a game card (#355). Distinct from the dev-status
// (`GameStatus`: PLAYABLE / IN DEV / CONCEPT, which is build maturity) and from the
// raw entitlement gate (lib/access.ts). The gallery presents exactly four states:
//
//   available — a playable preview build, free or already unlocked: play now.
//   preview   — an early community build still in active development.
//   waitlist  — a design target with no build yet: join the list for first access.
//   locked    — playable, but behind the Deadrot Collection purchase the visitor
//               hasn't unlocked.
//
// Pure + exhaustive so the mapping is unit-tested and the UI can never invent a
// state. Dev-status decides the base; entitlement then refines a playable game.

export type AccessState = "available" | "preview" | "waitlist" | "locked";

/** The four states in presentation order (drives the access-surface legend). */
export const ACCESS_STATE_ORDER = ["available", "preview", "waitlist", "locked"] as const;

export function baseAccessState(status: GameStatus): Exclude<AccessState, "locked"> {
  switch (status) {
    case "PLAYABLE":
      return "available";
    case "IN DEV":
      return "preview";
    default:
      // CONCEPT — a design target, nothing to play yet.
      return "waitlist";
  }
}

interface AccessContext {
  /** The game sits behind the Deadrot Collection purchase gate. */
  gated: boolean;
  /** The visitor owns the collection — or auth is disabled, so everything reads open. */
  unlocked: boolean;
}

export function resolveAccessState(status: GameStatus, ctx: AccessContext): AccessState {
  const base = baseAccessState(status);
  // Only a playable, gated, not-yet-unlocked game flips to `locked`. A preview or
  // waitlist game is never "locked" — there's nothing to buy access to yet.
  if (base === "available" && ctx.gated && !ctx.unlocked) return "locked";
  return base;
}

interface AccessStatePresentation {
  label: string;
  /** One-line gallery legend description — honest, never a finished-game promise. */
  blurb: string;
}

export const ACCESS_STATE_PRESENTATION: Record<AccessState, AccessStatePresentation> = {
  available: { label: "Play now", blurb: "Playable preview build — jump in." },
  preview: { label: "Preview", blurb: "Early community build, rough edges and all." },
  waitlist: { label: "Waitlist", blurb: "A design target — join the list for first access." },
  locked: { label: "Locked", blurb: "Unlock the Deadrot Collection to play." },
};
