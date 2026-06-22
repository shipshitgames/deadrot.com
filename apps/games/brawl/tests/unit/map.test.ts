import { describe, expect, test } from "bun:test";
import { MAP } from "../../src/game/constants";

// The canon front-taxonomy classes declared in apps/lore/content/Maps.md.
const FRONTS = ["holdout", "lane", "breach", "orbital"] as const;

describe("Brawl canon map metadata (#140 lore cohesion)", () => {
  test("declares the canon loreId + front + name from Maps.md", () => {
    // Brawl is fought in the "No-Man's-Land Pocket" on The Hollow Lanes — see the
    // cross-game map registry row in apps/lore/content/Maps.md.
    expect(MAP.loreId).toBe("hollowlanes");
    expect(MAP.front).toBe("lane");
    expect(MAP.name).toBe("No-Man's-Land Pocket");
  });

  test("front is a valid canon front-taxonomy class", () => {
    expect(FRONTS).toContain(MAP.front);
  });

  test("the three join keys are all present and non-empty", () => {
    expect(MAP.name.length).toBeGreaterThan(0);
    expect(MAP.loreId.length).toBeGreaterThan(0);
    expect(MAP.front.length).toBeGreaterThan(0);
  });
});
