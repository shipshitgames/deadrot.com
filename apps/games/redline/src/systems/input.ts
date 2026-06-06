/**
 * Input system. Maps keyboard + pointer/touch to intent flags the game reads.
 * Edge events (jumpPressed / dashPressed) are latched until consumed so the
 * physics step can buffer them precisely.
 */

export class Input {
  // Held states
  accelerate = false; // hold to build speed
  dashHeld = false; // hold to keep crouch-roll posture

  // Latched edge presses (consume once)
  private jumpQueued = false;
  private dashQueued = false;
  private restartQueued = false;
  private anyKeyQueued = false; // used to dismiss the start overlay

  private readonly held = new Set<string>();

  constructor(private readonly target: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Pointer: left half = accelerate, tap upper = jump, hold lower = dash.
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
  }

  // --- edge consumers -------------------------------------------------------
  consumeJump(): boolean {
    const q = this.jumpQueued;
    this.jumpQueued = false;
    return q;
  }
  consumeDash(): boolean {
    const q = this.dashQueued;
    this.dashQueued = false;
    return q;
  }
  consumeRestart(): boolean {
    const q = this.restartQueued;
    this.restartQueued = false;
    return q;
  }
  consumeAnyKey(): boolean {
    const q = this.anyKeyQueued;
    this.anyKeyQueued = false;
    return q;
  }

  private isJumpKey(code: string) {
    return code === "Space" || code === "ArrowUp" || code === "KeyW";
  }
  private isDashKey(code: string) {
    return code === "ShiftLeft" || code === "ShiftRight" || code === "ArrowDown" || code === "KeyS";
  }
  private isAccelKey(code: string) {
    return code === "ArrowRight" || code === "KeyD";
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Prevent page scroll on the game keys.
    if (this.isJumpKey(e.code) || this.isDashKey(e.code) || this.isAccelKey(e.code) || e.code === "ArrowLeft") {
      e.preventDefault();
    }

    this.anyKeyQueued = true;
    if (e.repeat) return;

    this.held.add(e.code);

    if (this.isAccelKey(e.code)) this.accelerate = true;
    if (this.isDashKey(e.code)) {
      this.dashHeld = true;
      this.dashQueued = true;
    }
    if (this.isJumpKey(e.code)) this.jumpQueued = true;
    if (e.code === "KeyR") this.restartQueued = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
    if (this.isAccelKey(e.code)) this.accelerate = false;
    if (this.isDashKey(e.code) && !this.anyDashHeld()) this.dashHeld = false;
  };

  private anyDashHeld() {
    return (
      this.held.has("ShiftLeft") || this.held.has("ShiftRight") || this.held.has("ArrowDown") || this.held.has("KeyS")
    );
  }

  /** True while a jump key is held (for variable jump height / cut-jump). */
  get jumpHeld(): boolean {
    return this.held.has("Space") || this.held.has("ArrowUp") || this.held.has("KeyW");
  }

  // --- pointer / touch ------------------------------------------------------
  private onPointerDown = (e: PointerEvent) => {
    this.anyKeyQueued = true;
    this.accelerate = true; // any touch builds speed
    const lower = e.clientY > window.innerHeight * 0.62;
    if (lower) {
      this.dashHeld = true;
      this.dashQueued = true;
    } else {
      this.jumpQueued = true;
    }
  };

  private onPointerUp = () => {
    this.accelerate = false;
    this.dashHeld = false;
  };

  private onBlur = () => {
    this.accelerate = false;
    this.dashHeld = false;
    this.held.clear();
  };
}
