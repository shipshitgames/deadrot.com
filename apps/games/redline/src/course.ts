// Canon location: see apps/lore/content/Locations/The-Hollow-Lanes.md and apps/lore/content/Maps.md (cross-game map registry).
// This course is "The Hollow Lanes — Dead Road" (loreId: hollowlanes, front: lane) — see COURSE in constants.ts.

/**
 * Deterministic course generation.
 * Walks from the start runway to the BEACON, laying down platforms (with pits),
 * blood-creep hazards, kicker ramps and speed embers. Seeded so every run of a
 * given seed is identical — fair for time-attack.
 */

import { COURSE, RUNNER, WORLD } from "./constants";
import type {
  Course,
  CourseSegment,
  CourseSegmentKind,
  Ember,
  Hazard,
  HazardKind,
  Platform,
  Ramp,
} from "./types";

/** Tiny mulberry32 PRNG — fast, deterministic, good enough for layout. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type CourseSegmentSpec = {
  id: string;
  checkpoint?: { id: string; label: string };
} & (
  | { kind: "hazard"; hazardKind: HazardKind }
  | { kind: Exclude<CourseSegmentKind, "hazard"> }
);

/**
 * The authored route vocabulary. Seeds tune spacing and pit widths, but never
 * reorder the course's readable flat/ramp/gap/hazard rhythm.
 */
export const COURSE_SEGMENT_PLAN: readonly CourseSegmentSpec[] = [
  { id: "ash-runway", kind: "flat" },
  { id: "first-spike", kind: "hazard", hazardKind: "spike" },
  { id: "kiln-kicker", kind: "ramp" },
  { id: "split-asphalt", kind: "gap" },
  { id: "low-scab", kind: "hazard", hazardKind: "bar" },
  { id: "ember-line", kind: "flat" },
  { id: "road-tooth", kind: "hazard", hazardKind: "spike" },
  { id: "signal-rise", kind: "ramp" },
  { id: "relay-cut", kind: "gap" },
  { id: "burn-order", kind: "flat" },
  { id: "choir-arch", kind: "hazard", hazardKind: "bar" },
  { id: "cinder-kicker", kind: "ramp" },
  { id: "rupture-spike", kind: "hazard", hazardKind: "spike" },
  { id: "hollow-drop", kind: "gap" },
  { id: "dead-air", kind: "flat" },
  {
    id: "junction-split",
    kind: "flat",
    checkpoint: { id: "junction-split", label: "JUNCTION SPLIT" },
  },
  { id: "closing-bar", kind: "hazard", hazardKind: "bar" },
  { id: "second-kicker", kind: "ramp" },
  { id: "black-water", kind: "gap" },
  { id: "host-spine", kind: "hazard", hazardKind: "spike" },
  { id: "courier-line", kind: "flat" },
  { id: "overpass-kicker", kind: "ramp" },
  { id: "chitin-arch", kind: "hazard", hazardKind: "bar" },
  { id: "severed-block", kind: "gap" },
  { id: "holdout-signal", kind: "flat" },
  { id: "last-spike", kind: "hazard", hazardKind: "spike" },
  { id: "redline-kicker", kind: "ramp" },
  { id: "final-cut", kind: "gap" },
  { id: "last-arch", kind: "hazard", hazardKind: "bar" },
  { id: "beacon-sightline", kind: "flat" },
  { id: "beacon-kicker", kind: "ramp" },
  { id: "gate-tooth", kind: "hazard", hazardKind: "spike" },
];

export function generateCourse(seed = COURSE.seed): Course {
  const rng = mulberry32(seed);
  const rand = (min: number, max: number) => min + rng() * (max - min);

  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const embers: Ember[] = [];
  const ramps: Ramp[] = [];
  const segments: CourseSegment[] = [
    { id: "opening-runway", kind: "flat", x0: 0, x1: COURSE.firstObstacleX },
  ];
  const checkpoints: Course["checkpoints"] = [];

  const groundY = WORLD.groundY;
  const beaconX = WORLD.levelLength;

  // Current open platform start; we extend the floor as we go, punching pits.
  let platformStart = 0;
  let cursor = COURSE.firstObstacleX; // first feature only after a safe runway

  const closePlatform = (endX: number) => {
    if (endX > platformStart) {
      platforms.push({ x0: platformStart, x1: endX, topY: groundY });
    }
  };

  // Sprinkle a short arc of embers above the lane.
  const dropEmberArc = (centerX: number, count: number, peak: number) => {
    const span = Math.max(2, count - 1);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / span;
      const arc = Math.sin(t * Math.PI); // 0..1..0
      embers.push({
        x: centerX + (t - 0.5) * 4.5,
        y: groundY + 1.4 + arc * peak,
        collected: false,
      });
    }
  };

  let planIndex = 0;
  while (cursor < beaconX - 24) {
    const spec = COURSE_SEGMENT_PLAN[planIndex % COURSE_SEGMENT_PLAN.length];
    const planCycle = Math.floor(planIndex / COURSE_SEGMENT_PLAN.length);
    planIndex++;
    const segmentStart = cursor;

    switch (spec.kind) {
      case "hazard": {
        if (spec.hazardKind === "spike") {
          hazards.push({
            kind: "spike",
            x: cursor,
            width: COURSE.spikeWidth,
            baseY: groundY,
            height: COURSE.spikeHeight,
            clearance: 0,
          });
          // reward arc you grab by jumping over it
          dropEmberArc(cursor, 3, 2.4);
        } else {
          hazards.push({
            kind: "bar",
            x: cursor,
            width: COURSE.barWidth,
            baseY: groundY,
            height: 3.4,
            clearance: COURSE.barClearance,
          });
        }
        cursor += rand(COURSE.minGapBetween, COURSE.maxGapBetween);
        break;
      }

      case "gap": {
        const w = rand(COURSE.pitWidthMin, COURSE.pitWidthMax);
        // Pit edges: close the floor before, reopen after.
        closePlatform(cursor);
        platformStart = cursor + w;
        // a few embers floating across the gap to bait the jump line
        dropEmberArc(cursor + w / 2, 3, 1.8);
        cursor = platformStart + rand(COURSE.minGapBetween, COURSE.maxGapBetween);
        break;
      }

      case "ramp": {
        const x0 = cursor;
        const x1 = cursor + COURSE.rampRun;
        ramps.push({ x0, x1, baseY: groundY, rise: COURSE.rampRise });
        // Big payoff arc launched off the top of the ramp.
        dropEmberArc(x1 + 4.5, 5, 4.2);
        cursor = x1 + rand(COURSE.minGapBetween, COURSE.maxGapBetween);
        break;
      }

      case "flat": {
        dropEmberArc(cursor, 5, 3.0);
        cursor += rand(COURSE.minGapBetween * 0.8, COURSE.maxGapBetween * 0.8);
        break;
      }
    }

    const segment: CourseSegment = {
      id: planCycle === 0 ? spec.id : `${spec.id}-${planCycle + 1}`,
      kind: spec.kind,
      x0: segmentStart,
      x1: cursor,
    };
    segments.push(segment);
    if (spec.checkpoint && planCycle === 0) {
      checkpoints.push({
        id: spec.checkpoint.id,
        label: spec.checkpoint.label,
        x: segment.x0 + (segment.x1 - segment.x0) * 0.5,
        reached: false,
        splitTime: null,
      });
    }
  }

  segments.push({ id: "final-approach", kind: "flat", x0: cursor, x1: beaconX });

  // Close the final platform out past the beacon so there's a landing pad.
  closePlatform(beaconX + 30);

  // A welcoming ember line on the opening runway.
  for (let x = 8; x < COURSE.firstObstacleX - 2; x += 3) {
    embers.push({ x, y: groundY + 1.5 + RUNNER.radius, collected: false });
  }

  return { segments, platforms, hazards, embers, ramps, checkpoints, beaconX };
}
