import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { OperationResult, WorldState } from "@shipshitgames/warline";
import { createInitialWorld, NEUTRAL_WAR_EFFORT, WAR_EFFORT } from "@shipshitgames/warline";
import {
  buildOperationResult,
  configureWarlineReporter,
  fetchWarEffortBonus,
  readSharedFaction,
  reportWarlineOperation,
  resetWarlineReporterConfig,
  resolveWarlineConfig,
  type WarlineReportClient,
  type WarlineStateClient,
} from "../src/warline/reporter";

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const g = globalThis as {
  localStorage?: unknown;
  __warlineReporter?: unknown;
};

let storage: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  storage = fakeLocalStorage();
  g.localStorage = storage;
  resetWarlineReporterConfig();
  delete g.__warlineReporter;
});

afterEach(() => {
  delete g.localStorage;
  delete g.__warlineReporter;
  resetWarlineReporterConfig();
});

/** A client that captures the reported result and returns a scripted response. */
function captureClient(response: { ok: boolean; error?: string } | (() => never)) {
  const captured: OperationResult[] = [];
  const client: WarlineReportClient = {
    reportOperation: async (result) => {
      captured.push(result);
      if (typeof response === "function") return response();
      return response;
    },
  };
  return { client, captured };
}

// ---- buildOperationResult ----

test("buildOperationResult defaults faction to wardens with no stored allegiance", () => {
  const result = buildOperationResult("scourge-survivors", { outcome: "victory", score: 1200 });
  assert.deepEqual(result, {
    game: "scourge-survivors",
    faction: "wardens",
    outcome: "victory",
    score: 1200,
  });
});

test("buildOperationResult reads the shared warline.faction allegiance", () => {
  storage.setItem("warline.faction", "pyre");
  const result = buildOperationResult("rothulk", { outcome: "victory", score: 10 });
  assert.equal(result.faction, "pyre");
});

test("buildOperationResult lets the caller override the faction", () => {
  storage.setItem("warline.faction", "pyre");
  const result = buildOperationResult("pactfall", { outcome: "defeat", score: 5, faction: "wardens" });
  assert.equal(result.faction, "wardens");
});

test("buildOperationResult clamps non-finite and negative scores to >= 0", () => {
  assert.equal(buildOperationResult("redline", { outcome: "victory", score: -50 }).score, 0);
  assert.equal(buildOperationResult("redline", { outcome: "victory", score: Number.NaN }).score, 0);
  assert.equal(buildOperationResult("redline", { outcome: "victory", score: Infinity }).score, 0);
  assert.equal(buildOperationResult("redline", { outcome: "victory" }).score, 0);
});

test("buildOperationResult passes through optional player/nonce/targetId only when set", () => {
  const bare = buildOperationResult("deadlane", { outcome: "victory", score: 3 });
  assert.equal("player" in bare, false);
  assert.equal("nonce" in bare, false);
  assert.equal("targetId" in bare, false);

  const full = buildOperationResult("deadlane", {
    outcome: "victory",
    score: 3,
    player: "vince",
    nonce: "abc",
    targetId: "lane-2",
  });
  assert.equal(full.player, "vince");
  assert.equal(full.nonce, "abc");
  assert.equal(full.targetId, "lane-2");
});

test("buildOperationResult includes contributed only when it is a positive finite number", () => {
  // Omitted / zero / junk → no key on the wire (server banks nothing).
  assert.equal("contributed" in buildOperationResult("scourge-survivors", { outcome: "victory", score: 1 }), false);
  assert.equal(
    "contributed" in buildOperationResult("scourge-survivors", { outcome: "victory", score: 1, contributed: 0 }),
    false,
  );
  assert.equal(
    "contributed" in buildOperationResult("scourge-survivors", { outcome: "victory", score: 1, contributed: -50 }),
    false,
  );
  assert.equal(
    "contributed" in
      buildOperationResult("scourge-survivors", { outcome: "victory", score: 1, contributed: Number.NaN }),
    false,
  );
  // A positive loot value rides along, clamped to >= 0 by the same coercion as score.
  assert.equal(
    buildOperationResult("scourge-survivors", { outcome: "defeat", score: 1, contributed: 420 }).contributed,
    420,
  );
});

// ---- readSharedFaction ----

test("readSharedFaction returns wardens when unset or invalid", () => {
  assert.equal(readSharedFaction(), "wardens");
  storage.setItem("warline.faction", "scourge");
  assert.equal(readSharedFaction(), "wardens");
});

test("readSharedFaction returns wardens with no localStorage (SSR)", () => {
  delete g.localStorage;
  assert.equal(readSharedFaction(), "wardens");
});

// ---- resolveWarlineConfig precedence ----

test("resolveWarlineConfig prefers explicit options over module config and runtime override", () => {
  configureWarlineReporter({ host: "module-host", token: "module-token" });
  g.__warlineReporter = { host: "runtime-host" };
  const config = resolveWarlineConfig({ host: "opt-host", token: "opt-token" });
  assert.deepEqual(config, { host: "opt-host", token: "opt-token" });
});

test("resolveWarlineConfig falls back to module config then runtime override", () => {
  g.__warlineReporter = { host: "runtime-host", token: "runtime-token" };
  assert.deepEqual(resolveWarlineConfig(), { host: "runtime-host", token: "runtime-token" });

  configureWarlineReporter({ host: "module-host" });
  // module host wins over runtime host; runtime token still applies as fallback.
  assert.deepEqual(resolveWarlineConfig(), { host: "module-host", token: "runtime-token" });
});

test("resolveWarlineConfig defaults host to empty string when nothing is configured", () => {
  const config = resolveWarlineConfig();
  assert.equal(config.host, "");
  assert.equal(config.token, undefined);
});

test("resolveWarlineConfig trims a whitespace-only host to empty (reads as disabled)", () => {
  assert.equal(resolveWarlineConfig({ host: "   " }).host, "");
  assert.equal(resolveWarlineConfig({ host: "  warline.test  " }).host, "warline.test");
});

test("reportWarlineOperation treats a whitespace-only host as disabled (no request)", async () => {
  // A misconfigured host must collapse to a silent no-op, not a doomed fetch.
  const original = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
  }) as typeof fetch;
  try {
    const outcome = await reportWarlineOperation("redline", { outcome: "victory", score: 1 }, { host: "   " });
    assert.equal(outcome.reported, false);
    assert.equal(outcome.status, "disabled");
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = original;
  }
});

// ---- reportWarlineOperation ----

test("reportWarlineOperation is a no-op (disabled) with no host configured", async () => {
  const outcome = await reportWarlineOperation("scourge-survivors", { outcome: "victory", score: 9 });
  assert.equal(outcome.reported, false);
  assert.equal(outcome.status, "disabled");
  // The result is still built (useful for diagnostics / window sinks).
  assert.equal(outcome.result?.game, "scourge-survivors");
  assert.equal(outcome.result?.score, 9);
});

test("reportWarlineOperation sends the built result through an injected client on success", async () => {
  storage.setItem("warline.faction", "pyre");
  const { client, captured } = captureClient({ ok: true });
  const outcome = await reportWarlineOperation(
    "starblight",
    { outcome: "victory", score: 7, player: "ace" },
    { client },
  );
  assert.equal(outcome.reported, true);
  assert.equal(outcome.status, "ok");
  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0], {
    game: "starblight",
    faction: "pyre",
    outcome: "victory",
    score: 7,
    player: "ace",
  });
});

test("reportWarlineOperation surfaces a server rejection as an error outcome", async () => {
  const { client } = captureClient({ ok: false, error: "unauthorized" });
  const outcome = await reportWarlineOperation("brawl", { outcome: "defeat", score: 1 }, { client });
  assert.equal(outcome.reported, false);
  assert.equal(outcome.status, "error");
  assert.equal(outcome.error, "unauthorized");
});

test("reportWarlineOperation never throws when the client throws", async () => {
  const { client } = captureClient(() => {
    throw new Error("network down");
  });
  const outcome = await reportWarlineOperation("pactfall", { outcome: "victory", score: 2 }, { client });
  assert.equal(outcome.reported, false);
  assert.equal(outcome.status, "error");
  assert.match(outcome.error ?? "", /network down/);
});

test("reportWarlineOperation reports through a configured host without an injected client", async () => {
  // No injected client: a configured host means it constructs a real WarlineClient,
  // which POSTs via fetch. Stub fetch so the call resolves locally.
  const original = globalThis.fetch;
  const calls: { url: unknown; body: unknown }[] = [];
  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
    return {
      ok: true,
      json: async () => ({ ok: true }),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const outcome = await reportWarlineOperation(
      "deadlane",
      { outcome: "victory", score: 4 },
      { host: "warline.test" },
    );
    assert.equal(outcome.reported, true);
    assert.equal(outcome.status, "ok");
    assert.equal(calls.length, 1);
    assert.match(String(calls[0]?.url), /\/parties\/main\/front$/);
    assert.deepEqual((calls[0]?.body as { result: OperationResult }).result, {
      game: "deadlane",
      faction: "wardens",
      outcome: "victory",
      score: 4,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("reportWarlineOperation carries looted `contributed` through to the wire", async () => {
  const { client, captured } = captureClient({ ok: true });
  const outcome = await reportWarlineOperation(
    "scourge-survivors",
    { outcome: "victory", score: 10, contributed: 777 },
    { client },
  );
  assert.equal(outcome.reported, true);
  assert.equal(captured[0]?.contributed, 777);
});

// ---- fetchWarEffortBonus (#280) ----

/** A state client that returns a world with the given resource pool. */
function stateClientWithPool(scrap: number) {
  const world = createInitialWorld(1_700_000_000_000);
  const state: WorldState = { ...world, resources: { scrap, biomass: 0, fuel: 0, intel: 0 } };
  const client: WarlineStateClient = {
    fetchState: async () => state,
  };
  return client;
}

test("fetchWarEffortBonus returns the neutral bonus when no host is configured", async () => {
  const bonus = await fetchWarEffortBonus();
  assert.deepEqual(bonus, NEUTRAL_WAR_EFFORT);
});

test("fetchWarEffortBonus derives the bonus from the fetched world pool", async () => {
  // Two full tiers of scrap → tier 2, +2*perTier damage, fresh progress.
  const client = stateClientWithPool(WAR_EFFORT.unitPerTier * 2);
  const bonus = await fetchWarEffortBonus({ client });
  assert.equal(bonus.tier, 2);
  assert.ok(Math.abs(bonus.damageMult - (1 + 2 * WAR_EFFORT.perTier)) < 1e-9);
  assert.equal(bonus.total, WAR_EFFORT.unitPerTier * 2);
  assert.equal(bonus.progress, 0);
});

test("fetchWarEffortBonus never throws — a failing client yields the neutral bonus", async () => {
  const client: WarlineStateClient = {
    fetchState: async () => {
      throw new Error("front unreachable");
    },
  };
  const bonus = await fetchWarEffortBonus({ client });
  assert.deepEqual(bonus, NEUTRAL_WAR_EFFORT);
});

test("fetchWarEffortBonus times out a *slow* front and yields the neutral bonus", async () => {
  // A reachable-but-stalled front: fetchState never settles. The read must not
  // hang the run start — it falls back to neutral once timeoutMs elapses.
  const client: WarlineStateClient = {
    fetchState: () => new Promise<WorldState>(() => {}),
  };
  const start = Date.now();
  const bonus = await fetchWarEffortBonus({ client, timeoutMs: 20 });
  assert.deepEqual(bonus, NEUTRAL_WAR_EFFORT);
  // Resolved promptly via the timeout, nowhere near hanging.
  assert.ok(Date.now() - start < 1_000, "slow front resolved via timeout");
});

test("fetchWarEffortBonus reads through a configured host without an injected client", async () => {
  const original = globalThis.fetch;
  const world = createInitialWorld(1_700_000_000_000);
  const state: WorldState = { ...world, resources: { scrap: WAR_EFFORT.unitPerTier, biomass: 0, fuel: 0, intel: 0 } };
  let calledUrl: unknown;
  globalThis.fetch = (async (url: unknown) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ state }) } as unknown as Response;
  }) as typeof fetch;
  try {
    const bonus = await fetchWarEffortBonus({ host: "warline.test" });
    assert.equal(bonus.tier, 1);
    assert.match(String(calledUrl), /\/parties\/main\/front$/);
  } finally {
    globalThis.fetch = original;
  }
});

test("fetchWarEffortBonus is disabled (neutral) for a whitespace-only host — no request", async () => {
  const original = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return { ok: true, json: async () => ({ state: createInitialWorld(1) }) } as unknown as Response;
  }) as typeof fetch;
  try {
    const bonus = await fetchWarEffortBonus({ host: "   " });
    assert.deepEqual(bonus, NEUTRAL_WAR_EFFORT);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = original;
  }
});
