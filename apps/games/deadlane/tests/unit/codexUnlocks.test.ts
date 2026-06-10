import { afterAll, describe, expect, test } from "bun:test";

/**
 * Codex discovery persistence (src/codexUnlocks.ts): creep kinds unlock once,
 * are persisted under "deadlane:codex", and map to lore bestiary slugs.
 *
 * The module seeds its in-memory mirror from localStorage at import time, so a
 * fake window/localStorage must exist BEFORE the dynamic import below.
 */

const backing = new Map<string, string>();
let writes = 0;

(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1;
      backing.set(key, value);
    },
    removeItem: (key: string) => void backing.delete(key),
  },
};

const { CREEP_BESTIARY_SLUGS, recordCreepKill, unlockedBestiarySlugs } = await import("../../src/codexUnlocks");

// Don't leak the fake window into other test files in the same process.
afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("codex unlocks", () => {
  test("starts with nothing unlocked", () => {
    expect(unlockedBestiarySlugs().size).toBe(0);
  });

  test("first kill of a kind unlocks its bestiary slug and persists once", () => {
    recordCreepKill("shambler");
    expect(unlockedBestiarySlugs()).toEqual(new Set(["scourge"]));
    expect(writes).toBe(1);
    expect(backing.get("deadlane:codex")).toContain("shambler");

    // Repeat kills of an already-seen kind never hit localStorage again.
    recordCreepKill("shambler");
    recordCreepKill("shambler");
    expect(writes).toBe(1);
  });

  test("each new kind costs exactly one write; slugs accumulate", () => {
    recordCreepKill("ripper");
    recordCreepKill("hulk");
    recordCreepKill("boss");
    recordCreepKill("boss");
    expect(writes).toBe(4);
    expect(unlockedBestiarySlugs()).toEqual(new Set(["scourge", "swarm-ripper", "graft-breacher", "breach-boss"]));
  });

  test("every creep kind maps to a bestiary slug", () => {
    expect(Object.keys(CREEP_BESTIARY_SLUGS).sort()).toEqual(["boss", "hulk", "ripper", "shambler"]);
    for (const slug of Object.values(CREEP_BESTIARY_SLUGS)) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});
