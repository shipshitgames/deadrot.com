import { type Accent, type GameStatus, gamesByStatus } from "@/lib/content";
import { buildFeedbackUrl, knownIssuesUrl, releaseNotesUrl } from "@/lib/feedback";

// The community page treats every game as an open build the player can shape.
// Data here is derived from the catalog-backed roster (gamesByStatus) so it can
// never drift from what's actually shipped; the page is a pure render of it.

export type CommunityPhase = "preview" | "development" | "concept";

export interface CommunityPhaseMeta {
  id: CommunityPhase;
  label: string;
  blurb: string;
  /** Whether this phase actively wants bug reports (vs. only ideas). */
  feedbackOpen: boolean;
}

export const COMMUNITY_PHASES: Record<CommunityPhase, CommunityPhaseMeta> = {
  preview: {
    id: "preview",
    label: "Open Preview",
    blurb: "Playable right now. Bugs, balance, and feel are all fair game.",
    feedbackOpen: true,
  },
  development: {
    id: "development",
    label: "In Development",
    blurb: "Coming together in the open. Shape it before it sets.",
    feedbackOpen: true,
  },
  concept: {
    id: "concept",
    label: "Concept",
    blurb: "Still on the drawing board. Pitch us what it should become.",
    feedbackOpen: false,
  },
};

const STATUS_TO_PHASE: Record<GameStatus, CommunityPhase> = {
  PLAYABLE: "preview",
  "IN DEV": "development",
  CONCEPT: "concept",
};

export function phaseForStatus(status: GameStatus): CommunityPhaseMeta {
  return COMMUNITY_PHASES[STATUS_TO_PHASE[status]];
}

// What feedback is most useful for each build right now. Falls back to the
// game's tagline for any roster entry not called out here.
const FOCUS: Record<string, string> = {
  "scourge-survivors": "Run pacing — how the breach difficulty curve feels deep in a run.",
  deadlane: "Lane economy, and whether tower placement reads clearly under pressure.",
  pactfall: "Lane balance, and whether objectives create real comeback moments.",
  brawl: "Matchup fairness and the input feel on one-on-one exchanges.",
  starblight: "Flight handling, and how readable enemy fire stays at speed.",
  redline: "Movement flow — where the level rhythm breaks your momentum.",
  rothulk: "Stealth tells, and whether climbing routes feel discoverable.",
  warline: "Campaign clarity — does the war console make your next run obvious?",
};

export interface CommunityBuild {
  slug: string;
  title: string;
  genre: string;
  accent: Accent;
  phase: CommunityPhaseMeta;
  focus: string;
  bugUrl: string;
  ideaUrl: string;
  knownIssuesUrl: string;
}

export const communityBuilds: CommunityBuild[] = gamesByStatus.map((game) => ({
  slug: game.slug,
  title: game.title,
  genre: game.genre,
  accent: game.accent,
  phase: phaseForStatus(game.status),
  focus: FOCUS[game.slug] ?? game.tagline,
  bugUrl: buildFeedbackUrl({ scope: game.slug, scopeLabel: game.title, kind: "bug" }),
  ideaUrl: buildFeedbackUrl({ scope: game.slug, scopeLabel: game.title, kind: "idea" }),
  knownIssuesUrl: knownIssuesUrl(game.slug),
}));

export const CONTRIBUTOR_PRINCIPLES: readonly string[] = [
  "These are previews, not finished games — rough edges are the point.",
  "Everything is built in the open. What you report steers what we fix next.",
  "Every report becomes a labelled issue you can follow all the way to the fix.",
  "What's playable today can change tomorrow — your feedback is part of why.",
];

export const SITE_FEEDBACK_URL = buildFeedbackUrl({
  scope: "site",
  scopeLabel: "the deadrot.com site",
  kind: "idea",
});
export const RELEASE_NOTES_URL = releaseNotesUrl();
export const SITE_KNOWN_ISSUES_URL = knownIssuesUrl();
