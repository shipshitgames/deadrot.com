import { type SpawnDescriptor, WaveDirector } from "@deadrot/game-kit/modes";
import { describe, expect, it } from "vitest";
import {
  FIRST_WAVE_DELAY,
  SCOURGE_WAVE_SCHEDULE,
  TOTAL_WAVES,
  WAVE_BREAK,
  WAVE_SPAWN_INTERVAL,
  WAVES,
  type WaveConfig,
} from "../../src/game/constants";

const SCOURGE_TIMING = {
  firstWaveDelay: FIRST_WAVE_DELAY,
  waveBreak: WAVE_BREAK,
  spawnInterval: WAVE_SPAWN_INTERVAL,
};

/** Mirrors Scourge's PveDirectorSystem wiring without the Three.js game world. */
function scourgeHarness() {
  let alive = 0;
  const spawns: SpawnDescriptor<WaveConfig>[] = [];
  const banners: string[] = [];
  let bossSpawned = 0;
  const dir = new WaveDirector<WaveConfig>(SCOURGE_WAVE_SCHEDULE, SCOURGE_TIMING, {
    aliveCount: () => alive,
    spawn: (d) => {
      spawns.push(d);
      alive++;
    },
    startBoss: () => {
      bossSpawned++;
      banners.push("BREACH BOSS");
    },
    onWaveStart: (n) => banners.push(`WAVE ${n}`),
    onWaveCleared: (cleared, total) =>
      banners.push(cleared >= total ? "FINAL WAVE CLEARED" : `WAVE ${cleared} CLEARED`),
  });
  // Fixed-step pump that also reaps everything alive each frame, mimicking a
  // player who instantly clears the field — so the run advances deterministically.
  const pump = (seconds: number, step = 1 / 60) => {
    for (let t = 0; t < seconds; t += step) {
      dir.update(step);
      while (alive > 0) {
        alive--;
        dir.notifyProgress();
      }
    }
  };
  return { dir, spawns, banners, pump, getBossSpawned: () => bossSpawned };
}

describe("Scourge wave schedule", () => {
  it("derives one plan per tuned wave, preserving count/concurrent and carrying the config as meta", () => {
    expect(SCOURGE_WAVE_SCHEDULE.length).toBe(TOTAL_WAVES);
    expect(SCOURGE_WAVE_SCHEDULE.length).toBe(WAVES.length);
    WAVES.forEach((cfg, i) => {
      const plan = SCOURGE_WAVE_SCHEDULE[i];
      expect(plan).toBeDefined();
      expect(plan?.count).toBe(cfg.count);
      expect(plan?.concurrent).toBe(cfg.concurrent);
      expect(plan?.meta).toBe(cfg); // same reference → health/speed muls stay in sync
    });
  });
});

describe("Scourge campaign run via the shared WaveDirector", () => {
  it("runs every wave to the breach boss, spawning exactly the tuned totals", () => {
    const { dir, spawns, pump, getBossSpawned } = scourgeHarness();
    // Enough simulated time to cover the opening delay, all waves, and breaks.
    pump(120);
    const expectedSpawns = WAVES.reduce((sum, w) => sum + w.count, 0);
    expect(spawns.length).toBe(expectedSpawns);
    expect(getBossSpawned()).toBe(1);
    expect(dir.bossPhase).toBe(true);
    expect(dir.waveIndex).toBe(TOTAL_WAVES);
  });

  it("announces every wave and the boss exactly once, in order", () => {
    const { banners, pump } = scourgeHarness();
    pump(120);
    expect(banners).toEqual([
      "WAVE 1",
      "WAVE 1 CLEARED",
      "WAVE 2",
      "WAVE 2 CLEARED",
      "WAVE 3",
      "FINAL WAVE CLEARED",
      "BREACH BOSS",
    ]);
  });

  it("never lets concurrent spawns exceed each wave's ceiling", () => {
    // Pump WITHOUT reaping, so the stagger gate is the only thing limiting alive.
    let alive = 0;
    const perWaveMaxAlive = new Map<number, number>();
    const dir = new WaveDirector<WaveConfig>(SCOURGE_WAVE_SCHEDULE, SCOURGE_TIMING, {
      aliveCount: () => alive,
      spawn: (d) => {
        alive++;
        perWaveMaxAlive.set(d.waveIndex, Math.max(perWaveMaxAlive.get(d.waveIndex) ?? 0, alive));
      },
      startBoss: () => {},
    });
    for (let t = 0; t < 30; t += 1 / 60) dir.update(1 / 60);
    // Wave 0 fills to its concurrent ceiling and jams there (no kills to free room).
    const wave0 = WAVES[0];
    expect(wave0).toBeDefined();
    expect(perWaveMaxAlive.get(0)).toBe(wave0?.concurrent);
    expect(alive).toBeLessThanOrEqual(wave0?.concurrent ?? 0);
  });

  it("respects the opening delay before the first spawn", () => {
    const { dir, spawns } = scourgeHarness();
    dir.update(FIRST_WAVE_DELAY - 0.05);
    expect(dir.waveActive).toBe(false);
    expect(spawns.length).toBe(0);
    dir.update(0.1);
    expect(dir.waveActive).toBe(true);
  });
});
