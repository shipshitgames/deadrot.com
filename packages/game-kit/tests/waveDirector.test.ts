import assert from "node:assert/strict";
import { test } from "node:test";

import { type SpawnDescriptor, WaveDirector, type WaveDirectorTiming, type WaveSchedule } from "../src/modes";

interface Meta {
  tag: string;
}

const TIMING: WaveDirectorTiming = { firstWaveDelay: 2, waveBreak: 3, spawnInterval: 0.9 };

function schedule(...waves: Array<[count: number, concurrent: number]>): WaveSchedule<Meta> {
  return waves.map(([count, concurrent], i) => ({ count, concurrent, meta: { tag: `w${i}` } }));
}

/**
 * Drives a {@link WaveDirector} with a fake host that models the only thing the
 * gate reads — a live-count — plus records every callback. `kill(n)` mirrors a
 * host reporting `n` defeats: it drops the live count and notifies progress.
 */
function harness(sched: WaveSchedule<Meta>, timing: WaveDirectorTiming = TIMING, interval = timing.spawnInterval) {
  let alive = 0;
  const spawns: SpawnDescriptor<Meta>[] = [];
  const events: string[] = [];
  const t = { ...timing, spawnInterval: interval };
  const dir = new WaveDirector<Meta>(sched, t, {
    aliveCount: () => alive,
    spawn: (d) => {
      spawns.push(d);
      alive++;
    },
    startBoss: () => events.push("boss"),
    onWaveStart: (n, total) => events.push(`start:${n}/${total}`),
    onWaveCleared: (n, total) => events.push(`cleared:${n}/${total}`),
  });
  const kill = (n = 1) => {
    for (let i = 0; i < n; i++) {
      alive--;
      dir.notifyProgress();
    }
  };
  return { dir, spawns, events, kill, getAlive: () => alive };
}

test("starts inactive and arms the opening delay", () => {
  const { dir, events } = harness(schedule([6, 4]));
  assert.equal(dir.waveActive, false);
  assert.equal(dir.waveIndex, 0);
  assert.equal(dir.totalWaves, 1);
  assert.equal(dir.bossPhase, false);
  assert.deepEqual(dir.activePlan, { count: 6, concurrent: 4, meta: { tag: "w0" } });
  assert.deepEqual(events, []);
});

test("first wave starts only after the opening delay elapses", () => {
  const { dir, events, spawns } = harness(schedule([6, 4]));
  dir.update(1.9); // < firstWaveDelay (2)
  assert.equal(dir.waveActive, false);
  assert.deepEqual(events, []);
  dir.update(0.2); // crosses the delay
  assert.equal(dir.waveActive, true);
  assert.deepEqual(events, ["start:1/1"]);
  assert.equal(spawns.length, 0); // the wave-start tick does not also spawn
});

test("positive interval releases at most one spawn per sub-interval update and never exceeds concurrent", () => {
  const { dir, spawns, getAlive } = harness(schedule([6, 4]));
  dir.update(2); // start wave 1
  const before = spawns.length;
  dir.update(0.1); // dt < interval → exactly one spawn opens
  assert.equal(spawns.length - before, 1);
  // No kills: the gate must hold at `concurrent`, even after many ticks.
  for (let i = 0; i < 200; i++) dir.update(0.1);
  assert.equal(getAlive(), 4);
  assert.equal(spawns.length, 4); // cannot spawn the 5th of 6 until something dies
});

test("a positive interval releases only ONE spawn after a jammed field frees up (no banked-debt burst)", () => {
  // Regression guard for the stagger gate: while the field is jammed at
  // `concurrent` the timer keeps draining to a deep negative, but re-arming it
  // to the absolute interval (not accumulating) must discard that debt so the
  // refill trickles in one-per-interval — matching the pre-extraction feel.
  const { dir, spawns, kill, getAlive } = harness(schedule([6, 2])); // interval 0.9
  dir.update(2); // start wave 1
  dir.update(0.1); // spawn #0 → alive 1
  dir.update(0.9); // spawn #1 → alive 2 (now jammed at concurrent 2)
  assert.equal(spawns.length, 2);
  assert.equal(getAlive(), 2);
  // Hold the field full for ~5s with no kills: spawnTimer drifts far below zero.
  for (let i = 0; i < 50; i++) dir.update(0.1);
  assert.equal(spawns.length, 2); // gate stayed closed while jammed
  // An AoE clears BOTH slots in one step.
  kill(2);
  assert.equal(getAlive(), 0);
  // The next update must open exactly one replacement, not pay down the debt
  // with a multi-spawn burst (the bug: `+=` would release two here).
  dir.update(0.1);
  assert.equal(spawns.length, 3);
  assert.equal(getAlive(), 1);
});

test("interval === 0 drains every free slot up to concurrent in a single update", () => {
  const { dir, spawns, getAlive } = harness(schedule([10, 5]), TIMING, 0);
  dir.update(2); // start wave 1
  dir.update(0.016); // one frame drains the whole concurrency window at once
  assert.equal(spawns.length, 5);
  assert.equal(getAlive(), 5);
  // ordinals are contiguous from 0
  assert.deepEqual(
    spawns.map((s) => s.ordinal),
    [0, 1, 2, 3, 4],
  );
});

test("interval === 0 cannot infinite-loop even if the host never reports new spawns as alive", () => {
  // A host whose aliveCount stays 0 must still terminate: the count ceiling bounds it.
  let spawns = 0;
  const dir = new WaveDirector<Meta>(
    schedule([7, 5]),
    { ...TIMING, spawnInterval: 0 },
    {
      aliveCount: () => 0,
      spawn: () => {
        spawns++;
      },
      startBoss: () => {},
    },
  );
  dir.update(2); // start
  dir.update(0.016); // would loop forever if `count` did not bound it
  assert.equal(spawns, 7); // exactly the wave's count, then it stops
});

test("a wave clears only when progress reaches count AND nothing is alive", () => {
  const sched = schedule([3, 3]);
  const { dir, events, kill, spawns, getAlive } = harness(sched, TIMING, 0);
  dir.update(2); // start wave 1
  dir.update(0.016); // spawn all 3 (concurrent 3 >= count 3)
  assert.equal(spawns.length, 3);
  kill(2); // progress 2 < 3 → not cleared
  dir.update(0.016);
  assert.equal(dir.waveActive, true);
  assert.equal(dir.waveIndex, 0);
  kill(1); // progress 3, alive 0 → clears on next update
  assert.equal(getAlive(), 0);
  dir.update(0.016);
  assert.equal(dir.waveActive, false);
  assert.equal(dir.waveIndex, 1);
  assert.deepEqual(events.at(-1), "cleared:1/1");
});

test("a straggler blocks completion even after progress reaches count", () => {
  // Decoupled host: progress (kills) and the live count move independently so we
  // can construct the progress >= count but alive > 0 case (e.g. splitter brood).
  let alive = 0;
  const dir = new WaveDirector<Meta>(
    schedule([2, 2]),
    { ...TIMING, spawnInterval: 0 },
    {
      aliveCount: () => alive,
      spawn: () => {
        alive++;
      },
      startBoss: () => {},
    },
  );
  dir.update(2); // start
  dir.update(0.016); // 2 alive
  dir.notifyProgress();
  dir.notifyProgress(); // progress 2 >= count 2, but the field is not clear
  dir.update(0.016);
  assert.equal(dir.waveActive, true); // still fighting — two are alive
  assert.equal(dir.waveIndex, 0);
  alive = 0; // the field clears
  dir.update(0.016);
  assert.equal(dir.waveActive, false); // now it completes
  assert.equal(dir.waveIndex, 1);
});

test("inter-wave break gates the next wave start", () => {
  const sched = schedule([1, 1], [1, 1]);
  const { dir, events, kill } = harness(sched, TIMING, 0);
  dir.update(2); // start wave 1
  dir.update(0.016); // spawn the single enemy
  kill(1);
  dir.update(0.016); // clear wave 1, arm waveBreak (3)
  assert.equal(dir.waveActive, false);
  dir.update(2.9); // < waveBreak
  assert.equal(dir.waveActive, false);
  dir.update(0.2); // crosses the break → wave 2
  assert.equal(dir.waveActive, true);
  assert.equal(dir.waveIndex, 1);
  assert.deepEqual(events, ["start:1/2", "cleared:1/2", "start:2/2"]);
});

test("the boss hand-off fires after the final wave instead of a fourth wave start", () => {
  const sched = schedule([1, 1], [1, 1]);
  const { dir, events, kill } = harness(sched, TIMING, 0);
  // run both waves to completion
  for (let w = 0; w < 2; w++) {
    dir.update(w === 0 ? 2 : 3); // opening delay, then waveBreak
    dir.update(0.016); // spawn
    kill(1);
    dir.update(0.016); // clear
  }
  assert.equal(dir.waveIndex, 2);
  assert.equal(dir.bossPhase, true);
  assert.equal(dir.activePlan, null);
  dir.update(3); // cross the final break → boss phase, not "start:3/2"
  assert.deepEqual(events, ["start:1/2", "cleared:1/2", "start:2/2", "cleared:2/2", "boss"]);
});

test("notifyProgress is inert outside an active normal wave", () => {
  const { dir } = harness(schedule([2, 2]), TIMING, 0);
  // before any wave: a barrage of progress must not pre-clear wave 1
  for (let i = 0; i < 50; i++) dir.notifyProgress();
  dir.update(2); // start wave 1
  dir.update(0.016); // spawn 2
  // progress was reset on start; the wave is not instantly complete
  assert.equal(dir.waveActive, true);
  assert.equal(dir.waveIndex, 0);
});

test("notifyProgress is inert during the boss phase", () => {
  const sched = schedule([1, 1]);
  const { dir, kill, events } = harness(sched, TIMING, 0);
  dir.update(2);
  dir.update(0.016);
  kill(1);
  dir.update(0.016); // clears → boss phase pending
  dir.update(3); // boss starts
  assert.equal(dir.bossPhase, true);
  const before = events.length;
  for (let i = 0; i < 10; i++) dir.notifyProgress();
  dir.update(0.5); // boss-phase update is a no-op for pacing
  assert.equal(events.length, before); // no extra wave/boss events
});

test("reset re-arms the opening delay from any state", () => {
  const { dir, events, kill } = harness(schedule([1, 1], [1, 1]), TIMING, 0);
  dir.update(2);
  dir.update(0.016);
  kill(1);
  dir.update(0.016); // mid-run: cleared wave 1
  assert.equal(dir.waveIndex, 1);
  dir.reset();
  assert.equal(dir.waveIndex, 0);
  assert.equal(dir.waveActive, false);
  dir.update(1.9);
  assert.equal(dir.waveActive, false); // delay re-armed
  dir.update(0.2);
  assert.equal(dir.waveActive, true);
  assert.equal(events.at(-1), "start:1/2");
});

test("suspend freezes progression until reset", () => {
  const { dir, events } = harness(schedule([1, 1]), TIMING, 0);
  dir.suspend();
  assert.equal(dir.waveActive, false);
  dir.update(1000); // huge advance, but the suspended break never elapses
  assert.equal(dir.waveActive, false);
  assert.deepEqual(events, []);
  dir.reset();
  dir.update(2);
  assert.equal(dir.waveActive, true); // recoverable after reset
});
