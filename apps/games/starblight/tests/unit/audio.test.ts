import { describe, expect, test } from "bun:test";
import manifest from "../../../../../packages/assets/games/starblight/assets.json";
import { spatialGain } from "../../src/game/audioMix";

const COMBAT_CUES = [
  "weapon-kinetic",
  "weapon-drone",
  "weapon-ordnance",
  "weapon-beam",
  "weapon-mine",
  "weapon-wing",
  "enemy-hit",
  "enemy-kill",
  "elite-kill",
  "salvage-pickup",
  "level-up",
  "card-select",
  "player-hit",
  "low-integrity",
] as const;

describe("Starblight combat audio manifest", () => {
  test("registers every authored cue with mix limits and project-owned provenance", () => {
    expect(Object.keys(manifest.audio).sort()).toEqual([...COMBAT_CUES].sort());
    for (const cue of COMBAT_CUES) {
      const entry = manifest.audio[cue];
      expect(entry.path).toBe(`games/starblight/audio/sfx/${cue}.webm`);
      expect(entry.volume).toBeGreaterThan(0);
      expect(entry.volume).toBeLessThanOrEqual(1);
      expect(entry.maxVoices).toBeGreaterThan(0);
      expect(entry.minIntervalMs).toBeGreaterThan(0);
      expect(entry.license.plan).toBe("project-owned");
      expect(entry.license.date).toBe("2026-07-20");
    }
  });

  test("routes gameplay and UI cues to separate buses", () => {
    expect(manifest.audio["level-up"].bus).toBe("ui");
    expect(manifest.audio["card-select"].bus).toBe("ui");
    for (const cue of COMBAT_CUES.filter((id) => id !== "level-up" && id !== "card-select")) {
      expect(manifest.audio[cue].bus).toBe("sfx");
    }
  });
});

describe("Starblight spatial-lite mix", () => {
  test("keeps near action full and attenuates distant action smoothly", () => {
    expect(spatialGain(0)).toBe(1);
    expect(spatialGain(7)).toBe(1);
    expect(spatialGain(20)).toBeLessThan(1);
    expect(spatialGain(20)).toBeGreaterThan(spatialGain(40));
    expect(spatialGain(52)).toBe(0.22);
    expect(spatialGain(500)).toBe(0.22);
  });
});
