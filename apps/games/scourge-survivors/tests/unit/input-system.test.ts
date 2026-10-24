import { actionFor, applyMoveKey, makeMoveIntent } from "@shipshitgames/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEAPON_ORDER } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import type { GameSystems } from "../../src/game/systems";
import { FpsActionHandler, fpsActionMap, InputSystem, PointerLockRig } from "../../src/game/systems/InputSystem";

describe("engine input bindings", () => {
  it("applies default WASD movement and custom movement keys", () => {
    const move = makeMoveIntent();

    expect(applyMoveKey(move, "KeyW", true)).toBe(true);
    expect(move.forward).toBe(true);
    expect(applyMoveKey(move, "KeyW", false)).toBe(true);
    expect(move.forward).toBe(false);
    expect(applyMoveKey(move, "KeyQ", true)).toBe(false);

    expect(applyMoveKey(move, "KeyQ", true, { moveKeys: { KeyQ: "left" } })).toBe(true);
    expect(move.left).toBe(true);
  });
});

describe("Scourge Survivors FPS input policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps physical keys to FPS actions", () => {
    expect(actionFor(fpsActionMap, "KeyR")).toBe("reload");
    expect(actionFor(fpsActionMap, "KeyF")).toBe("melee");
    expect(actionFor(fpsActionMap, "KeyV")).toBe("melee");
    expect(actionFor(fpsActionMap, "Digit4")).toBe("weapon4");
    expect(actionFor(fpsActionMap, "Space")).toBeUndefined();
  });

  it("dispatches mapped FPS actions to weapon systems", () => {
    const weapon = {
      startReload: vi.fn(),
      switchWeapon: vi.fn(),
      tryMelee: vi.fn(),
    };
    const handler = new FpsActionHandler({ weapon } as unknown as Pick<GameSystems, "weapon">);

    handler.handleAction("reload");
    handler.handleAction("melee");
    handler.handleAction("weapon3");

    expect(weapon.startReload).toHaveBeenCalledTimes(1);
    expect(weapon.tryMelee).toHaveBeenCalledTimes(1);
    expect(weapon.switchWeapon).toHaveBeenCalledWith(WEAPON_ORDER[2]);
  });

  it("keeps capture status transitions in the pointer-lock policy", () => {
    const { capture, ctx, listeners, sys } = makePointerLockHarness();
    ctx.status = "pointerlock-needed";

    capture.bind();
    listeners.capture?.();

    expect(ctx.status).toBe("playing");
    expect(sys.hud.emit).toHaveBeenCalledTimes(1);

    ctx.firing = true;
    ctx.move.forward = true;
    ctx.move.left = true;
    ctx.wantsSprint = true;
    ctx.wantsCrouch = true;

    listeners.release?.();

    expect(ctx.status).toBe("paused");
    expect(ctx.firing).toBe(false);
    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
    expect(ctx.wantsSprint).toBe(false);
    expect(ctx.wantsCrouch).toBe(false);
    expect(sys.weapon.stopAds).toHaveBeenCalledTimes(1);
    expect(sys.hud.emit).toHaveBeenCalledTimes(2);
  });

  it("retries pointer-lock requests once after an Esc cooldown rejection", () => {
    const setTimeoutSpy = vi.fn(() => 42);
    const clearTimeoutSpy = vi.fn();
    vi.stubGlobal("window", {
      clearTimeout: clearTimeoutSpy,
      setTimeout: setTimeoutSpy,
    });
    const { capture, ctx, rig } = makePointerLockHarness();
    ctx.status = "paused";
    rig.requestCapture.mockImplementation(() => {
      throw new Error("pointer lock cooldown");
    });

    capture.requestCapture();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(0);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1300);
    expect(capture.lockRetry).toBe(42);
  });

  it("resumes a paused run directly back to play without requiring pointer lock", () => {
    const { ctx, sys } = makePointerLockHarness();
    ctx.status = "paused";
    ctx.firing = true;
    ctx.move.forward = true;
    ctx.wantsSprint = true;
    ctx.wantsCrouch = true;

    const input = new InputSystem(ctx, sys as unknown as GameSystems);

    input.resumeFromPauseWithoutCapture();

    expect(ctx.status).toBe("playing");
    expect(ctx.firing).toBe(false);
    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
    expect(ctx.wantsSprint).toBe(false);
    expect(ctx.wantsCrouch).toBe(false);
    expect(sys.weapon.stopAds).toHaveBeenCalledTimes(1);
    expect(sys.hud.emit).toHaveBeenCalledTimes(1);
  });

  it("requests pointer lock when the player has a mouse", () => {
    const { ctx, sys } = makePointerLockHarness();
    const { captureRig, input } = makeInputWithStubbedRig(ctx, sys);

    input.requestLock();

    expect(captureRig.requestCapture).toHaveBeenCalledTimes(1);
  });

  it("never requests pointer lock on a coarse pointer, and starts play instead", () => {
    const { ctx, sys } = makePointerLockHarness({ touch: true });
    const { captureRig, input } = makeInputWithStubbedRig(ctx, sys);

    input.requestLock();

    // A *granted* lock retargets every pointer event to the locked canvas, which
    // starves the on-screen pad: gestures land on the canvas instead of the pad,
    // and the pad's own setPointerCapture calls throw InvalidStateError. Whether
    // the browser grants the request varies by platform, so the request itself
    // has to not happen — every mode call site reaches play through here.
    expect(captureRig.requestCapture).not.toHaveBeenCalled();
    expect(ctx.status).toBe("playing");
  });

  it("leaves an already-live touch run untouched when a mode closes an overlay", () => {
    const { ctx, sys } = makePointerLockHarness({ touch: true });
    ctx.status = "playing";
    const { captureRig, input } = makeInputWithStubbedRig(ctx, sys);

    // Closing a level-up draft sets `playing` and then asks for the lock back.
    input.requestLock();

    expect(captureRig.requestCapture).not.toHaveBeenCalled();
    expect(ctx.status).toBe("playing");
    // Nothing to rebuild, so a held ADS toggle survives the draft on a phone
    // exactly as the held mouse button does on a desktop.
    expect(sys.weapon.stopAds).not.toHaveBeenCalled();
    expect(sys.hud.emit).not.toHaveBeenCalled();
  });

  it("suspends live input for a cinematic and restores the capture boundary", () => {
    const { ctx, sys } = makePointerLockHarness();
    ctx.status = "playing";
    ctx.firing = true;
    ctx.move.forward = true;
    ctx.wantsSprint = true;
    ctx.wantsCrouch = true;

    const input = new InputSystem(ctx, sys as unknown as GameSystems);
    input.suspendForCinematic();

    expect(ctx.status).toBe("paused");
    expect(ctx.firing).toBe(false);
    expect(ctx.move).toEqual({ forward: false, back: false, left: false, right: false });
    expect(ctx.wantsSprint).toBe(false);
    expect(ctx.wantsCrouch).toBe(false);
    expect(sys.weapon.stopAds).toHaveBeenCalledTimes(1);

    input.resumeFromCinematic();

    expect(ctx.status).toBe("pointerlock-needed");
    expect(sys.hud.emit).toHaveBeenCalledTimes(2);
  });

  it("does not immediately resume pause from the same handled Escape keydown", () => {
    const { ctx, sys } = makePointerLockHarness();
    ctx.status = "paused";
    const input = new InputSystem(ctx, sys as unknown as GameSystems);
    const handledEscape = {
      code: "Escape",
      defaultPrevented: true,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    (input as unknown as { onLocomotionKeyDown: (event: KeyboardEvent) => void }).onLocomotionKeyDown(handledEscape);

    expect(ctx.status).toBe("paused");
    expect(handledEscape.preventDefault).not.toHaveBeenCalled();
    expect(sys.hud.emit).not.toHaveBeenCalled();
  });
});

/**
 * An `InputSystem` with a stubbed capture rig. `bindEvents()` is what normally
 * builds the rig, and it needs a live DOM, so the field is injected instead —
 * the assertions here are about *whether* capture is requested, not about the
 * pointer-lock plumbing itself, which {@link PointerLockRig} covers above.
 */
function makeInputWithStubbedRig(ctx: GameContext, sys: HarnessSystems) {
  const captureRig = { cancelLockRetry: vi.fn(), requestCapture: vi.fn() };
  const input = new InputSystem(ctx, sys as unknown as GameSystems);
  (input as unknown as { captureRig: typeof captureRig }).captureRig = captureRig;
  return { captureRig, input };
}

type HarnessSystems = Pick<GameSystems, "hud" | "touch" | "weapon">;

function makePointerLockHarness({ touch = false }: { touch?: boolean } = {}) {
  const listeners: Partial<Record<"capture" | "release", () => void>> = {};
  const rig = {
    captured: false,
    off: vi.fn((event: "capture" | "release") => {
      delete listeners[event];
    }),
    on: vi.fn((event: "capture" | "release", fn: () => void) => {
      listeners[event] = fn;
    }),
    releaseCapture: vi.fn(),
    requestCapture: vi.fn(),
  };
  const ctx = {
    firing: false,
    move: makeMoveIntent(),
    rig,
    status: "pointerlock-needed",
    wantsCrouch: false,
    wantsSprint: false,
  } as unknown as GameContext;
  const sys = {
    hud: { emit: vi.fn() },
    // Desktop by default: the touch system exists but reports itself off, which
    // is what keeps most of these assertions on the pointer-lock path.
    touch: { enabled: touch, releaseAll: vi.fn() },
    weapon: { stopAds: vi.fn() },
  } as unknown as HarnessSystems;

  return {
    capture: new PointerLockRig(ctx, sys),
    ctx,
    listeners,
    rig,
    sys,
  };
}
