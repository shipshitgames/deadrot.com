/**
 * Score system — pure and deterministic (no DOM / Three imports) so it runs
 * under `bun test` like the rest of the gameplay logic.
 *
 *   - Ember chain: consecutive pickups inside SCORE.chainWindow heat a
 *     multiplier (x1 -> x{chainMax}); it collapses back to x1 when the window
 *     runs dry.
 *   - Near-miss style: skimming past a hazard (no stagger) within
 *     SCORE.nearMissMargin grants style points. Detection is a pure function
 *     over the hazard list + the runner's step movement.
 *   - Run score = ember points (chain applied) + style + time bonus; the
 *     letter grade comes from SCORE.grades thresholds.
 *   - Persistence: per-seed best time + best score in a versioned
 *     createLocalStore envelope, migrating the legacy raw best-time payload.
 */

import { createLocalStore, type LocalStore } from "@deadrot/game-kit/core";
import { BESTS_VERSION, COURSE, SCORE, STORAGE_KEY } from "../constants";
import type { Hazard } from "../types";

export type Grade = (typeof SCORE.grades)[number]["grade"];

// ---------------------------------------------------------------------------
// Pure scoring math
// ---------------------------------------------------------------------------

/** Time bonus at the beacon: faster = more, floored at zero. */
export function timeBonus(time: number): number {
  return Math.max(0, Math.round(SCORE.timeBonusMax - SCORE.timeBonusPerSecond * time));
}

/** Letter grade for a final total (thresholds checked top-down). */
export function gradeFor(score: number): Grade {
  for (const g of SCORE.grades) {
    if (score >= g.min) return g.grade;
  }
  return SCORE.grades[SCORE.grades.length - 1].grade;
}

/** Everything the finish overlay needs to present a run. */
export interface RunSummary {
  time: number;
  embers: number;
  emberPoints: number;
  nearMisses: number;
  stylePoints: number;
  timeBonus: number;
  total: number;
  grade: Grade;
}

// ---------------------------------------------------------------------------
// Near-miss detection
// ---------------------------------------------------------------------------

/** The runner's state across one fixed step, as the detector needs it. */
export interface NearMissProbe {
  prevX: number; // X before the step
  x: number; // X after the step
  y: number; // capsule center Y after the step
  crouch: number; // posture scale (1 upright .. dashCrouchScale rolled)
  radius: number; // capsule radius
  staggered: boolean;
  invulnerable: boolean;
}

/** Per-hazard-kind near-miss margins (world units). */
export interface NearMissMargins {
  spike: number;
  bar: number;
}

/**
 * Count hazards whose center the runner crossed this step cleanly but barely:
 * feet skim a spike's tip, or the head skims a bar's underside, within the
 * kind's margin. Staggered / i-frame passes never count — those were hits
 * (or freebies), not style.
 */
export function detectNearMisses(
  probe: NearMissProbe,
  hazards: readonly Hazard[],
  margins: NearMissMargins = SCORE.nearMissMargin,
): number {
  if (probe.staggered || probe.invulnerable) return 0;

  const feet = probe.y - probe.radius * probe.crouch;
  const head = probe.y + probe.radius * probe.crouch;

  let count = 0;
  for (const h of hazards) {
    // Crossed the hazard center during this step (movement is always +X).
    if (!(probe.prevX < h.x && probe.x >= h.x)) continue;

    if (h.kind === "spike") {
      const clearance = feet - (h.baseY + h.height);
      if (clearance >= 0 && clearance <= margins.spike) count++;
    } else {
      const clearance = h.baseY + h.clearance - head;
      if (clearance >= 0 && clearance <= margins.bar) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Live run score state
// ---------------------------------------------------------------------------

export class ScoreSystem {
  /** Current ember-chain multiplier, x1..x{chainMax}. */
  chain = 1;
  /** Seconds left before the chain collapses (0 when cold). */
  chainTimer = 0;

  embers = 0;
  emberPoints = 0;
  nearMisses = 0;
  stylePoints = 0;

  reset() {
    this.chain = 1;
    this.chainTimer = 0;
    this.embers = 0;
    this.emberPoints = 0;
    this.nearMisses = 0;
    this.stylePoints = 0;
  }

  /** Tick the chain window; the multiplier collapses when it runs dry. */
  update(dt: number) {
    if (this.chainTimer <= 0) return;
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    if (this.chainTimer === 0) this.chain = 1;
  }

  /**
   * Score one ember at the current multiplier, then heat the chain a step and
   * refresh the window. Returns the points granted.
   */
  collectEmber(): number {
    const points = SCORE.emberPoints * this.chain;
    this.embers++;
    this.emberPoints += points;
    this.chain = Math.min(SCORE.chainMax, this.chain + 1);
    this.chainTimer = SCORE.chainWindow;
    return points;
  }

  /** Bank near-miss style points. Returns the points granted. */
  addNearMisses(count: number): number {
    if (count <= 0) return 0;
    const points = SCORE.nearMissPoints * count;
    this.nearMisses += count;
    this.stylePoints += points;
    return points;
  }

  /** Points banked so far (what the live HUD shows — no time bonus yet). */
  get earned(): number {
    return this.emberPoints + this.stylePoints;
  }

  /** 0..1 fraction of the chain window remaining (for the HUD meter). */
  get chainFrac(): number {
    return this.chain > 1 ? this.chainTimer / SCORE.chainWindow : 0;
  }

  /** Final total if the run ends at `time`. */
  total(time: number): number {
    return this.earned + timeBonus(time);
  }

  /** Freeze the run into the finish-overlay summary. */
  summary(time: number): RunSummary {
    const bonus = timeBonus(time);
    const total = this.earned + bonus;
    return {
      time,
      embers: this.embers,
      emberPoints: this.emberPoints,
      nearMisses: this.nearMisses,
      stylePoints: this.stylePoints,
      timeBonus: bonus,
      total,
      grade: gradeFor(total),
    };
  }
}

// ---------------------------------------------------------------------------
// Per-seed best persistence (with legacy best-time migration)
// ---------------------------------------------------------------------------

export interface SeedBest {
  time: number | null; // best (lowest) finish time
  score: number | null; // best (highest) run score
}

export interface BestsData {
  bests: Record<string, SeedBest>;
}

/**
 * Upgrade older payloads found under STORAGE_KEY. The legacy format (pre-kit)
 * was the raw best time as a bare number string — e.g. `"23.45"` — which
 * JSON-parses to a number. Anything unrecognized resets to empty.
 */
export function migrateBests(raw: unknown): BestsData {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return { bests: { [String(COURSE.seed)]: { time: raw, score: null } } };
  }
  return { bests: {} };
}

export function bestFor(data: BestsData, seed: number): SeedBest {
  return data.bests[String(seed)] ?? { time: null, score: null };
}

/** Fold a finished run into the bests table; reports which records broke. */
export function applyRunRecord(
  data: BestsData,
  seed: number,
  time: number,
  score: number,
): { next: BestsData; newBestTime: boolean; newBestScore: boolean } {
  const prev = bestFor(data, seed);
  const newBestTime = prev.time === null || time < prev.time;
  const newBestScore = prev.score === null || score > prev.score;
  const next: BestsData = {
    bests: {
      ...data.bests,
      [String(seed)]: {
        time: newBestTime ? time : prev.time,
        score: newBestScore ? score : prev.score,
      },
    },
  };
  return { next, newBestTime, newBestScore };
}

/** Typed localStorage store for the bests table (SSR/quota-safe). */
export function createBestsStore(): LocalStore<BestsData> {
  return createLocalStore<BestsData>(
    STORAGE_KEY,
    { bests: {} },
    {
      version: BESTS_VERSION,
      migrate: (raw) => migrateBests(raw),
    },
  );
}
