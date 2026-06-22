import { describe, expect, test } from "bun:test";

import { ACCESS_STATE_ORDER, ACCESS_STATE_PRESENTATION, baseAccessState, resolveAccessState } from "@/lib/access-state";
import type { GameStatus } from "@/lib/content";

describe("baseAccessState", () => {
  test("maps dev-status to a base access state", () => {
    expect(baseAccessState("PLAYABLE")).toBe("available");
    expect(baseAccessState("IN DEV")).toBe("preview");
    expect(baseAccessState("CONCEPT")).toBe("waitlist");
  });

  test("an unknown status degrades to waitlist (never throws)", () => {
    expect(baseAccessState("MYSTERY" as GameStatus)).toBe("waitlist");
  });
});

describe("resolveAccessState", () => {
  test("a playable, gated, not-unlocked game is locked", () => {
    expect(resolveAccessState("PLAYABLE", { gated: true, unlocked: false })).toBe("locked");
  });

  test("a playable, gated, unlocked game is available", () => {
    expect(resolveAccessState("PLAYABLE", { gated: true, unlocked: true })).toBe("available");
  });

  test("a playable, ungated game is always available", () => {
    expect(resolveAccessState("PLAYABLE", { gated: false, unlocked: false })).toBe("available");
  });

  test("preview and waitlist are never locked — there is nothing to buy yet", () => {
    expect(resolveAccessState("IN DEV", { gated: true, unlocked: false })).toBe("preview");
    expect(resolveAccessState("CONCEPT", { gated: true, unlocked: false })).toBe("waitlist");
  });
});

describe("presentation", () => {
  test("every ordered state has label + blurb", () => {
    for (const state of ACCESS_STATE_ORDER) {
      const p = ACCESS_STATE_PRESENTATION[state];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  test("the order covers exactly the four states once each", () => {
    expect([...ACCESS_STATE_ORDER].sort()).toEqual(["available", "locked", "preview", "waitlist"]);
  });

  test("copy stays honest — no finished-game promise wording", () => {
    const allCopy = ACCESS_STATE_ORDER.map(
      (s) => `${ACCESS_STATE_PRESENTATION[s].label} ${ACCESS_STATE_PRESENTATION[s].blurb}`,
    )
      .join(" ")
      .toLowerCase();
    expect(allCopy).not.toMatch(/full release|finished game|out now|launched/);
  });
});
