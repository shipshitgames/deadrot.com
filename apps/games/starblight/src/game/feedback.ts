import { CONSTANTS } from "./constants";

export type ShakeEvent = keyof typeof CONSTANTS.fx.shake.events;
export type MarqueeImpact = keyof typeof CONSTANTS.fx.hitStop;

export interface ImpactDirection {
  x: number;
  y: number;
}

export interface HitStopPreset {
  duration: number;
  timeScale: number;
}

/** Resolves an event through the named tap/pop/thump/slam shake vocabulary. */
export function shakeFor(event: ShakeEvent): number {
  const tier = CONSTANTS.fx.shake.events[event];
  return CONSTANTS.fx.shake.tiers[tier];
}

/**
 * Real-time hit-stop controller. It scales only the simulation slice covered
 * by the active impact; any remainder of a long frame runs at normal speed.
 */
export class HitStopController {
  private remaining = 0;
  private timeScale = 1;

  trigger(preset: HitStopPreset) {
    this.remaining = Math.max(this.remaining, Math.max(0, preset.duration));
    this.timeScale = Math.min(this.timeScale, Math.max(0, Math.min(1, preset.timeScale)));
  }

  scaleDelta(realDelta: number): number {
    const delta = Math.max(0, realDelta);
    if (this.remaining <= 0 || delta === 0) return delta;

    const affected = Math.min(delta, this.remaining);
    this.remaining = Math.max(0, this.remaining - delta);
    const scaled = affected * this.timeScale + (delta - affected);
    if (this.remaining === 0) this.timeScale = 1;
    return scaled;
  }

  reset() {
    this.remaining = 0;
    this.timeScale = 1;
  }
}
