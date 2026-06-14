import { describe, expect, test } from "bun:test";

import {
  COMMUNITY_PHASES,
  CONTRIBUTOR_PRINCIPLES,
  type CommunityBuild,
  communityBuilds,
  phaseForStatus,
  RELEASE_NOTES_URL,
  SITE_FEEDBACK_URL,
  SITE_KNOWN_ISSUES_URL,
} from "@/lib/community";
import { FEEDBACK_LABEL, FEEDBACK_REPO, feedbackKindPrefix } from "@/lib/feedback";

// Slugs we never expect to vanish from the roster. Asserting "these are present"
// instead of "there are exactly N builds" keeps the test stable as the catalog grows.
const KNOWN_SLUGS = ["scourge-survivors", "warline", "brawl", "deadlane", "starblight"] as const;

const issueParams = (url: string): URLSearchParams => new URL(url).searchParams;

describe("phaseForStatus", () => {
  test("PLAYABLE maps to the open-preview phase (feedback open)", () => {
    const phase = phaseForStatus("PLAYABLE");
    expect(phase).toBe(COMMUNITY_PHASES.preview);
    expect(phase.id).toBe("preview");
    expect(phase.label).toBe("Open Preview");
    expect(phase.feedbackOpen).toBe(true);
  });

  test("IN DEV maps to the development phase (feedback open)", () => {
    const phase = phaseForStatus("IN DEV");
    expect(phase).toBe(COMMUNITY_PHASES.development);
    expect(phase.id).toBe("development");
    expect(phase.label).toBe("In Development");
    expect(phase.feedbackOpen).toBe(true);
  });

  test("CONCEPT maps to the concept phase (feedback closed)", () => {
    const phase = phaseForStatus("CONCEPT");
    expect(phase).toBe(COMMUNITY_PHASES.concept);
    expect(phase.id).toBe("concept");
    expect(phase.label).toBe("Concept");
    expect(phase.feedbackOpen).toBe(false);
  });
});

describe("COMMUNITY_PHASES", () => {
  test("each entry's id matches its record key, with a non-empty label and blurb", () => {
    for (const [key, meta] of Object.entries(COMMUNITY_PHASES)) {
      expect(meta.id).toBe(key as CommunityBuild["phase"]["id"]);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.blurb.length).toBeGreaterThan(0);
      expect(typeof meta.feedbackOpen).toBe("boolean");
    }
  });
});

describe("CONTRIBUTOR_PRINCIPLES", () => {
  test("is a non-empty list of non-empty strings", () => {
    expect(Array.isArray(CONTRIBUTOR_PRINCIPLES)).toBe(true);
    expect(CONTRIBUTOR_PRINCIPLES.length).toBeGreaterThan(0);
    for (const principle of CONTRIBUTOR_PRINCIPLES) {
      expect(typeof principle).toBe("string");
      expect(principle.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("communityBuilds", () => {
  test("is non-empty", () => {
    expect(communityBuilds.length).toBeGreaterThan(0);
  });

  test("every entry has the CommunityBuild shape with non-empty fields", () => {
    for (const build of communityBuilds) {
      // Non-empty string fields.
      for (const field of [
        "slug",
        "title",
        "genre",
        "accent",
        "focus",
        "bugUrl",
        "ideaUrl",
        "knownIssuesUrl",
      ] as const) {
        expect(typeof build[field]).toBe("string");
        expect((build[field] as string).trim().length).toBeGreaterThan(0);
      }
      // Phase is one of the canonical phase metas.
      expect(Object.values(COMMUNITY_PHASES)).toContain(build.phase);
    }
  });

  test("focus is always a non-empty string (tagline fallback covers un-curated builds)", () => {
    for (const build of communityBuilds) {
      expect(build.focus.trim().length).toBeGreaterThan(0);
    }
  });

  test("has no duplicate slugs", () => {
    const slugs = communityBuilds.map((build) => build.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("includes the known builds", () => {
    const slugs = new Set(communityBuilds.map((build) => build.slug));
    for (const slug of KNOWN_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  test("bugUrl is a [Bug] new-issue link labelled with the build slug", () => {
    for (const build of communityBuilds) {
      const url = new URL(build.bugUrl);
      expect(url.origin).toBe("https://github.com");
      expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues/new`);

      const params = url.searchParams;
      expect(params.get("title")?.startsWith(`[${feedbackKindPrefix("bug")}]`)).toBe(true);

      const labels = (params.get("labels") ?? "").split(",");
      expect(labels).toContain(build.slug);
      expect(labels).toContain(FEEDBACK_LABEL);
      expect(labels).toContain("bug");
    }
  });

  test("ideaUrl is an [Idea] new-issue link labelled with the build slug", () => {
    for (const build of communityBuilds) {
      const url = new URL(build.ideaUrl);
      expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues/new`);

      const params = url.searchParams;
      expect(params.get("title")?.startsWith(`[${feedbackKindPrefix("idea")}]`)).toBe(true);

      const labels = (params.get("labels") ?? "").split(",");
      expect(labels).toContain(build.slug);
      expect(labels).toContain(FEEDBACK_LABEL);
    }
  });

  test("knownIssuesUrl is an issue-search link that references the build slug", () => {
    for (const build of communityBuilds) {
      const url = new URL(build.knownIssuesUrl);
      expect(url.origin).toBe("https://github.com");
      expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues`);
      // The query is URL-encoded; decoding the `q` param should surface the slug.
      const query = url.searchParams.get("q") ?? "";
      expect(query).toContain(build.slug);
    }
  });
});

describe("site-level feedback URLs", () => {
  test("SITE_FEEDBACK_URL is an [Idea] issue scoped to the site on the feedback repo", () => {
    const url = new URL(SITE_FEEDBACK_URL);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues/new`);

    const params = issueParams(SITE_FEEDBACK_URL);
    expect(params.get("title")?.startsWith(`[${feedbackKindPrefix("idea")}]`)).toBe(true);

    const labels = (params.get("labels") ?? "").split(",");
    expect(labels).toContain("site");
    expect(labels).toContain(FEEDBACK_LABEL);
  });

  test("RELEASE_NOTES_URL is the releases page of the feedback repo", () => {
    const url = new URL(RELEASE_NOTES_URL);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/releases`);
  });

  test("SITE_KNOWN_ISSUES_URL is the project-wide issue search on the feedback repo", () => {
    const url = new URL(SITE_KNOWN_ISSUES_URL);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe(`/${FEEDBACK_REPO}/issues`);
    // Unscoped known-issues falls back to the umbrella feedback label.
    const query = url.searchParams.get("q") ?? "";
    expect(query).toContain(FEEDBACK_LABEL);
  });
});
