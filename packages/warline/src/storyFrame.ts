/**
 * @shipshitgames/warline — community-build story frame (#362).
 *
 * The framing copy that explains *why community builds matter*: every playable
 * preview is an operation on a shared front, playtest results read in as
 * provisional dispatches (never auto-promoted into locked canon), and the line
 * the community pushes resets to the weekly release cadence.
 *
 * Dependency-free per the package doctrine — plain strings + types, safe to
 * import on the edge server and in the React app. The operation slate is
 * DERIVED from GAME_OPERATIONS so the briefing can never claim an operation the
 * front does not actually field. The app's unit tests pin the prose against the
 * canon lore (gameLore.warlineRole), the same way narrative refs are pinned to
 * the timeline.
 */

import { GAME_OPERATIONS, GAME_SLUGS } from "./operations";
import type { GameSlug, HumanFaction } from "./types";

/** A faction whose weekly operation outcomes move the front. */
export type CadenceFaction = HumanFaction | "scourge";

/** One legible idea about how a preview becomes a move on the shared front. */
export interface StoryFramePillar {
  /** Stable id, kebab-case. */
  slug: "operations" | "resources" | "front-movement";
  title: string;
  body: string;
}

/** What a faction's weekly wins and losses buy (or cost) the front. */
export interface CadenceLine {
  faction: CadenceFaction;
  /** Display label as it reads on the front (e.g. "The Scourge"). */
  label: string;
  outcome: string;
}

/**
 * The Warline story frame. Static briefing copy — deterministic, render-pure,
 * and unit-testable. The UI's StoryFrame card renders it verbatim.
 */
export const STORY_FRAME = {
  /** The thesis, in five words. */
  headline: "Every preview is an operation.",
  thesis:
    "Each playable build is a sortie on the same war. Authenticated, bounded run claims can enter as operations and nudge a provisional line the whole community is pushing together.",

  /** How a preview becomes a move on the front (scope: operations, resources, provisional movement). */
  pillars: [
    {
      slug: "operations",
      title: "Trusted reports become operations",
      body: "Every game maps to one operation — purge, hold, contest, duel, intercept, run, or sabotage. Signed-in players report through a server broker; anonymous browser demos never move the shared line.",
    },
    {
      slug: "resources",
      title: "Runs spend the shared war pool",
      body: "Accepted operations credit the four war resources — scrap, fuel, biomass, intel — in one shared pool. Browser command-table spending stays inside an isolated local demo.",
    },
    {
      slug: "front-movement",
      title: "The line moves, provisionally",
      body: "Wins cool regions and push the line; losses let pressure root. The front is a living prototype, not a locked map — it shifts with the community's runs and resets between builds.",
    },
  ] satisfies StoryFramePillar[],

  /**
   * Playtest + community feedback → in-world reports, explicitly provisional so
   * the loop makes no false canon promises (scope bullet 2; mirrors the
   * "provisional until promoted" line in apps/lore/content/Games/Warline.md).
   */
  reports: {
    lead: "Playtests become field reports, not promises.",
    body: "Accepted, identity-bound community results read into the front as provisional dispatches. Client gameplay claims are bounded and rate-limited, not treated as cheat-proof proof, and never auto-promoted into locked canon; authored lore decides what holds.",
    /** Hard invariant: this loop never writes locked canon from a run. */
    provisional: true,
  },

  /**
   * Pyre / Warden / Scourge outcomes tied to the weekly release cadence
   * (scope bullet 3). Each release ships a fresh slate; the line this week seeds
   * where next week's war starts.
   */
  cadence: {
    lead: "The front keeps the weekly release cadence.",
    note: "Every release ships a fresh operation slate and a re-seeded front; the ground the community holds this week is where the next build's war opens.",
    factions: [
      {
        faction: "pyre",
        label: "Pyre",
        outcome:
          "Purge and sabotage runs burn breaches down from the inside — a strong Pyre week thins the nests before the next drop.",
      },
      {
        faction: "wardens",
        label: "Wardens",
        outcome:
          "Lane holds and logistics keep the holdouts connected — Warden wins bank ground the Choir has to retake.",
      },
      {
        faction: "scourge",
        label: "The Scourge",
        outcome:
          "The Choir escalates every week it runs — a quiet community week lets breaches root and the next front opens harder.",
      },
    ] satisfies CadenceLine[],
  },
} as const;

/**
 * The operation slate the briefing renders, derived from the operation contract
 * so the rendered slate can never list an operation the front does not actually
 * field. One entry per game, in GAME_OPERATIONS declaration order; the labels are
 * the same ones the Ops panel fires. (The pillar/cadence prose is hand-authored
 * flavor — only this slate is contract-derived.)
 */
export const STORY_FRAME_OPERATIONS: { game: GameSlug; operation: string }[] = GAME_SLUGS.map((game) => ({
  game,
  operation: GAME_OPERATIONS[game].label,
}));
