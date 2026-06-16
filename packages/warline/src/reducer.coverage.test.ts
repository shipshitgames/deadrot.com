import assert from "node:assert/strict";
import { test } from "node:test";

import { breachById, createInitialWorld, regionById } from "./map";
import { applyOperation, tick } from "./reducer";
import type { OperationResult } from "./types";

// Coverage top-up for src/reducer.ts: the operation kinds and target-fallback
// branches the primary reducer.test.ts does not exercise (orbital-intercept,
// sabotage, run-logistics defeat, the "no valid target" arms, contest by default
// rule, and the tick reconquest path). Kept in a separate file so the happy-path
// spec in reducer.test.ts stays readable.

const NOW = 1_700_000_000_000;

function op(partial: Partial<OperationResult> & { game: OperationResult["game"] }): OperationResult {
  return {
    faction: "wardens",
    outcome: "victory",
    score: 2000,
    ...partial,
  };
}

// ---- orbital-intercept (starblight) ----

test("orbital-intercept victory bleeds every active breach and the worst region", () => {
  const w = createInitialWorld(NOW);
  const before = new Map(w.breaches.map((b) => [b.id, b.intensity]));
  // perdition is the highest-pressure region (96) at the start.
  const perditionBefore = regionById(w, "perdition")!.pressure;
  const { state, credited } = applyOperation(w, op({ game: "starblight" }), NOW);
  for (const b of state.breaches) {
    assert.ok(b.intensity < before.get(b.id)!, `breach ${b.id} bled`);
  }
  assert.ok(regionById(state, "perdition")!.pressure < perditionBefore, "worst region cooled");
  assert.ok((credited.fuel ?? 0) > 0, "fuel credited");
  assert.ok((credited.intel ?? 0) > 0, "intel credited");
  assert.equal(state.feed[0]!.kind, "orbital-intercept");
  assert.match(state.feed[0]!.text, /orbital intercept/);
});

test("orbital-intercept defeat only misses (recon trickle, no breach bleed)", () => {
  const w = createInitialWorld(NOW);
  const before = new Map(w.breaches.map((b) => [b.id, b.intensity]));
  const { state, credited } = applyOperation(w, op({ game: "starblight", outcome: "defeat" }), NOW);
  for (const b of state.breaches) {
    assert.equal(b.intensity, before.get(b.id), `breach ${b.id} untouched`);
  }
  assert.equal(credited.intel ?? 0, 8, "defeat recon trickle only");
  assert.match(state.feed[0]!.text, /missed/);
});

// ---- sabotage (rothulk) ----

test("sabotage victory cripples the breach, hardens its region, and credits biomass", () => {
  const w = createInitialWorld(NOW);
  const intensityBefore = breachById(w, "breach-perdition")!.intensity;
  const { state, credited } = applyOperation(w, op({ game: "rothulk", targetId: "breach-perdition" }), NOW);
  const sabotaged = breachById(state, "breach-perdition")!;
  assert.ok(sabotaged.intensity < intensityBefore, "intensity dropped");
  // 4 is the intentional sabotage window (TICK ticks of halved breach output); a
  // rebalance should update this line deliberately, not regress it silently.
  assert.equal(sabotaged.sabotaged, 4, "sabotage ticks added");
  assert.ok(regionById(state, "perdition")!.defense > 0, "region hardened");
  assert.ok((credited.biomass ?? 0) > 0, "biomass credited");
  assert.equal(state.feed[0]!.kind, "sabotage");
  assert.match(state.feed[0]!.text, /sabotaged/);
});

test("sabotage with no active breach reports nothing to sabotage", () => {
  const w = createInitialWorld(NOW);
  for (const b of w.breaches) b.active = false;
  const { state } = applyOperation(w, op({ game: "rothulk" }), NOW);
  assert.match(state.feed[0]!.text, /no breach to sabotage/);
});

// ---- run-logistics (redline) defeat ----

test("run-logistics defeat scatters the convoy and musters no army", () => {
  const w = createInitialWorld(NOW);
  const { state, credited } = applyOperation(w, op({ game: "redline", outcome: "defeat" }), NOW);
  assert.equal(state.pactArmy, 0, "no army on defeat");
  assert.equal(credited.scrap ?? 0, 0, "no logistics scrap on defeat");
  assert.match(state.feed[0]!.text, /scattered/);
});

// ---- contest-territory default-target rule + stall/empty arms ----

test("contest-territory without a targetId claims a neutral region adjacent to the faction", () => {
  const w = createInitialWorld(NOW);
  // wardens border rustmarch (neutral) via the North Front lane.
  const { state } = applyOperation(w, op({ game: "pactfall", faction: "wardens" }), NOW);
  assert.equal(regionById(state, "rustmarch")!.faction, "wardens");
  assert.match(state.feed[0]!.text, /claimed/);
});

test("contest-territory defeat with a real region stalls without flipping it", () => {
  const w = createInitialWorld(NOW);
  const { state } = applyOperation(
    w,
    op({ game: "pactfall", faction: "pyre", targetId: "rustmarch", outcome: "defeat" }),
    NOW,
  );
  assert.equal(regionById(state, "rustmarch")!.faction, "neutral", "region unchanged");
  assert.match(state.feed[0]!.text, /stalled/);
});

test("contest-territory with no contestable region reports none found", () => {
  const w = createInitialWorld(NOW);
  // Remove every neutral region so the default rule resolves nothing.
  for (const r of w.regions) {
    if (r.faction === "neutral") r.faction = "scourge";
  }
  const { state } = applyOperation(w, op({ game: "pactfall", faction: "wardens" }), NOW);
  assert.match(state.feed[0]!.text, /no territory to contest/);
});

// ---- purge-breach with no available breach ----

test("purge-breach with no active breach reports nothing to purge", () => {
  const w = createInitialWorld(NOW);
  for (const b of w.breaches) b.active = false;
  const { state } = applyOperation(w, op({ game: "scourge-survivors" }), NOW);
  assert.match(state.feed[0]!.text, /no breach to purge/);
});

// ---- hold-lane: fortify the `to` endpoint, and the no-lane arm ----

test("hold-lane fortifies a human `to` endpoint", () => {
  const w = createInitialWorld(NOW);
  // l-spire-ashgate runs spire -> ashgate; ashgate (the `to` end) is a warden hold.
  const defBefore = regionById(w, "ashgate")!.defense;
  const { state } = applyOperation(w, op({ game: "deadlane", targetId: "l-spire-ashgate" }), NOW);
  assert.ok(regionById(state, "ashgate")!.defense > defBefore, "to-endpoint fortified");
});

test("hold-lane with no holdable lane reports none to hold", () => {
  const w = createInitialWorld(NOW);
  // No scourge/neutral lane left for the default rule to pick.
  for (const l of w.lanes) l.control = "wardens";
  const { state } = applyOperation(w, op({ game: "deadlane" }), NOW);
  assert.match(state.feed[0]!.text, /no lane to hold/);
});

// ---- tick: a quiet scourge region with a human neighbor recedes ----

test("tick: a quiet scourge region bordering a human region recedes to neutral", () => {
  const w = createInitialWorld(NOW);
  // Silence the front so no breach pumping / lane spread re-pressures the Maw.
  for (const b of w.breaches) b.active = false;
  for (const r of w.regions) r.pressure = 0;
  // The Maw borders Rustmarch via The Maw Lane; make that neighbor human.
  regionById(w, "rustmarch")!.faction = "wardens";
  const next = tick(w, NOW);
  assert.equal(regionById(next, "maw")!.faction, "neutral", "quiet scourge region receded");
  const receded = next.feed.find((e) => e.kind === "system" && /receded/.test(e.text));
  assert.ok(receded, "recede event recorded");
});
