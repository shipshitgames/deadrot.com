// Full-screen DOM hit-flash + vignette overlays. Every game already layers DOM
// over its canvas, so these cost no render passes and respect the user's global
// "flash" effect level (photosensitivity control).

import { getGlobalEffectLevel } from "@shipshitgames/ui";

import { createOverlayElement, ensurePositioningContext } from "./domLayer";

export interface FlashOverlayOptions {
  /** Override the intensity scalar; defaults to the global "flash" effect level. */
  getLevel?: () => number;
  /** Stacking context for the overlays. Default 30 (above canvas, below menus). */
  zIndex?: number;
}

export interface FlashOptions {
  /** Peak opacity before the user's flash-level scaling. Default 0.35. */
  alpha?: number;
  /** Seconds to fade out. Default 0.25. */
  duration?: number;
}

export class FlashOverlay {
  private readonly flashEl: HTMLDivElement;
  private readonly vignetteEl: HTMLDivElement;
  private readonly getLevel: () => number;
  private alpha = 0;
  private fadePerSecond = 0;

  constructor(container: HTMLElement, opts: FlashOverlayOptions = {}) {
    this.getLevel = opts.getLevel ?? (() => getGlobalEffectLevel("flash"));
    ensurePositioningContext(container);
    this.flashEl = this.makeLayer(container, opts.zIndex ?? 30);
    this.vignetteEl = this.makeLayer(container, (opts.zIndex ?? 30) - 1);
  }

  /** One-shot screen flash (damage red, pickup gold, …). */
  flash(color = "#ff2d2d", opts: FlashOptions = {}) {
    const peak = (opts.alpha ?? 0.35) * this.getLevel();
    if (peak <= 0) return;
    this.flashEl.style.background = color;
    this.alpha = Math.max(this.alpha, peak);
    this.fadePerSecond = peak / Math.max(0.05, opts.duration ?? 0.25);
    this.flashEl.style.opacity = String(this.alpha);
  }

  /** Persistent edge vignette (low health, berserk). Strength 0 clears it. */
  setVignette(strength: number, color = "#c1121f") {
    const s = Math.max(0, Math.min(1, strength)) * this.getLevel();
    if (s <= 0) {
      this.vignetteEl.style.boxShadow = "none";
      return;
    }
    const spread = Math.round(20 + s * 110);
    this.vignetteEl.style.boxShadow = `inset 0 0 ${spread}px ${Math.round(spread * 0.55)}px ${color}`;
    this.vignetteEl.style.opacity = String(0.35 + s * 0.45);
  }

  /** Decay the active flash; call once per frame. */
  update(dt: number) {
    if (this.alpha <= 0) return;
    this.alpha = Math.max(0, this.alpha - this.fadePerSecond * dt);
    this.flashEl.style.opacity = String(this.alpha);
  }

  dispose() {
    this.flashEl.remove();
    this.vignetteEl.remove();
  }

  private makeLayer(container: HTMLElement, zIndex: number): HTMLDivElement {
    return createOverlayElement(container, "div", {
      inset: "0",
      opacity: "0",
      zIndex: String(zIndex),
    });
  }
}
