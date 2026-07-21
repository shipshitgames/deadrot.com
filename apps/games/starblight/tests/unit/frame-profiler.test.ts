import { describe, expect, test } from "bun:test";
import {
  FRAME_BUDGET_MS,
  type FrameProfileSnapshot,
  formatFrameProfile,
  HUD_EMIT_INTERVAL_SEC,
  HudEmitGate,
} from "../../src/game/frameProfiler";

describe("Starblight HUD emission gate", () => {
  test("emits at 10Hz during a normal 40Hz frame stream", () => {
    const gate = new HudEmitGate();
    let emits = 0;
    for (let frame = 0; frame < 40; frame++) {
      if (gate.advance(0.025)) emits++;
    }
    expect(HUD_EMIT_INTERVAL_SEC).toBe(0.1);
    expect(emits).toBe(10);
  });

  test("reset delays the next periodic emit for an immediate phase update", () => {
    const gate = new HudEmitGate();
    expect(gate.advance(0.075)).toBe(false);
    gate.reset();
    expect(gate.advance(0.075)).toBe(false);
    expect(gate.advance(0.025)).toBe(true);
  });
});

describe("Starblight frame profiler readout", () => {
  test("reports the frame target, every phase, renderer counters, and HUD rate", () => {
    const snapshot: FrameProfileSnapshot = {
      fps: 60,
      frameMs: 16.2,
      phases: { flight: 1, directorAi: 2, weapons: 3, collisions: 4, gems: 1.5, render: 4.7 },
      drawCalls: 42,
      triangles: 12_345,
      hudHz: 10,
      hudEmits: 30,
    };
    const text = formatFrameProfile(snapshot);

    expect(FRAME_BUDGET_MS).toBeCloseTo(16.666, 2);
    expect(text).toContain("FRAME 16.20 / 16.7 ms");
    expect(text).toContain("director+AI 2.00 ms");
    expect(text).toContain("collisions  4.00 ms");
    expect(text).toContain("draw 42  tris 12,345");
    expect(text).toContain("HUD 10.0 Hz  emits 30");
  });
});
