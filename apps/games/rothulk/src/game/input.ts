// Keyboard input. Edge-detected jump so we can buffer it precisely.
export class Input {
  private down = new Set<string>();
  private jumpQueued = false; // a fresh jump press this frame
  jumpHeld = false; // is a jump key currently held (for variable height)

  constructor() {
    window.addEventListener('keydown', this.onDown, { passive: false });
    window.addEventListener('keyup', this.onUp);
    // Release everything if focus is lost so the hero never "sticks".
    window.addEventListener('blur', this.reset);
  }

  private isJumpKey(code: string) {
    return code === 'Space' || code === 'KeyW' || code === 'ArrowUp';
  }

  private onDown = (e: KeyboardEvent) => {
    if (this.isJumpKey(e.code)) {
      e.preventDefault();
      if (!this.jumpHeld) this.jumpQueued = true; // edge only
      this.jumpHeld = true;
    }
    this.down.add(e.code);
  };

  private onUp = (e: KeyboardEvent) => {
    if (this.isJumpKey(e.code)) this.jumpHeld = false;
    this.down.delete(e.code);
  };

  private reset = () => {
    this.down.clear();
    this.jumpHeld = false;
    this.jumpQueued = false;
  };

  /** -1 left, +1 right, 0 none. */
  get moveAxis(): number {
    let axis = 0;
    if (this.down.has('ArrowLeft') || this.down.has('KeyA')) axis -= 1;
    if (this.down.has('ArrowRight') || this.down.has('KeyD')) axis += 1;
    return axis;
  }

  get restartPressed(): boolean {
    return this.down.has('KeyR');
  }

  /** True once per jump key press; consumes the edge. */
  consumeJump(): boolean {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      return true;
    }
    return false;
  }

  dispose() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.reset);
  }
}
