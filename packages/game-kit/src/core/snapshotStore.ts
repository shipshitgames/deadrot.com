/**
 * createSnapshotStore — a tiny module-level snapshot store for bridging
 * imperative game code into React (e.g. via useSyncExternalStore wrappers).
 * `set` replaces the snapshot, `patch` shallow-merges, and both notify
 * subscribers after the swap.
 */
export interface SnapshotStore<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
  set(next: T): void;
  patch(partial: Partial<T>): void;
}

export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();

  const set = (next: T): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    get: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set,
    patch: (partial) => {
      set({ ...snapshot, ...partial });
    },
  };
}
