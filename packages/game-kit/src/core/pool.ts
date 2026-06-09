// Generic object pool for hot-loop entities (projectiles, particles, pickups) —
// allocate once, recycle forever, no GC churn in the frame loop.

export interface Pool<T> {
  acquire(): T;
  release(item: T): void;
  prewarm(count: number): void;
  /** Items ready for reuse right now. */
  readonly available: number;
  /** Total items the pool has ever created. */
  readonly size: number;
}

export function createPool<T>(factory: () => T, reset?: (item: T) => void): Pool<T> {
  const free: T[] = [];
  let created = 0;

  return {
    acquire() {
      const item = free.pop();
      if (item !== undefined) return item;
      created++;
      return factory();
    },
    release(item) {
      reset?.(item);
      free.push(item);
    },
    prewarm(count) {
      while (free.length < count) {
        free.push(factory());
        created++;
      }
    },
    get available() {
      return free.length;
    },
    get size() {
      return created;
    },
  };
}
