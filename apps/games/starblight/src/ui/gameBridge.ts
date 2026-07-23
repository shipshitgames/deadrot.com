// Thin pub/sub bridge between the imperative Game engine and the React shell.
// AppShell mounts before the Game is constructed, so instead of threading the
// Game instance through React we publish a small serializable menu snapshot.
// The Game also registers the action callbacks the menu screens need.
import type { ShopTiers } from "../game/drydock";
import { INITIAL_MENU_SNAPSHOT, type MenuSnapshot, sameMenuSnapshot } from "./menuState";

export interface PauseActions {
  resume: () => void;
  restart: () => void;
  title: () => void;
}

type Listener = (snapshot: MenuSnapshot) => void;

const noopActions: PauseActions = {
  resume: () => {},
  restart: () => {},
  title: () => {},
};

let snapshot: MenuSnapshot = INITIAL_MENU_SNAPSHOT;
let actions: PauseActions = noopActions;
const listeners = new Set<Listener>();

/** Game side: publish the latest menu snapshot (cheap; dirty-checked here). */
export function publishMenu(next: MenuSnapshot) {
  if (sameMenuSnapshot(next, snapshot)) return;
  snapshot = { ...next, build: next.build.map((chip) => ({ ...chip })) };
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
export function getMenuSnapshot(): MenuSnapshot {
  return snapshot;
}

/** React side: subscribe to menu changes; returns an unsubscribe. */
export function subscribeMenu(listener: Listener): () => void {
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
