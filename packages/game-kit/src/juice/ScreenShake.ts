// Screen shake with exponential trauma decay and a dual-sine offset — ported from
// Redline's render system, where it made impacts feel weighty. The caller adds the
// offset to its camera each frame, so any rig (ortho, perspective, FPS) works.

import { getGlobalEffectLevel } from "@shipshitgames/ui";

export interface ScreenShakeOptions {
  /** Trauma decay per second (proportional). Redline ships 9. */
  decay?: number;
  /** Override the intensity scalar; defaults to the global "shake" effect level. */
  getLevel?: () => number;
  /** Phase seed so multiple shakers don't sync up. */
  seed?: number;
}

export class ScreenShake {
  private trauma = 0;
  private elapsed = 0;
  private readonly decay: number;
  private readonly seed: number;
  private readonly getLevel: () => number;

  constructor(opts: ScreenShakeOptions = {}) {
    this.decay = opts.decay ?? 9;
    this.seed = opts.seed ?? Math.random() * 1000;
    this.getLevel = opts.getLevel ?? (() => getGlobalEffectLevel("shake"));
  }

  /** Kick the shake — keeps the larger of current and incoming trauma. */
  kick(amount: number) {
    this.trauma = Math.max(this.trauma, amount);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt * this.trauma);
  }

  /** Current shake magnitude after the user's intensity setting. */
  get amount(): number {
    const a = this.trauma * this.getLevel();
    return a > 0.001 ? a : 0;
  }

  /** Horizontal offset to add to the camera this frame. */
  get offsetX(): number {
    const a = this.amount;
    if (a === 0) return 0;
    return Math.sin((this.elapsed * 60 + this.seed) * 1.7) * a * 0.5;
  }

  /** Vertical offset to add to the camera this frame. */
  get offsetY(): number {
    const a = this.amount;
    if (a === 0) return 0;
    return Math.cos((this.elapsed * 60 + this.seed) * 2.3) * a;
  }

  reset() {
    this.trauma = 0;
  }
}
