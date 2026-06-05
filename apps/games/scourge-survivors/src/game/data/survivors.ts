// Vampire-Survivors-style "Survivors" mode: endless swarms, XP/levels, and a
// level-up draft where the player picks 1 of 3 upgrades to stack into combos.

import type { PixelIconId } from '../../assets/ui/pixelIcons'
import type { BuildEntry, UpgradeChoice } from '../types'
import type { WeaponId } from '../constants'

export {
  ENEMY_ARCHETYPES as SURV_ARCHETYPES,
  type EnemyArchetypeDef as SurvArchetype,
  type EnemyArchetypeId as SurvArchetypeId,
} from './enemies'

export type UpgradeId =
  | 'dmg'
  | 'rate'
  | 'speed'
  | 'maxhp'
  | 'regen'
  | 'armor'
  | 'ward'
  | 'spikes'
  | 'bloodtap'
  | 'bastion'
  | 'dodge'
  | 'grace'
  | 'magnet'
  | 'multishot'
  | 'crit'
  | 'xpgain'
  | 'amp'
  | 'orbit'
  | 'bolt'
  | 'nova'

/** The auto-weapons that can evolve at max level. */
export type WeaponUpgradeId = 'orbit' | 'bolt' | 'nova'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  desc: string
  icon: PixelIconId
  max: number
  kind: 'passive' | 'weapon'
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'orbit', name: 'Orbiting Blades', desc: '+1 spinning blade that shreds nearby foes', icon: 'orbit', max: 6, kind: 'weapon' },
  { id: 'bolt', name: 'Seeker Bolts', desc: 'Auto-fires homing bolts at the nearest enemy', icon: 'bolt', max: 6, kind: 'weapon' },
  { id: 'nova', name: 'Nova Pulse', desc: 'Periodic shockwave damaging everything around you', icon: 'nova', max: 6, kind: 'weapon' },
  { id: 'dmg', name: 'Heavy Rounds', desc: '+25% damage (all sources)', icon: 'fire', max: 5, kind: 'passive' },
  { id: 'amp', name: 'Overcharge', desc: '+22% damage to your auto-weapons (blades / bolts / nova)', icon: 'battery', max: 5, kind: 'passive' },
  { id: 'rate', name: 'Rapid Fire', desc: '+18% fire rate', icon: 'lightning', max: 5, kind: 'passive' },
  { id: 'multishot', name: 'Split Shot', desc: '+1 projectile on your gun AND auto-weapons', icon: 'trident', max: 3, kind: 'passive' },
  { id: 'crit', name: 'Deadeye', desc: '+12% critical hit chance (2× damage)', icon: 'target', max: 4, kind: 'passive' },
  { id: 'speed', name: 'Adrenaline', desc: '+12% move speed', icon: 'boot', max: 4, kind: 'passive' },
  { id: 'maxhp', name: 'Vitality', desc: '+30 max health (and heal)', icon: 'heart', max: 5, kind: 'passive' },
  { id: 'regen', name: 'Regeneration', desc: '+2 HP / second', icon: 'medic-cross', max: 4, kind: 'passive' },
  { id: 'armor', name: 'Bone Plating', desc: '-10% incoming damage from every hit', icon: 'armor', max: 5, kind: 'passive' },
  { id: 'ward', name: 'Warden Aegis', desc: '+24 regenerating shield before health takes damage', icon: 'shield', max: 4, kind: 'passive' },
  { id: 'spikes', name: 'Retribution Mesh', desc: 'Taking damage lashes nearby foes with bone-shard counterfire', icon: 'spikes', max: 4, kind: 'passive' },
  { id: 'bloodtap', name: 'Blood Tap', desc: 'Heal a small amount from every kill', icon: 'bloodtap', max: 4, kind: 'passive' },
  { id: 'bastion', name: 'Bastion Protocol', desc: 'Low-health hits trigger a defensive blast around you', icon: 'bastion', max: 3, kind: 'passive' },
  { id: 'dodge', name: 'Ghost Step', desc: '+8% chance to evade incoming hits entirely', icon: 'dodge', max: 4, kind: 'passive' },
  { id: 'grace', name: 'Ire Frames', desc: 'After health damage, gain longer post-hit invulnerability', icon: 'grace', max: 3, kind: 'passive' },
  { id: 'magnet', name: 'Magnet', desc: '+45% XP pickup radius', icon: 'magnet', max: 4, kind: 'passive' },
  { id: 'xpgain', name: 'Fast Learner', desc: '+20% XP gained', icon: 'chart', max: 4, kind: 'passive' },
]

export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>

/**
 * Weapon EVOLUTIONS (the Vampire-Survivors climax): max a weapon AND its paired
 * passive, then draft a golden card to transform it — changing how it PLAYS, not
 * just its numbers.
 */
export interface EvolutionDef {
  weapon: WeaponUpgradeId
  passive: UpgradeId // the passive that must be maxed to unlock the evolution
  name: string
  desc: string
  icon: PixelIconId
}

export const EVOLUTIONS: Record<WeaponUpgradeId, EvolutionDef> = {
  orbit: { weapon: 'orbit', passive: 'dmg', name: 'CYCLONE', desc: 'Blades become a roaring ring — bigger, faster, far deadlier', icon: 'orbit' },
  bolt: { weapon: 'bolt', passive: 'crit', name: 'HAILSTORM', desc: 'A relentless storm of bolts that punch clean through the swarm', icon: 'bolt' },
  nova: { weapon: 'nova', passive: 'rate', name: 'SUPERNOVA', desc: 'Nova erupts twice as often with a vast second shockwave', icon: 'nova' },
}

export const WEAPON_UPGRADE_IDS: WeaponUpgradeId[] = ['orbit', 'bolt', 'nova']

export function availableEvolutionChoice(
  upgradeLevels: Partial<Record<UpgradeId, number>>,
  evolved: Partial<Record<WeaponUpgradeId, boolean>>,
): UpgradeChoice | null {
  for (const w of WEAPON_UPGRADE_IDS) {
    const evo = EVOLUTIONS[w]
    const weaponMaxed = (upgradeLevels[w] ?? 0) >= UPGRADE_BY_ID[w].max
    const passiveMaxed = (upgradeLevels[evo.passive] ?? 0) >= UPGRADE_BY_ID[evo.passive].max
    if (evolved[w] !== true && weaponMaxed && passiveMaxed) {
      return { id: `evo-${w}`, name: evo.name, desc: evo.desc, icon: evo.icon, level: 0, max: 1, golden: true }
    }
  }
  return null
}

export function survivorBuildList(
  upgradeLevels: Partial<Record<UpgradeId, number>>,
  evolved: Partial<Record<WeaponUpgradeId, boolean>>,
): BuildEntry[] {
  const out: BuildEntry[] = []
  for (const u of UPGRADES) {
    const level = upgradeLevels[u.id] ?? 0
    if (level <= 0) continue
    const weaponId = WEAPON_UPGRADE_IDS.includes(u.id as WeaponUpgradeId) ? (u.id as WeaponUpgradeId) : null
    const isEvolved = weaponId ? evolved[weaponId] === true : false
    out.push({
      id: u.id,
      name: isEvolved && weaponId ? EVOLUTIONS[weaponId].name : u.name,
      icon: u.icon,
      level,
      max: u.max,
      evolved: isEvolved,
    })
  }
  return out
}

// ---- Survivor classes -------------------------------------------------------
export type SurvivorClassId = 'ranger' | 'heavy' | 'scout' | 'medic'

export interface SurvivorClassDef {
  id: SurvivorClassId
  name: string
  role: string
  desc: string
  icon: PixelIconId
  startingWeapon: WeaponId
  startingUpgrades?: Partial<Record<UpgradeId, number>>
  damageMul?: number
  fireRateMul?: number
  moveMul?: number
  maxHpBonus?: number
  regen?: number
  magnetMul?: number
  xpMul?: number
  crit?: number
  armor?: number
  shieldMax?: number
  shieldRegen?: number
  retaliate?: number
  killHeal?: number
}

export const SURVIVOR_CLASSES: Record<SurvivorClassId, SurvivorClassDef> = {
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    role: 'Balanced Pyre-operator',
    desc: 'Starts with a reliable sidearm and an early Seeker Bolt path.',
    icon: 'target',
    startingWeapon: 'pistol',
    startingUpgrades: { bolt: 1 },
    damageMul: 1.08,
    fireRateMul: 1.06,
  },
  heavy: {
    id: 'heavy',
    name: 'Bulwark',
    role: 'Defensible breach anchor',
    desc: 'Slower, tougher, and starts with a shotgun plus Orbiting Blades.',
    icon: 'shield',
    startingWeapon: 'shotgun',
    startingUpgrades: { orbit: 1, armor: 1 },
    moveMul: 0.9,
    maxHpBonus: 45,
    armor: 0.12,
    retaliate: 8,
  },
  scout: {
    id: 'scout',
    name: 'Vector',
    role: 'Fast looter / crit skirmisher',
    desc: 'Starts with an SMG, lower health, higher speed, wider pickup reach, better crits.',
    icon: 'dodge',
    startingWeapon: 'smg',
    startingUpgrades: { speed: 1 },
    moveMul: 1.2,
    maxHpBonus: -15,
    magnetMul: 1.2,
    crit: 0.08,
  },
  medic: {
    id: 'medic',
    name: 'Patch',
    role: 'Support marksman rig',
    desc: 'Starts with a scoped sniper, regenerates, starts shielded, and bleeds healing from kills.',
    icon: 'medic-cross',
    startingWeapon: 'sniper',
    startingUpgrades: { regen: 1, ward: 1 },
    maxHpBonus: 10,
    regen: 0.8,
    shieldMax: 24,
    shieldRegen: 1.2,
    killHeal: 0.5,
  },
}

export const SURVIVOR_CLASS_IDS: SurvivorClassId[] = ['ranger', 'heavy', 'scout', 'medic']

// ---- Structured run: a canonical breach descent for Survivors ----------------
export interface SurvivorRunChapter {
  mapId: string
  name: string
  subtitle: string
  duration: number
  spawnMul: number
  hpMul: number
  speedMul: number
  capMul: number
  eliteInterval: number
  swellInterval: number
}

export const SURVIVOR_RUN_CHAPTERS: SurvivorRunChapter[] = [
  {
    mapId: 'ashgate',
    name: 'Ashgate Drop',
    subtitle: 'Hold the foundry wall while the breach wakes.',
    duration: 60,
    spawnMul: 1.15,
    hpMul: 1,
    speedMul: 1,
    capMul: 1.08,
    eliteInterval: 24,
    swellInterval: 36,
  },
  {
    mapId: 'hollowlanes',
    name: 'Hollow Lanes',
    subtitle: 'Thread the dead corridors as the swarm starts folding in.',
    duration: 65,
    spawnMul: 1.35,
    hpMul: 1.12,
    speedMul: 1.06,
    capMul: 1.2,
    eliteInterval: 22,
    swellInterval: 34,
  },
  {
    mapId: 'maw',
    name: 'The Maw',
    subtitle: 'Fight across the breach throat under Scourge glow.',
    duration: 70,
    spawnMul: 1.55,
    hpMul: 1.32,
    speedMul: 1.12,
    capMul: 1.36,
    eliteInterval: 20,
    swellInterval: 32,
  },
  {
    mapId: 'perdition',
    name: 'Perdition',
    subtitle: 'Seal the source before the host-mass swallows the arena.',
    duration: 75,
    spawnMul: 1.8,
    hpMul: 1.58,
    speedMul: 1.2,
    capMul: 1.55,
    eliteInterval: 18,
    swellInterval: 30,
  },
]

export const SURVIVOR_RUN_GOAL_TIME = SURVIVOR_RUN_CHAPTERS.reduce((sum, chapter) => sum + chapter.duration, 0)

export function survivorChapterStart(index: number): number {
  let start = 0
  for (let i = 0; i < index; i++) start += SURVIVOR_RUN_CHAPTERS[i]?.duration ?? 0
  return start
}

export function survivorChapterAt(time: number): number {
  let cursor = 0
  for (let i = 0; i < SURVIVOR_RUN_CHAPTERS.length; i++) {
    cursor += SURVIVOR_RUN_CHAPTERS[i].duration
    if (time < cursor) return i
  }
  return SURVIVOR_RUN_CHAPTERS.length - 1
}

// ---- Build-agency tunables --------------------------------------------------
export const REROLLS_PER_LEVEL = 2 // free re-rolls offered on each level-up draft
export const BANISHES_PER_RUN = 3 // permanently remove this many upgrades from a run's pool
export const AMP_PER_TIER = 0.22 // 'amp' passive: +22% auto-weapon damage per level

/** XP needed to go from `level` to `level+1`. Smooth ramp. */
export function xpForLevel(level: number): number {
  return Math.floor(4 + level * 2.4 + level * level * 0.45)
}

// ---- Survivors tunables -----------------------------------------------------
export const SURV_BASE_MAGNET = 4.4
export const SURV_SPAWN_CAP = 60
export const SURV_SPAWN_START = 0.82 // seconds between spawns at t=0
export const SURV_SPAWN_MIN = 0.18 // fastest spawn interval
export const SURV_ELITE_INTERVAL = 22 // seconds between elite spawns
export const SURV_ENEMY_BASE_HP = 28
export const SURV_XP_GEM_VALUE = 2
export const SURV_XP_ELITE_VALUE = 24 // elites ("bosses") are a big XP payout

// Auto-weapon tuning (indexed loosely by level)
export const ORBIT_RADIUS = 2.6
export const ORBIT_SPEED = 2.4 // rad/s
export const ORBIT_HIT_RADIUS = 1.0
export const ORBIT_DMG = 22 // per hit
export const ORBIT_HIT_CD = 0.35 // per-enemy cooldown

export const BOLT_DMG = 26
export const BOLT_SPEED = 26
export const BOLT_TTL = 1.6

export const NOVA_DMG = 34
export const NOVA_RADIUS = 6.5
export const NOVA_INTERVAL = 3.2

// ---- Threat rhythm: periodic horde "swells" + telegraphed elites ------------
export const SURV_SWELL_INTERVAL = 34 // seconds between breach surges
export const SURV_SWELL_COUNT = 18 // mobs burst-spawned in a surge
export const SURV_SWELL_CAP = 88 // temporary alive cap during a surge

// ---- Shop: permanent meta-upgrades bought with gold between runs ----
export type ShopId =
  | 'might'
  | 'vigor'
  | 'swift'
  | 'regenP'
  | 'magnetP'
  | 'scholar'
  | 'greed'
  | 'arsenal'
  | 'munitions'
  | 'pulsar'

export interface ShopDef {
  id: ShopId
  name: string
  desc: string
  icon: PixelIconId
  max: number
  baseCost: number
}

export const SHOP_UPGRADES: ShopDef[] = [
  { id: 'might', name: 'Might', desc: '+8% base damage (all sources)', icon: 'fire', max: 5, baseCost: 35 },
  { id: 'vigor', name: 'Vigor', desc: '+18 starting max health', icon: 'heart', max: 5, baseCost: 35 },
  { id: 'swift', name: 'Swift', desc: '+6% base move speed', icon: 'boot', max: 4, baseCost: 45 },
  { id: 'regenP', name: 'Recovery', desc: '+0.8 base HP regen / second', icon: 'medic-cross', max: 4, baseCost: 40 },
  { id: 'magnetP', name: 'Lodestone', desc: '+24% base pickup radius', icon: 'magnet', max: 4, baseCost: 30 },
  { id: 'scholar', name: 'Scholar', desc: '+12% XP gained', icon: 'chart', max: 4, baseCost: 40 },
  { id: 'greed', name: 'Greed', desc: '+18% gold earned per run', icon: 'gold', max: 4, baseCost: 50 },
  // --- Starting weapons: buy these to begin a run already armed (build variety) ---
  { id: 'arsenal', name: 'Arsenal', desc: 'Start every run with Orbiting Blades Lv1', icon: 'orbit', max: 1, baseCost: 95 },
  { id: 'munitions', name: 'Munitions', desc: 'Start every run with Seeker Bolts Lv1', icon: 'bolt', max: 1, baseCost: 95 },
  { id: 'pulsar', name: 'Pulsar', desc: 'Start every run with Nova Pulse Lv1', icon: 'nova', max: 1, baseCost: 110 },
]

export const SHOP_BY_ID: Record<ShopId, ShopDef> = Object.fromEntries(SHOP_UPGRADES.map((s) => [s.id, s])) as Record<
  ShopId,
  ShopDef
>

/** Cost to buy the next tier (current tier -> tier+1). */
export function shopCost(def: ShopDef, tier: number): number {
  return Math.round(def.baseCost * (1 + tier * 0.55))
}

/** Gold awarded for a finished Survivors run. */
export function runGold(kills: number, level: number, time: number, greedTier: number): number {
  const base = kills * 3.5 + level * 14 + time * 1.35
  return Math.floor(base * (1 + 0.18 * greedTier))
}
