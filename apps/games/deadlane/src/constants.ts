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
    startGold: 150,
    towerCost: 50,
    killReward: 12,
    waveClearBonus: 25,
  },

  // ---- Base -----------------------------------------------------------------
  base: {
    startHp: 20,
  },

  // ---- Tower ----------------------------------------------------------------
  tower: {
    range: 5.5,
    fireRate: 1.6, // shots per second
    damage: 16,
    projectileSpeed: 22,
    turnSpeed: 9, // rad/s the turret rotates toward target
  },

  // ---- Creep (Scourge) ------------------------------------------------------
  creep: {
    baseHp: 30,
    baseSpeed: 2.4, // world units / sec along the path
    radius: 0.45,
    // per-wave scaling
    hpGrowth: 1.22, // multiplied each wave
    speedGrowth: 1.04,
  },

  // ---- Waves ----------------------------------------------------------------
  waves: {
    total: 8,
    baseCount: 6, // creeps in wave 1
    countGrowth: 2, // extra creeps added per wave
    spawnInterval: 0.85, // seconds between creeps in a wave
    interWaveDelay: 3.0, // seconds of breathing room between waves
  },

  // ---- Render / camera ------------------------------------------------------
  camera: {
    fov: 50,
    // Angled perspective over the board.
    position: [0, 18, 16] as [number, number, number],
    lookAtY: 0,
  },

  // ---- Loop -----------------------------------------------------------------
  loop: {
    maxDelta: 0.05, // clamp dt so a tab-out can't fling the sim
  },
} as const;
