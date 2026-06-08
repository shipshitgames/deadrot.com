// Thin pub/sub bridge between the imperative Game engine and the React shell.
// AppShell mounts before the Game is constructed, so instead of threading the
// Game instance through React we publish a small pause snapshot here and let the
// shell subscribe. The Game also registers the action callbacks the shared
// PauseMenu needs (resume / restart / exit to title).

export interface PauseSnapshot {
  /** True while the run is paused — drives the shared PauseMenu's open prop. */
  open: boolean;
  /** Pre-formatted "0:00 - LVL 1 - 0 kills" status line for the overlay. */
  stats: string;
}

export interface PauseActions {
  resume: () => void;
  restart: () => void;
  title: () => void;
}

type Listener = (snapshot: PauseSnapshot) => void;

const noopActions: PauseActions = {
  resume: () => {},
  restart: () => {},
  title: () => {},
};

let snapshot: PauseSnapshot = { open: false, stats: "" };
let actions: PauseActions = noopActions;
const listeners = new Set<Listener>();

/** Game side: publish the latest pause snapshot (cheap; dirty-checked here). */
export function publishPause(next: PauseSnapshot) {
  if (next.open === snapshot.open && next.stats === snapshot.stats) return;
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

/** Game side: wire the resume / restart / title callbacks the menu invokes. */
export function setPauseActions(next: PauseActions) {
  actions = next;
}

/** Game side: clear actions on dispose so a stale closure can't fire. */
export function clearPauseActions() {
  actions = noopActions;
}

/** React side: read the action bundle (stable indirection — always current). */
export function getPauseActions(): PauseActions {
  return actions;
}

/** React side: current snapshot for the initial render. */
export function getPauseSnapshot(): PauseSnapshot {
  return snapshot;
}

/** React side: subscribe to pause changes; returns an unsubscribe. */
export function subscribePause(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
