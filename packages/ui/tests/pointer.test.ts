import assert from "node:assert/strict";
import { test } from "node:test";

import { COARSE_POINTER_QUERY, isCoarsePointer, subscribeToPointerKind } from "../src/pointer";

/**
 * A window that answers the pointer query, and records who asked.
 *
 * Every field is optional so each test can delete exactly the capability it is
 * about — an engine without `matchMedia`, a MediaQueryList without
 * `addEventListener` — rather than hand-rolling a whole window per case.
 */
function fakeWindow(options: {
  matches?: boolean;
  maxTouchPoints?: number;
  omitMatchMedia?: boolean;
  omitAddEventListener?: boolean;
  throwOnQuery?: boolean;
}): { win: Window; queries: string[]; listeners: number } {
  const state = { queries: [] as string[], listeners: 0 };
  const query = {
    matches: options.matches ?? false,
    ...(options.omitAddEventListener
      ? {}
      : {
          addEventListener: () => {
            state.listeners += 1;
          },
          removeEventListener: () => {
            state.listeners -= 1;
          },
        }),
  };
  const win = {
    navigator: { maxTouchPoints: options.maxTouchPoints ?? 0 },
    ...(options.omitMatchMedia
      ? {}
      : {
          matchMedia: (text: string) => {
            state.queries.push(text);
            if (options.throwOnQuery) throw new Error("unsupported query");
            return query;
          },
        }),
  } as unknown as Window;
  return {
    win,
    queries: state.queries,
    get listeners() {
      return state.listeners;
    },
  };
}

test("isCoarsePointer asks the pointer media query and returns its answer", () => {
  const coarse = fakeWindow({ matches: true });
  const fine = fakeWindow({ matches: false });

  assert.equal(isCoarsePointer(coarse.win), true);
  assert.equal(isCoarsePointer(fine.win), false);
  assert.deepEqual(coarse.queries, [COARSE_POINTER_QUERY]);
});

test("isCoarsePointer falls back to touch points where the query is unavailable", () => {
  assert.equal(isCoarsePointer(fakeWindow({ omitMatchMedia: true, maxTouchPoints: 5 }).win), true);
  assert.equal(isCoarsePointer(fakeWindow({ omitMatchMedia: true, maxTouchPoints: 0 }).win), false);
});

test("isCoarsePointer survives a matchMedia that throws, and no window at all", () => {
  // A throwing query must not take the menu down with it; a fine pointer is the
  // safe assumption because it asks for no on-screen controls.
  assert.equal(isCoarsePointer(fakeWindow({ throwOnQuery: true }).win), false);
  assert.equal(isCoarsePointer(undefined), false);
});

test("isCoarsePointer prefers the query over touch points when both are present", () => {
  // A laptop with a touchscreen reports touch points but is still a fine
  // pointer, so the query has to win or every desktop gets a thumb pad.
  assert.equal(isCoarsePointer(fakeWindow({ matches: false, maxTouchPoints: 10 }).win), false);
});

test("subscribeToPointerKind attaches a change listener and detaches on unsubscribe", () => {
  const device = fakeWindow({ matches: true });

  const unsubscribe = subscribeToPointerKind(() => {}, device.win);
  assert.equal(device.listeners, 1);
  assert.deepEqual(device.queries, [COARSE_POINTER_QUERY]);

  unsubscribe();
  assert.equal(device.listeners, 0);
});

test("subscribeToPointerKind returns a callable no-op where it cannot listen", () => {
  // Callers subscribe unconditionally, so every unlistenable shape still has to
  // hand back something safe to call.
  for (const win of [
    fakeWindow({ omitMatchMedia: true }).win,
    fakeWindow({ omitAddEventListener: true }).win,
    fakeWindow({ throwOnQuery: true }).win,
    undefined,
  ]) {
    const unsubscribe = subscribeToPointerKind(() => {}, win);
    assert.equal(typeof unsubscribe, "function");
    unsubscribe();
  }
});
