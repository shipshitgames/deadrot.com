import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { InputLatch } from "../src/core/inputLatch";

// Minimal window stand-in: an EventTarget that also satisfies the blur listener.
const g = globalThis as { window?: unknown };
let target: EventTarget;

beforeEach(() => {
  target = new EventTarget();
  g.window = target;
});

afterEach(() => {
  delete g.window;
});

function key(type: "keydown" | "keyup", code: string): Event {
  return Object.assign(new Event(type), { code });
}

function makeLatch() {
  return new InputLatch<"jump" | "dash">({
    keys: { Space: "jump", KeyW: "jump", ShiftLeft: "dash" },
    target: target as unknown as HTMLElement,
  });
}

test("edge press latches once until consumed", () => {
  const latch = makeLatch();
  target.dispatchEvent(key("keydown", "Space"));
  assert.equal(latch.consume("jump"), true);
  assert.equal(latch.consume("jump"), false); // consumed
  latch.dispose();
});

test("OS key-repeat does not re-latch", () => {
  const latch = makeLatch();
  target.dispatchEvent(key("keydown", "Space"));
  target.dispatchEvent(key("keydown", "Space")); // repeat while held
  assert.equal(latch.consume("jump"), true);
  assert.equal(latch.consume("jump"), false);
  target.dispatchEvent(key("keyup", "Space"));
  target.dispatchEvent(key("keydown", "Space")); // genuine new press
  assert.equal(latch.consume("jump"), true);
  latch.dispose();
});

test("held tracks keydown/keyup across aliased codes", () => {
  const latch = makeLatch();
  target.dispatchEvent(key("keydown", "Space"));
  target.dispatchEvent(key("keydown", "KeyW")); // second code, same action
  assert.equal(latch.isHeld("jump"), true);
  target.dispatchEvent(key("keyup", "Space"));
  assert.equal(latch.isHeld("jump"), true); // KeyW still down
  target.dispatchEvent(key("keyup", "KeyW"));
  assert.equal(latch.isHeld("jump"), false);
  latch.dispose();
});

test("programmatic press/setHeld for pointer bindings", () => {
  const latch = makeLatch();
  latch.press("dash");
  latch.setHeld("dash", true);
  assert.equal(latch.consume("dash"), true);
  assert.equal(latch.isHeld("dash"), true);
  latch.setHeld("dash", false);
  assert.equal(latch.isHeld("dash"), false);
  latch.dispose();
});

test("window blur clears held + queued state", () => {
  const latch = makeLatch();
  target.dispatchEvent(key("keydown", "ShiftLeft"));
  assert.equal(latch.isHeld("dash"), true);
  target.dispatchEvent(new Event("blur"));
  assert.equal(latch.isHeld("dash"), false);
  assert.equal(latch.consume("dash"), false);
  latch.dispose();
});

test("dispose detaches listeners", () => {
  const latch = makeLatch();
  latch.dispose();
  target.dispatchEvent(key("keydown", "Space"));
  assert.equal(latch.consume("jump"), false);
});
