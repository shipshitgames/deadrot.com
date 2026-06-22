// Warline operation identity + sabotage beats for Rothulk (#364). Rothulk is
// the [[CANON]] §6 win condition rendered as a level: a lone Pyre saboteur
// climbs a beached Scourge breach-hulk, ignites its breach-core, and severs the
// local node from the Choir (§5). The operation NAME and its one-line frame are
// canon and live in the typed lore (`@shipshitgames/assets/lore` → games.json
// `warlineRole`), so the in-game briefing reads the same strings the web hub and
// the Warline front field — without re-authoring canon in game code.
//
// The three beats — IGNITE → COLLAPSE → ESCAPE — are tied to Choir isolation
// and the Warline sabotage report: lighting the core burns out the node's link
// to the Choir, the severed nest can no longer call the swarm, and what it files
// to the front is "one sabotaged nest goes feral and blind on the board".
// Dependency-free at runtime (plain strings + a phase tag) so it is safe to
// import in both the game loop and the React shell.

import { getGameLore } from "@shipshitgames/assets/lore";
import type { CoreLoopPhase } from "../types";

const SLUG = "rothulk";

const role = getGameLore(SLUG)?.warlineRole;

/** Canon Warline operation name for the breach-hulk climb (lore: games.json warlineRole). */
export const OPERATION_NAME: string = role?.operation ?? "Breach Sabotage";

/** Canon one-line operation frame — what this op buys the shared front. */
export const OPERATION_LINE: string =
  role?.line ??
  "A Pyre saboteur climbs a beached breach-hulk to ignite its core and sever the local node — one sabotaged nest goes feral and blind on the board.";

export type SabotageBeatId = "ignite" | "collapse" | "escape";

/** One sabotage beat: a player action tied to its core-loop phase, the Choir
 *  isolation it causes (CANON §5/§6), and the dispatch it files to the front. */
export interface SabotageBeat {
  id: SabotageBeatId;
  /** The core-loop phase this beat culminates in. */
  phase: CoreLoopPhase;
  /** Short label for the briefing card. */
  title: string;
  /** What the saboteur does, and how it cuts the Choir. */
  detail: string;
  /** The one-line Warline sabotage report this beat files to the front. */
  report: string;
}

/** The Breach Sabotage beats in narrative order — one per core-loop phase. */
export const SABOTAGE_BEATS: readonly SabotageBeat[] = [
  {
    id: "ignite",
    phase: "infiltrate",
    title: "Ignite the core",
    detail:
      "Climb the bio-hulk to its breach-core — the repeater-heart wiring the nest into the Choir — and set it alight from the inside.",
    report: "Pyre saboteur inside the hulk; breach-core burning.",
  },
  {
    id: "collapse",
    phase: "escape",
    title: "Collapse the node",
    detail:
      "The lit core eats the hulk and burns out its link to the Choir, severing the local node so it can no longer call the swarm.",
    report: "Local node severed from the Choir — the nest is cut off.",
  },
  {
    id: "escape",
    phase: "won",
    title: "Run it feral",
    detail:
      "Outrun the collapse. The severed nest goes feral — blind, dumb, instinct-only — and the lane is handed back to the war.",
    report: "One sabotaged nest goes feral and blind on the board.",
  },
] as const;

/** The sabotage beat that culminates in a given core-loop phase. */
export function beatForPhase(phase: CoreLoopPhase): SabotageBeat {
  return SABOTAGE_BEATS.find((beat) => beat.phase === phase) ?? SABOTAGE_BEATS[0];
}

/** The closing Warline dispatch a completed sabotage files to the front. */
export const FRONT_REPORT: string = beatForPhase("won").report;
