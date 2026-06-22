import { describe, expect, test } from "bun:test";

import {
  buildFeedbackUrl,
  FEEDBACK_LABEL,
  FEEDBACK_REPO,
  type FeedbackTarget,
  feedbackKindPrefix,
  feedbackLabels,
  knownIssuesUrl,
  releaseNotesUrl,
} from "@/lib/feedback";

// A representative game-scoped target. Individual tests spread/override as needed.
const GAME_TARGET: FeedbackTarget = {
  scope: "scourge-survivors",
  scopeLabel: "Scourge Survivors",
};

// Any token-ish substring we never want leaking into a static deep link.
const SECRET_MARKERS = ["ghp_", "github_pat_", "token", "secret", "Bearer ", "Authorization", "apiKey", "api_key"];

describe("buildFeedbackUrl", () => {
  test("targets the GitHub new-issue form on the default repo", () => {
    const url = new URL(buildFeedbackUrl(GAME_TARGET));
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues/new`);
    // Sanity: the repo constant is the one we expect.
    expect(url.pathname).toBe("/shipshitgames/deadrot.com/issues/new");
  });

  test("defaults to a [Bug] title prefixed with the scope label", () => {
    const params = new URL(buildFeedbackUrl(GAME_TARGET)).searchParams;
    const title = params.get("title");
    expect(title).not.toBeNull();
    expect(title?.startsWith("[Bug] Scourge Survivors: ")).toBe(true);
  });

  test("uses the [Idea] prefix when kind is idea", () => {
    const params = new URL(buildFeedbackUrl({ ...GAME_TARGET, kind: "idea" })).searchParams;
    expect(params.get("title")?.startsWith("[Idea] Scourge Survivors: ")).toBe(true);
  });

  test("uses the [Praise] prefix when kind is praise", () => {
    const params = new URL(buildFeedbackUrl({ ...GAME_TARGET, kind: "praise" })).searchParams;
    expect(params.get("title")?.startsWith("[Praise] Scourge Survivors: ")).toBe(true);
  });

  test("carries a body that references the scope slug", () => {
    const params = new URL(buildFeedbackUrl(GAME_TARGET)).searchParams;
    const body = params.get("body");
    expect(body).not.toBeNull();
    expect(body).toContain(GAME_TARGET.scope);
    // The body is structured enough to triage.
    expect(body).toContain("Steps to reproduce");
  });

  test("labels param (comma-joined) carries umbrella + scope + kind default", () => {
    const params = new URL(buildFeedbackUrl(GAME_TARGET)).searchParams;
    const labels = params.get("labels")?.split(",") ?? [];
    expect(labels).toContain(FEEDBACK_LABEL); // "community-feedback"
    expect(labels).toContain(GAME_TARGET.scope); // scope slug
    expect(labels).toContain("bug"); // default kind label
  });

  test("kind defaults map to the per-kind labels (bug/enhancement/praise)", () => {
    const labelsFor = (kind: FeedbackTarget["kind"]) =>
      new URL(buildFeedbackUrl({ ...GAME_TARGET, kind })).searchParams.get("labels")?.split(",") ?? [];
    expect(labelsFor("bug")).toContain("bug");
    expect(labelsFor("idea")).toContain("enhancement");
    expect(labelsFor("praise")).toContain("praise");
  });

  test("a custom repo option changes the host path", () => {
    const url = new URL(buildFeedbackUrl({ ...GAME_TARGET, repo: "octo/playground" }));
    expect(url.host).toBe("github.com");
    expect(url.pathname).toBe("/octo/playground/issues/new");
    expect(url.pathname).not.toContain(FEEDBACK_REPO);
  });

  test("contains no secrets or tokens — it is a static template", () => {
    // Exercise every kind so we cover all body headings.
    for (const kind of ["bug", "idea", "praise"] as const) {
      const raw = buildFeedbackUrl({ ...GAME_TARGET, kind });
      const decoded = decodeURIComponent(raw);
      const haystack = `${raw}\n${decoded}`.toLowerCase();
      for (const marker of SECRET_MARKERS) {
        expect(haystack).not.toContain(marker.toLowerCase());
      }
    }
  });
});

describe("feedbackLabels", () => {
  test("returns umbrella + scope + kind default for a bare game target", () => {
    expect(feedbackLabels(GAME_TARGET)).toEqual([FEEDBACK_LABEL, "scourge-survivors", "bug"]);
  });

  test("the site scope still includes the community-feedback umbrella", () => {
    const labels = feedbackLabels({ scope: "site", scopeLabel: "the deadrot.com site" });
    expect(labels).toContain(FEEDBACK_LABEL);
    expect(labels).toContain("site");
  });

  test("appends extra labels after the defaults", () => {
    const labels = feedbackLabels({ ...GAME_TARGET, labels: ["regression", "p1"] });
    expect(labels).toContain("regression");
    expect(labels).toContain("p1");
    // Extras come after the base trio.
    expect(labels.indexOf("regression")).toBeGreaterThan(labels.indexOf("bug"));
  });

  test("dedupes labels that collide with the defaults", () => {
    // scope === FEEDBACK_LABEL would otherwise appear twice; a duplicate extra too.
    const labels = feedbackLabels({
      scope: FEEDBACK_LABEL,
      scopeLabel: "Community",
      labels: ["bug", FEEDBACK_LABEL],
    });
    expect(labels.filter((l) => l === FEEDBACK_LABEL)).toHaveLength(1);
    expect(labels.filter((l) => l === "bug")).toHaveLength(1);
    // Set semantics preserve all distinct values exactly once.
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("trims whitespace and drops blank/whitespace-only labels", () => {
    const labels = feedbackLabels({ ...GAME_TARGET, labels: ["  spaced  ", "", "   ", "\t"] });
    expect(labels).toContain("spaced");
    expect(labels).not.toContain("");
    // No entry survives as pure whitespace.
    expect(labels.every((l) => l.trim().length > 0)).toBe(true);
    expect(labels.every((l) => l === l.trim())).toBe(true);
  });
});

describe("feedbackKindPrefix", () => {
  test("maps each kind to its title prefix", () => {
    expect(feedbackKindPrefix("bug")).toBe("Bug");
    expect(feedbackKindPrefix("idea")).toBe("Idea");
    expect(feedbackKindPrefix("praise")).toBe("Praise");
  });
});

describe("knownIssuesUrl", () => {
  function decodedQuery(url: string): string {
    const q = new URL(url).searchParams.get("q");
    expect(q).not.toBeNull();
    // Round-trips cleanly: encodeURIComponent output decodes back to the raw query.
    return decodeURIComponent(q as string);
  }

  test("points at the repo issue search on the default repo", () => {
    const url = new URL(knownIssuesUrl("scourge-survivors"));
    expect(url.host).toBe("github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues`);
  });

  test("a game scope filters by that scope's own label", () => {
    const query = decodedQuery(knownIssuesUrl("scourge-survivors"));
    expect(query).toContain('label:"scourge-survivors"');
    // Still an open-issue search.
    expect(query).toContain("is:issue");
    expect(query).toContain("is:open");
  });

  test("undefined scope falls back to the community-feedback umbrella label", () => {
    const query = decodedQuery(knownIssuesUrl());
    expect(query).toContain(`label:"${FEEDBACK_LABEL}"`);
    expect(query).not.toContain('label:"site"');
  });

  test('the "site" scope also falls back to the umbrella label', () => {
    const query = decodedQuery(knownIssuesUrl("site"));
    expect(query).toContain(`label:"${FEEDBACK_LABEL}"`);
    expect(query).not.toContain('label:"site"');
  });

  test("the q param is URL-encoded (no raw spaces or quotes leak into the query string)", () => {
    const raw = knownIssuesUrl("scourge-survivors");
    const rawQ = raw.split("?q=")[1] ?? "";
    expect(rawQ).not.toContain(" ");
    expect(rawQ).not.toContain('"');
    // But decodes back to a well-formed search.
    expect(decodedQuery(raw)).toBe('is:issue is:open label:"scourge-survivors"');
  });

  test("respects a custom repo arg", () => {
    const url = new URL(knownIssuesUrl("scourge-survivors", "octo/playground"));
    expect(url.pathname).toBe("/octo/playground/issues");
  });
});

describe("releaseNotesUrl", () => {
  test("points at the default repo's releases page", () => {
    const url = new URL(releaseNotesUrl());
    expect(url.host).toBe("github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/releases`);
  });

  test("respects a custom repo arg", () => {
    const url = new URL(releaseNotesUrl("octo/playground"));
    expect(url.pathname).toBe("/octo/playground/releases");
  });
});
