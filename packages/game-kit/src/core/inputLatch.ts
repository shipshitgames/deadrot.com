// Held + edge-latched input intents: edge presses (jump, dash, confirm) are
// queued until consumed so a fixed physics step can buffer them precisely.
// Extracted from the latch pattern redline/deadlane/starblight each hand-rolled.

export interface InputLatchOptions<A extends string> {
  /** KeyboardEvent.code → action (e.g. { Space: "jump", ShiftLeft: "dash" }). */
  keys: Record<string, A>;
  /** Where to listen. Default window. */
  target?: Window | HTMLElement;
  /** Prevent default for matched codes (true, or per-code predicate). Default false. */
  preventDefault?: boolean | ((code: string) => boolean);
}

export class InputLatch<A extends string> {
  private readonly heldActions = new Set<A>();
  private readonly queued = new Set<A>();
  private readonly heldCodes = new Set<string>();
  private readonly target: Window | HTMLElement;
  private disposed = false;

  constructor(private readonly opts: InputLatchOptions<A>) {
    this.target = opts.target ?? window;
    this.target.addEventListener("keydown", this.onKeyDown as EventListener);
    this.target.addEventListener("keyup", this.onKeyUp as EventListener);
    window.addEventListener("blur", this.onBlur);
  }

  /** Is the action's key currently held? */
  isHeld(action: A): boolean {
    return this.heldActions.has(action);
  }

  /** Latched edge press — true once per press, then cleared. */
  consume(action: A): boolean {
    if (!this.queued.has(action)) return false;
    this.queued.delete(action);
    return true;
  }

  /** Programmatic edge press (pointer/touch bindings). */
  press(action: A) {
    this.queued.add(action);
  }

  /** Programmatic held control (pointer/touch bindings). */
  setHeld(action: A, held: boolean) {
    if (held) this.heldActions.add(action);
    else this.heldActions.delete(action);
  }

  /** Drop all held + queued state (focus loss, scene change). */
  clear() {
    this.heldActions.clear();
    this.queued.clear();
    this.heldCodes.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.target.removeEventListener("keydown", this.onKeyDown as EventListener);
    this.target.removeEventListener("keyup", this.onKeyUp as EventListener);
    window.removeEventListener("blur", this.onBlur);
    this.clear();
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const action = this.opts.keys[e.code];
    if (!action) return;
    if (this.shouldPreventDefault(e.code)) e.preventDefault();
    if (!this.heldCodes.has(e.code)) {
      // Edge only on the first keydown, not OS key-repeat.
      this.heldCodes.add(e.code);
      this.queued.add(action);
    }
    this.heldActions.add(action);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const action = this.opts.keys[e.code];
    if (!action) return;
    this.heldCodes.delete(e.code);
    // Only release the action if no other bound code still holds it.
    for (const [code, a] of Object.entries(this.opts.keys)) {
      if (a === action && this.heldCodes.has(code)) return;
    }
    this.heldActions.delete(action);
  };

  private readonly onBlur = () => this.clear();

  private shouldPreventDefault(code: string): boolean {
    const pd = this.opts.preventDefault;
    if (typeof pd === "function") return pd(code);
    return pd === true;
  }
}
