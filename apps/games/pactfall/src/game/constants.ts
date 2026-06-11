// Canon location: see apps/lore/content/Locations/Ashgate.md and apps/lore/content/Maps.md (cross-game map registry).
// Data-driven tunables. Everything the designer might want to tweak lives here
// so the systems stay declarative. Colors mirror apps/lore/content/DESIGN.md.

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

export type Team = "pyre" | "warden";

export const CONSTANTS = {
  // Loop
  maxDelta: 1 / 30, // clamp the delta so a tab-out doesn't teleport entities

  // Arena (a single lane running along +Z, centered on the origin)
  // Canon: the sanctioned Pyre–Warden duels happen in Ashgate's arena district.
  arena: {
    name: "Ashgate Arena District",
    loreId: "ashgate",
    front: "holdout",
    length: 64, // along Z
    width: 14, // along X
    laneClamp: 6, // how far off-center the champion can stray (|x|)
  },

  // Champion (the player)
  champion: {
    maxHp: 220,
    moveSpeed: 9, // units / sec
    moveAccel: 80,
    moveDamping: 13,
    moveBrakeDamping: 20,
    moveStartBoostTime: 0.12,
    moveStartBoostMultiplier: 0.18,
    moveStopEpsilon: 0.05,
    radius: 0.8,
    height: 2.2,
    attackRange: 9,
    attackDamage: 22,
    attackCooldown: 0.55, // seconds between auto-attacks
    respawnZ: -16, // spawn out in the lane, ahead of the friendly base (which stays behind the camera)
    respawnDelay: 5, // seconds a slain champion stays down before redeploying
    retreatZ: -20, // how far back toward the base the player may walk (keeps the base behind the cam)
    maxMana: 100,
    manaRegen: 7, // mana / sec while alive
    lowHpFraction: 0.25, // below this HP fraction the low-health heartbeat + vignette kick in
  },

  // Q/W/E abilities — every cost, cooldown, and damage knob lives here so the
  // ability system stays declarative. Tuned so abilities clearly out-damage
  // autos (22/hit) but are aimable / dodge-able.
  abilities: {
    q: {
      name: "Cinder Lance",
      damage: 75, // ~3.4 autos in one skillshot
      range: 16, // longer than auto range so landing it feels like a pick
      width: 1.6, // total corridor width (forgiveness on each side)
      cooldown: 6,
      manaCost: 25,
    },
    w: {
      name: "Pact Brand",
      radius: 3.5,
      castRange: 8, // max distance from the champion the brand can be placed
      duration: 2.5,
      slowFactor: 0.6, // enemies in the zone move at 60% speed (~40% slow)
      tickDamage: 9, // light damage per tick (5 ticks ≈ 45 total)
      tickInterval: 0.5,
      slowLinger: 0.2, // seconds the slow persists after leaving the zone
      cooldown: 10,
      manaCost: 35,
    },
    e: {
      name: "Vault",
      distance: 7, // dash length toward move direction / cursor
      cooldown: 7,
      manaCost: 15,
    },
  },

  // Warden champion AI: a simple, deterministic caster — Q on cooldown when the
  // player is in range, telegraphed so the shot can be side-stepped.
  ai: {
    qWindup: 0.55, // seconds the aim line shows before the locked shot fires
    qRangeFactor: 0.85, // cast once the player is inside q.range * factor
  },

  // Juice/feedback tunables (presentation only — never touches the sim).
  feedback: {
    hurtSfxCooldown: 0.25, // throttle the hurt cue so minion chip isn't a siren
    heartbeatInterval: 1.1, // seconds between low-health heartbeats
    maxHitSfxPerFrame: 4,
    maxKillSfxPerFrame: 3,
    shake: {
      championKill: 0.5,
      playerHit: 0.16,
      playerDeath: 0.7,
    },
  },

  // Minions (the steady lane trickle)
  minion: {
    maxHp: 60,
    moveSpeed: 3.4,
    radius: 0.55,
    attackRange: 2.2,
    attackDamage: 8,
    attackCooldown: 0.9,
    baseDamage: 6, // chip damage when a minion reaches the enemy base
    spawnInterval: 2.6, // seconds between spawns per side
    waveSize: 1,
    bounty: 12, // (reserved) gold/score per kill
  },

  // Neutral Scourge blob at center
  scourge: {
    maxHp: 320,
    radius: 2.4,
    respawn: 22, // seconds to respawn after it is slain
    buffDuration: 14, // seconds the damage buff lasts
    buffMultiplier: 1.8, // champion damage multiplier while buffed
  },

  // Bases (the win/lose objectives)
  base: {
    maxHp: 1000,
    radius: 2.6,
    height: 6,
    friendlyZ: -30, // Pyre base (yours)
    enemyZ: 30, // Warden base (theirs)
    // A base only takes champion fire once the lane is "pushed" near it.
    championRange: 7,
  },
} as const;

// Z-direction each team marches: Pyre pushes toward +Z, Wardens toward -Z.
export const MARCH_DIR: Record<Team, number> = {
  pyre: 1,
  warden: -1,
};
