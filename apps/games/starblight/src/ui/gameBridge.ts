// Thin pub/sub bridge between the imperative Game engine and the React shell.
// AppShell mounts before the Game is constructed, so instead of threading the
// Game instance through React we publish a small pause snapshot here and let the
// shell subscribe. The Game also registers the action callbacks the shared
// PauseMenu needs (resume / restart / exit to title).
import type { ShopTiers } from "../game/drydock";

export interface PauseSnapshot {
  /** True while the run is paused — drives the shared PauseMenu's open prop. */
  open: boolean;
  /** Pre-formatted "0:00 - LVL 1 - 0 kills" status line for the overlay. */
  stats: string;
  /** Current game phase ("title" | "playing" | "paused" | "gameover" | ...).
   *  The title menu uses this to hide the hero copy once the menu is revealed,
   *  while still showing the engine-written game-over/victory banner. */
  phase: string;
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

let snapshot: PauseSnapshot = { open: false, stats: "", phase: "title" };
let actions: PauseActions = noopActions;
const listeners = new Set<Listener>();

/** Game side: publish the latest pause snapshot (cheap; dirty-checked here). */
export function publishPause(next: PauseSnapshot) {
  if (next.open === snapshot.open && next.stats === snapshot.stats && next.phase === snapshot.phase) return;
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

// --- Drydock meta-shop tiers (React -> Game) -------------------------------
// The persisted upgrade tiers the engine folds into a run's starting stats.
let drydockTiers: ShopTiers = {};
const tierListeners = new Set<(tiers: ShopTiers) => void>();

/** React side: push the latest purchased tiers (on boot + after each buy). */
export function pushDrydockTiers(tiers: ShopTiers) {
  drydockTiers = tiers;
  for (const listener of tierListeners) listener(drydockTiers);
}

/**
 * Game side: subscribe to tier changes; replays the current tiers immediately so
 * ordering between Game construction and the React mount-effect doesn't matter.
 */
export function subscribeDrydockTiers(listener: (tiers: ShopTiers) => void): () => void {
  tierListeners.add(listener);
  listener(drydockTiers);
  return () => tierListeners.delete(listener);
}

// --- Run end: bank salvage as wreckage (Game -> React) ---------------------
let runEndHandler: (salvage: number) => void = () => {};

/** React side: register the handler that banks a finished run's salvage. */
export function setRunEndHandler(handler: (salvage: number) => void) {
  runEndHandler = handler;
}

/** Game side: a run ended — hand its salvage to React to bank as wreckage. */
export function emitRunEnd(salvage: number) {
  runEndHandler(salvage);
}
