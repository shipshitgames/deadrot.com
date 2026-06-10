// Pure boss-encounter math for THE BLIGHT-MAW's telegraphed attack patterns.
// No THREE/DOM imports — the unit tests exercise this module directly and
// Game.ts consumes the same helpers, so the tested math IS the shipped math.

import { CONSTANTS } from "./constants";

const TAU = Math.PI * 2;

export type BossPhase = 1 | 2 | 3;

/** Boss phase from its remaining-health fraction (mirrors the HP gates). */
export function bossPhaseFor(hp01: number): BossPhase {
  if (hp01 > CONSTANTS.boss.phase2Pct) return 1;
  if (hp01 > CONSTANTS.boss.phase3Pct) return 2;
  return 3;
}

/** Evenly spaced radial-burst angles (radians), rotated by `offset`. */
export function radialBurstAngles(count: number, offset = 0): number[] {
  const angles: number[] = [];
  for (let i = 0; i < count; i++) angles.push(offset + (i / count) * TAU);
  return angles;
}

/**
 * Rotation applied to ring `index` of a volley: each successive ring sits half
 * a bullet-gap off the previous one, so the safe lanes shift between rings and
 * the pilot has to weave rather than park in one gap.
 */
export function ringOffset(index: number, count: number): number {
  return index * (TAU / count) * 0.5;
}

/** Per-phase ring-burst plan: rings per volley + cooldown between volleys. */
export function ringBurstPlan(phase: BossPhase): { rings: number; cooldown: number } {
  const r = CONSTANTS.boss.ring;
  return { rings: r.ringsByPhase[phase - 1], cooldown: r.cooldownByPhase[phase - 1] };
}

/** Per-phase beam plan, or null while the beam is offline for that phase. */
export function beamPlan(phase: BossPhase): { cooldown: number } | null {
  const cooldown = CONSTANTS.boss.beam.cooldownByPhase[phase - 1];
  return cooldown > 0 ? { cooldown } : null;
}

/** Seconds a full ring volley occupies (glow windup + staggered rings). */
export function ringVolleyDuration(phase: BossPhase): number {
  const r = CONSTANTS.boss.ring;
  return r.telegraph + (ringBurstPlan(phase).rings - 1) * r.ringInterval;
}

/** Seconds a full beam attack occupies (warning line + burn). */
export function beamAttackDuration(): number {
  const b = CONSTANTS.boss.beam;
  return b.telegraph + b.duration;
}

/** Distance from point P to segment AB — the beam's damage corridor test. */
export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}
