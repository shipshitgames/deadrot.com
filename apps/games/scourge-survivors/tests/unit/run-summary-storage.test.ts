import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearScores, loadScores, type ScoreEntry, saveScore } from "../../src/game/storage";
import type { RunMode } from "../../src/game/types";

// storage.ts is localStorage-backed and vitest runs in node by default, where
// `localStorage` is undefined. Rather than depend on the (uninstalled) jsdom
// environment we install a minimal, spec-shaped in-memory Storage shim. This is
// the same surface storage.ts touches: getItem / setItem / removeItem.
const SCORES_KEY = "scourge-survivors.scores.v1";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  /** Test-only helper to seed raw (possibly malformed) payloads. */
  __raw(key: string): string | null {
    return this.getItem(key);
  }
}

let memory: MemoryStorage;

beforeEach(() => {
  memory = new MemoryStorage();
  // storage.ts references the global `localStorage` directly.
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memory;
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
});

function makeEntry(over: Partial<ScoreEntry> = {}): ScoreEntry {
  return {
    score: 100,
    kills: 5,
    headshots: 2,
    time: 60,
    outcome: "dead",
    mode: "endless",
    level: 3,
    depthReached: 2,
    depthTotal: 5,
    depthName: "The Undercroft",
    goldEarned: 42,
    date: 1_700_000_000_000,
    ...over,
  };
}

describe("run-summary storage (#75)", () => {
  describe("saveScore / loadScores round-trip", () => {
    it("returns an empty list when nothing has been stored", () => {
      expect(loadScores()).toEqual([]);
    });

    it("persists a single entry and reads it back identically", () => {
      const entry = makeEntry();
      const afterSave = saveScore(entry);

      expect(afterSave).toHaveLength(1);
      // saveScore returns the new list AND it must be durable across a fresh load.
      const loaded = loadScores();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(entry);
    });

    it("retains the run-summary metadata fields verbatim", () => {
      saveScore(
        makeEntry({
          mode: "structured",
          level: 7,
          depthReached: 4,
          depthTotal: 9,
          depthName: "Ashfall Spires",
          goldEarned: 128,
        }),
      );

      const [loaded] = loadScores();
      expect(loaded.mode).toBe<RunMode>("structured");
      expect(loaded.level).toBe(7);
      expect(loaded.depthReached).toBe(4);
      expect(loaded.depthTotal).toBe(9);
      expect(loaded.depthName).toBe("Ashfall Spires");
      expect(loaded.goldEarned).toBe(128);
    });

    it("preserves each supported run mode", () => {
      const modes: RunMode[] = ["campaign", "structured", "endless", "coop", "sandbox"];
      // Save in ascending score so ordering is deterministic and 1:1 with `modes`.
      modes.forEach((mode, i) => {
        saveScore(makeEntry({ mode, score: (i + 1) * 10, kills: 0 }));
      });
      const loaded = loadScores();
      expect(loaded.map((e) => e.mode).sort()).toEqual([...modes].sort());
    });
  });

  describe("ordering", () => {
    it("sorts entries by score descending", () => {
      saveScore(makeEntry({ score: 50 }));
      saveScore(makeEntry({ score: 300 }));
      saveScore(makeEntry({ score: 150 }));

      const scores = loadScores().map((e) => e.score);
      expect(scores).toEqual([300, 150, 50]);
    });

    it("breaks score ties by kills descending", () => {
      saveScore(makeEntry({ score: 200, kills: 3 }));
      saveScore(makeEntry({ score: 200, kills: 9 }));
      saveScore(makeEntry({ score: 200, kills: 6 }));

      const kills = loadScores().map((e) => e.kills);
      expect(kills).toEqual([9, 6, 3]);
    });

    it("keeps only the top 10 entries by score", () => {
      // Insert 15 entries with distinct ascending scores.
      for (let i = 1; i <= 15; i++) {
        saveScore(makeEntry({ score: i * 10, kills: 0 }));
      }
      const loaded = loadScores();
      expect(loaded).toHaveLength(10);
      // The lowest five (10..50) must have been dropped.
      expect(loaded.map((e) => e.score)).toEqual([150, 140, 130, 120, 110, 100, 90, 80, 70, 60]);
      expect(Math.min(...loaded.map((e) => e.score))).toBe(60);
    });
  });

  describe("clearScores", () => {
    it("removes all stored entries and returns an empty list", () => {
      saveScore(makeEntry());
      expect(loadScores()).toHaveLength(1);

      const cleared = clearScores();
      expect(cleared).toEqual([]);
      expect(loadScores()).toEqual([]);
    });
  });

  describe("legacy / malformed localStorage entries", () => {
    it("backfills missing run-summary fields on legacy entries as undefined", () => {
      // A pre-#75 entry has only the original fields, none of the run-summary metadata.
      const legacy = {
        score: 80,
        kills: 4,
        headshots: 1,
        time: 30,
        outcome: "win",
        date: 1_600_000_000_000,
      };
      memory.setItem(SCORES_KEY, JSON.stringify([legacy]));

      const [loaded] = loadScores();
      expect(loaded.score).toBe(80);
      expect(loaded.outcome).toBe("win");
      // New metadata is absent on legacy rows → normalized to undefined, not NaN/null.
      expect(loaded.mode).toBeUndefined();
      expect(loaded.level).toBeUndefined();
      expect(loaded.depthReached).toBeUndefined();
      expect(loaded.depthTotal).toBeUndefined();
      expect(loaded.depthName).toBeUndefined();
      expect(loaded.goldEarned).toBeUndefined();
    });

    it("drops unknown run modes back to undefined", () => {
      memory.setItem(SCORES_KEY, JSON.stringify([{ ...makeEntry(), mode: "roguelike-deluxe" }]));
      expect(loadScores()[0]?.mode).toBeUndefined();
    });

    it("coerces non-numeric / negative numeric fields safely", () => {
      memory.setItem(
        SCORES_KEY,
        JSON.stringify([
          {
            score: "not-a-number",
            kills: -5,
            headshots: undefined,
            time: -1,
            outcome: "bogus",
            level: -2,
            depthReached: "x",
            goldEarned: -10,
            date: "garbage",
          },
        ]),
      );

      const [loaded] = loadScores();
      // Core numeric fields clamp to >= 0.
      expect(loaded.score).toBe(0);
      expect(loaded.kills).toBe(0);
      expect(loaded.headshots).toBe(0);
      expect(loaded.time).toBe(0);
      // Unknown outcome falls back to "dead".
      expect(loaded.outcome).toBe("dead");
      // Negative / non-finite optional metadata → undefined.
      expect(loaded.level).toBeUndefined();
      expect(loaded.depthReached).toBeUndefined();
      expect(loaded.goldEarned).toBeUndefined();
      // A non-numeric date is replaced with a real timestamp.
      expect(typeof loaded.date).toBe("number");
      expect(Number.isFinite(loaded.date)).toBe(true);
      expect(loaded.date).toBeGreaterThan(0);
    });

    it("returns an empty list for non-JSON garbage", () => {
      memory.setItem(SCORES_KEY, "{not valid json");
      expect(loadScores()).toEqual([]);
    });

    it("returns an empty list when the stored payload is not an array", () => {
      memory.setItem(SCORES_KEY, JSON.stringify({ score: 1 }));
      expect(loadScores()).toEqual([]);
    });

    it("filters out non-object members within the stored array", () => {
      memory.setItem(SCORES_KEY, JSON.stringify([null, 42, "ghost", makeEntry({ score: 999 })]));
      const loaded = loadScores();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.score).toBe(999);
    });

    it("normalizes legacy entries through a save and survives re-load", () => {
      // Seed a legacy row, then save a fresh modern entry on top of it.
      memory.setItem(
        SCORES_KEY,
        JSON.stringify([{ score: 70, kills: 2, headshots: 0, time: 10, outcome: "dead", date: 1 }]),
      );
      saveScore(makeEntry({ score: 500, depthName: "Deep Vault" }));

      const loaded = loadScores();
      expect(loaded).toHaveLength(2);
      // Modern entry sorts first and keeps its metadata.
      expect(loaded[0]?.score).toBe(500);
      expect(loaded[0]?.depthName).toBe("Deep Vault");
      // Legacy entry is normalized (metadata undefined) but still present.
      expect(loaded[1]?.score).toBe(70);
      expect(loaded[1]?.depthName).toBeUndefined();
    });
  });
});
