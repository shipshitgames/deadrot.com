// Central place for all gameplay tunables. Units are roughly meters / seconds.

export const ARENA_HALF = 40; // arena spans [-40, 40] on X and Z -> 80x80 floor
export const WALL_HEIGHT = 6;
export const WALL_THICKNESS = 1.5;

export const PLAYER_HEIGHT = 1.8; // camera eye height when grounded
export const PLAYER_CROUCH_HEIGHT = 1.08;
export const PLAYER_RADIUS = 0.5; // collision radius against obstacles/walls
export const CAMERA_BASE_FOV = 75;
export const ADS_LERP = 13;
export const GRAVITY = 30;
export const JUMP_VELOCITY = 11;
export const MOVE_ACCEL = 120; // higher = snappier; steady-state speed ~= accel / damping
export const MOVE_DAMPING = 13; // crisper start/stop (DOOM-snappy, less ice-skating)
export const MOVE_STOP_EPSILON = 0.6; // snap velocity to 0 below this when no input (kills the long glide)
export const SPRINT_ACCEL_MULT = 1.45;
export const CROUCH_ACCEL_MULT = 0.48;
export const STANCE_LERP = 18;
export const PLAYER_STEP_HEIGHT = 0.45;
export const GROUND_SNAP_DOWN = 0.42;
export const PLAYER_MAX_HEALTH = 100;

// Weapon
export const MAGAZINE_SIZE = 15;
export const START_RESERVE = 75;
export const RESERVE_CAP = 300;
export const AMMO_PER_KILL = 12;
export const RELOAD_TIME = 1.2; // seconds
export const FIRE_INTERVAL = 0.18; // seconds between shots
export const WEAPON_DAMAGE = 26; // sidearm baseline
export const HEADSHOT_MULTIPLIER = 2.2;

// Melee knife — always available (no ammo), the guaranteed fallback so you can
// never be locked out of fighting when ammo runs dry. Works in every mode.
export const MELEE_DAMAGE = 48;
export const MELEE_RANGE = 3.0;
export const MELEE_COOLDOWN = 0.5;
export const MELEE_ARC_DOT = 0.55; // cos(~57°): frontal cone, hits a small cluster
export const MELEE_KNOCKBACK = 7; // a satisfying shove on the knife

// Enemies (base stats; waves scale these)
export const ENEMY_MAX_HEALTH = 100;
export const ENEMY_SPEED_MIN = 2.6;
export const ENEMY_SPEED_MAX = 4.2;
export const ENEMY_RADIUS = 0.6;
export const ENEMY_HEIGHT = 1.7;
export const ENEMY_ATTACK_RANGE = 2.2;
export const ENEMY_ATTACK_DAMAGE = 9;
export const ENEMY_ATTACK_INTERVAL = 0.9; // seconds between an enemy's hits
export const ENEMY_SCORE = 100;
export const ENEMY_SEPARATION = 1.4; // soft push so they don't perfectly stack

// ---- Waves ----------------------------------------------------------------
export interface WaveConfig {
  count: number; // total enemies to defeat this wave
  concurrent: number; // max alive at once
  healthMul: number;
  speedMul: number;
}

export const WAVES: WaveConfig[] = [
  { count: 6, concurrent: 4, healthMul: 1.0, speedMul: 1.0 },
  { count: 9, concurrent: 5, healthMul: 1.3, speedMul: 1.12 },
  { count: 12, concurrent: 6, healthMul: 1.6, speedMul: 1.25 },
];
export const TOTAL_WAVES = WAVES.length; // breach-boss arrives after the final wave

// ---- Structured descent (multi-map run) ------------------------------------
// Each descent stage runs the full WAVES + breach-boss on a different map;
// clearing a breach-boss advances to the next map. Difficulty escalates per
// stage, and the player is patched up a little between maps to reward the push.
export const STAGE_DIFFICULTY_STEP = 0.22; // +22% enemy & breach-boss health per stage
export const STAGE_CLEAR_HEAL = 40; // HP restored when advancing to the next map

export const FIRST_WAVE_DELAY = 2.2; // seconds before wave 1 spawns
export const WAVE_BREAK = 3.2; // seconds between cleared waves
export const WAVE_SPAWN_INTERVAL = 0.9; // seconds between staggered spawns within a wave

// ---- Boss -----------------------------------------------------------------
export const BOSS_HEALTH = 2200;
export const BOSS_SCALE = 2.6;
export const BOSS_SPEED = 2.2;
export const BOSS_ATTACK_DAMAGE = 18;
export const BOSS_ATTACK_INTERVAL = 1.1;
export const BOSS_ATTACK_RANGE = 4.4;
export const BOSS_SCORE = 2500;
export const BOSS_COLOR = 0xff1f4f;
export const BOSS_RESERVE_BONUS = 60; // ammo granted for slaying the boss

// ---- Weapons --------------------------------------------------------------
export type WeaponId = "pistol" | "smg" | "shotgun" | "cannon" | "sniper";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  damage: number;
  fireInterval: number; // seconds between shots
  magazineSize: number;
  reserve: number; // reserve granted when first unlocked
  reserveCap: number;
  pellets: number; // rays per trigger pull (shotgun > 1)
  spread: number; // cone half-angle in radians
  auto: boolean; // hold-to-fire vs semi-auto
  ammoPerKill: number;
  accent: number; // viewmodel accent colour
  barrelLen: number; // viewmodel barrel length
  knockback: number; // shove imparted to a hit enemy (units/s impulse)
  shake: number; // screenshake trauma added per shot (0..1)
  kick: number; // view recoil pitch kick per shot (radians)
  adsFovs: number[]; // per-weapon aim-down-sights FOV levels; sniper has multiple zooms
  adsSpreadMul: number; // spread multiplier when fully ADS
  adsMoveMul: number; // move acceleration multiplier while ADS
  dualCompatible: boolean; // whether the dual-weapon pickup can mirror this shot
  headshotMultiplier?: number; // optional weapon-specific headshot payoff
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    damage: 26,
    fireInterval: 0.18,
    magazineSize: 15,
    reserve: 75,
    reserveCap: 225,
    pellets: 1,
    spread: 0.012,
    auto: false,
    ammoPerKill: 9,
    accent: 0xff6a00,
    barrelLen: 0.27,
    knockback: 2.8,
    shake: 0.045,
    kick: 0.014,
    adsFovs: [56],
    adsSpreadMul: 0.45,
    adsMoveMul: 0.82,
    dualCompatible: true,
  },
  smg: {
    id: "smg",
    name: "SMG",
    damage: 18,
    fireInterval: 0.06,
    magazineSize: 45,
    reserve: 180,
    reserveCap: 450,
    pellets: 1,
    spread: 0.022,
    auto: true,
    ammoPerKill: 18,
    accent: 0x9b5cff,
    barrelLen: 0.3,
    knockback: 2,
    shake: 0.03,
    kick: 0.007,
    adsFovs: [62],
    adsSpreadMul: 0.7,
    adsMoveMul: 0.86,
    dualCompatible: true,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    damage: 13,
    fireInterval: 0.62,
    magazineSize: 8,
    reserve: 32,
    reserveCap: 80,
    pellets: 9,
    spread: 0.095,
    auto: false,
    ammoPerKill: 4,
    accent: 0xffb02e,
    barrelLen: 0.5,
    knockback: 6,
    shake: 0.34,
    kick: 0.05,
    adsFovs: [66],
    adsSpreadMul: 0.82,
    adsMoveMul: 0.78,
    dualCompatible: true,
  },
  cannon: {
    id: "cannon",
    name: "Cannon",
    damage: 130,
    fireInterval: 0.92,
    magazineSize: 5,
    reserve: 15,
    reserveCap: 40,
    pellets: 1,
    spread: 0,
    auto: false,
    ammoPerKill: 2,
    accent: 0xff3b6b,
    barrelLen: 0.62,
    knockback: 14,
    shake: 0.6,
    kick: 0.09,
    adsFovs: [70],
    adsSpreadMul: 1,
    adsMoveMul: 0.62,
    dualCompatible: false,
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    damage: 92,
    fireInterval: 0.78,
    magazineSize: 5,
    reserve: 25,
    reserveCap: 60,
    pellets: 1,
    spread: 0.002,
    auto: false,
    ammoPerKill: 2,
    accent: 0xd7d2c4,
    barrelLen: 0.68,
    knockback: 8,
    shake: 0.22,
    kick: 0.06,
    adsFovs: [36, 18],
    adsSpreadMul: 0.18,
    adsMoveMul: 0.46,
    dualCompatible: true,
    headshotMultiplier: 3.2,
  },
};

// ---- Cannon area-of-effect: the power weapon detonates on impact -----------
export const CANNON_SPLASH_RADIUS = 4.0;
export const CANNON_SPLASH_DAMAGE = 90; // full damage at the centre, falls off to 0 at the rim
export const STARTING_WEAPON: WeaponId = "pistol";
export const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "shotgun", "cannon", "sniper"];

// ---- Pickups (drops) ------------------------------------------------------
export type PickupKind = "health" | "ammo" | "damage" | "dual" | WeaponId;
export const PICKUP_DROP_CHANCE = 0.5; // chance a normal kill drops something
export const PICKUP_RADIUS = 1.7; // walk within this to collect
export const PICKUP_TTL = 16; // seconds before a drop despawns
export const HEALTH_PICKUP_AMOUNT = 35;
export const BERSERK_DAMAGE_MULT = 2;
export const BERSERK_TIME = 10;
export const BERSERK_FIRE_RATE_MULT = 1.35;
export const BERSERK_MOVE_MULT = 1.16;
export const BERSERK_KNOCKBACK_MULT = 1.28;
export const DAMAGE_BOOST_MULT = BERSERK_DAMAGE_MULT;
export const DAMAGE_BOOST_TIME = BERSERK_TIME;
export const DUAL_WEAPON_TIME = 12;

// ---- Enemy ranged fire ----------------------------------------------------
export const ENEMY_RANGED_CHANCE = 0.45; // fraction of mobs that shoot back
export const ENEMY_FIRE_INTERVAL = 1.7;
export const ENEMY_FIRE_RANGE = 30; // max distance a mob will open fire
export const ENEMY_PREFERRED_RANGE = 12; // ranged mobs try to hold this gap
export const ENEMY_PROJECTILE_SPEED = 22;
export const ENEMY_PROJECTILE_DAMAGE = 8;
export const PROJECTILE_HIT_RADIUS = 0.9; // distance to player that counts as a hit
export const PROJECTILE_TTL = 4;

// ---- Elite wave affixes (Survivors) ----------------------------------------
// Every Nth breach surge arrives as an ELITE WAVE: a fraction of its spawns are
// promoted to larger, tinted elites that all share one rolled affix.
export type EliteAffixId = "shielded" | "frenzied" | "splitting";

export interface EliteAffixDef {
  id: EliteAffixId;
  name: string; // toast copy shown when the elite wave lands
  tint: number; // sprite/death-FX tint (DOOM palette only)
  cue: "shieldUp" | "berserk" | null; // played once per elite batch, not per enemy
}

export const ELITE_WAVE_EVERY = 3; // every Nth breach surge is an ELITE WAVE
export const ELITE_WAVE_FRACTION = 0.18; // fraction of the surge promoted to elites
export const ELITE_WAVE_MIN_ELITES = 2; // an elite wave always fields at least this many
export const ELITE_SCALE_MUL = 1.25; // elites are visibly larger than their archetype
export const ELITE_HP_MUL = 2.2; // elite health over the archetype baseline
export const ELITE_XP_MUL = 3; // elite gems pay out triple the archetype value
export const ELITE_SHIELD_HP = 70; // overshield absorbed before health (scaled by run time)
export const ELITE_FRENZY_SPEED_MUL = 1.4; // frenzied: +40% move speed
export const ELITE_FRENZY_DAMAGE_MUL = 1.2; // frenzied: +20% damage
export const ELITE_SPLIT_COUNT_MIN = 2; // splitting elites shed 2-3 standard enemies on death
export const ELITE_SPLIT_COUNT_MAX = 3;
export const ELITE_SPLIT_CAP_PER_WAVE = 12; // total split children allowed per elite wave

export const ELITE_AFFIXES: Record<EliteAffixId, EliteAffixDef> = {
  shielded: { id: "shielded", name: "SHIELDED ELITES", tint: 0xe9e3d6, cue: "shieldUp" }, // bone
  frenzied: { id: "frenzied", name: "FRENZIED ELITES", tint: 0xff2a18, cue: "berserk" }, // bloodHot
  splitting: { id: "splitting", name: "SPLITTING ELITES", tint: 0x8bdc1f, cue: null }, // toxic (Scourge-only)
};

export const ELITE_AFFIX_IDS: EliteAffixId[] = ["shielded", "frenzied", "splitting"];

// ---- Boss skills ----------------------------------------------------------
export const BOSS_SKILL_INTERVAL = 7; // seconds between boss abilities
export const BOSS_SHIELD_DURATION = 4;
export const BOSS_ENRAGE_HEALTH_FRAC = 0.5; // enrages below this health fraction
export const BOSS_ENRAGE_SPEED_MULT = 1.7;
export const BOSS_PROJECTILE_DAMAGE = 13;
export const BOSS_PROJECTILE_SPEED = 17;
export const BOSS_BARRAGE_COUNT = 7;
export const BOSS_BARRAGE_SPREAD = 0.55; // radians, total fan
