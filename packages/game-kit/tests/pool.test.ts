import assert from "node:assert/strict";
import { test } from "node:test";

import { createPool } from "../src/core/pool";

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
