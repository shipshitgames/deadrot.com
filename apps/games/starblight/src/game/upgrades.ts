// Vampire-Survivors buildcraft for Starblight: 6 auto-firing pilot weapons and
// 7 passives drafted 1-of-3 on level-up and stacked into overpowered combos.
// Per-level stat arrays (index = level-1) keep the firing code table-driven,
// exactly like scourge-survivors' data/survivors.ts.

export type WeaponId = "seeker" | "phalanx" | "nova" | "lance" | "wake" | "wing";
export type PassiveId = "thrusters" | "hull" | "reactor" | "focusingcoils" | "scoop" | "focusing" | "siphon";
export type UpgradeId = WeaponId | PassiveId;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  desc: string;
  kind: "weapon";
  maxLevel: number;
  // per-level arrays (length === maxLevel); read with lv-1
  interval?: number[]; // seconds between activations
  damage: number[];
  count?: number[]; // projectiles / drones / mines / wingmates
  radius?: number[]; // nova / orbit / blast radius
  pierce?: number[];
  width?: number[]; // beam width
  length?: number[]; // beam length
  knockback?: number[];
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  desc: string;
  kind: "passive";
  max: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  seeker: {
    id: "seeker",
    name: "SEEKER BOLTS",
    icon: "➙",
    desc: "Hull autocannon flings homing plasma bolts at the nearest Scourge. Never misses.",
    kind: "weapon",
    maxLevel: 7,
    interval: [0.6, 0.52, 0.45, 0.38, 0.32, 0.28, 0.24],
    damage: [10, 12, 15, 19, 24, 30, 38],
    count: [1, 1, 2, 2, 2, 3, 3],
    pierce: [0, 0, 0, 0, 1, 1, 1],
  },
  phalanx: {
    id: "phalanx",
    name: "PHALANX DRONES",
    icon: "◎",
    desc: "Salvaged sentry drones orbit your hull and shred anything they touch — an always-on melee bubble.",
    kind: "weapon",
    maxLevel: 6,
    damage: [6, 8, 11, 15, 18, 24],
    count: [2, 3, 3, 4, 4, 5],
    radius: [4, 4.5, 5, 5, 5.5, 6],
  },
  nova: {
    id: "nova",
    name: "PYRE NOVA",
    icon: "✺",
    desc: "Vents the reactor in a hellfire shockwave that erupts from the hull — periodic panic-clear.",
    kind: "weapon",
    maxLevel: 5,
    interval: [3.2, 2.9, 2.6, 2.3, 2.0],
    damage: [14, 18, 24, 32, 42],
    radius: [7, 8.5, 10, 11.5, 13],
    knockback: [6, 7, 7.5, 8, 9],
  },
  lance: {
    id: "lance",
    name: "WARDEN LANCE",
    icon: "▮",
    desc: "A sustained orbital beam that locks onto the nearest threat and burns a line through it.",
    kind: "weapon",
    maxLevel: 5,
    damage: [22, 30, 40, 54, 70], // damage / second (continuous)
    length: [18, 22, 26, 30, 34],
    width: [1.2, 1.6, 2.0, 2.4, 3.0],
    count: [1, 1, 1, 1, 2], // L5 forks a second beam
  },
  wake: {
    id: "wake",
    name: "CINDER WAKE",
    icon: "◈",
    desc: "Drops drifting hellfire mines from your thrusters that detonate when the Scourge close in.",
    kind: "weapon",
    maxLevel: 5,
    interval: [1.1, 0.95, 0.8, 0.65, 0.5],
    damage: [20, 26, 34, 45, 60],
    count: [4, 6, 8, 10, 12], // max alive
    radius: [3, 3.5, 4, 4.5, 5], // blast radius
  },
  wing: {
    id: "wing",
    name: "WINGMATE FIGHTERS",
    icon: "≺",
    desc: "Autonomous Warden fighters fly your wing and strafe nearby Scourge with their own cannons.",
    kind: "weapon",
    maxLevel: 5,
    interval: [0.8, 0.65, 0.55, 0.5, 0.4],
    damage: [7, 9, 12, 16, 21],
    count: [1, 1, 2, 2, 3],
    pierce: [0, 0, 0, 0, 1],
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  thrusters: {
    id: "thrusters",
    name: "ION THRUSTERS",
    icon: "»",
    desc: "+12% flight speed & +15% acceleration. Outrun the swarm and kite forever.",
    kind: "passive",
    max: 5,
  },
  hull: {
    id: "hull",
    name: "REINFORCED HULL",
    icon: "▣",
    desc: "+25 max integrity (and full repair on pickup). The Warden frame holds.",
    kind: "passive",
    max: 5,
  },
  reactor: {
    id: "reactor",
    name: "OVERCLOCKED REACTOR",
    icon: "⚡",
    desc: "+18% fire rate across every weapon system.",
    kind: "passive",
    max: 5,
  },
  focusingcoils: {
    id: "focusingcoils",
    name: "FOCUSING COILS",
    icon: "✷",
    desc: "+25% weapon damage across all systems. Hellfire burns hotter.",
    kind: "passive",
    max: 5,
  },
  scoop: {
    id: "scoop",
    name: "SALVAGE SCOOP",
    icon: "⊹",
    desc: "+45% salvage magnet radius. Slurp gems from across the front.",
    kind: "passive",
    max: 5,
  },
  focusing: {
    id: "focusing",
    name: "PHASE FOCUSING",
    icon: "◇",
    desc: "+12% crit chance (2× damage) & +10% blast area. Burst the elites.",
    kind: "passive",
    max: 5,
  },
  siphon: {
    id: "siphon",
    name: "BIOMASS SIPHON",
    icon: "ℂ",
    desc: "+20% XP from every gem. Level faster, draft sooner.",
    kind: "passive",
    max: 5,
  },
};

export const ALL_UPGRADES: (WeaponDef | PassiveDef)[] = [...Object.values(WEAPONS), ...Object.values(PASSIVES)];

export function maxLevelOf(id: UpgradeId): number {
  const w = WEAPONS[id as WeaponId];
  if (w) return w.maxLevel;
  return PASSIVES[id as PassiveId].max;
}

export function defOf(id: UpgradeId): WeaponDef | PassiveDef {
  return (WEAPONS[id as WeaponId] as WeaponDef) ?? PASSIVES[id as PassiveId];
}

/** XP needed to go from `level` to `level+1`. Mirrors scourge-survivors. */
export function xpForLevel(level: number): number {
  return Math.floor(6 + level * 4 + level * level * 0.7);
}

// Derived combat stats folded from passive levels (recomputed on every draft).
export interface Stats {
  damageMul: number;
  fireRateMul: number;
  moveMul: number;
  accelMul: number;
  maxIntegrity: number;
  magnetRadius: number;
  critChance: number;
  areaMul: number;
  xpGainMul: number;
}

export function computeStats(levels: Map<UpgradeId, number>, baseMagnet: number, baseIntegrity: number): Stats {
  const lv = (id: PassiveId) => levels.get(id) ?? 0;
  return {
    damageMul: 1 + 0.25 * lv("focusingcoils"),
    fireRateMul: 1 + 0.18 * lv("reactor"),
    moveMul: 1 + 0.12 * lv("thrusters"),
    accelMul: 1 + 0.15 * lv("thrusters"),
    maxIntegrity: baseIntegrity + 25 * lv("hull"),
    magnetRadius: baseMagnet * (1 + 0.45 * lv("scoop")),
    critChance: 0.12 * lv("focusing"),
    areaMul: 1 + 0.1 * lv("focusing"),
    xpGainMul: 1 + 0.2 * lv("siphon"),
  };
}

/** Read a per-level array safely (clamps to last entry past its length). */
export function atLevel(arr: number[] | undefined, level: number, fallback = 0): number {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.min(level, arr.length) - 1];
}
