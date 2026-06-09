// The fixed-step frame loop every Deadrot game was hand-rolling: clamped delta +
// accumulator so physics stays stable regardless of frame rate (extracted from
// redline/deadlane/starblight, which all shipped the same constants).

export interface FixedLoopOptions {
  /** Physics step in seconds. Default 1/120. */
  fixedDt?: number;
  /** Clamp huge frame deltas (tab switches etc.). Default 0.1s. */
  maxFrame?: number;
  /** Fixed-step simulation callback; may run 0..N times per frame. */
  update: (dt: number) => void;
  /**
   * Per-frame render callback. `alpha` is the accumulator fraction (0..1) for
   * interpolation; `frameDt` is the clamped wall-clock delta.
   */
  render?: (alpha: number, frameDt: number) => void;
}

export interface FixedLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createFixedLoop(opts: FixedLoopOptions): FixedLoop {
  const fixedDt = opts.fixedDt ?? 1 / 120;
  const maxFrame = opts.maxFrame ?? 0.1;

  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(maxFrame, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= fixedDt) {
      opts.update(fixedDt);
      acc -= fixedDt;
    }
    opts.render?.(acc / fixedDt, dt);
    raf = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}
