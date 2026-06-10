// Canon location: see apps/lore/content/Locations/The-Hollow-Lanes.md and apps/lore/content/Maps.md (cross-game map registry).
// This course is "The Hollow Lanes — Dead Road" (loreId: hollowlanes, front: lane) — see COURSE in constants.ts.

/**
 * Deterministic course generation.
 * Walks from the start runway to the BEACON, laying down platforms (with pits),
 * blood-creep hazards, kicker ramps and speed embers. Seeded so every run of a
 * given seed is identical — fair for time-attack.
 */

import { COURSE, RUNNER, WORLD } from "./constants";
import type { Course, Ember, Hazard, Platform, Ramp } from "./types";

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

type Feature = "spike" | "bar" | "pit" | "ramp" | "embers";

export function generateCourse(seed = COURSE.seed): Course {
  const rng = mulberry32(seed);
  const rand = (min: number, max: number) => min + rng() * (max - min);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const embers: Ember[] = [];
  const ramps: Ramp[] = [];

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

  const features: Feature[] = ["spike", "bar", "pit", "ramp", "embers"];

  while (cursor < beaconX - 24) {
    const feature = pick(features);

    switch (feature) {
      case "spike": {
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
        cursor += rand(COURSE.minGapBetween, COURSE.maxGapBetween);
        break;
      }

      case "bar": {
        hazards.push({
          kind: "bar",
          x: cursor,
          width: COURSE.barWidth,
          baseY: groundY,
          height: 3.4,
          clearance: COURSE.barClearance,
        });
        cursor += rand(COURSE.minGapBetween, COURSE.maxGapBetween);
        break;
      }

      case "pit": {
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

      case "embers": {
        dropEmberArc(cursor, 5, 3.0);
        cursor += rand(COURSE.minGapBetween * 0.8, COURSE.maxGapBetween * 0.8);
        break;
      }
    }
  }

  // Close the final platform out past the beacon so there's a landing pad.
  closePlatform(beaconX + 30);

  // A welcoming ember line on the opening runway.
  for (let x = 8; x < COURSE.firstObstacleX - 2; x += 3) {
    embers.push({ x, y: groundY + 1.5 + RUNNER.radius, collected: false });
  }

  return { platforms, hazards, embers, ramps, beaconX };
}
