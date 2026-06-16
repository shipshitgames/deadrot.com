import assert from "node:assert/strict";
import { test } from "node:test";

import { createSnapshotStore } from "../src/core/snapshotStore";

test("get returns the initial snapshot", () => {
  const store = createSnapshotStore({ hp: 100 });
  assert.deepEqual(store.get(), { hp: 100 });
});

test("set replaces the snapshot and notifies subscribers", () => {
  const store = createSnapshotStore({ hp: 100 });
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.set({ hp: 40 });
  assert.deepEqual(store.get(), { hp: 40 });
  assert.equal(calls, 1, "subscriber fired once on set");
});

test("patch shallow-merges into the snapshot and notifies", () => {
  const store = createSnapshotStore({ hp: 100, score: 0 });
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.patch({ score: 250 });
  assert.deepEqual(store.get(), { hp: 100, score: 250 }, "untouched keys preserved");
  assert.equal(calls, 1, "subscriber fired once on patch");
});

test("set swaps the snapshot before subscribers run", () => {
  const store = createSnapshotStore({ hp: 100 });
  let seen = -1;
  store.subscribe(() => {
    seen = store.get().hp;
  });
  store.set({ hp: 7 });
  assert.equal(seen, 7, "subscriber observes the post-swap snapshot");
});

test("every subscriber is notified", () => {
  const store = createSnapshotStore({ n: 0 });
  let a = 0;
  let b = 0;
  store.subscribe(() => {
    a += 1;
  });
  store.subscribe(() => {
    b += 1;
  });
  store.patch({ n: 1 });
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("unsubscribe stops further notifications without affecting others", () => {
  const store = createSnapshotStore({ n: 0 });
  let kept = 0;
  let dropped = 0;
  const unsubscribe = store.subscribe(() => {
    dropped += 1;
  });
  store.subscribe(() => {
    kept += 1;
  });
  store.set({ n: 1 });
  unsubscribe();
  store.set({ n: 2 });
  assert.equal(dropped, 1, "unsubscribed listener stops after the first set");
  assert.equal(kept, 2, "remaining listener keeps receiving");
  assert.deepEqual(store.get(), { n: 2 });
});
