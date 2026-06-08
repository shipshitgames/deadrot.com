/**
 * REDLINE — gameplay unit tests.
 *
 * Scope: PURE gameplay logic only. We deliberately avoid importing the modules
 * that pull in Three.js / WebGL / DOM (render.ts, hud.ts, input.ts, game.ts),
 * because those fail under `bun test` (no Vite, no browser). What we exercise:
 *   - constants.ts   : tuning invariants the "feel" depends on
 *   - course.ts      : deterministic, seeded course generation
 *   - entities/runner: momentum / jump / dash / stagger / ember state machine
 *   - systems/physics: surface resolution, hazards, embers, beacon, progress
 *
 * The Runner consumes an `Input` only via a small structural interface
 * (accelerate, jumpHeld, consumeJump(), consumeDash()), so we feed it a fake
 * input instead of the DOM-bound real one.
 */

import { describe, expect, test } from "bun:test";

import { COURSE, EMBER, RUNNER, WORLD } from "../../src/constants";
import { generateCourse } from "../../src/course";
import { Runner } from "../../src/entities/runner";
import { Physics } from "../../src/systems/physics";
import type { Course } from "../../src/types";

// --- Fake input -------------------------------------------------------------
// Mirrors the structural surface Runner.updateHorizontal() reads. Edge presses
// are latched then consumed, just like the real Input.
class FakeInput {
  accelerate = false;
  jumpHeld = false;
  private jumpQueued = false;
  private dashQueued = false;

  pressJump() {
    this.jumpQueued = true;
    this.jumpHeld = true;
  }
  releaseJump() {
    this.jumpHeld = false;
  }
  pressDash() {
    this.dashQueued = true;
  }

  consumeJump() {
    const q = this.jumpQueued;
    this.jumpQueued = false;
    return q;
  }
  consumeDash() {
    const q = this.dashQueued;
    this.dashQueued = false;
    return q;
  }
}

type RealInput = import("../../src/systems/input").Input;

// One fixed-step of horizontal integration. Event flags (justJumped/justDashed/
// justHit) are sticky — the real game loop clears them once per frame — so we
// clear them up front to mirror that frame scoping.
function step(runner: Runner, input: FakeInput, dt = 1 / 120) {
  runner.clearEvents();
  runner.updateHorizontal(dt, input as unknown as RealInput);
}

// Step the runner's horizontal integration for `seconds` at a fixed dt, so
// continuous behaviours (accel ramp, timers) play out the way the loop runs them.
function advance(runner: Runner, input: FakeInput, seconds: number, dt = 1 / 120) {
  let t = 0;
  // small epsilon so float drift doesn't drop the final step
  while (t < seconds - dt / 2) {
    step(runner, input, dt);
    t += dt;
  }
}

describe("constants — tuning invariants", () => {
  test("speed band is ordered: base < redline trigger < top", () => {
    expect(RUNNER.baseSpeed).toBeLessThan(RUNNER.topSpeed);
    const redlineSpeed = RUNNER.topSpeed * RUNNER.redlineFrac;
    expect(redlineSpeed).toBeGreaterThan(RUNNER.baseSpeed);
    expect(redlineSpeed).toBeLessThan(RUNNER.topSpeed);
  });

  test("stagger bleeds speed but never reverses (multiplier in 0..1)", () => {
    expect(RUNNER.staggerSpeedMul).toBeGreaterThan(0);
    expect(RUNNER.staggerSpeedMul).toBeLessThan(1);
  });

  test("cut-jump shortens but never inverts a jump (0 < mul < 1)", () => {
    expect(RUNNER.cutJumpMul).toBeGreaterThan(0);
    expect(RUNNER.cutJumpMul).toBeLessThan(1);
  });

  test("gravity pulls down and fall speed is capped below zero", () => {
    expect(WORLD.gravity).toBeLessThan(0);
    expect(RUNNER.maxFallSpeed).toBeLessThan(0);
  });

  test("course pacing: gap bounds and pit widths are sane", () => {
    expect(COURSE.minGapBetween).toBeLessThan(COURSE.maxGapBetween);
    expect(COURSE.pitWidthMin).toBeLessThan(COURSE.pitWidthMax);
    expect(COURSE.firstObstacleX).toBeGreaterThan(WORLD.startX);
  });
});

describe("course generation — deterministic & well-formed", () => {
  test("same seed produces an identical course", () => {
    const a = generateCourse(1337);
    const b = generateCourse(1337);
    expect(b).toEqual(a);
  });

  test("different seeds produce different layouts", () => {
    const a = generateCourse(1);
    const b = generateCourse(2);
    // At least one feature stream should differ.
    const differs =
      JSON.stringify(a.hazards) !== JSON.stringify(b.hazards) ||
      JSON.stringify(a.ramps) !== JSON.stringify(b.ramps) ||
      JSON.stringify(a.embers) !== JSON.stringify(b.embers);
    expect(differs).toBe(true);
  });

  test("beacon sits at the configured level length", () => {
    const c = generateCourse(1337);
    expect(c.beaconX).toBe(WORLD.levelLength);
  });

  test("a safe runway precedes the first hazard", () => {
    const c = generateCourse(1337);
    for (const h of c.hazards) {
      expect(h.x).toBeGreaterThanOrEqual(COURSE.firstObstacleX);
    }
  });

  test("the floor extends past the beacon as a landing pad", () => {
    const c = generateCourse(1337);
    const farthestEdge = Math.max(...c.platforms.map((p) => p.x1));
    expect(farthestEdge).toBeGreaterThan(c.beaconX);
  });

  test("platforms are non-degenerate (x0 < x1)", () => {
    const c = generateCourse(1337);
    for (const p of c.platforms) {
      expect(p.x0).toBeLessThan(p.x1);
    }
  });

  test("pits are encoded as gaps between platforms (sorted, non-overlapping)", () => {
    const c = generateCourse(1337);
    const sorted = [...c.platforms].sort((p, q) => p.x0 - q.x0);
    for (let i = 1; i < sorted.length; i++) {
      // next platform starts at or after the previous one ends (a pit gap may exist)
      expect(sorted[i].x0).toBeGreaterThanOrEqual(sorted[i - 1].x1);
    }
  });

  test("spike hazards are tall obstacles; bar hazards leave clearance to roll under", () => {
    const c = generateCourse(1337);
    const spikes = c.hazards.filter((h) => h.kind === "spike");
    const bars = c.hazards.filter((h) => h.kind === "bar");
    // The seeded course is rich enough to contain both kinds.
    expect(spikes.length).toBeGreaterThan(0);
    expect(bars.length).toBeGreaterThan(0);
    for (const s of spikes) {
      expect(s.height).toBeGreaterThan(0);
      expect(s.clearance).toBe(0);
    }
    for (const b of bars) {
      expect(b.clearance).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(b.clearance);
    }
  });

  test("course is populated with embers to chase", () => {
    const c = generateCourse(1337);
    expect(c.embers.length).toBeGreaterThan(0);
    expect(c.embers.every((e) => e.collected === false)).toBe(true);
  });
});

describe("runner — momentum state machine", () => {
  test("spawns at base speed on the ground", () => {
    const r = new Runner();
    expect(r.vx).toBe(RUNNER.baseSpeed);
    expect(r.onGround).toBe(true);
    expect(r.state).toBe("run");
    expect(r.speedFrac).toBe(0);
  });

  test("holding accelerate ramps speed up toward (and clamps at) top speed", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.accelerate = true;

    advance(r, input, 0.5);
    const mid = r.vx;
    expect(mid).toBeGreaterThan(RUNNER.baseSpeed);
    expect(mid).toBeLessThanOrEqual(RUNNER.topSpeed);

    // Long hold: clamps exactly at top speed, never overshoots.
    advance(r, input, 5);
    expect(r.vx).toBe(RUNNER.topSpeed);
    expect(r.speedFrac).toBe(1);
  });

  test("releasing accelerate coasts back down toward base speed", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.accelerate = true;
    advance(r, input, 5);
    expect(r.vx).toBe(RUNNER.topSpeed);

    input.accelerate = false;
    advance(r, input, 5);
    expect(r.vx).toBe(RUNNER.baseSpeed);
  });

  test("speedFrac is the normalized 0..1 position within the speed band", () => {
    const r = new Runner();
    // halfway between base and top
    r.vx = (RUNNER.baseSpeed + RUNNER.topSpeed) / 2;
    expect(r.speedFrac).toBeCloseTo(0.5, 5);
    // below base clamps to 0, above top clamps to 1
    r.vx = RUNNER.baseSpeed - 10;
    expect(r.speedFrac).toBe(0);
    r.vx = RUNNER.topSpeed + 10;
    expect(r.speedFrac).toBe(1);
  });

  test("moving forward advances X by velocity * time", () => {
    const r = new Runner();
    const input = new FakeInput();
    const startX = r.x;
    // base speed, no accel: x grows by ~baseSpeed * dt each step
    advance(r, input, 1);
    expect(r.x).toBeGreaterThan(startX);
    // roughly baseSpeed over 1s (no dash bonus, no accel)
    expect(r.x - startX).toBeCloseTo(RUNNER.baseSpeed, 0);
  });
});

describe("runner — jump (buffer / coyote / variable height)", () => {
  test("a buffered jump while grounded launches with full jump velocity", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.pressJump();
    step(r, input);
    expect(r.justJumped).toBe(true);
    expect(r.onGround).toBe(false);
    expect(r.vy).toBeCloseTo(RUNNER.jumpVel, 5);
  });

  test("coyote time lets you jump shortly after leaving the ground", () => {
    const r = new Runner();
    const input = new FakeInput();
    r.leaveGround(); // walked off an edge -> coyote window opens
    expect(r.onGround).toBe(false);

    input.pressJump();
    step(r, input);
    // within coyote window the jump still fires
    expect(r.justJumped).toBe(true);
    expect(r.vy).toBeCloseTo(RUNNER.jumpVel, 5);
  });

  test("coyote window expires — no late jump from thin air", () => {
    const r = new Runner();
    const input = new FakeInput();
    r.leaveGround();
    // burn well past coyoteTime with no jump pressed
    advance(r, input, RUNNER.coyoteTime + 0.2);
    input.pressJump();
    step(r, input);
    expect(r.justJumped).toBe(false);
  });

  test("releasing jump while ascending cuts upward velocity (variable height)", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.pressJump();
    step(r, input);
    expect(r.vy).toBeCloseTo(RUNNER.jumpVel, 5);

    // release while still rising -> velocity capped at jumpVel * cutJumpMul
    input.releaseJump();
    step(r, input);
    expect(r.vy).toBeLessThanOrEqual(RUNNER.jumpVel * RUNNER.cutJumpMul + 1e-6);
  });
});

describe("runner — dash-roll", () => {
  test("dash starts a timed roll and enters the low posture", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.pressDash();
    step(r, input);
    expect(r.justDashed).toBe(true);
    expect(r.dashing).toBe(true);
    expect(r.isLow).toBe(true);
    expect(r.state).toBe("dash");
  });

  test("dash ends after dashTime and then enters cooldown (no instant re-dash)", () => {
    const r = new Runner();
    const input = new FakeInput();
    input.pressDash();
    advance(r, input, RUNNER.dashTime + 1 / 60);
    expect(r.dashing).toBe(false);

    // immediately try to dash again while on cooldown — should be refused
    input.pressDash();
    step(r, input);
    expect(r.justDashed).toBe(false);
    expect(r.dashing).toBe(false);

    // after the cooldown expires, dashing is allowed again
    advance(r, input, RUNNER.dashCooldown + 0.05);
    input.pressDash();
    step(r, input);
    expect(r.justDashed).toBe(true);
  });

  test("dash adds a forward speed kick on top of running speed", () => {
    const noDash = new Runner();
    const dashing = new Runner();
    const plain = new FakeInput();
    const dashInput = new FakeInput();
    dashInput.pressDash();

    const startX = noDash.x;
    // one dt with vs without dash, same base velocity
    step(noDash, plain);
    step(dashing, dashInput);

    const plainDelta = noDash.x - startX;
    const dashDelta = dashing.x - startX;
    expect(dashDelta).toBeGreaterThan(plainDelta);
  });
});

describe("runner — stagger on hazard hit", () => {
  test("hit staggers, bleeds speed, and grants i-frames", () => {
    const r = new Runner();
    r.vx = RUNNER.topSpeed; // running hot
    r.hit();

    expect(r.staggered).toBe(true);
    expect(r.invuln).toBeGreaterThan(0);
    expect(r.state).toBe("hit");
    expect(r.justHit).toBe(true);
    // speed dropped to staggerSpeedMul of prior speed (floored at base*0.5)
    expect(r.vx).toBeCloseTo(RUNNER.topSpeed * RUNNER.staggerSpeedMul, 5);
    expect(r.vx).toBeLessThan(RUNNER.topSpeed);
  });

  test("a second hit during i-frames is ignored", () => {
    const r = new Runner();
    r.vx = RUNNER.topSpeed;
    r.hit();
    const afterFirst = r.vx;
    r.justHit = false;

    r.hit(); // still invulnerable
    expect(r.justHit).toBe(false);
    expect(r.vx).toBe(afterFirst); // unchanged
  });

  test("stagger locks acceleration: holding accelerate cannot exceed the stagger target", () => {
    const r = new Runner();
    r.vx = RUNNER.topSpeed;
    r.hit();
    const input = new FakeInput();
    input.accelerate = true;

    // during the stagger window, target is base*0.5 so speed can't climb back up
    advance(r, input, RUNNER.staggerTime * 0.5);
    expect(r.vx).toBeLessThan(RUNNER.topSpeed);
  });
});

describe("runner — ember pickup", () => {
  test("collecting an ember adds an instant speed bonus", () => {
    const r = new Runner();
    r.vx = RUNNER.baseSpeed;
    r.collectEmber(EMBER.speedBonus);
    expect(r.vx).toBeCloseTo(RUNNER.baseSpeed + EMBER.speedBonus, 5);
  });

  test("ember speed is clamped a touch above top speed", () => {
    const r = new Runner();
    r.vx = RUNNER.topSpeed;
    // many embers shouldn't run away past the clamp
    for (let i = 0; i < 10; i++) r.collectEmber(EMBER.speedBonus);
    expect(r.vx).toBeLessThanOrEqual(RUNNER.topSpeed * 1.08 + 1e-6);
  });
});

describe("physics — surface resolution, hazards, embers, beacon", () => {
  // A minimal flat course with a single platform under the runner.
  function flatCourse(): Course {
    return {
      platforms: [{ x0: 0, x1: 100, topY: WORLD.groundY }],
      hazards: [],
      embers: [],
      ramps: [],
      beaconX: 90,
    };
  }

  test("grounded over a platform sticks the runner to the surface", () => {
    const phys = new Physics();
    const r = new Runner();
    r.x = 10;
    r.onGround = true;
    r.vy = 0;
    phys.step(1 / 120, r, flatCourse());
    expect(r.y).toBeCloseTo(WORLD.groundY + RUNNER.radius, 5);
    expect(r.vy).toBe(0);
  });

  test("over a pit there is no floor: the runner falls", () => {
    const phys = new Physics();
    const course: Course = {
      platforms: [
        { x0: 0, x1: 20, topY: WORLD.groundY },
        { x0: 30, x1: 100, topY: WORLD.groundY },
      ],
      hazards: [],
      embers: [],
      ramps: [],
      beaconX: 90,
    };
    const r = new Runner();
    r.x = 25; // squarely over the 20..30 pit
    r.onGround = true;
    phys.step(1 / 120, r, course);
    expect(r.onGround).toBe(false);
    expect(r.vy).toBeLessThan(0); // gravity pulled it down
  });

  test("falling far below the world reports fellInPit (a lost run)", () => {
    const phys = new Physics();
    const course: Course = {
      platforms: [{ x0: 0, x1: 20, topY: WORLD.groundY }],
      hazards: [],
      embers: [],
      ramps: [],
      beaconX: 90,
    };
    const r = new Runner();
    r.x = 40; // past the only platform -> no floor
    r.y = WORLD.groundY - 9; // already below the death plane
    const res = phys.step(1 / 120, r, course);
    expect(res.fellInPit).toBe(true);
  });

  test("running into a spike at ground level triggers a hit", () => {
    const phys = new Physics();
    const course = flatCourse();
    course.hazards = [
      { kind: "spike", x: 10, width: COURSE.spikeWidth, baseY: WORLD.groundY, height: COURSE.spikeHeight, clearance: 0 },
    ];
    const r = new Runner();
    r.x = 10;
    r.y = WORLD.groundY + RUNNER.radius; // standing, feet at ground -> inside spike
    r.onGround = true;
    const res = phys.step(1 / 120, r, course);
    expect(res.hitHazard).toBe(true);
    expect(r.staggered).toBe(true);
  });

  test("jumping high enough clears the spike (feet above its top)", () => {
    const phys = new Physics();
    const course = flatCourse();
    course.hazards = [
      { kind: "spike", x: 10, width: COURSE.spikeWidth, baseY: WORLD.groundY, height: COURSE.spikeHeight, clearance: 0 },
    ];
    const r = new Runner();
    r.x = 10;
    // feet (= y - radius) need to clear baseY + height
    r.y = WORLD.groundY + COURSE.spikeHeight + RUNNER.radius + 0.5;
    r.onGround = false;
    const res = phys.step(1 / 120, r, course);
    expect(res.hitHazard).toBe(false);
    expect(r.staggered).toBe(false);
  });

  test("an upright runner at bar height hits; rolling (low posture) clears it", () => {
    const phys = new Physics();
    const bar = {
      kind: "bar" as const,
      x: 10,
      width: COURSE.barWidth,
      baseY: WORLD.groundY,
      height: 3.4,
      clearance: COURSE.barClearance,
    };
    // The bar's open span is [baseY .. baseY + clearance]; its underside is at
    // baseY + clearance. The collision uses head = y + radius*crouch, so the
    // runner must be high enough that an upright head pokes above the underside.
    // Position the runner so an upright head exceeds the bar bottom but a rolled
    // (crouched) head fits beneath it.
    const barBottom = bar.baseY + bar.clearance;
    // Put the rolled head exactly at the bar's underside: it clears (hit is
    // head > barBottom, strict), while an upright head pokes well above it.
    const y = barBottom - RUNNER.radius * RUNNER.dashCrouchScale;

    // upright runner at this height: head pokes above the bar -> hit
    const standing = new Runner();
    standing.x = 10;
    standing.y = y;
    standing.onGround = false;
    standing.crouch = 1;
    expect(standing.y + RUNNER.radius * standing.crouch).toBeGreaterThan(barBottom);
    const courseA = flatCourse();
    courseA.hazards = [bar];
    expect(phys.step(1 / 120, standing, courseA).hitHazard).toBe(true);

    // rolling runner at the same height: crouch squashes the head below -> clear
    const rolling = new Runner();
    rolling.x = 10;
    rolling.y = y;
    rolling.onGround = false;
    rolling.crouch = RUNNER.dashCrouchScale; // rolled-low posture
    expect(rolling.y + RUNNER.radius * rolling.crouch).toBeLessThanOrEqual(barBottom);
    const courseB = flatCourse();
    courseB.hazards = [bar];
    expect(phys.step(1 / 120, rolling, courseB).hitHazard).toBe(false);
  });

  test("i-frames suppress hazard hits", () => {
    const phys = new Physics();
    const course = flatCourse();
    course.hazards = [
      { kind: "spike", x: 10, width: COURSE.spikeWidth, baseY: WORLD.groundY, height: COURSE.spikeHeight, clearance: 0 },
    ];
    const r = new Runner();
    r.x = 10;
    r.y = WORLD.groundY + RUNNER.radius;
    r.onGround = true;
    r.invuln = 0.5; // currently invulnerable
    const res = phys.step(1 / 120, r, course);
    expect(res.hitHazard).toBe(false);
  });

  test("overlapping an ember collects it once and grants the speed bonus", () => {
    const phys = new Physics();
    const course = flatCourse();
    course.embers = [{ x: 10, y: WORLD.groundY + RUNNER.radius, collected: false }];
    const r = new Runner();
    r.x = 10;
    r.y = WORLD.groundY + RUNNER.radius;
    r.vx = RUNNER.baseSpeed;

    const res = phys.step(1 / 120, r, course);
    expect(res.collectedEmbers).toBe(1);
    expect(course.embers[0].collected).toBe(true);
    expect(r.vx).toBeGreaterThan(RUNNER.baseSpeed);

    // already collected -> not double-counted on a second overlap
    const res2 = phys.step(1 / 120, r, course);
    expect(res2.collectedEmbers).toBe(0);
  });

  test("reaching the beacon X reports a win", () => {
    const phys = new Physics();
    const course = flatCourse();
    const r = new Runner();
    r.x = course.beaconX + 1;
    r.y = WORLD.groundY + RUNNER.radius;
    r.onGround = true;
    const res = phys.step(1 / 120, r, course);
    expect(res.reachedBeacon).toBe(true);
  });

  test("a ramp launches the runner upward at its top", () => {
    const phys = new Physics();
    const course: Course = {
      platforms: [{ x0: 0, x1: 100, topY: WORLD.groundY }],
      hazards: [],
      embers: [],
      ramps: [{ x0: 5, x1: 10, baseY: WORLD.groundY, rise: COURSE.rampRise }],
      beaconX: 90,
    };
    const r = new Runner();
    r.x = 10; // right at the top of the ramp
    r.vx = RUNNER.topSpeed; // fast = bigger pop
    r.onGround = true;
    r.y = WORLD.groundY + COURSE.rampRise + RUNNER.radius;
    phys.step(1 / 120, r, course);
    expect(r.vy).toBeGreaterThan(0);
    expect(r.onGround).toBe(false);
  });
});

describe("physics — progress & distance math", () => {
  const phys = new Physics();
  const course: Course = {
    platforms: [{ x0: 0, x1: 600, topY: WORLD.groundY }],
    hazards: [],
    embers: [],
    ramps: [],
    beaconX: WORLD.levelLength,
  };

  test("progress is 0 at the start line", () => {
    const r = new Runner();
    r.x = WORLD.startX;
    expect(phys.progress(r, course)).toBe(0);
  });

  test("progress clamps to 1 at/after the beacon", () => {
    const r = new Runner();
    r.x = course.beaconX + 50;
    expect(phys.progress(r, course)).toBe(1);
  });

  test("progress is monotonic with X across the span", () => {
    const a = new Runner();
    const b = new Runner();
    a.x = WORLD.startX + 100;
    b.x = WORLD.startX + 200;
    expect(phys.progress(b, course)).toBeGreaterThan(phys.progress(a, course));
  });

  test("distance is meters run from the start (never negative)", () => {
    const r = new Runner();
    r.x = WORLD.startX + 42;
    expect(phys.distance(r)).toBeCloseTo(42, 5);

    r.x = WORLD.startX - 5; // behind the line clamps at 0
    expect(phys.distance(r)).toBe(0);
  });

  test("runway exposes the safe pre-hazard distance", () => {
    expect(phys.runway).toBe(COURSE.firstObstacleX);
  });
});
