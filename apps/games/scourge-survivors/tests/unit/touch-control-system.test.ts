import { makeMoveIntent } from "@shipshitgames/engine";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameContext } from "../../src/game/context";
import type { GameSystems } from "../../src/game/systems";
import { TouchControlSystem } from "../../src/game/systems/TouchControlSystem";
import { STICK_RADIUS } from "../../src/game/touchControls";

/**
 * The seam between the on-screen pad and the shared player state.
 *
 * `touch-controls.test.ts` covers the maths; this file covers the wiring — that
 * a gesture reaches `ctx`, that nothing reaches it while the run is paused, and
 * that the verbs the pad calls land on the right sibling system.
 */
describe("TouchControlSystem", () => {
  beforeEach(() => {
    // The constructor decides `enabled` once, from the media query.
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stands down entirely on a mouse-and-keyboard machine", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: { maxTouchPoints: 0 } });
    const { touch, ctx } = harness();

    expect(touch.enabled).toBe(false);
    expect(touch.stickStart(1, 0, 0)).toBe(false);
    touch.jump();
    touch.update();

    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
  });

  it("folds a full-forward stick push into movement and sprint", () => {
    const { touch, ctx } = harness();

    touch.stickStart(1, 200, 400);
    touch.stickMove(1, 200, 400 - STICK_RADIUS);
    touch.update();

    expect(ctx.move.forward).toBe(true);
    expect(ctx.move.back).toBe(false);
    expect(ctx.wantsSprint).toBe(true);
  });

  it("zeroes the intent the instant the thumb lifts, without waiting for a frame", () => {
    const { touch, ctx } = harness();

    touch.stickStart(1, 200, 400);
    touch.stickMove(1, 200, 400 - STICK_RADIUS);
    touch.update();
    touch.stickEnd(1);

    expect(ctx.move.forward).toBe(false);
    expect(ctx.wantsSprint).toBe(false);
  });

  it("turns a look drag into yaw and pitch on the rig body", () => {
    const { touch, ctx, canvas } = harness();
    touch.bind();

    canvas.emit("pointerdown", { pointerId: 7, clientX: 300, clientY: 300 });
    canvas.emit("pointermove", { pointerId: 7, clientX: 360, clientY: 340 });
    touch.update();

    const euler = new THREE.Euler().setFromQuaternion(ctx.rig.body.quaternion, "YXZ");
    // Drag right turns right (negative yaw); drag down looks down (negative pitch).
    expect(euler.y).toBeLessThan(0);
    expect(euler.x).toBeLessThan(0);
    expect(euler.z).toBeCloseTo(0, 10);
  });

  it("banks no motion and moves nothing while the run is paused", () => {
    const { touch, ctx, canvas } = harness();
    touch.bind();
    ctx.status = "paused";

    canvas.emit("pointerdown", { pointerId: 7, clientX: 300, clientY: 300 });
    canvas.emit("pointermove", { pointerId: 7, clientX: 500, clientY: 300 });
    touch.update();

    expect(ctx.rig.body.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
  });

  it("queues a trigger on press so a semi-auto tap fires exactly once", () => {
    const { touch, ctx } = harness();

    touch.setFiring(true);
    expect(ctx.firing).toBe(true);
    expect(ctx.triggerQueued).toBe(true);

    ctx.triggerQueued = false;
    touch.setFiring(false);
    expect(ctx.firing).toBe(false);
    expect(ctx.triggerQueued).toBe(false);
  });

  it("latches aim-down-sights, because a thumb cannot hold a button", () => {
    const { touch, sys } = harness();

    expect(touch.toggleAds()).toBe(true);
    expect(touch.aiming).toBe(true);
    expect(sys.weapon.startAds).toHaveBeenCalledTimes(1);

    expect(touch.toggleAds()).toBe(false);
    expect(sys.weapon.stopAds).toHaveBeenCalledTimes(1);
  });

  it("routes each action button to the system that owns it", () => {
    const { touch, sys } = harness();

    touch.jump();
    touch.reload();
    touch.melee();
    touch.interact();

    expect(sys.input.tryJump).toHaveBeenCalledTimes(1);
    expect(sys.weapon.startReload).toHaveBeenCalledTimes(1);
    expect(sys.weapon.tryMelee).toHaveBeenCalledTimes(1);
    expect(sys.structures.interact).toHaveBeenCalledTimes(1);
  });

  it("cycles only through unlocked weapons and wraps both ways", () => {
    // Unlocked is pistol/smg/shotgun; cannon and sniper are still locked, so a
    // step must skip them rather than land on a weapon the player cannot draw.
    const { touch, sys } = harness();

    touch.cycleWeapon(1);
    expect(sys.weapon.switchWeapon).toHaveBeenLastCalledWith("smg");

    touch.cycleWeapon(-1);
    expect(sys.weapon.switchWeapon).toHaveBeenLastCalledWith("shotgun");
  });

  it("does nothing when only one weapon is unlocked", () => {
    const { touch, ctx, sys } = harness();
    ctx.unlocked = new Set(["pistol"]) as GameContext["unlocked"];

    touch.cycleWeapon();

    expect(sys.weapon.switchWeapon).not.toHaveBeenCalled();
  });

  it("drops every in-flight gesture on release", () => {
    const { touch, ctx } = harness();
    touch.stickStart(1, 200, 400);
    touch.stickMove(1, 200, 400 - STICK_RADIUS);
    touch.setFiring(true);
    touch.toggleAds();

    touch.releaseAll();
    touch.update();

    expect(ctx.firing).toBe(false);
    expect(ctx.wantsSprint).toBe(false);
    expect(touch.aiming).toBe(false);
    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
  });

  it("detaches its listeners and clears state on unbind", () => {
    const { touch, ctx, canvas } = harness();
    touch.bind();
    expect(canvas.listeners.size).toBe(4);
    expect(canvas.style.touchAction).toBe("none");

    ctx.firing = true;
    touch.unbind();

    expect(canvas.listeners.size).toBe(0);
    expect(ctx.firing).toBe(false);
  });
});

/** A canvas stand-in — these specs run under node, where there is no DOM. */
function fakeCanvas() {
  const listeners = new Map<string, (e: PointerEvent) => void>();
  const captured = new Set<number>();
  return {
    listeners,
    style: { touchAction: "" },
    addEventListener: (type: string, fn: (e: PointerEvent) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    setPointerCapture: (id: number) => captured.add(id),
    releasePointerCapture: (id: number) => captured.delete(id),
    hasPointerCapture: (id: number) => captured.has(id),
    /** Fire one pointer event at whatever the system registered. */
    emit(type: string, init: { pointerId: number; clientX: number; clientY: number }) {
      listeners.get(type)?.({ ...init, preventDefault: () => {} } as unknown as PointerEvent);
    },
  };
}

function harness() {
  const canvas = fakeCanvas();
  const ctx = {
    activeWeapon: "pistol",
    disposed: false,
    firing: false,
    move: makeMoveIntent(),
    renderer: { domElement: canvas },
    rig: { body: new THREE.Object3D() },
    status: "playing",
    triggerQueued: false,
    unlocked: new Set(["pistol", "smg", "shotgun"]),
    wantsSprint: false,
  } as unknown as GameContext;
  const sys = {
    input: { tryJump: vi.fn() },
    structures: { interact: vi.fn() },
    weapon: {
      startAds: vi.fn(),
      startReload: vi.fn(),
      stopAds: vi.fn(),
      switchWeapon: vi.fn(),
      tryMelee: vi.fn(),
    },
  };

  return { canvas, ctx, sys, touch: new TouchControlSystem(ctx, sys as unknown as GameSystems) };
}
