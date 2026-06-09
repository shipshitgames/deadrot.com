import assert from "node:assert/strict";
import { test } from "node:test";

import { createRng } from "../src/core/rng";

test("same seed produces the same sequence", () => {
  const a = createRng(1337);
  const b = createRng(1337);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.next(), b.next());
  }
});

test("different seeds diverge", () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test("next stays in [0, 1)", () => {
  const rng = createRng(99);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("range stays in [min, max)", () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng.range(-5, 5);
    assert.ok(v >= -5 && v < 5, `out of range: ${v}`);
  }
});

test("int covers [min, max] inclusive", () => {
  const rng = createRng(42);
  const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) {
    const v = rng.int(1, 3);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 3, `out of range: ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test("pick returns members and throws on empty", () => {
  const rng = createRng(5);
  const items = ["a", "b", "c"] as const;
  for (let i = 0; i < 100; i++) {
    assert.ok(items.includes(rng.pick(items)));
  }
  assert.throws(() => rng.pick([]));
});

test("chance respects probability extremes", () => {
  const rng = createRng(11);
  for (let i = 0; i < 100; i++) {
    assert.equal(rng.chance(1), true);
    assert.equal(rng.chance(0), false);
  }
});
