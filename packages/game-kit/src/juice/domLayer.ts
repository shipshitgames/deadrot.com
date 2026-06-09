// Shared DOM helpers for juice overlays that absolutely position children
// inside a game container (damage numbers, flash/vignette layers).

/**
 * Absolutely-positioned children need a positioned ancestor; if the container
 * is still `static`, promote it to `relative`.
 */
export function ensurePositioningContext(container: HTMLElement): void {
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
}

/**
 * Create an absolutely-positioned, pointer-events-none child of `container`
 * with extra inline `styles`, and append it.
 */
export function createOverlayElement<K extends keyof HTMLElementTagNameMap>(
  container: HTMLElement,
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.style.position = "absolute";
  el.style.pointerEvents = "none";
  Object.assign(el.style, styles);
  container.appendChild(el);
  return el;
}
