// The persistence half of the first-drop controls primer. The card itself is a
// render-only overlay covered by E2E; what matters here is that "seen" survives
// a reload, stays independent of progression, and never throws a run away when
// storage is unavailable — a private-mode player should see the primer again,
// not lose the drop to an uncaught SecurityError.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearScores, loadShop, markPrimerSeen, primerSeen, saveShop } from "../../src/game/storage";

/** Minimal Storage stand-in: the unit env is node, so there is no DOM one. */
function installStorage(impl?: Partial<Storage>) {
  const map = new Map<string, string>();
  const store: Storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    ...impl,
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
  return map;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("first-drop primer persistence", () => {
  it("is unseen on a fresh install and seen for good once marked", () => {
    expect(primerSeen()).toBe(false);
    markPrimerSeen();
    expect(primerSeen()).toBe(true);
  });

  it("is idempotent, so re-marking mid-run cannot un-teach the player", () => {
    markPrimerSeen();
    markPrimerSeen();
    expect(primerSeen()).toBe(true);
  });

  it("survives clearing scores and the meta-progression shop", () => {
    markPrimerSeen();
    saveShop({ gold: 120, tiers: { health: 2 } });

    clearScores();
    // A veteran who wipes their leaderboard or respecs is still a veteran.
    expect(primerSeen()).toBe(true);
    expect(loadShop().gold).toBe(120);
  });

  it("reads as unseen rather than throwing when storage is blocked", () => {
    installStorage({
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(primerSeen()).toBe(false);
  });

  it("swallows a rejected write so a full quota cannot kill the drop", () => {
    installStorage({
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });
    expect(() => markPrimerSeen()).not.toThrow();
  });

  it("does not exist at all when there is no storage object", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(primerSeen()).toBe(false);
    expect(() => markPrimerSeen()).not.toThrow();
  });
});
