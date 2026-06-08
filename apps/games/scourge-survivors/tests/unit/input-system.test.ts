import { actionFor, applyMoveKey, makeMoveIntent } from "@shipshitgames/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEAPON_ORDER } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import type { GameSystems } from "../../src/game/systems";
import { FpsActionHandler, fpsActionMap, PointerLockRig } from "../../src/game/systems/InputSystem";

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
});

function makePointerLockHarness() {
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
    weapon: { stopAds: vi.fn() },
  } as unknown as Pick<GameSystems, "hud" | "weapon">;

  return {
    capture: new PointerLockRig(ctx, sys),
    ctx,
    listeners,
    rig,
    sys,
  };
}
