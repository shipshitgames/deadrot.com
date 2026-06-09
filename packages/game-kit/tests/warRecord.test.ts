import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  mergeWarResult,
  readWarRecord,
  recordWarResult,
  WAR_RECORD_KEY,
  type WarRecord,
  type WarRecordEntry,
} from "../src/core/warRecord";

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const g = globalThis as { window?: unknown };
let storage: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  storage = fakeLocalStorage();
  g.window = { localStorage: storage };
});

afterEach(() => {
  delete g.window;
});

/** Narrowing accessor: fails the test instead of tripping strict index access. */
function entryOf(record: WarRecord, slug: string): WarRecordEntry {
  const entry = record[slug];
  assert.ok(entry, `expected a war-record entry for ${slug}`);
  return entry;
}

test("empty store reads as an empty record", () => {
  assert.deepEqual(readWarRecord(), {});
});

test("first victory creates the entry with counters + bests", () => {
  recordWarResult("redline", { outcome: "victory", score: 1200, timeMs: 32500 }, 1000);
  assert.deepEqual(readWarRecord(), {
    redline: { plays: 1, victories: 1, bestScore: 1200, bestTimeMs: 32500, updatedAt: 1000 },
  });
});

test("counters increment; defeats count plays but not victories", () => {
  recordWarResult("starblight", { outcome: "victory", score: 9 }, 1);
  recordWarResult("starblight", { outcome: "defeat", score: 4 }, 2);
  recordWarResult("starblight", { outcome: "defeat" }, 3);
  const entry = entryOf(readWarRecord(), "starblight");
  assert.equal(entry.plays, 3);
  assert.equal(entry.victories, 1);
});

test("merges maxima for score and wave", () => {
  recordWarResult("scourge-survivors", { outcome: "defeat", score: 500, wave: 3 }, 1);
  recordWarResult("scourge-survivors", { outcome: "victory", score: 250, wave: 7 }, 2);
  const entry = entryOf(readWarRecord(), "scourge-survivors");
  assert.equal(entry.bestScore, 500); // lower later score does not regress the best
  assert.equal(entry.bestWave, 7);
  assert.equal(entry.updatedAt, 2); // updatedAt always follows the latest run
});

test("keeps the fastest time (race-style minimum)", () => {
  recordWarResult("redline", { outcome: "victory", timeMs: 40000 }, 1);
  recordWarResult("redline", { outcome: "victory", timeMs: 31000 }, 2);
  recordWarResult("redline", { outcome: "victory", timeMs: 55000 }, 3);
  assert.equal(entryOf(readWarRecord(), "redline").bestTimeMs, 31000);
});

test("a run without a stat leaves the banked best untouched", () => {
  recordWarResult("redline", { outcome: "victory", score: 800, timeMs: 30000 }, 1);
  recordWarResult("redline", { outcome: "defeat" }, 2);
  const entry = entryOf(readWarRecord(), "redline");
  assert.equal(entry.bestScore, 800);
  assert.equal(entry.bestTimeMs, 30000);
});

test("boss kills accumulate from booleans and counts", () => {
  recordWarResult("starblight", { outcome: "victory", bossKill: true }, 1);
  recordWarResult("starblight", { outcome: "defeat", bossKill: false }, 2);
  recordWarResult("starblight", { outcome: "victory", bossKill: 2 }, 3);
  assert.equal(entryOf(readWarRecord(), "starblight").bossKills, 3);
});

test("games keep independent entries under the shared key", () => {
  recordWarResult("redline", { outcome: "victory", timeMs: 30000 }, 1);
  recordWarResult("starblight", { outcome: "defeat", score: 5 }, 2);
  const record = readWarRecord();
  assert.deepEqual(Object.keys(record).sort(), ["redline", "starblight"]);
  assert.equal(entryOf(record, "redline").victories, 1);
  assert.equal(entryOf(record, "starblight").victories, 0);
  assert.ok(storage._map.has(WAR_RECORD_KEY));
});

test("mergeWarResult is pure and ignores non-finite inputs", () => {
  const merged = mergeWarResult(undefined, { outcome: "victory", score: Number.NaN, timeMs: Infinity, wave: 2 }, 9);
  assert.deepEqual(merged, { plays: 1, victories: 1, bestWave: 2, updatedAt: 9 });
});

test("corrupt JSON payload falls back to an empty record", () => {
  storage.setItem(WAR_RECORD_KEY, "{nope");
  assert.deepEqual(readWarRecord(), {});
  // …and recording on top of the corruption starts a fresh record.
  recordWarResult("redline", { outcome: "victory" }, 5);
  assert.deepEqual(readWarRecord(), { redline: { plays: 1, victories: 1, updatedAt: 5 } });
});

test("garbage entry shapes are dropped on read and reset on write", () => {
  storage.setItem(
    WAR_RECORD_KEY,
    JSON.stringify({ v: 1, data: { redline: "bogus", starblight: { plays: "x", victories: 2, updatedAt: 7 } } }),
  );
  // Unrecognizable entries vanish; recognizable fields are coerced.
  assert.deepEqual(readWarRecord(), { starblight: { plays: 0, victories: 2, updatedAt: 7 } });
  recordWarResult("redline", { outcome: "defeat" }, 8);
  assert.deepEqual(entryOf(readWarRecord(), "redline"), { plays: 1, victories: 0, updatedAt: 8 });
});

test("is SSR-safe without window", () => {
  delete g.window;
  assert.deepEqual(readWarRecord(), {});
  // recordWarResult still returns the merged record without throwing.
  const merged = recordWarResult("redline", { outcome: "victory", score: 10 }, 4);
  assert.deepEqual(merged, { redline: { plays: 1, victories: 1, bestScore: 10, updatedAt: 4 } });
});
