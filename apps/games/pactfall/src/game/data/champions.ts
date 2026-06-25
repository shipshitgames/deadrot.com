import { COLORS, CONSTANTS, type Team } from "../constants";

export type ChampionId = "pyre-duelist" | "pyre-cauterizer" | "warden-bastion" | "warden-artillerist";
export type ChampionFaction = "Pyre" | "Wardens";
export type AbilityKey = "q" | "w" | "e";

export const ABILITY_KEYS: readonly AbilityKey[] = ["q", "w", "e"] as const;

export interface ChampionStats {
  maxHp: number;
  moveSpeed: number;
  radius: number;
  height: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  respawnDelay: number;
  maxMana: number;
  manaRegen: number;
  lowHpFraction: number;
}

export interface LineAbilityDef {
  name: string;
  damage: number;
  range: number;
  width: number;
  cooldown: number;
  manaCost: number;
}

export interface ZoneAbilityDef {
  name: string;
  radius: number;
  castRange: number;
  duration: number;
  slowFactor: number;
  tickDamage: number;
  tickInterval: number;
  slowLinger: number;
  cooldown: number;
  manaCost: number;
}

export interface DashAbilityDef {
  name: string;
  distance: number;
  cooldown: number;
  manaCost: number;
}

export interface ChampionAbilityKit {
  q: LineAbilityDef;
  w: ZoneAbilityDef;
  e: DashAbilityDef;
}

export interface ChampionVisualDef {
  bodyColor: number;
  bodyEmissive: number;
  crestColor: number;
  emissiveIntensity: number;
  metalness: number;
  scale: number;
}

export interface ChampionDef {
  id: ChampionId;
  name: string;
  faction: ChampionFaction;
  team: Team;
  role: string;
  silhouette: string;
  resourceModel: string;
  basicAttack: string;
  stats: ChampionStats;
  abilities: ChampionAbilityKit;
  progressionHooks: string[];
  visual: ChampionVisualDef;
}

const BASE_STATS: ChampionStats = {
  maxHp: CONSTANTS.champion.maxHp,
  moveSpeed: CONSTANTS.champion.moveSpeed,
  radius: CONSTANTS.champion.radius,
  height: CONSTANTS.champion.height,
  attackRange: CONSTANTS.champion.attackRange,
  attackDamage: CONSTANTS.champion.attackDamage,
  attackCooldown: CONSTANTS.champion.attackCooldown,
  respawnDelay: CONSTANTS.champion.respawnDelay,
  maxMana: CONSTANTS.champion.maxMana,
  manaRegen: CONSTANTS.champion.manaRegen,
  lowHpFraction: CONSTANTS.champion.lowHpFraction,
};

const BASE_ABILITIES: ChampionAbilityKit = {
  q: { ...CONSTANTS.abilities.q },
  w: { ...CONSTANTS.abilities.w },
  e: { ...CONSTANTS.abilities.e },
};

export const CHAMPIONS: Record<ChampionId, ChampionDef> = {
  "pyre-duelist": {
    id: "pyre-duelist",
    name: "Pyre Duelist",
    faction: "Pyre",
    team: "pyre",
    role: "Melee carry / skirmisher",
    silhouette: "Fast triangular Pyre silhouette with ember-blade pressure.",
    resourceModel: "Mana fighter: spends burst windows to win short trades.",
    basicAttack: "Quick hellfire blade-beam that rewards staying in kill range.",
    stats: BASE_STATS,
    abilities: BASE_ABILITIES,
    progressionHooks: ["attack-speed talents", "burn executes", "dash resets"],
    visual: {
      bodyColor: COLORS.bone,
      bodyEmissive: COLORS.blood,
      crestColor: COLORS.hellfire,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      scale: 1,
    },
  },
  "pyre-cauterizer": {
    id: "pyre-cauterizer",
    name: "Pyre Cauterizer",
    faction: "Pyre",
    team: "pyre",
    role: "Area-control burner",
    silhouette: "Masked furnace rig with tank-and-hose geometry.",
    resourceModel: "Heat mana: lower mobility, higher zone pressure.",
    basicAttack: "Short furnace burst that hits harder but reaches less far.",
    stats: {
      ...BASE_STATS,
      maxHp: 240,
      moveSpeed: 8.1,
      attackRange: 7.2,
      attackDamage: 28,
      attackCooldown: 0.7,
      maxMana: 115,
      manaRegen: 6.2,
    },
    abilities: {
      q: { ...BASE_ABILITIES.q, name: "Furnace Jet", damage: 68, range: 13.5, width: 2.1, cooldown: 5.5, manaCost: 24 },
      w: {
        ...BASE_ABILITIES.w,
        name: "Cautery Ground",
        radius: 4.2,
        duration: 3.2,
        tickDamage: 11,
        cooldown: 11,
        manaCost: 38,
      },
      e: { ...BASE_ABILITIES.e, name: "Pressure Step", distance: 5.2, cooldown: 8.5, manaCost: 18 },
    },
    progressionHooks: ["longer burn fields", "armor melt", "Scourge objective scorch"],
    visual: {
      bodyColor: COLORS.gunmetal,
      bodyEmissive: COLORS.hellfire,
      crestColor: COLORS.bloodHot,
      emissiveIntensity: 0.75,
      metalness: 0.45,
      scale: 1.08,
    },
  },
  "warden-bastion": {
    id: "warden-bastion",
    name: "Warden Bastion",
    faction: "Wardens",
    team: "warden",
    role: "Tank / support anchor",
    silhouette: "Square slab Warden silhouette with shield projector hardware.",
    resourceModel: "Command mana: slower regeneration but a larger pool.",
    basicAttack: "Disciplined shield-rifle burst that trades cadence for durability.",
    stats: {
      ...BASE_STATS,
      maxHp: 285,
      moveSpeed: 7.1,
      attackRange: 8,
      attackDamage: 20,
      attackCooldown: 0.78,
      maxMana: 120,
      manaRegen: 5.5,
      lowHpFraction: 0.3,
    },
    abilities: {
      q: { ...BASE_ABILITIES.q, name: "Brace Lance", damage: 58, range: 14, width: 2.2, cooldown: 7.2, manaCost: 28 },
      w: {
        ...BASE_ABILITIES.w,
        name: "Holdfast Field",
        radius: 4,
        duration: 3,
        slowFactor: 0.52,
        tickDamage: 6,
        cooldown: 12,
        manaCost: 34,
      },
      e: { ...BASE_ABILITIES.e, name: "Bulwark Step", distance: 4.5, cooldown: 9, manaCost: 18 },
    },
    progressionHooks: ["shield aura", "tower repair pulse", "frontline mitigation"],
    visual: {
      bodyColor: COLORS.gunmetal,
      bodyEmissive: COLORS.bloodHot,
      crestColor: COLORS.bloodHot,
      emissiveIntensity: 0.5,
      metalness: 0.6,
      scale: 1.14,
    },
  },
  "warden-artillerist": {
    id: "warden-artillerist",
    name: "Warden Artillerist",
    faction: "Wardens",
    team: "warden",
    role: "Ranged siege carry",
    silhouette: "Braced Warden launcher rig with rangefinder lamps.",
    resourceModel: "Command mana: medium pool, high long-range cost.",
    basicAttack: "Long-range launcher shot with slower cadence and strong reach.",
    stats: {
      ...BASE_STATS,
      maxHp: 205,
      moveSpeed: 8,
      attackRange: 12,
      attackDamage: 24,
      attackCooldown: 0.82,
      maxMana: 105,
      manaRegen: 6.4,
    },
    abilities: {
      q: {
        ...BASE_ABILITIES.q,
        name: "Rangefinder Shell",
        damage: 82,
        range: 18,
        width: 1.3,
        cooldown: 7.5,
        manaCost: 32,
      },
      w: {
        ...BASE_ABILITIES.w,
        name: "Marked Ground",
        radius: 3.2,
        castRange: 10,
        duration: 2.2,
        tickDamage: 8,
        cooldown: 10.5,
        manaCost: 30,
      },
      e: { ...BASE_ABILITIES.e, name: "Reposition Brace", distance: 5.8, cooldown: 8, manaCost: 16 },
    },
    progressionHooks: ["siege range", "tower breaker rounds", "lane artillery talents"],
    visual: {
      bodyColor: COLORS.iron,
      bodyEmissive: COLORS.bloodHot,
      crestColor: COLORS.bone,
      emissiveIntensity: 0.45,
      metalness: 0.65,
      scale: 1.02,
    },
  },
};

export const CHAMPION_IDS = Object.keys(CHAMPIONS) as ChampionId[];
export const DEFAULT_PLAYER_CHAMPION_ID: ChampionId = "pyre-duelist";
export const DEFAULT_ENEMY_CHAMPION_ID: ChampionId = "warden-bastion";

export function championById(id?: string | null): ChampionDef {
  return CHAMPIONS[id as ChampionId] ?? CHAMPIONS[DEFAULT_PLAYER_CHAMPION_ID];
}

export function defaultChampionForTeam(team: Team): ChampionDef {
  return team === "pyre" ? CHAMPIONS[DEFAULT_PLAYER_CHAMPION_ID] : CHAMPIONS[DEFAULT_ENEMY_CHAMPION_ID];
}

export function championsForTeam(team: Team): ChampionDef[] {
  return CHAMPION_IDS.map((id) => CHAMPIONS[id]).filter((champion) => champion.team === team);
}
