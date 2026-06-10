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

export interface BoundedPoolOptions<T> {
  /** Is this item currently in use? Inactive items are reused first. */
  isActive(item: T): boolean;
  /** When all items are active, the item with the highest priority is recycled. */
  recyclePriority(item: T): number;
}

export interface BoundedPool<T> {
  /**
   * Three-phase acquire: reuse the first inactive item, else create a new one
   * while under `max`, else recycle the active item with the highest
   * `recyclePriority` (first wins ties). Returns null only when `max` is not
   * positive.
   */
  acquire(): T | null;
  forEach(fn: (item: T) => void): void;
  /** Backing array of every item created so far (live view; do not mutate). */
  readonly items: T[];
}

export function createBoundedPool<T>(max: number, factory: () => T, opts: BoundedPoolOptions<T>): BoundedPool<T> {
  const items: T[] = [];

  return {
    acquire() {
      for (const item of items) {
        if (!opts.isActive(item)) return item;
      }
      if (items.length < max) {
        const item = factory();
        items.push(item);
        return item;
      }
      let victim: T | null = null;
      let best = Number.NEGATIVE_INFINITY;
      for (const item of items) {
        const p = opts.recyclePriority(item);
        if (p > best) {
          best = p;
          victim = item;
        }
      }
      return victim;
    },
    forEach(fn) {
      for (const item of items) fn(item);
    },
    items,
  };
}
