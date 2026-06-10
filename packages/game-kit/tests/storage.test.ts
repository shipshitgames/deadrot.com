import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createLocalStore } from "../src/core/storage";

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

test("returns defaults when empty, round-trips set/get", () => {
  const store = createLocalStore("t:basic", { best: 0, runs: 0 });
  assert.deepEqual(store.get(), { best: 0, runs: 0 });
  store.set({ best: 12, runs: 3 });
  assert.deepEqual(store.get(), { best: 12, runs: 3 });
});

test("update patches objects and returns the next value", () => {
  const store = createLocalStore("t:update", { best: 0, runs: 0 });
  const next = store.update({ best: 9 });
  assert.deepEqual(next, { best: 9, runs: 0 });
  assert.deepEqual(
    store.update((c) => ({ ...c, runs: c.runs + 1 })),
    { best: 9, runs: 1 },
  );
});

test("merges defaults over stored data for new fields", () => {
  createLocalStore("t:merge", { a: 1 }).set({ a: 5 });
  const upgraded = createLocalStore("t:merge", { a: 1, b: 2 });
  assert.deepEqual(upgraded.get(), { a: 5, b: 2 });
});

test("version mismatch without migrate falls back to defaults", () => {
  createLocalStore("t:ver", { a: 1 }, { version: 1 }).set({ a: 7 });
  const v2 = createLocalStore("t:ver", { a: 0 }, { version: 2 });
  assert.deepEqual(v2.get(), { a: 0 });
});

test("version mismatch with migrate upgrades the payload", () => {
  createLocalStore("t:mig", { score: 5 }, { version: 1 }).set({ score: 50 });
  const v2 = createLocalStore<{ best: number }>(
    "t:mig",
    { best: 0 },
    {
      version: 2,
      migrate: (raw, from) => {
        assert.equal(from, 1);
        return { best: (raw as { score: number }).score };
      },
    },
  );
  assert.deepEqual(v2.get(), { best: 50 });
});

test("corrupt JSON falls back to defaults", () => {
  storage.setItem("t:bad", "{nope");
  const store = createLocalStore("t:bad", { ok: true });
  assert.deepEqual(store.get(), { ok: true });
});

test("clear removes the key", () => {
  const store = createLocalStore("t:clear", { n: 1 });
  store.set({ n: 9 });
  store.clear();
  assert.deepEqual(store.get(), { n: 1 });
});

test("is SSR-safe without window", () => {
  delete g.window;
  const store = createLocalStore("t:ssr", { n: 4 });
  assert.deepEqual(store.get(), { n: 4 });
  store.set({ n: 5 }); // no throw
  store.clear(); // no throw
});
