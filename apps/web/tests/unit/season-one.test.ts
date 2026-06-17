import { describe, expect, test } from "bun:test";

import { frontOperations, SEASON_ONE } from "@/lib/season-one";

// The full roster the front is built around. Asserting "these are present"
// instead of "there are exactly N operations" keeps the test stable as the
// catalog grows, while still pinning the known eight.
const ROSTER_SLUGS = [
  "scourge-survivors",
  "deadlane",
  "pactfall",
  "brawl",
  "starblight",
  "redline",
  "rothulk",
  "warline",
] as const;

describe("SEASON_ONE", () => {
  test("kicker, title, lede, and close are non-empty strings", () => {
    for (const field of ["kicker", "title", "lede", "close"] as const) {
      expect(typeof SEASON_ONE[field]).toBe("string");
      expect(SEASON_ONE[field].trim().length).toBeGreaterThan(0);
    }
  });

  test("beats is a non-empty array", () => {
    expect(Array.isArray(SEASON_ONE.beats)).toBe(true);
    expect(SEASON_ONE.beats.length).toBeGreaterThan(0);
  });

  test("every beat has a non-empty title and body", () => {
    for (const beat of SEASON_ONE.beats) {
      expect(typeof beat.title).toBe("string");
      expect(beat.title.trim().length).toBeGreaterThan(0);
      expect(typeof beat.body).toBe("string");
      expect(beat.body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("frontOperations", () => {
  test("is non-empty", () => {
    expect(frontOperations.length).toBeGreaterThan(0);
  });

  test("has no duplicate slugs", () => {
    const slugs = frontOperations.map((op) => op.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("includes every roster slug", () => {
    const slugs = new Set(frontOperations.map((op) => op.slug));
    for (const slug of ROSTER_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  test("every entry has non-empty operation and line strings and a defined accent", () => {
    for (const op of frontOperations) {
      expect(typeof op.operation).toBe("string");
      expect(op.operation.trim().length).toBeGreaterThan(0);
      expect(typeof op.line).toBe("string");
      expect(op.line.trim().length).toBeGreaterThan(0);
      expect(op.accent).toBeDefined();
    }
  });

  test("the canon operation contract holds for scourge-survivors and warline", () => {
    const bySlug = new Map(frontOperations.map((op) => [op.slug, op]));
    expect(bySlug.get("scourge-survivors")?.operation).toBe("Breach Purge");
    expect(bySlug.get("warline")?.operation).toBe("The Front");
  });
});
