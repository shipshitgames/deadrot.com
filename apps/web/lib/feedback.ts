// Community feedback is intentionally a GitHub "new issue" deep link: no token,
// no API call, no PII collection, nothing to leak. Every helper here is pure so
// the URLs can be unit-tested without a browser. The site never POSTs anywhere —
// the visitor lands on a pre-filled GitHub issue form and submits it themselves.

export const FEEDBACK_REPO = "shipshitgames/deadrot.com";
const GITHUB_ORIGIN = "https://github.com";

/** Umbrella label stamped on every community-filed issue. */
export const FEEDBACK_LABEL = "community-feedback";

export type FeedbackKind = "bug" | "idea" | "praise";

interface KindMeta {
  /** Title prefix, e.g. "[Bug]". */
  prefix: string;
  /** Heading for the free-text section of the issue body. */
  heading: string;
  /** Default GitHub label applied alongside the scope. */
  label: string;
}

const KINDS: Record<FeedbackKind, KindMeta> = {
  bug: { prefix: "Bug", heading: "What went wrong", label: "bug" },
  idea: { prefix: "Idea", heading: "The idea", label: "enhancement" },
  praise: { prefix: "Praise", heading: "What landed", label: "praise" },
};

export interface FeedbackTarget {
  /** Stable scope slug — a game slug or "site". Used as a GitHub label + body field. */
  scope: string;
  /** Human label for the scope, e.g. "Scourge Survivors" or "the deadrot.com site". */
  scopeLabel: string;
  /** Defaults to "bug". */
  kind?: FeedbackKind;
  /** Extra labels beyond the scope + kind defaults. */
  labels?: string[];
  /** Defaults to FEEDBACK_REPO. */
  repo?: string;
}

export function feedbackKindPrefix(kind: FeedbackKind): string {
  return KINDS[kind].prefix;
}

function issueBody(target: FeedbackTarget, kind: FeedbackKind): string {
  const { heading } = KINDS[kind];
  // A lightweight template — enough structure to triage, nothing the visitor
  // must fill before submitting. The HTML comment never renders on the issue.
  const lines = [
    `<!-- Thanks for hardening ${target.scopeLabel}. These are open previews, so rough edges are expected. -->`,
    "",
    `**Build:** ${target.scope}`,
    "",
    `### ${heading}`,
    "",
    "_Tell us what you saw._",
    "",
    "### Steps to reproduce",
    "",
    "1. ",
    "2. ",
    "",
    "### Browser / device",
    "",
    "_e.g. Chrome 124 on macOS, or iPhone 15 Safari._",
  ];
  return lines.join("\n");
}

/** Deduped, trimmed label list: umbrella + scope + kind default + extras. */
export function feedbackLabels(target: FeedbackTarget): string[] {
  const kind = target.kind ?? "bug";
  const base = [FEEDBACK_LABEL, target.scope, KINDS[kind].label, ...(target.labels ?? [])];
  return [...new Set(base.map((label) => label.trim()).filter((label) => label.length > 0))];
}

/** Pre-filled GitHub "new issue" URL for a feedback target. */
export function buildFeedbackUrl(target: FeedbackTarget): string {
  const kind = target.kind ?? "bug";
  const repo = target.repo ?? FEEDBACK_REPO;
  const params = new URLSearchParams({
    title: `[${KINDS[kind].prefix}] ${target.scopeLabel}: `,
    body: issueBody(target, kind),
    labels: feedbackLabels(target).join(","),
  });
  return `${GITHUB_ORIGIN}/${repo}/issues/new?${params.toString()}`;
}

/** GitHub issue search for open reports — scoped to one build, or the whole project. */
export function knownIssuesUrl(scope?: string, repo: string = FEEDBACK_REPO): string {
  const label = scope && scope !== "site" ? scope : FEEDBACK_LABEL;
  const query = `is:issue is:open label:${JSON.stringify(label)}`;
  return `${GITHUB_ORIGIN}/${repo}/issues?q=${encodeURIComponent(query)}`;
}

export function releaseNotesUrl(repo: string = FEEDBACK_REPO): string {
  return `${GITHUB_ORIGIN}/${repo}/releases`;
}
