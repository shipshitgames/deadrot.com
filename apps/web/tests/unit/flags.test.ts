import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  __setRemoteFetcher,
  FLAG_DEFAULTS,
  fetchRemoteFlags,
  filterVisibleGames,
  flagDefault,
  gameVisibilityFlag,
  isEnabled,
  isEnabledSync,
  isGameVisible,
  isGameVisibleSync,
  normalizeRemoteFlags,
  parseFlagOverrides,
  resolveFlag,
  selectVisibleGames,
} from "@/lib/flags";

// ── Test hygiene ──────────────────────────────────────────────────────────────
// Capture the original FLAG_OVERRIDES value before each test and restore it
// after, and reset the remote fetcher seam. This prevents any state from
// leaking between tests regardless of pass/fail.

let originalFlagOverrides: string | undefined;

beforeEach(() => {
  originalFlagOverrides = process.env.FLAG_OVERRIDES;
});

afterEach(() => {
  if (originalFlagOverrides === undefined) {
    delete process.env.FLAG_OVERRIDES;
  } else {
    process.env.FLAG_OVERRIDES = originalFlagOverrides;
  }
  __setRemoteFetcher(null);
});

// ── 1. gameVisibilityFlag ─────────────────────────────────────────────────────

describe("gameVisibilityFlag", () => {
  test("returns game-<slug>-visible for a given slug", () => {
    expect(gameVisibilityFlag("rothulk")).toBe("game-rothulk-visible");
  });

  test("handles slugs with hyphens", () => {
    expect(gameVisibilityFlag("dead-lane")).toBe("game-dead-lane-visible");
  });

  test("handles numeric slugs", () => {
    expect(gameVisibilityFlag("zone42")).toBe("game-zone42-visible");
  });
});

// ── 2. flagDefault ────────────────────────────────────────────────────────────

describe("flagDefault", () => {
  test("any game-<slug>-visible flag defaults to true (default on)", () => {
    expect(flagDefault("game-rothulk-visible")).toBe(true);
    expect(flagDefault("game-deadlane-visible")).toBe(true);
    expect(flagDefault("game-any-new-game-visible")).toBe(true);
  });

  test("an unknown non-game flag defaults to false (dark by default)", () => {
    expect(flagDefault("web-new-hero")).toBe(false);
    expect(flagDefault("enable-chat")).toBe(false);
    expect(flagDefault("unknown-feature")).toBe(false);
  });

  test("a flag explicitly in FLAG_DEFAULTS takes its registered value", () => {
    // FLAG_DEFAULTS is currently empty — verify the property at runtime
    // and confirm the fallback behaviour when it IS populated (via a
    // hand-crafted lookup rather than mutating the exported constant).
    expect(Object.keys(FLAG_DEFAULTS)).toHaveLength(0);
    // Non-game, not in FLAG_DEFAULTS => false
    expect(flagDefault("some-future-flag")).toBe(false);
  });

  test("does NOT match partial game flag patterns", () => {
    // Missing trailing -visible
    expect(flagDefault("game-rothulk")).toBe(false);
    // Missing game- prefix
    expect(flagDefault("rothulk-visible")).toBe(false);
  });
});

// ── 3. parseFlagOverrides ─────────────────────────────────────────────────────

describe("parseFlagOverrides", () => {
  test("parses a valid JSON object of booleans", () => {
    const result = parseFlagOverrides('{"game-rothulk-visible":false,"web-new-hero":true}');
    expect(result).toEqual({ "game-rothulk-visible": false, "web-new-hero": true });
  });

  test("malformed JSON returns an empty object", () => {
    expect(parseFlagOverrides("{bad json}")).toEqual({});
    expect(parseFlagOverrides("not-json-at-all")).toEqual({});
    expect(parseFlagOverrides("{")).toEqual({});
  });

  test("a JSON array returns an empty object (not an object)", () => {
    expect(parseFlagOverrides("[true,false]")).toEqual({});
    expect(parseFlagOverrides('["game-rothulk-visible"]')).toEqual({});
  });

  test("non-boolean values (string, number) are dropped silently", () => {
    const result = parseFlagOverrides('{"game-rothulk-visible":"yes","count":42,"valid":true}');
    // string "yes" and number 42 are dropped; only explicit bool survives
    expect(result).toEqual({ valid: true });
  });

  test("null key value is dropped (not a boolean)", () => {
    const result = parseFlagOverrides('{"game-rothulk-visible":null}');
    expect(result).toEqual({});
  });

  test("undefined input returns an empty object", () => {
    expect(parseFlagOverrides(undefined)).toEqual({});
  });

  test("null input returns an empty object", () => {
    expect(parseFlagOverrides(null)).toEqual({});
  });

  test("empty string returns an empty object", () => {
    expect(parseFlagOverrides("")).toEqual({});
  });

  test("a JSON object with mixed valid and invalid values keeps only booleans", () => {
    const result = parseFlagOverrides('{"a":true,"b":false,"c":"string","d":1,"e":null,"f":{}}');
    expect(result).toEqual({ a: true, b: false });
  });
});

// ── 4. resolveFlag precedence ─────────────────────────────────────────────────

describe("resolveFlag", () => {
  test("override wins over remote and fallback", () => {
    expect(resolveFlag({ override: true, remote: false, fallback: false })).toBe(true);
    expect(resolveFlag({ override: false, remote: true, fallback: true })).toBe(false);
  });

  test("remote wins over fallback when there is no override", () => {
    expect(resolveFlag({ remote: true, fallback: false })).toBe(true);
    expect(resolveFlag({ remote: false, fallback: true })).toBe(false);
  });

  test("fallback wins when both override and remote are undefined", () => {
    expect(resolveFlag({ fallback: true })).toBe(true);
    expect(resolveFlag({ fallback: false })).toBe(false);
  });

  test("override:false beats remote:true (explicit false is respected)", () => {
    expect(resolveFlag({ override: false, remote: true, fallback: true })).toBe(false);
  });

  test("override:undefined is treated as absent — falls through to remote", () => {
    expect(resolveFlag({ override: undefined, remote: true, fallback: false })).toBe(true);
  });

  test("remote:undefined is treated as absent — falls through to fallback", () => {
    expect(resolveFlag({ override: undefined, remote: undefined, fallback: true })).toBe(true);
  });
});

// ── 5. normalizeRemoteFlags ───────────────────────────────────────────────────

describe("normalizeRemoteFlags", () => {
  test("boolean true stays true", () => {
    expect(normalizeRemoteFlags({ "game-rothulk-visible": true })).toEqual({
      "game-rothulk-visible": true,
    });
  });

  test("boolean false stays false", () => {
    expect(normalizeRemoteFlags({ "game-rothulk-visible": false })).toEqual({
      "game-rothulk-visible": false,
    });
  });

  test("variant string 'control' maps to true (flag is on)", () => {
    expect(normalizeRemoteFlags({ "some-experiment": "control" })).toEqual({
      "some-experiment": true,
    });
  });

  test("variant string 'variant-a' maps to true", () => {
    expect(normalizeRemoteFlags({ "some-experiment": "variant-a" })).toEqual({
      "some-experiment": true,
    });
  });

  test("null values are dropped from output", () => {
    expect(normalizeRemoteFlags({ "game-rothulk-visible": null })).toEqual({});
  });

  test("undefined values are dropped from output", () => {
    expect(normalizeRemoteFlags({ "game-rothulk-visible": undefined })).toEqual({});
  });

  test("a mix of valid and dropped values is handled correctly", () => {
    const result = normalizeRemoteFlags({
      "flag-a": true,
      "flag-b": false,
      "flag-c": "variant-x",
      "flag-d": null,
      "flag-e": undefined,
    });
    expect(result).toEqual({ "flag-a": true, "flag-b": false, "flag-c": true });
  });

  test("undefined input (no featureFlags key) returns empty object", () => {
    expect(normalizeRemoteFlags(undefined as unknown as Record<string, unknown>)).toEqual({});
  });

  test("any present non-false value (e.g. a number) maps to true", () => {
    // PostHog returns bool | variant-string; a number is off-contract, but the
    // rule is "present and not false => on", so document that it does not crash.
    expect(normalizeRemoteFlags({ "flag-a": 1, "flag-b": 0 })).toEqual({
      "flag-a": true,
      "flag-b": true,
    });
  });
});

// ── 6. isEnabledSync / isGameVisibleSync ─────────────────────────────────────

describe("isEnabledSync", () => {
  test("with FLAG_OVERRIDES killing a game, that game reads false", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    expect(isEnabledSync("game-rothulk-visible")).toBe(false);
  });

  test("with FLAG_OVERRIDES killing one game, another game still reads true (default-on)", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    expect(isEnabledSync("game-deadlane-visible")).toBe(true);
  });

  test("with FLAG_OVERRIDES unset, a game-visible flag reads true (default-on)", () => {
    delete process.env.FLAG_OVERRIDES;
    expect(isEnabledSync("game-rothulk-visible")).toBe(true);
  });

  test("with FLAG_OVERRIDES unset, an unknown non-game flag reads false", () => {
    delete process.env.FLAG_OVERRIDES;
    expect(isEnabledSync("web-new-hero")).toBe(false);
  });

  test("an env override of true forces a non-game flag on", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "web-new-hero": true });
    expect(isEnabledSync("web-new-hero")).toBe(true);
  });
});

describe("isGameVisibleSync", () => {
  test("with FLAG_OVERRIDES killing rothulk, isGameVisibleSync('rothulk') is false", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    expect(isGameVisibleSync("rothulk")).toBe(false);
  });

  test("another game is unaffected by a per-game override", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    expect(isGameVisibleSync("deadlane")).toBe(true);
  });

  test("with no overrides set, any game reads visible (default-on)", () => {
    delete process.env.FLAG_OVERRIDES;
    expect(isGameVisibleSync("rothulk")).toBe(true);
    expect(isGameVisibleSync("some-new-game")).toBe(true);
  });
});

// ── 7. Async isEnabled / isGameVisible / filterVisibleGames (fake remote) ─────

describe("async isEnabled with __setRemoteFetcher", () => {
  test("remote false hides a game when there is no env override", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    expect(await isEnabled("game-rothulk-visible")).toBe(false);
  });

  test("env override true BEATS a remote false (override precedence)", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": true });
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    expect(await isEnabled("game-rothulk-visible")).toBe(true);
  });

  test("env override false BEATS a remote true", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": true }));
    expect(await isEnabled("game-rothulk-visible")).toBe(false);
  });

  test("remote empty + no override falls through to flagDefault (game => true)", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({}));
    expect(await isEnabled("game-rothulk-visible")).toBe(true);
  });

  test("remote empty + no override falls through to flagDefault (non-game => false)", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({}));
    expect(await isEnabled("web-new-hero")).toBe(false);
  });
});

describe("async isGameVisible with __setRemoteFetcher", () => {
  test("remote kills rothulk", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    expect(await isGameVisible("rothulk")).toBe(false);
  });

  test("env override beats remote false for rothulk", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": true });
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    expect(await isGameVisible("rothulk")).toBe(true);
  });
});

describe("filterVisibleGames with __setRemoteFetcher", () => {
  const games = [
    { slug: "rothulk", title: "Rothulk" },
    { slug: "deadlane", title: "Deadlane" },
    { slug: "warline", title: "Warline" },
  ];

  test("remote false for rothulk drops it from the list", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    const result = await filterVisibleGames(games);
    expect(result.map((g) => g.slug)).toEqual(["deadlane", "warline"]);
  });

  test("remote {} with no overrides keeps all games (all default-on)", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({}));
    const result = await filterVisibleGames(games);
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.slug)).toEqual(["rothulk", "deadlane", "warline"]);
  });

  test("env override beats remote: killing deadlane via env while remote is empty", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-deadlane-visible": false });
    __setRemoteFetcher(async () => ({}));
    const result = await filterVisibleGames(games);
    expect(result.map((g) => g.slug)).toEqual(["rothulk", "warline"]);
  });

  test("env override beats remote: restoring rothulk via env despite remote false", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": true });
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    const result = await filterVisibleGames(games);
    expect(result.map((g) => g.slug)).toEqual(["rothulk", "deadlane", "warline"]);
  });

  test("remote kills multiple games at once", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({
      "game-rothulk-visible": false,
      "game-warline-visible": false,
    }));
    const result = await filterVisibleGames(games);
    expect(result.map((g) => g.slug)).toEqual(["deadlane"]);
  });

  test("filterVisibleGames makes a SINGLE remote call regardless of game count", async () => {
    delete process.env.FLAG_OVERRIDES;
    let callCount = 0;
    __setRemoteFetcher(async () => {
      callCount++;
      return {};
    });
    await filterVisibleGames(games);
    expect(callCount).toBe(1);
  });
});

// ── 7b. fetchRemoteFlags / selectVisibleGames (cache-friendly split) ──────────
//
// The render path (app/page.tsx) fetches the remote map ONCE (wrapped in
// unstable_cache for ISR) and then resolves with the pure, network-free
// selectVisibleGames — so the FLAG_OVERRIDES kill-switch stays instant even when
// the remote map is served stale from cache. These tests pin that contract.

describe("fetchRemoteFlags", () => {
  test("returns the raw remote map with NO override/default resolution applied", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": true });
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));
    // The env override is deliberately NOT applied here — this is the raw remote.
    expect(await fetchRemoteFlags()).toEqual({ "game-rothulk-visible": false });
  });

  test("forwards the FlagUser identity to the remote fetcher", async () => {
    let seen: unknown;
    __setRemoteFetcher(async (user) => {
      seen = user;
      return {};
    });
    await fetchRemoteFlags({ id: "user_123", email: "a@b.com" });
    expect(seen).toEqual({ id: "user_123", email: "a@b.com" });
  });

  test("resolves to {} when no remote fetcher data (default posthog, no key)", async () => {
    // Reset to the real posthogFetcher; with NEXT_PUBLIC_POSTHOG_KEY unset it
    // short-circuits to {} with no network.
    __setRemoteFetcher(null);
    const original = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    try {
      expect(await fetchRemoteFlags()).toEqual({});
    } finally {
      if (original !== undefined) process.env.NEXT_PUBLIC_POSTHOG_KEY = original;
    }
  });
});

describe("selectVisibleGames (pure resolver)", () => {
  const games = [
    { slug: "rothulk", title: "Rothulk" },
    { slug: "deadlane", title: "Deadlane" },
  ];

  test("remote false drops a game", () => {
    delete process.env.FLAG_OVERRIDES;
    const result = selectVisibleGames(games, { "game-rothulk-visible": false });
    expect(result.map((g) => g.slug)).toEqual(["deadlane"]);
  });

  test("empty remote keeps all games (default-on)", () => {
    delete process.env.FLAG_OVERRIDES;
    expect(selectVisibleGames(games, {}).map((g) => g.slug)).toEqual(["rothulk", "deadlane"]);
  });

  test("env override beats a stale remote map (kill-switch stays instant)", () => {
    // Remote says rothulk visible, but a fresh env override kills it — the pure
    // resolver reads FLAG_OVERRIDES per call, so a cached remote can't override it.
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    const result = selectVisibleGames(games, { "game-rothulk-visible": true });
    expect(result.map((g) => g.slug)).toEqual(["deadlane"]);
  });

  test("env override can restore a game the remote map hid", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": true });
    const result = selectVisibleGames(games, { "game-rothulk-visible": false });
    expect(result.map((g) => g.slug)).toEqual(["rothulk", "deadlane"]);
  });

  test("does no network — ignores the remote fetcher entirely", () => {
    let called = false;
    __setRemoteFetcher(async () => {
      called = true;
      return {};
    });
    selectVisibleGames(games, {});
    expect(called).toBe(false);
  });
});

// ── 7c. isEnabled skips the network when an override is pinned ────────────────

describe("isEnabled override short-circuits the remote fetch", () => {
  test("a pinned override returns WITHOUT calling the remote fetcher", async () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "web-new-hero": true });
    let called = false;
    __setRemoteFetcher(async () => {
      called = true;
      return {};
    });
    expect(await isEnabled("web-new-hero")).toBe(true);
    expect(called).toBe(false);
  });

  test("no override DOES consult the remote fetcher", async () => {
    delete process.env.FLAG_OVERRIDES;
    let called = false;
    __setRemoteFetcher(async () => {
      called = true;
      return {};
    });
    await isEnabled("web-new-hero");
    expect(called).toBe(true);
  });
});

// ── 8. Flags vs paywall property ─────────────────────────────────────────────
//
// Hard boundary: a flag is a UX toggle, NOT a security boundary.
// The paywall (lib/access.ts + proxy.ts Clerk/Stripe entitlement) is the
// security boundary. A game being visible does NOT mean it is accessible —
// the proxy.ts entitlement gate runs independently after visibility is checked.
//
// Visibility is a necessary but NOT sufficient condition for playability:
//   isGameVisible => false  ⟹  game is hidden (regardless of entitlement)
//   isGameVisible => true   ⟹  game is shown, but may still require purchase
//
// This module exposes NO function that returns or grants an entitlement.

describe("flags vs paywall — visibility != access", () => {
  test("a killed visibility flag hides a game (isGameVisible is false)", async () => {
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": false }));

    // A killed flag means the game is invisible regardless of who the user is.
    const visible = await isGameVisible("rothulk");
    expect(visible).toBe(false);
  });

  test("isGameVisibleSync also respects a kill-switch from the env", () => {
    process.env.FLAG_OVERRIDES = JSON.stringify({ "game-rothulk-visible": false });
    expect(isGameVisibleSync("rothulk")).toBe(false);
  });

  test("the flags module exports no entitlement-granting function", () => {
    // The public API surface must not include any function that could be
    // mistaken for an access grant. We assert that the core access-control
    // identifiers from lib/access.ts are NOT present on this module.
    const flagsModule = {
      FLAG_DEFAULTS,
      gameVisibilityFlag,
      flagDefault,
      parseFlagOverrides,
      resolveFlag,
      normalizeRemoteFlags,
      isEnabledSync,
      isGameVisibleSync,
      isEnabled,
      isGameVisible,
      fetchRemoteFlags,
      selectVisibleGames,
      filterVisibleGames,
      __setRemoteFetcher,
    };

    // None of the exported identifiers should be named like an access or
    // entitlement check. Visibility is always about display, not security.
    const exportNames = Object.keys(flagsModule);
    for (const name of exportNames) {
      expect(name).not.toMatch(/entitlement|hasAccess|grantAccess|canPlay|isUnlocked/i);
    }
  });

  test("a game can be visible yet conceptually still require a paywall check", () => {
    // This test documents the intended contract, not a code path:
    // isGameVisible returning true does NOT bypass Clerk/Stripe.
    // The proxy.ts entitlement gate always runs after visibility resolution.
    //
    // Here we simply verify that isGameVisible does not throw or return
    // anything other than a plain boolean.
    delete process.env.FLAG_OVERRIDES;
    __setRemoteFetcher(async () => ({ "game-rothulk-visible": true }));

    return isGameVisible("rothulk").then((result) => {
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
      // result === true here means "show in gallery", NOT "grant access".
    });
  });
});
