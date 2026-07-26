/**
 * Which input scheme the device actually has.
 *
 * Deliberately free of React and of everything else in this package, and
 * reachable on its own via the `@shipshitgames/ui/pointer` subpath, so engine
 * and system code can ask the question without pulling a component tree into
 * its bundle.
 */

/** The media query that decides it. Exported so tests can name the same string. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

/**
 * True when the primary pointer cannot hover or click precisely — phones and
 * tablets. `matchMedia` is the authoritative signal; `maxTouchPoints` is the
 * fallback for engines that do not implement the pointer media query, and both
 * are guarded because this runs under jsdom and SSR too.
 */
export function isCoarsePointer(win: Window | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win) return false;
  try {
    if (typeof win.matchMedia === "function") {
      const query = win.matchMedia(COARSE_POINTER_QUERY);
      if (query && typeof query.matches === "boolean") return query.matches;
    }
  } catch {
    // matchMedia can throw on a malformed query in older engines; fall through.
  }
  return (win.navigator?.maxTouchPoints ?? 0) > 0;
}

/**
 * Watch for the answer changing, and return the unsubscribe.
 *
 * It does change: a tablet gains a trackpad when it is docked to a keyboard
 * case, and a desktop browser flips the moment device emulation is toggled. A
 * no-op unsubscribe is returned where the query is unavailable, so callers can
 * subscribe unconditionally.
 */
export function subscribeToPointerKind(
  onChange: () => void,
  win: Window | undefined = typeof window === "undefined" ? undefined : window,
): () => void {
  if (!win || typeof win.matchMedia !== "function") return () => {};
  try {
    const query = win.matchMedia(COARSE_POINTER_QUERY);
    if (!query?.addEventListener) return () => {};
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}
