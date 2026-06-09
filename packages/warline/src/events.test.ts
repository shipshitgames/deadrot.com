import assert from "node:assert/strict";
import { test } from "node:test";

import { applyNarrative, NARRATIVE, NARRATIVE_EVENTS, pickNarrativeEvent } from "./events";
import { createInitialWorld } from "./map";
import { escalationFactor, tick } from "./reducer";
import { summarize } from "./summary";
import type { WorldState } from "./types";
import { ESCALATION } from "./types";

const NOW = 1_700_000_000_000;

function worldAtTick(tickNo: number): WorldState {
  const w = createInitialWorld(NOW);
  w.tick = tickNo;
  return w;
}

// ---- determinism ------------------------------------------------------------

test("narrative pick is deterministic for identical worlds", () => {
  for (let t = 0; t <= NARRATIVE.cadenceTicks * 8; t += NARRATIVE.cadenceTicks) {
    const a = pickNarrativeEvent(worldAtTick(t));
    const b = pickNarrativeEvent(worldAtTick(t));
    assert.equal(a?.slug, b?.slug, `tick ${t} diverged`);
  }
});

test("narrative only fires on the cadence", () => {
  for (let t = 1; t < NARRATIVE.cadenceTicks; t++) {
    assert.equal(pickNarrativeEvent(worldAtTick(t)), null, `tick ${t} should be silent`);
  }
  assert.equal(pickNarrativeEvent(worldAtTick(0)), null, "tick 0 should be silent");
});

test("applyNarrative pushes a story event with a canon anchor", () => {
  // Find a cadence tick where the deterministic roll fires.
  for (let t = NARRATIVE.cadenceTicks; t <= NARRATIVE.cadenceTicks * 40; t += NARRATIVE.cadenceTicks) {
    const w = worldAtTick(t);
    const picked = pickNarrativeEvent(w);
    if (!picked) continue;
    const event = applyNarrative(w, NOW);
    assert.ok(event, "applyNarrative should fire when pickNarrativeEvent does");
    assert.equal(event.kind, "story");
    assert.equal(w.feed[0]?.id, event.id, "story event lands at the head of the feed");
    assert.match(event.detail ?? "", /^war record: /);
    return;
  }
  assert.fail("no narrative beat fired across 40 cadence windows — chance/trigger config is broken");
});

// ---- event table sanity -------------------------------------------------------

test("every narrative event has copy, weight, and a timeline ref", () => {
  const seen = new Set<string>();
  for (const def of NARRATIVE_EVENTS) {
    assert.ok(!seen.has(def.slug), `duplicate slug ${def.slug}`);
    seen.add(def.slug);
    assert.ok(def.weight > 0, `${def.slug} weight`);
    assert.ok(def.timelineRef.length > 0, `${def.slug} timelineRef`);
  }
});

test("event triggers and effects behave on representative worlds", () => {
  // breach-stirs: hot breach raises its region's pressure.
  const hot = worldAtTick(12);
  for (const b of hot.breaches) b.intensity = 90;
  const stirs = NARRATIVE_EVENTS.find((d) => d.slug === "breach-stirs");
  assert.ok(stirs);
  assert.equal(stirs.trigger(hot), true);
  const region = hot.regions.find((r) => r.id === hot.breaches[0]?.regionId);
  const before = region?.pressure ?? 0;
  stirs.apply(hot);
  const hottest = hot.breaches.slice().sort((a, b) => b.intensity - a.intensity)[0];
  const target = hot.regions.find((r) => r.id === hottest?.regionId);
  assert.ok((target?.pressure ?? 0) >= before, "pressure should not drop");

  // pact-rally: requires a recent fall in the feed.
  const calm = worldAtTick(12);
  const rally = NARRATIVE_EVENTS.find((d) => d.slug === "pact-rally");
  assert.ok(rally);
  assert.equal(rally.trigger(calm), false);
  calm.feed.unshift({
    id: "x",
    t: 11,
    at: NOW,
    kind: "fall",
    faction: "wardens",
    text: "fell",
  });
  assert.equal(rally.trigger(calm), true);
  const armyBefore = calm.pactArmy;
  rally.apply(calm);
  assert.ok(calm.pactArmy > armyBefore);

  // listener-whisper: spends intel to reveal a dark region.
  const rich = worldAtTick(12);
  rich.resources.intel = 500;
  const whisper = NARRATIVE_EVENTS.find((d) => d.slug === "listener-whisper");
  assert.ok(whisper);
  if (rich.regions.some((r) => !r.revealed)) {
    assert.equal(whisper.trigger(rich), true);
    const hiddenBefore = rich.regions.filter((r) => !r.revealed).length;
    whisper.apply(rich);
    const hiddenAfter = rich.regions.filter((r) => !r.revealed).length;
    assert.equal(hiddenAfter, hiddenBefore - 1);
    assert.equal(rich.resources.intel, 450);
  }
});

// ---- escalation (doom clock) ---------------------------------------------------

test("escalation is exactly 1x for the early war and steps up later", () => {
  assert.equal(escalationFactor(0), 1);
  assert.equal(escalationFactor(ESCALATION.rampTicks - 1), 1);
  assert.equal(escalationFactor(ESCALATION.rampTicks), 1 + ESCALATION.perRamp);
  assert.equal(escalationFactor(ESCALATION.rampTicks * 2), 1 + ESCALATION.perRamp * 2);
  assert.equal(escalationFactor(ESCALATION.rampTicks * 1000), ESCALATION.max);
});

test("a late-war tick pumps more pressure than an early-war tick", () => {
  const early = worldAtTick(0);
  const late = worldAtTick(ESCALATION.rampTicks * 4);
  // Same starting pressure/intensity; only the tick count differs.
  const earlyNext = tick(early, NOW);
  const lateNext = tick(late, NOW + 1);

  const sumPressure = (w: WorldState) => w.regions.reduce((sum, r) => sum + r.pressure, 0);
  assert.ok(sumPressure(lateNext) > sumPressure(earlyNext), "escalated Choir should pressure the world harder");
});

test("summary exposes the escalation factor", () => {
  const s = summarize(worldAtTick(ESCALATION.rampTicks));
  assert.equal(s.escalation, 1 + ESCALATION.perRamp);
});
