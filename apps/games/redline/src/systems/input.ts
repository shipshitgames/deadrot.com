/**
 * Input system. Thin facade over @deadrot/game-kit's InputLatch: maps keyboard
 * + pointer/touch to intent flags the game reads. Edge events (jump / dash /
 * restart) are latched until consumed so the physics step can buffer them
 * precisely.
 */

import { InputLatch } from "@deadrot/game-kit";

type Action = "jump" | "dash" | "restart" | "accelerate";

const KEYS: Record<string, Action> = {
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  ArrowDown: "dash",
  KeyS: "dash",
  KeyR: "restart",
  ArrowRight: "accelerate",
  KeyD: "accelerate",
};

/** Prevent page scroll on the game keys (matches the original key list). */
const PREVENT_DEFAULT = new Set([
  "Space",
  "ArrowUp",
  "KeyW",
  "ShiftLeft",
  "ShiftRight",
  "ArrowDown",
  "KeyS",
  "ArrowRight",
  "KeyD",
  "ArrowLeft",
]);

export class Input {
  private readonly latch = new InputLatch<Action>({
    keys: KEYS,
    preventDefault: (code) => PREVENT_DEFAULT.has(code),
  });

  // "Any key" side-channel: InputLatch only queues mapped codes, but the start
  // overlay dismisses on any keypress / tap, so keep this one boolean local.
  private anyKeyQueued = false;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener("keydown", this.onAnyKeyDown);

    // Pointer: any touch = accelerate, tap upper = jump, hold lower = dash.
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
  }

  dispose() {
    this.latch.dispose();
    window.removeEventListener("keydown", this.onAnyKeyDown);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
  }

  // --- held states ------------------------------------------------------------
  /** Hold to build speed. */
  get accelerate(): boolean {
    return this.latch.isHeld("accelerate");
  }

  /** True while a jump key is held (for variable jump height / cut-jump). */
  get jumpHeld(): boolean {
    return this.latch.isHeld("jump");
  }

  // --- edge consumers -------------------------------------------------------
  consumeJump(): boolean {
    return this.latch.consume("jump");
  }
  consumeDash(): boolean {
    return this.latch.consume("dash");
  }
  consumeRestart(): boolean {
    return this.latch.consume("restart");
  }
  consumeAnyKey(): boolean {
    const q = this.anyKeyQueued;
    this.anyKeyQueued = false;
    return q;
  }

  /** Drop all held + queued state (used while paused). */
  clear() {
    this.latch.clear();
    this.anyKeyQueued = false;
  }

  private onAnyKeyDown = () => {
    this.anyKeyQueued = true;
  };

  // --- pointer / touch ------------------------------------------------------
  private onPointerDown = (e: PointerEvent) => {
    this.anyKeyQueued = true;
    this.latch.setHeld("accelerate", true); // any touch builds speed
    const lower = e.clientY > window.innerHeight * 0.62;
    if (lower) {
      this.latch.press("dash");
    } else {
      this.latch.press("jump");
    }
  };

  private onPointerUp = () => {
    this.latch.setHeld("accelerate", false);
  };

  private onBlur = () => {
    this.latch.clear();
  };
}
