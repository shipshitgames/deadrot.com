import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  BALANCE_SESSION_KEY,
  BALANCE_TELEMETRY_KEY,
  clearLocalBalanceEvents,
  createBalanceTelemetry,
  createPostHogTelemetrySink,
  createSentryBreadcrumbSink,
  readLocalBalanceEvents,
  resetBalanceTelemetryConfigForTests,
} from "../src/telemetry";

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const g = globalThis as unknown as { window?: { localStorage: ReturnType<typeof fakeLocalStorage> } };
let storage: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  storage = fakeLocalStorage();
  g.window = { localStorage: storage };
  resetBalanceTelemetryConfigForTests();
});

afterEach(() => {
  resetBalanceTelemetryConfigForTests();
  delete g.window;
});

test("records local run lifecycle events with stable session/run ids", () => {
  const telemetry = createBalanceTelemetry({
    game: "scourge-survivors",
    mode: "endless",
    now: () => 1000,
    random: () => 0.5,
  });

  const runId = telemetry.startRun({ map: "ashgate", playerClass: "ranger" });
  telemetry.checkpoint({ level: 3, hpPct: 0.72 }, 30);
  telemetry.endRun({ outcome: "defeat", score: 420, wave: 7 }, 61);

  const events = readLocalBalanceEvents();
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.event),
    ["run_start", "checkpoint", "run_end"],
  );
  assert.ok(runId.startsWith("run_"));
  assert.equal(events[0]?.runId, runId);
  assert.equal(events[1]?.runId, runId);
  assert.equal(events[2]?.runId, runId);
  assert.equal(events[0]?.sessionId, telemetry.sessionId);
  assert.equal(events[0]?.mode, "endless");
  assert.equal(events[1]?.elapsedSec, 30);
  assert.equal(storage._map.has(BALANCE_SESSION_KEY), true);
  assert.equal(storage._map.has(BALANCE_TELEMETRY_KEY), true);
});

test("sanitizes properties so only JSON-safe values are stored", () => {
  const telemetry = createBalanceTelemetry({
    game: "deadlane",
    now: () => 2,
    random: () => 0.25,
  });

  telemetry.capture("checkpoint", {
    hp: 12,
    nan: Number.NaN,
    inf: Infinity,
    fn: () => "nope",
    nested: { ok: true, skip: undefined },
    arr: [1, Number.NaN, "x"],
  });

  const event = readLocalBalanceEvents()[0];
  assert.ok(event);
  assert.deepEqual(event.properties, {
    hp: 12,
    nested: { ok: true },
    arr: [1, "x"],
  });
});

test("can disable local buffering and forward to PostHog-compatible sinks", () => {
  const captured: Array<{ event: string; properties?: Record<string, unknown> }> = [];
  const telemetry = createBalanceTelemetry({
    game: "redline",
    localBuffer: false,
    now: () => 3,
    random: () => 0.1,
    sinks: [
      createPostHogTelemetrySink({
        capture(event, properties) {
          captured.push({ event, properties });
        },
      }),
    ],
  });

  telemetry.endRun({ outcome: "victory", score: 900, timeMs: 31500 });

  assert.equal(readLocalBalanceEvents().length, 0);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.event, "deadrot_balance_run_end");
  assert.equal(captured[0]?.properties?.game, "redline");
  assert.equal(captured[0]?.properties?.score, 900);
});

test("adds Sentry breadcrumbs for selected balance events", () => {
  const breadcrumbs: Array<{ category: string; message: string; data?: Record<string, unknown> }> = [];
  const telemetry = createBalanceTelemetry({
    game: "pactfall",
    localBuffer: false,
    now: () => 4,
    random: () => 0.1,
    sinks: [
      createSentryBreadcrumbSink(
        {
          addBreadcrumb(breadcrumb) {
            breadcrumbs.push(breadcrumb);
          },
        },
        { includeEvents: ["run_end"] },
      ),
    ],
  });

  telemetry.checkpoint({ hpPct: 0.5 }, 10);
  telemetry.endRun({ outcome: "defeat" }, 20);

  assert.equal(breadcrumbs.length, 1);
  assert.equal(breadcrumbs[0]?.category, "game.balance");
  assert.equal(breadcrumbs[0]?.message, "run_end");
  assert.equal(breadcrumbs[0]?.data?.game, "pactfall");
});

test("clearLocalBalanceEvents empties the local buffer", () => {
  createBalanceTelemetry({ game: "starblight", now: () => 5, random: () => 0.1 }).endRun({ outcome: "defeat" });
  assert.equal(readLocalBalanceEvents().length, 1);
  clearLocalBalanceEvents();
  assert.equal(readLocalBalanceEvents().length, 0);
});
