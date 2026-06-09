import assert from "node:assert/strict";
import { test } from "node:test";

import { EMBER, RUNNER, WORLD } from "../../src/constants.ts";
import { generateCourse } from "../../src/course.ts";
import { Runner } from "../../src/entities/runner.ts";
import type { Input } from "../../src/systems/input.ts";
import { Physics } from "../../src/systems/physics.ts";
import type { Course } from "../../src/types.ts";

class TestInput {
  accelerate = false;
  jumpHeld = false;
  private jumpQueued = false;

  queueJump() {
    this.jumpQueued = true;
    this.jumpHeld = true;
  }

  consumeJump() {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  consumeDash() {
    return false;
  }
}

function asInput(input: TestInput): Input {
  return input as unknown as Input;
}

function flatCourse(overrides: Partial<Course> = {}): Course {
  return {
    platforms: [{ x0: 0, x1: 200, topY: WORLD.groundY }],
    hazards: [],
    embers: [],
    ramps: [],
    beaconX: 120,
    ...overrides,
  };
}

test("holding accelerate builds speed and releasing coasts back toward base speed", () => {
  const runner = new Runner();
  const input = new TestInput();

  input.accelerate = true;
  runner.updateHorizontal(0.75, asInput(input));

  assert.ok(runner.vx > RUNNER.baseSpeed, "hold-to-accelerate should build courier speed");

  const acceleratedSpeed = runner.vx;
  input.accelerate = false;
  runner.updateHorizontal(0.5, asInput(input));

  assert.ok(runner.vx < acceleratedSpeed, "release should bleed speed back toward the base run");
  assert.ok(runner.vx >= RUNNER.baseSpeed, "coasting should not drop below the baseline forward run");
});

test("releasing jump early cuts the courier arc shorter than a held jump", () => {
  const heldRunner = new Runner();
  const tappedRunner = new Runner();
  const heldInput = new TestInput();
  const tappedInput = new TestInput();

  heldInput.queueJump();
  tappedInput.queueJump();

  heldRunner.updateHorizontal(1 / 120, asInput(heldInput));
  tappedRunner.updateHorizontal(1 / 120, asInput(tappedInput));

  tappedInput.jumpHeld = false;
  heldRunner.updateHorizontal(1 / 120, asInput(heldInput));
  tappedRunner.updateHorizontal(1 / 120, asInput(tappedInput));

  assert.equal(heldRunner.onGround, false);
  assert.equal(tappedRunner.onGround, false);
  assert.ok(tappedRunner.vy < heldRunner.vy, "tap jump should cut vertical velocity");
});

test("speed embers are collected and push the runner faster", () => {
  const runner = new Runner();
  const physics = new Physics();
  const course = flatCourse({
    embers: [{ x: runner.x, y: runner.y, collected: false }],
  });

  const result = physics.step(1 / 120, runner, course);

  assert.equal(result.collectedEmbers, 1);
  assert.equal(course.embers[0]?.collected, true);
  assert.equal(runner.vx, RUNNER.baseSpeed + EMBER.speedBonus);
});

test("falling below a lane gap ends the run", () => {
  const runner = new Runner();
  const physics = new Physics();
  const course = flatCourse({ platforms: [] });
  let fellInPit = false;

  for (let i = 0; i < 60; i++) {
    const result = physics.step(1 / 30, runner, course);
    fellInPit = result.fellInPit;
    if (fellInPit) break;
  }

  assert.equal(fellInPit, true);
});

test("reaching the delivery beacon completes the course", () => {
  const runner = new Runner();
  const physics = new Physics();
  const course = generateCourse();

  runner.x = course.beaconX;

  const result = physics.step(1 / 120, runner, course);

  assert.equal(result.reachedBeacon, true);
  assert.equal(physics.progress(runner, course), 1);
});
