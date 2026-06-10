import { describe, expect, test } from "bun:test";
import {
  type BossPhase,
  beamAttackDuration,
  beamPlan,
  bossPhaseFor,
  pointSegDist,
  radialBurstAngles,
  ringBurstPlan,
  ringOffset,
  ringVolleyDuration,
} from "../../src/game/bossPatterns";
import { CONSTANTS } from "../../src/game/constants";

// These tests exercise the pure boss-pattern module (bossPatterns.ts) plus the
// canonical CONSTANTS tunables — the exact math Game.ts ships, with no THREE,
// assets, CSS, or DOM imports (same constraint as gameplay.test.ts).

const TAU = Math.PI * 2;
const PHASES: BossPhase[] = [1, 2, 3];

describe("Blight-Maw radial ring bursts — geometry", () => {
  test("ring angles are evenly spaced around the full circle", () => {
    const n = CONSTANTS.boss.ring.count;
    const angles = radialBurstAngles(n);
    expect(angles.length).toBe(n);
    for (let i = 1; i < n; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(TAU / n, 9);
    }
    // The wrap-around gap (last back to first) matches the spacing too.
    expect(angles[0] + TAU - angles[n - 1]).toBeCloseTo(TAU / n, 9);
  });

  test("an offset rotates every spore uniformly without warping the spacing", () => {
    const base = radialBurstAngles(16);
    const rotated = radialBurstAngles(16, 0.5);
    for (let i = 0; i < 16; i++) {
      expect(rotated[i] - base[i]).toBeCloseTo(0.5, 9);
    }
  });

  test("consecutive rings stagger by half a bullet-gap so the safe lanes shift", () => {
    const n = CONSTANTS.boss.ring.count;
    const halfGap = TAU / n / 2;
    expect(ringOffset(0, n)).toBe(0);
    expect(ringOffset(1, n) - ringOffset(0, n)).toBeCloseTo(halfGap, 9);
    expect(ringOffset(2, n) - ringOffset(1, n)).toBeCloseTo(halfGap, 9);
  });
});

describe("Blight-Maw radial ring bursts — schedule", () => {
  test("volleys escalate across phases: more rings, shorter cooldowns", () => {
    const p1 = ringBurstPlan(1);
    const p2 = ringBurstPlan(2);
    const p3 = ringBurstPlan(3);
    expect(p2.rings).toBeGreaterThanOrEqual(p1.rings);
    expect(p3.rings).toBeGreaterThan(p1.rings);
    expect(p2.cooldown).toBeLessThanOrEqual(p1.cooldown);
    expect(p3.cooldown).toBeLessThan(p1.cooldown);
  });

  test("a full volley (windup + staggered rings) always fits inside its cooldown", () => {
    for (const phase of PHASES) {
      expect(ringVolleyDuration(phase)).toBeLessThan(ringBurstPlan(phase).cooldown);
    }
  });

  test("the glow windup telegraphs ~0.8s before the first ring fires", () => {
    expect(CONSTANTS.boss.ring.telegraph).toBeGreaterThanOrEqual(0.6);
    expect(CONSTANTS.boss.ring.telegraph).toBeLessThanOrEqual(1.0);
  });

  test("ring spores are dodgeable at base player speed", () => {
    expect(CONSTANTS.boss.ring.bulletSpeed).toBeLessThan(CONSTANTS.player.maxSpeed);
    // Slower than the boss's existing quick-burst globs — these are the weave.
    expect(CONSTANTS.boss.ring.bulletSpeed).toBeLessThanOrEqual(CONSTANTS.boss.bulletSpeed);
  });
});

describe("Blight-Maw telegraphed beam", () => {
  test("offline in phase 1, online for phases 2 and 3", () => {
    expect(beamPlan(1)).toBeNull();
    expect(beamPlan(2)).not.toBeNull();
    expect(beamPlan(3)).not.toBeNull();
  });

  test("phase 3 fires the beam more often than phase 2", () => {
    const p2 = beamPlan(2);
    const p3 = beamPlan(3);
    expect(p3?.cooldown).toBeLessThan(p2?.cooldown ?? 0);
  });

  test("warning renders ~1s, the burn lasts ~1.2s, and both fit the cooldown", () => {
    const bm = CONSTANTS.boss.beam;
    expect(bm.telegraph).toBeGreaterThanOrEqual(0.8);
    expect(bm.telegraph).toBeLessThanOrEqual(1.2);
    expect(bm.duration).toBeCloseTo(1.2, 6);
    expect(beamAttackDuration()).toBeCloseTo(bm.telegraph + bm.duration, 9);
    for (const phase of [2, 3] as const) {
      const plan = beamPlan(phase);
      expect(beamAttackDuration()).toBeLessThan(plan?.cooldown ?? 0);
    }
  });

  test("the telegraph leaves time to clear the corridor at base player speed", () => {
    const bm = CONSTANTS.boss.beam;
    // Worst case: the ship sits dead-center on the locked line and must clear
    // the beam half-width plus its own half-width before the burn starts.
    const escapeTime = (bm.width / 2 + CONSTANTS.player.width / 2) / CONSTANTS.player.maxSpeed;
    expect(escapeTime).toBeLessThan(bm.telegraph);
  });

  test("pointSegDist measures the beam's damage corridor correctly", () => {
    expect(pointSegDist(5, 0, 0, 0, 10, 0)).toBe(0); // on the segment
    expect(pointSegDist(5, 3, 0, 0, 10, 0)).toBe(3); // perpendicular offset
    expect(pointSegDist(-3, 4, 0, 0, 10, 0)).toBe(5); // clamps to the near end
    expect(pointSegDist(13, 4, 0, 0, 10, 0)).toBe(5); // clamps to the far end
    expect(pointSegDist(2, 2, 1, 1, 1, 1)).toBeCloseTo(Math.SQRT2, 9); // degenerate segment
  });
});

describe("Blight-Maw phase gates", () => {
  test("bossPhaseFor mirrors the canonical HP thresholds", () => {
    const b = CONSTANTS.boss;
    expect(bossPhaseFor(1)).toBe(1);
    expect(bossPhaseFor(b.phase2Pct + 0.001)).toBe(1);
    expect(bossPhaseFor(b.phase2Pct)).toBe(2);
    expect(bossPhaseFor(b.phase3Pct + 0.001)).toBe(2);
    expect(bossPhaseFor(b.phase3Pct)).toBe(3);
    expect(bossPhaseFor(0)).toBe(3);
  });

  test("every phase has a complete ring plan and the beam arrives by phase 2", () => {
    const r = CONSTANTS.boss.ring;
    expect(r.ringsByPhase.length).toBe(3);
    expect(r.cooldownByPhase.length).toBe(3);
    expect(CONSTANTS.boss.beam.cooldownByPhase.length).toBe(3);
    for (const phase of PHASES) {
      expect(ringBurstPlan(phase).rings).toBeGreaterThanOrEqual(1);
      expect(ringBurstPlan(phase).cooldown).toBeGreaterThan(0);
    }
  });
});

describe("audio cue throttles", () => {
  test("the weapon-fire laser cue is capped at ~6 plays per second", () => {
    expect(1 / CONSTANTS.audio.laserMinInterval).toBeLessThanOrEqual(6.001);
    expect(CONSTANTS.audio.laserPitchHi).toBeGreaterThan(CONSTANTS.audio.laserPitchLo);
  });

  test("gem pickup pitch rises with the streak and caps", () => {
    const a = CONSTANTS.audio;
    const pitchAt = (streak: number) => Math.min(a.gemPitchMax, 1 + streak * a.gemPitchStep);
    expect(pitchAt(1)).toBeGreaterThan(pitchAt(0));
    expect(pitchAt(5)).toBeGreaterThan(pitchAt(1));
    expect(pitchAt(1000)).toBe(a.gemPitchMax); // the cap bites
    expect(a.gemMinInterval).toBeGreaterThan(0); // vacuum frames can't spam dings
  });

  test("the low-integrity warning is throttled and gated under 25%", () => {
    expect(CONSTANTS.audio.lowHealthEvery).toBeGreaterThanOrEqual(1);
    expect(CONSTANTS.audio.lowHealthPct).toBeCloseTo(0.25, 6);
  });
});
