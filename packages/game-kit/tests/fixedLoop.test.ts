import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createFixedLoop } from "../src/core/fixedLoop";

// Drive requestAnimationFrame by hand so frame timing is fully deterministic.
const g = globalThis as unknown as {
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
  performance: { now(): number };
};

let queue: Array<(t: number) => void>;
let now: number;
const origRaf = g.requestAnimationFrame;
const origCaf = g.cancelAnimationFrame;
const origNow = g.performance.now.bind(g.performance);

beforeEach(() => {
  queue = [];
  now = 0;
  g.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  g.cancelAnimationFrame = () => {
    queue.length = 0;
  };
  g.performance.now = () => now;
});

afterEach(() => {
  g.requestAnimationFrame = origRaf;
  g.cancelAnimationFrame = origCaf;
  g.performance.now = origNow;
});

function step(ms: number) {
  now += ms;
  const cbs = queue.splice(0, queue.length);
  for (const cb of cbs) cb(now);
}

test("runs fixed updates to match elapsed time", () => {
  let updates = 0;
  let renders = 0;
  const loop = createFixedLoop({
    fixedDt: 1 / 120,
    update: () => updates++,
    render: () => renders++,
  });
  loop.start();
  step(100); // 0.1s → 12 fixed steps
  assert.equal(updates, 12);
  assert.equal(renders, 1);
  loop.stop();
});

test("clamps huge frame deltas", () => {
  let updates = 0;
  const loop = createFixedLoop({ fixedDt: 1 / 120, maxFrame: 0.1, update: () => updates++ });
  loop.start();
  step(5000); // tab-switch sized gap → clamped to 0.1s = 12 steps
  assert.equal(updates, 12);
  loop.stop();
});

test("render gets the accumulator fraction", () => {
  let alpha = -1;
  const loop = createFixedLoop({
    fixedDt: 1 / 100,
    update: () => {},
    render: (a) => {
      alpha = a;
    },
  });
  loop.start();
  step(15); // 0.015s → 1 step + 0.005s left → alpha = 0.5
  assert.ok(Math.abs(alpha - 0.5) < 1e-9, `alpha was ${alpha}`);
  loop.stop();
});

test("stop halts the loop and start is idempotent", () => {
  let updates = 0;
  const loop = createFixedLoop({ fixedDt: 1 / 120, update: () => updates++ });
  loop.start();
  loop.start();
  assert.equal(queue.length, 1); // no double-scheduling
  loop.stop();
  assert.equal(loop.running, false);
  step(50);
  assert.equal(updates, 0);
});
