import { describe, expect, it } from "vitest";
import {
  ELITE_AFFIX_IDS,
  ELITE_AFFIXES,
  ELITE_SCALE_MUL,
  ELITE_SPLIT_CAP_PER_WAVE,
  ELITE_SPLIT_COUNT_MAX,
  ELITE_SPLIT_COUNT_MIN,
  ELITE_WAVE_EVERY,
  ELITE_WAVE_FRACTION,
  ELITE_XP_MUL,
} from "../../src/game/constants";
import {
  eliteCountForWave,
  eliteXpValue,
  isEliteWave,
  rollEliteAffix,
  rollEliteSplitCount,
  takeSplitAllowance,
} from "../../src/game/data/eliteWaves";
import { ENEMY_ARCHETYPES, SURVIVORS_ARCHETYPE_IDS } from "../../src/game/data/enemies";
import { SURV_SWELL_COUNT } from "../../src/game/data/survivors";

/** Deterministic mulberry32 PRNG so affix rolls can be replayed exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("elite wave cadence", () => {
  it("lands an elite wave on every Nth breach surge", () => {
    expect(ELITE_WAVE_EVERY).toBe(3);

    const surges = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(surges.filter((surge) => isEliteWave(surge))).toEqual([3, 6, 9, 12]);
  });

  it("never fires before the first surge or on a disabled cadence", () => {
    expect(isEliteWave(0)).toBe(false);
    expect(isEliteWave(-3)).toBe(false);
    expect(isEliteWave(3, 0)).toBe(false);
  });

  it("respects a custom cadence", () => {
    expect(isEliteWave(4, 2)).toBe(true);
    expect(isEliteWave(5, 2)).toBe(false);
  });
});

describe("elite affix assignment", () => {
  it("is deterministic given a seeded random source", () => {
    const rolls = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 8 }, () => rollEliteAffix(rng).id);
    };

    expect(rolls(1337)).toEqual(rolls(1337));
    expect(rolls(7)).toEqual(rolls(7));
  });

  it("maps the full random range onto the affix list (clamped at the edges)", () => {
    expect(rollEliteAffix(() => 0).id).toBe(ELITE_AFFIX_IDS[0]);
    expect(rollEliteAffix(() => 0.999).id).toBe(ELITE_AFFIX_IDS[ELITE_AFFIX_IDS.length - 1]);
    // a degenerate random() === 1 must still return a real affix
    expect(rollEliteAffix(() => 1).id).toBe(ELITE_AFFIX_IDS[ELITE_AFFIX_IDS.length - 1]);
  });

  it("defines the three affixes with their batch cues and toast copy", () => {
    expect(ELITE_AFFIX_IDS).toEqual(["shielded", "frenzied", "splitting"]);
    for (const id of ELITE_AFFIX_IDS) {
      expect(ELITE_AFFIXES[id].id).toBe(id);
      expect(ELITE_AFFIXES[id].name).toContain("ELITES");
    }
    expect(ELITE_AFFIXES.shielded.cue).toBe("shieldUp");
    expect(ELITE_AFFIXES.frenzied.cue).toBe("berserk");
    expect(ELITE_AFFIXES.splitting.cue).toBeNull();
  });
});

describe("elite wave composition", () => {
  it("promotes ~15-20% of a full surge to elites", () => {
    expect(ELITE_WAVE_FRACTION).toBeGreaterThanOrEqual(0.15);
    expect(ELITE_WAVE_FRACTION).toBeLessThanOrEqual(0.2);
    expect(eliteCountForWave(SURV_SWELL_COUNT)).toBe(Math.max(2, Math.round(SURV_SWELL_COUNT * ELITE_WAVE_FRACTION)));
  });

  it("always fields at least the minimum elites without exceeding the surge size", () => {
    expect(eliteCountForWave(6)).toBe(2); // round(1.08) would be 1 — min kicks in
    expect(eliteCountForWave(1)).toBe(1); // min capped by the surge itself
    expect(eliteCountForWave(0)).toBe(0);
    expect(eliteCountForWave(-4)).toBe(0);
  });

  it("keeps elites visibly larger than their archetype", () => {
    expect(ELITE_SCALE_MUL).toBeCloseTo(1.25, 5);
    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      expect(ENEMY_ARCHETYPES[id].scale * ELITE_SCALE_MUL).toBeGreaterThan(ENEMY_ARCHETYPES[id].scale);
    }
  });
});

describe("splitting elite cap math", () => {
  it("rolls 2-3 children per splitting elite", () => {
    expect(rollEliteSplitCount(() => 0)).toBe(ELITE_SPLIT_COUNT_MIN);
    expect(rollEliteSplitCount(() => 0.999)).toBe(ELITE_SPLIT_COUNT_MAX);
    expect(rollEliteSplitCount(() => 1)).toBe(ELITE_SPLIT_COUNT_MAX);

    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const count = rollEliteSplitCount(rng);
      expect(count).toBeGreaterThanOrEqual(ELITE_SPLIT_COUNT_MIN);
      expect(count).toBeLessThanOrEqual(ELITE_SPLIT_COUNT_MAX);
    }
  });

  it("spends the wave budget without overdrawing it", () => {
    expect(takeSplitAllowance(12, 3)).toEqual({ allowed: 3, remaining: 9 });
    expect(takeSplitAllowance(2, 3)).toEqual({ allowed: 2, remaining: 0 });
    expect(takeSplitAllowance(0, 3)).toEqual({ allowed: 0, remaining: 0 });
    expect(takeSplitAllowance(5, -2)).toEqual({ allowed: 0, remaining: 5 });
  });

  it("caps total split children across a whole elite wave", () => {
    let budget = ELITE_SPLIT_CAP_PER_WAVE;
    let spawned = 0;
    const rng = mulberry32(9);
    for (let elite = 0; elite < 20; elite++) {
      const { allowed, remaining } = takeSplitAllowance(budget, rollEliteSplitCount(rng));
      budget = remaining;
      spawned += allowed;
    }
    expect(spawned).toBe(ELITE_SPLIT_CAP_PER_WAVE);
    expect(budget).toBe(0);
  });
});

describe("elite XP payout", () => {
  it("pays triple the archetype gem value", () => {
    expect(ELITE_XP_MUL).toBe(3);
    for (const id of SURVIVORS_ARCHETYPE_IDS) {
      expect(eliteXpValue(ENEMY_ARCHETYPES[id].xp)).toBe(ENEMY_ARCHETYPES[id].xp * ELITE_XP_MUL);
    }
  });

  it("never drops below a single XP and rounds fractional payouts", () => {
    expect(eliteXpValue(0)).toBe(1);
    expect(eliteXpValue(1, 0.4)).toBe(1);
    expect(eliteXpValue(3, 1.5)).toBe(5);
  });
});
