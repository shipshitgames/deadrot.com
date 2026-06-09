// ---------------------------------------------------------------------------
// Ship Shit Games — DOOM palette (apps/lore/content/DESIGN.md). Red + fire + metal + bone.
// Toxic-green is reserved for the Scourge ONLY.
// ---------------------------------------------------------------------------
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
  fleshDark: 0x2a1418,
  fleshWet: 0x4a1a22,
} as const;

// ---------------------------------------------------------------------------
// Data-driven tunables. Units are world-units; Y is up; X runs along the hulk.
// All time-based values are per-second and integrated against a clamped delta.
// ---------------------------------------------------------------------------
export const CONSTANTS = {
  // --- Camera / view -------------------------------------------------------
  VIEW_HEIGHT: 18, // world-units visible vertically (orthographic side cam)
  CAMERA_LEAD: 4, // how far ahead of the hero the camera looks
  CAMERA_LERP: 6, // camera follow stiffness (higher = snappier)
  CAMERA_MIN_Y: 9, // clamp so we never drop the camera below the floor

  // --- Hero body -----------------------------------------------------------
  HERO_WIDTH: 0.9,
  HERO_HEIGHT: 1.6,
  HERO_SPAWN_X: 2,
  HERO_SPAWN_Y: 4,

  // --- Horizontal movement -------------------------------------------------
  MOVE_SPEED: 9, // max run speed
  ACCEL: 70, // ground acceleration toward target speed
  AIR_ACCEL: 40, // weaker air control
  FRICTION: 60, // ground deceleration when no input

  // --- Jump feel (variable height + assists) -------------------------------
  GRAVITY: 55, // base downward accel
  FALL_GRAVITY_MULT: 1.7, // heavier gravity while falling = snappy arc
  LOW_JUMP_MULT: 2.6, // extra gravity when jump released early (short hop)
  JUMP_VELOCITY: 19, // initial upward velocity on a full jump
  MAX_FALL_SPEED: 34, // terminal velocity
  COYOTE_TIME: 0.1, // grace window to still jump after leaving a ledge
  JUMP_BUFFER: 0.12, // grace window to queue a jump before landing
  STOMP_BOUNCE: 16, // upward velocity after stomping a Scourge

  // --- Combat / damage -----------------------------------------------------
  MAX_HP: 3,
  START_LIVES: 3,
  CONTACT_DAMAGE: 1, // HP lost touching a Scourge from the side
  HAZARD_DAMAGE: 1, // HP lost per tick in acid / on spikes
  IHURT_TIME: 1.1, // invulnerability seconds after taking a hit
  KILL_FLOOR_Y: -8, // below this = a fatal fall
  RESPAWN_DELAY: 0.7, // seconds the corpse lingers before respawn

  // --- Enemies -------------------------------------------------------------
  SCOURGE_SPEED: 2.4, // patrol speed of a blood-blob
  SCOURGE_FERAL_SPEED: 3.4, // severed hosts thrash faster after the Choir path is cut
  SCOURGE_SIZE: 1.1,

  // --- Spitter (stationary lobber) ------------------------------------------
  SPITTER_SIZE: 1.2,
  SPITTER_RANGE: 11, // engages when the hero is within this distance
  SPITTER_COOLDOWN: 2.2, // seconds between lobs
  GLOB_SIZE: 0.45, // toxic projectile body
  GLOB_ARC_TIME: 1.1, // seconds for a lob to arc onto the hero's position
  GLOB_GRAVITY: 22, // gentler than hero gravity so the arc reads (and dodges)
  GLOB_LIFE: 3.5, // failsafe lifetime in seconds
  GLOB_DAMAGE: 1,
  MAX_GLOBS: 6, // pooled projectiles per level

  // --- Charger ---------------------------------------------------------------
  CHARGER_WIDTH: 1.3,
  CHARGER_HEIGHT: 1.0,
  CHARGER_PATROL_SPEED: 1.8,
  CHARGER_CHARGE_SPEED: 11,
  CHARGER_TRIGGER_RANGE: 9, // horizontal engage distance
  CHARGER_ROW_TOLERANCE: 1.2, // vertical band that counts as "same row"
  CHARGER_STUN_TIME: 1.4, // wall-impact stun — the safe stomp window

  // --- Pickups -------------------------------------------------------------
  EMBER_SIZE: 0.5,
  EMBER_VALUE: 1,

  // --- Moving platforms ----------------------------------------------------
  MOVER_SPEED: 2.5,

  // --- Loop ----------------------------------------------------------------
  MAX_DELTA: 1 / 30, // clamp dt so a stutter never tunnels the hero
  CORE_IGNITE_RADIUS: 2,
  EXIT_RADIUS: 2.2,

  // --- Juice / feedback ------------------------------------------------------
  SHAKE_STOMP: 0.3, // ScreenShake kick on a stomp kill
  SHAKE_HURT: 0.45, // kick when the hero takes damage
  SHAKE_DEATH: 0.6, // kick on hero death
  SHAKE_IGNITE: 0.6, // kick on core ignition / hulk severance
  SHAKE_WALLHIT: 0.2, // kick when a charger slams a wall nearby
  LAND_DUST_MIN_FALL: 6, // landing speed that kicks dust + the land cue
  SFX_FRAME_CAP: 4, // max one-shot cues per displayed frame
} as const;
