// ---------------------------------------------------------------------------
// Central, data-driven tunables for Starblight — a top-down arcade-pilot
// Vampire-Survivors. Tweak gameplay feel here without touching system code.
// Units are world-units (the orthographic camera now FOLLOWS the ship across a
// large bounded arena) and seconds. Weapon/passive content lives in upgrades.ts.
// ---------------------------------------------------------------------------
// Canon location: see apps/lore/content/Locations/The-Skyhook.md and apps/lore/content/Maps.md
// (cross-game map registry). The Starblight theater is The Skyhook — the
// orbital ring and tether (front: orbital, loreId: skyhook).
// ---------------------------------------------------------------------------

// DOOM palette (apps/lore/content/DESIGN.md). Stored as hex numbers for Three.js materials.
// READABILITY RULE: toxic-green is the Scourge's ONLY color — every player
// weapon/effect stays bone/hellfire/blood so threats are always parseable.
export const COLORS = {
  void: 0x0a0a0a,
  coal: 0x121214,
  iron: 0x1e1e22,
  gunmetal: 0x34343c,
  blood: 0xc1121f,
  bloodHot: 0xff2a18,
  hellfire: 0xff6a00,
  ember: 0xffb02e,
  rust: 0x8a4b2a,
  bone: 0xe9e3d6,
  ash: 0x9b958a,
  toxic: 0x8bdc1f, // the Scourge only
  toxicHot: 0xc6ff4a,
} as const;

// Logical play-field — a large bounded square arena the camera flies across.
// Canon: this arena is The Skyhook, the orbital ring/tether front of the war.
export const WORLD = {
  // --- Canon metadata (see apps/lore/content/Locations/The-Skyhook.md, apps/lore/content/Maps.md) ---
  name: "The Skyhook — Orbital Ring",
  loreId: "skyhook",
  front: "orbital",
  // --- Geometry (PRESERVE EXACTLY — gameplay/camera depend on these) ------
  width: 200,
  height: 200,
  get halfW() {
    return this.width / 2;
  },
  get halfH() {
    return this.height / 2;
  },
} as const;

export const CONSTANTS = {
  // --- Loop -------------------------------------------------------------
  maxDelta: 1 / 30, // clamp dt so a stutter never teleports entities

  // --- Player interceptor (mouse-follow thrust) -------------------------
  player: {
    accel: 90, // base thrust (world-units / sec²), scaled by ION THRUSTERS
    maxSpeed: 22, // base top speed (world-units / sec), scaled by ION THRUSTERS
    followDeadzone: 1.0, // cursor distance under which the ship coasts to a stop
    drag: 0.86, // per-frame-equiv velocity decay while coasting
    width: 2.2,
    height: 2.6,
    startIntegrity: 100,
    invulnTime: 0.6, // i-frames after taking a contact hit (seconds)
    bankLerp: 0.2, // how fast the hull leans into a turn
    headingLerp: 0.25, // how fast the nose swings to face travel
    edgeMargin: 4, // how far inside the world border the ship is clamped
  },

  // --- Follow camera ----------------------------------------------------
  camera: {
    viewHeight: 48, // world-units shown tall (width derived from aspect)
    followSmooth: 8, // higher = camera catches the ship faster
    deadzoneW: 8, // ship can drift this far horizontally before the cam chases
    deadzoneH: 6,
    z: 50,
  },

  // --- XP / salvage gems ------------------------------------------------
  xp: {
    baseMagnet: 12, // fast-vacuum radius, scaled by SALVAGE SCOOP
    globalPull: 5.5, // gentle gravity-well drift so the whole field funnels in
    gemSpeedFar: 20, // homing speed when a gem first locks on
    gemSpeedNear: 52, // homing speed as it reaches the ship (the vacuum slurp)
    pickupDist: 1.4,
    gemLifetime: 30, // gems despawn after this many seconds...
    gemBlink: 25, // ...and blink to warn from here
    gemCap: 400, // hard cap on live gems (oldest auto-collected if exceeded)
  },

  // --- Director (time-driven escalation; replaces waves) ----------------
  director: {
    spawnBase: 0.95, // seconds between spawn ticks at t=0
    spawnSlope: 0.011, // interval shrinks by this per second of run time
    spawnFloor: 0.18, // fastest spawn interval
    batchBase: 2, // enemies per tick early
    batchPer: 22, // +1 to the batch every N seconds
    batchCap: 7,
    aliveMin: 80, // alive-cap at t=0...
    aliveMax: 160, // ...ramping to here (protects framerate)
    aliveRampTime: 240,
    hpSlope: 0.05, // enemy HP *= 1 + clock*hpSlope
    speedSlope: 0.01, // enemy speed *= 1 + clock*speedSlope (capped)
    speedCap: 1.7,
    eliteEvery: 35, // a BLIGHT-BOIL elite this often
    eliteHpMul: 9,
    ringPad: 4, // spawn ring sits this far beyond the camera view
  },

  // --- Orbital boss prototype label: THE BLIGHT-MAW ---------------------
  // Lore anchor remains the Orbital Breach Carrier until this encounter is reviewed.
  boss: {
    spawnAt: 180, // seconds into the run the boss warps in
    baseHP: 2400,
    phase2Pct: 0.66,
    phase3Pct: 0.33,
    orbitR: 9, // orbit distance it holds from the ship (close enough to menace)
    orbitSpeed: 0.5, // rad/s around the ship
    burstCount: 16, // radial spore-bullets per vent
    burstEvery: 2.4,
    spiralCount: 6, // glob arms per phase-3 spiral tick
    spiralEvery: 0.16, // phase-3 spiral cadence
    dashTelegraph: 0.8,
    dashSpeed: 46,
    dashEvery: 6,
    bulletSpeed: 14,
    bulletDmg: 12,
    contactDmg: 26,
    summonEvery: 5,

    // Telegraphed radial ring volley: a glow windup, then staggered rings of
    // slow spores the pilot weaves through. Pure math lives in bossPatterns.ts.
    ring: {
      telegraph: 0.8, // boss glow windup before the first ring fires
      firstDelay: 3, // first volley this long after the boss warps in
      ringsByPhase: [1, 2, 3], // rings per volley in phases 1 / 2 / 3
      cooldownByPhase: [7.5, 6.5, 5.5], // seconds between volleys per phase
      ringInterval: 0.28, // stagger between rings of one volley
      count: 18, // spores per ring (evenly spaced)
      bulletSpeed: 9, // slow + weavable (player base maxSpeed is 22)
      bulletDmg: 10,
    },

    // Telegraphed beam: a warning line renders, then a damaging beam burns
    // along the locked line. Offline in phase 1 (cooldown 0 = disabled).
    beam: {
      telegraph: 1.0, // warning line renders this long...
      duration: 1.2, // ...then the beam burns along it for this long
      firstDelay: 3, // grace period once the beam phase begins
      cooldownByPhase: [0, 9, 7], // seconds between beams per phase (0 = off)
      width: 2.4,
      length: 70, // long enough to cross the whole view
      damage: 16, // per touch (player i-frames gate repeat ticks)
    },
  },

  // --- Juice ------------------------------------------------------------
  fx: {
    // ScreenShake trauma kicks (game-kit units, 0..1; largest pending wins).
    shake: {
      gruntKill: 0.04,
      novaDetonate: 0.08,
      mineDetonate: 0.1,
      eliteSpawn: 0.12,
      eliteKill: 0.25, // big explosions
      playerHit: 0.3,
      bossCharge: 0.4, // boss dash lunge + beam ignition
      bossSpawn: 0.5,
      bossPhase: 0.5, // boss phase transition
      bossDeath: 0.6,
    },
    shakeDecay: 6, // trauma decay per second (proportional; higher settles faster)
    shakeMax: 1, // hard cap on any single kick
    shakeWorldScale: 2.2, // kit offsets -> ortho world units (view is 48 tall)
    // Kill-pop burst sizing (game-kit ParticleBursts; counts scale with the
    // user's global "particles" setting).
    burst: {
      enemy: { count: 10, speed: 7, life: 0.45, size: 0.24 },
      elite: { count: 30, speed: 11, life: 0.7, size: 0.34 },
      bossHit: { count: 6, speed: 6, life: 0.3, size: 0.2, every: 0.12 },
      bossPhase: { count: 40, speed: 13, life: 0.8, size: 0.36 },
      bossDeath: { count: 48, speed: 14, life: 0.9, size: 0.4 },
    },
    particlePerPop: 12,
    particleLife: 0.5,
    particleSpeed: 14,
    trailLife: 0.34, // thruster-trail quad lifetime
  },

  // --- Audio cue shaping (throttles + pitch ramps; cues are game-kit's) --
  audio: {
    laserMinInterval: 1 / 6, // cap weapon-fire cues at ~6 plays/sec
    laserPitchLo: 0.92, // fire-cue pitch jitter range
    laserPitchHi: 1.12,
    explosionMinInterval: 0.1, // chained elite kills don't stack booms
    gemMinInterval: 0.07, // a vacuum pulls many gems/frame — space the dings
    gemStreakWindow: 1.5, // pickups inside this window keep raising the pitch
    gemPitchStep: 0.045, // pitch climb per streak step
    gemPitchMax: 1.5,
    lowHealthPct: 0.25, // warning pings under this integrity fraction
    lowHealthEvery: 2.5, // seconds between warning pings while below
  },

  // --- Parallax starfield ----------------------------------------------
  stars: {
    nearCount: 140,
    farCount: 220,
    fieldSize: 440, // 2x world, so the field always blankets the view
    nearParallax: 0.7, // 1 = locked to camera, 0 = locked to world
    farParallax: 0.4,
    nearSize: 0.42,
    farSize: 0.28,
  },
} as const;

// --- Enemy archetypes (all toxic-green Scourge, distinct silhouettes) -------
export type EnemyType = "grunt" | "swarmling" | "weaver" | "spitter" | "elite";

export interface EnemyDef {
  baseHP: number;
  gem: number;
  speed: number; // world-units / sec at t=0
  contactDmg: number;
  size: number;
  geom: "cube" | "tetra" | "octa" | "icosa";
  behavior: "chase" | "weave" | "spit";
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  grunt: { baseHP: 3, gem: 1, speed: 6.5, contactDmg: 8, size: 1.9, geom: "cube", behavior: "chase" },
  swarmling: { baseHP: 1, gem: 1, speed: 11, contactDmg: 5, size: 1.1, geom: "tetra", behavior: "chase" },
  weaver: { baseHP: 2, gem: 2, speed: 8.5, contactDmg: 7, size: 1.4, geom: "tetra", behavior: "weave" },
  spitter: { baseHP: 5, gem: 3, speed: 4.5, contactDmg: 9, size: 1.7, geom: "octa", behavior: "spit" },
  elite: { baseHP: 3, gem: 25, speed: 3.6, contactDmg: 18, size: 3.4, geom: "icosa", behavior: "chase" },
};

// Spitter ranged behavior tunables (only ranged Scourge).
export const SPITTER = {
  range: 14, // tries to hold this distance
  fireEvery: 2.4,
  bulletSpeed: 13,
  bulletDmg: 8,
} as const;
