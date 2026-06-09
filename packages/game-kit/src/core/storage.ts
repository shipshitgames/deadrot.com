// Typed, versioned localStorage stores — replaces the ad-hoc JSON.parse/try/catch
// persistence each game grew (best times, drydock tiers, run summaries). SSR-safe
// and resilient to quota/private-mode failures.

export interface LocalStoreOptions<T> {
  /** Schema version stamped into the envelope. Bump it with a `migrate`. */
  version?: number;
  /** Upgrade older (or unversioned) payloads; return the new shape. */
  migrate?: (raw: unknown, fromVersion: number) => T;
}

export interface LocalStore<T> {
  readonly key: string;
  get(): T;
  set(value: T): void;
  /** Patch object stores or compute the next value from the current one. */
  update(patch: Partial<T> | ((current: T) => T)): T;
  clear(): void;
}

interface Envelope {
  v: number;
  data: unknown;
}

export function createLocalStore<T>(key: string, defaults: T, opts: LocalStoreOptions<T> = {}): LocalStore<T> {
  const version = opts.version ?? 1;

  const read = (): T => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<Envelope> | null;
      if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
        // Legacy unversioned payload.
        return opts.migrate ? opts.migrate(parsed, 0) : defaults;
      }
      const v = typeof parsed.v === "number" ? parsed.v : 0;
      if (v !== version) {
        return opts.migrate ? opts.migrate(parsed.data, v) : defaults;
      }
      // Merge over defaults so added fields stay forward-compatible.
      if (defaults !== null && typeof defaults === "object" && !Array.isArray(defaults)) {
        return { ...defaults, ...(parsed.data as object) } as T;
      }
      return parsed.data as T;
    } catch {
      return defaults;
    }
  };

  const write = (value: T) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ v: version, data: value } satisfies Envelope));
    } catch {
      /* ignore quota / private-mode errors */
    }
  };

  return {
    key,
    get: read,
    set: write,
    update(patch) {
      const current = read();
      const next = typeof patch === "function" ? (patch as (c: T) => T)(current) : ({ ...current, ...patch } as T);
      write(next);
      return next;
    },
    clear() {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
