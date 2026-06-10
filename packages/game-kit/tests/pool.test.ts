import assert from "node:assert/strict";
import { test } from "node:test";

import { createBoundedPool, createPool } from "../src/core/pool";

test("acquire creates, release recycles", () => {
  let made = 0;
  const pool = createPool(() => ({ id: ++made }));
  const a = pool.acquire();
  assert.equal(made, 1);
  pool.release(a);
  const b = pool.acquire();
  assert.equal(b, a); // same object reused
  assert.equal(made, 1);
});

test("reset runs on release", () => {
  const pool = createPool(
    () => ({ hp: 0 }),
    (item) => {
      item.hp = 100;
    },
  );
  const a = pool.acquire();
  a.hp = 3;
  pool.release(a);
  assert.equal(a.hp, 100);
});

test("prewarm fills the free list", () => {
  let made = 0;
  const pool = createPool(() => ({ id: ++made }));
  pool.prewarm(5);
  assert.equal(pool.available, 5);
  assert.equal(pool.size, 5);
  pool.acquire();
  assert.equal(pool.available, 4);
  assert.equal(pool.size, 5); // no new allocations
});

interface Slot {
  id: number;
  age: number;
  active: boolean;
}

function makeBoundedPool(max: number) {
  let made = 0;
  const pool = createBoundedPool<Slot>(max, () => ({ id: ++made, age: 0, active: false }), {
    isActive: (s) => s.active,
    recyclePriority: (s) => s.age,
  });
  return { pool, count: () => made };
}

test("bounded pool reuses the first inactive item", () => {
  const { pool, count } = makeBoundedPool(4);
  const a = pool.acquire()!;
  a.active = true;
  a.active = false;
  const b = pool.acquire();
  assert.equal(b, a);
  assert.equal(count(), 1);
});

test("bounded pool creates until max", () => {
  const { pool, count } = makeBoundedPool(3);
  for (let i = 0; i < 3; i++) {
    const s = pool.acquire()!;
    s.active = true;
  }
  assert.equal(count(), 3);
  assert.equal(pool.items.length, 3);
});

test("bounded pool recycles the highest-priority active item", () => {
  const { pool, count } = makeBoundedPool(3);
  const ages = [2, 9, 5];
  for (const age of ages) {
    const s = pool.acquire()!;
    s.active = true;
    s.age = age;
  }
  const recycled = pool.acquire()!;
  assert.equal(recycled.age, 9); // oldest wins
  assert.equal(count(), 3); // no new allocation past max
});

test("bounded pool returns null when max is 0", () => {
  const { pool } = makeBoundedPool(0);
  assert.equal(pool.acquire(), null);
});

test("bounded pool forEach visits every created item", () => {
  const { pool } = makeBoundedPool(4);
  pool.acquire()!.active = true;
  pool.acquire()!.active = true;
  const seen: number[] = [];
  pool.forEach((s) => {
    seen.push(s.id);
  });
  assert.deepEqual(seen, [1, 2]);
});
