import { describe, expect, test } from "bun:test";
import { LEVELS } from "../../src/game/levels";

// The canon front-taxonomy classes declared in apps/lore/content/Maps.md.
const FRONTS = ["holdout", "lane", "breach", "orbital"] as const;

describe("Rothulk canon map metadata (#140 lore cohesion)", () => {
  test("every level declares the canon loreId + front matching Maps.md", () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    for (const entry of LEVELS) {
      const level = entry.build();
      // Rothulk is the beached breach-ship in Cinder Flats — a breach front
      // (apps/lore/content/Maps.md: Cinder-Flats · `cinder` · breach).
      expect(level.loreId).toBe("cinder");
      expect(level.front).toBe("breach");
    }
  });

  test("front is always a valid canon front-taxonomy class", () => {
    for (const entry of LEVELS) {
      expect(FRONTS).toContain(entry.build().front);
    }
  });
});
