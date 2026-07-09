export const SETTINGS_KEY = "shipshitgames.gameSettings.v1";

export class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export interface TestWindow extends EventTarget {
  AudioContext?: typeof AudioContext;
  clearTimeout: typeof window.clearTimeout;
  localStorage: MemoryStorage;
  location: {
    href: string;
    hostname: string;
    port: string;
    protocol: string;
  };
  listenerCount(type: string): number;
  pendingTimeoutCount(): number;
  runAllTimeouts(): void;
  setTimeout: typeof window.setTimeout;
}

export function createTestWindow(
  location: Partial<TestWindow["location"]> = {},
  AudioContext?: typeof globalThis.AudioContext,
): TestWindow {
  const target = new EventTarget();
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const nativeAdd = target.addEventListener.bind(target);
  const nativeRemove = target.removeEventListener.bind(target);
  const timeouts = new Map<number, () => void>();
  let nextTimeout = 1;

  target.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
    if (listener) {
      const entries = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      entries.add(listener);
      listeners.set(type, entries);
    }
    nativeAdd(type, listener, options as AddEventListenerOptions);
  }) as typeof target.addEventListener;
  target.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: unknown,
  ) => {
    if (listener) listeners.get(type)?.delete(listener);
    nativeRemove(type, listener, options as EventListenerOptions);
  }) as typeof target.removeEventListener;

  return Object.assign(target, {
    AudioContext,
    localStorage: new MemoryStorage(),
    location: {
      href: "https://deadrot.com/scourge-survivors/",
      hostname: "deadrot.com",
      port: "",
      protocol: "https:",
      ...location,
    },
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
    setTimeout: ((handler: TimerHandler, _delay?: number, ...args: unknown[]) => {
      const id = nextTimeout++;
      timeouts.set(id, () => {
        if (typeof handler === "function") handler(...args);
      });
      return id;
    }) as typeof window.setTimeout,
    clearTimeout: ((id?: number) => {
      if (id !== undefined) timeouts.delete(id);
    }) as typeof window.clearTimeout,
    pendingTimeoutCount: () => timeouts.size,
    runAllTimeouts: () => {
      const pending = [...timeouts.entries()];
      timeouts.clear();
      for (const [, callback] of pending) callback();
    },
  });
}

export function installTestWindow(testWindow: TestWindow): void {
  Object.defineProperty(globalThis, "window", { configurable: true, value: testWindow, writable: true });
}

export function removeTestWindow(): void {
  Reflect.deleteProperty(globalThis, "window");
}
