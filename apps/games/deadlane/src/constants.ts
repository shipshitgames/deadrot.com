// Canon location: see apps/lore/content/Locations/Ashgate.md and apps/lore/content/Maps.md (cross-game map registry).

/**
 * CONSTANTS — every tunable knob for Deadlane lives here.
 * Data-driven by design: the systems read from this object, they never hardcode.
 */

// DOOM palette (apps/lore/content/DESIGN.md). Numbers are hex ints for Three.js materials;
// the matching CSS strings live in styles.css.
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
  toxic: 0x8bdc1f, // the Scourge only
} as const;

export const CONSTANTS = {
  // ---- Board ----------------------------------------------------------------
  board: {
    // Canon: Ashgate's eastern breach-lane, defended by the Wardens.
    name: "Ashgate — Eastern Lane",
    loreId: "ashgate",
    front: "lane",
    cols: 11,
    rows: 7,
    cell: 2, // world units per grid cell
    // The single lane, as [col,row] waypoints from spawn to base.
    // It snakes across the board so towers have angles to cover.
    path: [
      [0, 1],
      [3, 1],
      [3, 4],
      [7, 4],
      [7, 1],
      [10, 1],
    ] as [number, number][],
  },

  // ---- Economy --------------------------------------------------------------
  economy: {
    startGold: 175,
    waveClearBonus: 25,
  },

  // ---- Base -----------------------------------------------------------------
  base: {
    startHp: 20,
  },

  // ---- Tower archetypes -------------------------------------------------------
  // Select with 1/2/3. slowFactor/aoeRadius are 0 where the archetype has none.
  towers: {
    ember: {
      label: "EMBER TURRET",
      cost: 50,
      range: 6.25,
      fireRate: 1.6, // shots per second
      damage: 16,
      projectileSpeed: 22,
      turnSpeed: 9, // rad/s the turret rotates toward target
      slowFactor: 0,
      slowDuration: 0,
      aoeRadius: 0,
    },
    stasis: {
      label: "STASIS PYLON",
      cost: 65,
      range: 5.0,
      fireRate: 0.9,
      damage: 5,
      projectileSpeed: 26,
      turnSpeed: 12,
      slowFactor: 0.45, // fraction of speed removed while slowed
      slowDuration: 1.6, // seconds the slow lasts after a hit
      aoeRadius: 0,
    },
    mortar: {
      label: "ASH MORTAR",
      cost: 90,
      range: 8.75,
      fireRate: 0.45,
      damage: 34,
      projectileSpeed: 11,
      turnSpeed: 5,
      slowFactor: 0,
      slowDuration: 0,
      aoeRadius: 2.1, // splash radius around the impact
    },
  },

  // ---- Creep (Scourge) archetypes --------------------------------------------
  creeps: {
    shambler: {
      label: "SHAMBLER",
      hp: 30,
      speed: 2.25, // world units / sec along the path
      radius: 0.45,
      reward: 12,
      breachDamage: 1, // base HP lost when it reaches the door
    },
    ripper: {
      label: "RIPPER",
      hp: 13,
      speed: 4.2,
      radius: 0.3,
      reward: 7,
      breachDamage: 1,
    },
    hulk: {
      label: "BREACH HULK",
      hp: 110,
      speed: 1.4,
      radius: 0.62,
      reward: 32,
      breachDamage: 3,
    },
    boss: {
      label: "LANE TYRANT",
      hp: 420,
      speed: 1.15,
      radius: 0.85,
      reward: 130,
      breachDamage: 8,
    },
  },

  // per-wave scaling applied to every creep kind
  creepScaling: {
    hpGrowth: 1.22, // multiplied each wave
    speedGrowth: 1.04,
  },

  // ---- Waves ----------------------------------------------------------------
  waves: {
    total: 10,
    bossEvery: 5, // a Lane Tyrant leads every Nth wave
    baseCount: 6, // creeps in wave 1
    countGrowth: 2, // extra creeps added per wave
    spawnInterval: 0.85, // seconds between creeps in a wave
    interWaveDelay: 7.5, // seconds of breathing room between waves
  },

  // ---- Render / camera ------------------------------------------------------
  camera: {
    fov: 74,
    far: 220,
  },

  // ---- Embodied player ------------------------------------------------------
  player: {
    height: 1.75,
    radius: 0.42,
    moveSpeed: 5.0,
    sprintMultiplier: 1.42,
    accel: 46,
    damping: 10,
    brakeDamping: 17,
    sprintStartBoostTime: 0.16,
    sprintStartBoostMultiplier: 0.3,
    stopEpsilon: 0.05,
    buildRange: 2.1,
    startBackset: 2.4,
  },

  build: {
    time: 1.55,
  },

  bonuses: {
    buildSpeedPerLevel: 0.22,
    runSpeedPerLevel: 0.16,
  },

  // ---- Loop -----------------------------------------------------------------
  loop: {
    fixedDt: 1 / 120, // deterministic physics step (game-kit fixed loop)
    maxDelta: 0.05, // clamp dt so a tab-out can't fling the sim
  },
} as const;
