// Mobile play rebuilds two inputs the browser only gives a desktop: raw mouse
// deltas (pointer lock) and WASD booleans. These tests pin that reconstruction
// — the stick's deadzone and sprint tier, the look drag's batching, and the
// pitch clamp that stops a hard swipe from flipping the horizon. All of it is
// pure, so a phone is never needed to know the scheme is right.

import type { MoveIntent } from "@shipshitgames/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyLookDelta,
  applyStickToMove,
  isCoarsePointer,
  LOOK_SENSITIVITY,
  PITCH_LIMIT,
  STICK_DEADZONE,
  STICK_RADIUS,
  STICK_SPRINT,
  TouchLook,
  TouchStick,
} from "../../src/game/touchControls";

const move = (): MoveIntent => ({ forward: false, back: false, left: false, right: false });

/** Push the stick from (0,0) to a deflection given as a fraction of the ring. */
function deflect(stick: TouchStick, fx: number, fy: number, id = 1) {
  stick.start(id, 0, 0);
  stick.move(id, fx * STICK_RADIUS, fy * STICK_RADIUS);
  return stick.vector();
}

describe("TouchStick — a floating thumbstick", () => {
  it("takes its origin from wherever the thumb lands, not a fixed spot", () => {
    const stick = new TouchStick();
    stick.start(7, 240, 900);
    expect(stick.origin).toEqual({ x: 240, y: 900 });

    // A drag of exactly one radius reads as full deflection regardless of where
    // on the glass the gesture started.
    stick.move(7, 240, 900 - STICK_RADIUS);
    expect(stick.vector().magnitude).toBeCloseTo(1, 5);
  });

  it("saturates at the ring instead of reading past fully-pushed", () => {
    const stick = new TouchStick();
    const vec = deflect(stick, 0, -4); // four radii up-screen
    expect(vec.magnitude).toBe(1);
    expect(vec.y).toBeCloseTo(-1, 5);
  });

  it("ignores a second finger so the look drag can claim it", () => {
    const stick = new TouchStick();
    expect(stick.start(1, 0, 0)).toBe(true);
    expect(stick.start(2, 100, 100)).toBe(false); // rejected — already owned
    // ...and the interloper cannot steer or release the claimed gesture either
    expect(stick.move(2, 500, 500)).toBe(false);
    expect(stick.end(2)).toBe(false);
    expect(stick.active).toBe(true);
    expect(stick.end(1)).toBe(true);
    expect(stick.active).toBe(false);
  });

  it("reports nothing at all once the thumb lifts", () => {
    const stick = new TouchStick();
    deflect(stick, 1, 0);
    stick.end(1);
    expect(stick.vector()).toEqual({ x: 0, y: 0, magnitude: 0 });
  });
});

describe("applyStickToMove — deflection becomes movement intent", () => {
  it("stands still inside the deadzone rather than drifting on thumb jitter", () => {
    const stick = new TouchStick();
    const intent = move();
    const vec = deflect(stick, 0, -(STICK_DEADZONE * 0.5));

    expect(vec.magnitude).toBeLessThan(STICK_DEADZONE);
    expect(applyStickToMove(vec, intent).sprint).toBe(false);
    expect(intent).toEqual({ forward: false, back: false, left: false, right: false });
  });

  it("maps up-screen to forward — dragging toward the horizon walks toward it", () => {
    const stick = new TouchStick();
    const intent = move();
    applyStickToMove(deflect(stick, 0, -0.5), intent);
    expect(intent).toEqual({ forward: true, back: false, left: false, right: false });
  });

  it("keeps the diagonals reachable, like two keys held at once", () => {
    const stick = new TouchStick();
    const intent = move();
    applyStickToMove(deflect(stick, 0.45, -0.45), intent);
    expect(intent).toEqual({ forward: true, back: false, left: false, right: true });
  });

  it("gives the analog stick three honest tiers: idle, walk, sprint", () => {
    const stick = new TouchStick();
    const walk = move();
    const walkTier = applyStickToMove(deflect(stick, 0, -0.5), walk);
    expect(walk.forward).toBe(true);
    expect(walkTier.sprint).toBe(false); // pushed, but not to the ring

    const far = new TouchStick();
    const run = move();
    const runTier = applyStickToMove(deflect(far, 0, -1), run);
    expect(run.forward).toBe(true);
    expect(runTier.sprint).toBe(true);
    expect(STICK_SPRINT).toBeGreaterThan(STICK_DEADZONE); // the tiers are ordered
  });

  it("clears every direction when the thumb lifts, so the player stops", () => {
    const stick = new TouchStick();
    const intent = move();
    applyStickToMove(deflect(stick, 0, -1), intent);
    expect(intent.forward).toBe(true);

    stick.end(1);
    const tier = applyStickToMove(stick.vector(), intent);
    // no latching: a released stick is a full stop, not the last heading
    expect(intent).toEqual({ forward: false, back: false, left: false, right: false });
    expect(tier.sprint).toBe(false);
  });
});

describe("TouchLook — the look drag", () => {
  it("batches several moves into one frame's delta", () => {
    const look = new TouchLook();
    look.start(3, 100, 100);
    // A phone can deliver several pointermoves per animation frame; rotating on
    // each would tear the aim against the render, so they accumulate.
    look.move(3, 110, 100);
    look.move(3, 130, 100);
    look.move(3, 160, 100);

    const { yaw, pitch } = look.consume();
    expect(yaw).toBeCloseTo(60 * LOOK_SENSITIVITY, 8);
    expect(pitch).toBe(0);
  });

  it("drains the buffer, so a still finger produces no drift", () => {
    const look = new TouchLook();
    look.start(3, 0, 0);
    look.move(3, 50, 20);
    look.consume();

    expect(look.consume()).toEqual({ yaw: 0, pitch: 0 });
  });

  it("ignores pointers it does not own", () => {
    const look = new TouchLook();
    look.start(1, 0, 0);
    expect(look.move(2, 999, 999)).toBe(false);
    expect(look.consume()).toEqual({ yaw: 0, pitch: 0 });
  });

  it("throws away un-drained motion on reset, so a pause cannot bank a swipe", () => {
    const look = new TouchLook();
    look.start(1, 0, 0);
    look.move(1, 400, 400);
    look.reset();

    expect(look.active).toBe(false);
    expect(look.consume()).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe("applyLookDelta — the drag turns the player", () => {
  const body = () => new THREE.Object3D();
  const scratch = new THREE.Euler(0, 0, 0, "YXZ");
  const read = (o: THREE.Object3D) => new THREE.Euler().setFromQuaternion(o.quaternion, "YXZ");

  it("drags right to look right", () => {
    const o = body();
    applyLookDelta(o, 0.4, 0, scratch);
    // Yaw is subtracted, matching pointer-lock's own convention: +x drag turns
    // the view clockwise, which is a NEGATIVE yaw in three's right-handed Y-up.
    expect(read(o).y).toBeCloseTo(-0.4, 6);
  });

  it("accumulates across frames instead of snapping to the last delta", () => {
    const o = body();
    applyLookDelta(o, 0.2, 0, scratch);
    applyLookDelta(o, 0.2, 0, scratch);
    expect(read(o).y).toBeCloseTo(-0.4, 6);
  });

  it("clamps pitch just shy of vertical so the horizon never flips", () => {
    const o = body();
    applyLookDelta(o, 0, -10, scratch); // a violent swipe straight up
    const up = read(o);
    expect(up.x).toBeCloseTo(PITCH_LIMIT, 6);
    expect(PITCH_LIMIT).toBeLessThan(Math.PI / 2); // shy of the gimbal, not on it

    applyLookDelta(o, 0, 20, scratch); // and straight back down
    expect(read(o).x).toBeCloseTo(-PITCH_LIMIT, 6);
  });

  it("never rolls the camera, however diagonal the drag", () => {
    const o = body();
    for (let i = 0; i < 12; i++) applyLookDelta(o, 0.3, 0.21, scratch);
    expect(read(o).z).toBeCloseTo(0, 6);
  });

  it("leaves position alone — looking is not moving", () => {
    const o = body();
    o.position.set(4, 1.8, -9);
    applyLookDelta(o, 1.2, 0.3, scratch);
    expect(o.position.toArray()).toEqual([4, 1.8, -9]);
  });
});

describe("isCoarsePointer — which scheme the device gets", () => {
  const fakeWin = (over: Partial<Window>) => over as unknown as Window;

  it("believes the pointer media query when the engine implements it", () => {
    const coarse = fakeWin({ matchMedia: (() => ({ matches: true })) as Window["matchMedia"] });
    const fine = fakeWin({ matchMedia: (() => ({ matches: false })) as Window["matchMedia"] });

    expect(isCoarsePointer(coarse)).toBe(true);
    expect(isCoarsePointer(fine)).toBe(false);
  });

  it("falls back to touch points when matchMedia is missing or broken", () => {
    const legacy = fakeWin({ navigator: { maxTouchPoints: 5 } as Navigator });
    expect(isCoarsePointer(legacy)).toBe(true);

    const throws = fakeWin({
      matchMedia: (() => {
        throw new Error("bad query");
      }) as Window["matchMedia"],
      navigator: { maxTouchPoints: 0 } as Navigator,
    });
    expect(isCoarsePointer(throws)).toBe(false);
  });

  it("assumes a desktop when there is no window at all (SSR)", () => {
    expect(isCoarsePointer(undefined)).toBe(false);
  });
});
