/**
 * REDLINE — data-driven tunables.
 * Everything that defines "feel" lives here so the core loop can be tuned
 * without spelunking through systems. Distances are in world units; the
 * ground sits at WORLD.groundY and the runner moves +X toward the BEACON.
 */

import type { Front } from "./types";

// --- DOOM palette (apps/lore/content/DESIGN.md), as hex numbers for Three.js -------------
export const COLORS = {
  void: 0x0a0a0a,
  coal: 0x121214,
  iron: 0x1e1e22,
  gunmetal: 0x34343c,
  blood: 0xc1121f,
  bloodHot: 0xff2a18,
  hellfire: 0xff6a00,
  rust: 0x8a4b2a,
  bone: 0xe9e3d6,
  ash: 0x9b958a,
  toxic: 0x8bdc1f,
} as const;

export const WORLD = {
  groundY: 0, // top surface of the lane
  levelLength: 520, // world units from start to the BEACON
  startX: 4, // runner spawn X
  gravity: -78, // u/s^2 (snappy, arcade)
} as const;

export const RUNNER = {
  radius: 0.6,
  height: 1.8, // capsule total height
  // Horizontal momentum
  baseSpeed: 6, // creep speed when not accelerating
  topSpeed: 34, // hold-to-accel cap
  accel: 26, // u/s^2 while holding accelerate
  decel: 14, // u/s^2 coast slowdown toward baseSpeed
  redlineFrac: 0.86, // fraction of topSpeed that counts as "redline" (juice trigger)
  // Jump
  jumpVel: 26, // initial upward velocity
  coyoteTime: 0.1, // grace window to jump after leaving ground (s)
  jumpBufferTime: 0.12, // buffer a jump pressed just before landing (s)
  cutJumpMul: 0.45, // velocity multiplier when jump released early (variable height)
  maxFallSpeed: -70,
  // Dash-roll
  dashTime: 0.34, // duration of a dash (s)
  dashSpeedBonus: 14, // additive speed kick during dash
  dashCooldown: 0.18, // cooldown after a dash (s)
  dashCrouchScale: 0.5, // vertical squash while rolling (for low obstacles)
  // Hazard impact
  staggerTime: 0.42, // input-lock + slowdown window after a hit (s)
  staggerSpeedMul: 0.42, // speed multiplied by this on impact
  invulnTime: 0.7, // i-frames after a hit (s)
} as const;

export const EMBER = {
  speedBonus: 9, // instant additive speed on pickup
  radius: 0.55,
} as const;

export const CAMERA = {
  // Orthographic half-height; width derives from aspect.
  viewHeight: 16,
  lead: 7.5, // how far ahead of the runner the camera centers (world units)
  height: 5.5, // vertical center above groundY
  followLerp: 7, // camera position smoothing (per second)
  // Juice: subtle FOV-ish zoom-out + screen stretch at top speed
  zoomOutAtTop: 0.16, // extra view-height fraction at redline
  shakeDecay: 9, // screen-shake decay (per second)
} as const;

export const TRAIL = {
  segments: 16, // motion-trail ghost count
  spacing: 0.045, // seconds between trail samples
} as const;

export const COURSE = {
  // --- Canon metadata (apps/lore/content/Maps.md cross-game map registry) ----------------
  // Which canon place this course is. The `loreId` is the join key into the
  // War-for-the-Lanes registry; `front` is its front-taxonomy class.
  name: "The Hollow Lanes — Dead Road",
  loreId: "hollowlanes",
  front: "lane" as Front,
  // Procedural-but-seeded segment cadence. The generator walks from
  // ~startX to levelLength placing hazards, gaps, embers and ramps.
  seed: 1337,
  firstObstacleX: 26, // safe runway before the first hazard
  minGapBetween: 9, // min spacing between placed features
  maxGapBetween: 17,
  // Pit (gap) — must be jumped
  pitWidthMin: 3.5,
  pitWidthMax: 6.5,
  // Creep spike (tall hazard) — must be jumped, blood-red
  spikeHeight: 2.0,
  spikeWidth: 1.4,
  // Low creep bar — must be dash-rolled under, blood-red
  barClearance: 1.5, // gap under the bar
  barWidth: 1.2,
  // Ramp — gunmetal kicker that launches the runner
  rampRise: 2.6,
  rampRun: 5.0,
} as const;

export const SCORE = {
  // Ember chain: each pickup scores emberPoints * current multiplier, then
  // heats the chain one step (x1 -> chainMax). The chain collapses back to x1
  // when chainWindow seconds pass without a pickup.
  emberPoints: 10,
  chainMax: 5,
  chainWindow: 4, // seconds without a pickup before the chain collapses
  // Near-miss style: skim past a hazard (cleanly, no stagger) within this
  // margin (world units) to earn style points. The bar margin sits below the
  // 0.3 of headroom an upright grounded runner always has (barClearance 1.5
  // minus head at 2*radius = 1.2), so plain running never farms free style.
  nearMissMargin: { spike: 0.5, bar: 0.25 },
  nearMissPoints: 150,
  // Time bonus at the beacon: faster = more, floored at zero.
  timeBonusMax: 3000, // theoretical bonus at t=0
  timeBonusPerSecond: 50, // points shed per second on the clock
  // Letter grade thresholds on the final total (checked top-down).
  grades: [
    { grade: "S", min: 7000 },
    { grade: "A", min: 5000 },
    { grade: "B", min: 2500 },
    { grade: "C", min: 0 },
  ],
} as const;

export const FEEDBACK = {
  // Land SFX/dust only fire on meaningful falls: impact fall speed (u/s,
  // negative = down) must be at least this fast. A full jump lands ~ -26;
  // a cut-jump hop lands ~ -12.
  landFallVy: -16,
  sfxFrameCap: 4, // max one-shot cues layered per rendered frame
  gemChainPitchStep: 0.09, // gem cue pitches up per chain step
  jumpPitchJitter: 0.08, // subtle per-jump pitch variation
  // Particle bursts (consumed by the render system via game-kit ParticleBursts).
  emberBurst: { count: 12, speed: 6.5, life: 0.5, size: 0.17, upwardBias: 0.55 },
  dustBurst: { count: 10, speed: 3.4, life: 0.42, size: 0.15, gravity: 14, upwardBias: 0.6 },
  dustPuff: { count: 5, speed: 2.2, life: 0.32, size: 0.12, gravity: 10, upwardBias: 0.8 },
} as const;

// Best-run persistence. The key is shared with the legacy raw best-time payload
// (a bare number string); createLocalStore migrates it into the versioned
// per-seed envelope (see systems/score.ts).
export const STORAGE_KEY = "redline.best.v1";
export const BESTS_VERSION = 2;
