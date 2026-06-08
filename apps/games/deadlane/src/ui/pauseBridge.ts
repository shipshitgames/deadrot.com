/**
 * pauseBridge — a tiny store that lets the imperative Game push pause state into
 * the React HUD shell. The game loop stays vanilla; React only mirrors a flag
 * plus the resume callback so the shared <PauseMenu> can render over the canvas.
 */
export interface PauseSnapshot {
  open: boolean;
  /** Resume the run. Set by the Game while paused; null when not paused. */
  onResume: (() => void) | null;
  /** Bail back to the title menu. Set by the Game while paused; null otherwise. */
  onExitToTitle: (() => void) | null;
}

let snapshot: PauseSnapshot = { open: false, onResume: null, onExitToTitle: null };
const listeners = new Set<(snapshot: PauseSnapshot) => void>();

export function getPauseSnapshot(): PauseSnapshot {
  return snapshot;
}

export function subscribePause(listener: (snapshot: PauseSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPauseSnapshot(next: PauseSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}
