// Shared Scourge enemy archetypes. These are deliberately data-first so both
// structured runs and Survivors swarms can mix the same readable host variants.

export type EnemyArchetypeId = "grunt" | "swarmling" | "charger" | "shooter" | "flier" | "tank" | "splitter";
export type ScourgeThreatTier = "swarm" | "elite" | "breachBoss";

export const SCOURGE_THREAT_TIERS: Record<
  ScourgeThreatTier,
  {
    label: string;
    banner: string;
    summary: string;
  }
> = {
  swarm: {
    label: "Scourge Swarm",
    banner: "SCOURGE SWARM",
    summary: "fodder host-mass that wins through density",
  },
  elite: {
    label: "Scourge Elite",
    banner: "SCOURGE ELITE",
    summary: "mutated pressure spike inside a Survivors run",
  },
  breachBoss: {
    label: "Breach-Boss",
    banner: "BREACH-BOSS",
    summary: "breach-held war body with shield and frenzy states",
  },
};

export interface EnemyArchetypeDef {
  id: EnemyArchetypeId;
  name: string;
  loreTier: Extract<ScourgeThreatTier, "swarm">;
  speedMul: number;
  hpMul: number;
  scale: number;
  color: number;
  attackDamage: number;
  projectileDamage?: number;
  ranged?: boolean;
  flying?: boolean;
  hoverHeight?: number;
  xp: number;
  splitCount?: number;
  mass: number;
  staggerMul: number;
  spawnAfter: number;
  earlyWeight: number;
  lateWeight: number;
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeDef> = {
  grunt: {
    id: "grunt",
    name: "Swarm Ripper",
    loreTier: "swarm",
    speedMul: 1,
    hpMul: 1,
    scale: 1,
    color: 0xff5a3c,
    attackDamage: 7,
    xp: 2,
    mass: 1,
    staggerMul: 1,
    spawnAfter: 0,
    earlyWeight: 1,
    lateWeight: 0.78,
  },
  swarmling: {
    id: "swarmling",
    name: "Feral Swarmling",
    loreTier: "swarm",
    speedMul: 1.48,
    hpMul: 0.48,
    scale: 0.8,
    color: 0x8bdc1f,
    attackDamage: 5,
    xp: 1,
    mass: 0.72,
    staggerMul: 1.25,
    spawnAfter: 10,
    earlyWeight: 0.22,
    lateWeight: 0.34,
  },
  charger: {
    id: "charger",
    name: "Chitin Charger",
    loreTier: "swarm",
    speedMul: 1.08,
    hpMul: 1.25,
    scale: 1.08,
    color: 0xff8a3c,
    attackDamage: 10,
    xp: 3,
    mass: 1.25,
    staggerMul: 0.82,
    spawnAfter: 22,
    earlyWeight: 0.12,
    lateWeight: 0.24,
  },
  shooter: {
    id: "shooter",
    name: "Swarm Spitter",
    loreTier: "swarm",
    speedMul: 0.92,
    hpMul: 0.95,
    scale: 1,
    color: 0x35e0ff,
    attackDamage: 6,
    projectileDamage: 7,
    ranged: true,
    xp: 3,
    mass: 1,
    staggerMul: 1,
    spawnAfter: 28,
    earlyWeight: 0.1,
    lateWeight: 0.26,
  },
  flier: {
    id: "flier",
    name: "Quaver Host",
    loreTier: "swarm",
    speedMul: 1.18,
    hpMul: 0.82,
    scale: 0.96,
    color: 0x7edc1f,
    attackDamage: 5,
    projectileDamage: 6,
    ranged: true,
    flying: true,
    hoverHeight: 2.05,
    xp: 4,
    mass: 0.82,
    staggerMul: 1.32,
    spawnAfter: 38,
    earlyWeight: 0.08,
    lateWeight: 0.2,
  },
  tank: {
    id: "tank",
    name: "Bone-Hulk Swarm",
    loreTier: "swarm",
    speedMul: 0.56,
    hpMul: 3.1,
    scale: 1.48,
    color: 0x9c2a3a,
    attackDamage: 14,
    xp: 6,
    mass: 3.2,
    staggerMul: 0.42,
    spawnAfter: 44,
    earlyWeight: 0.03,
    lateWeight: 0.17,
  },
  splitter: {
    id: "splitter",
    name: "Brood Splitter",
    loreTier: "swarm",
    speedMul: 0.82,
    hpMul: 1.65,
    scale: 1.22,
    color: 0xb95cff,
    attackDamage: 9,
    xp: 4,
    splitCount: 2,
    mass: 1.45,
    staggerMul: 0.75,
    spawnAfter: 62,
    earlyWeight: 0,
    lateWeight: 0.14,
  },
};

export const SURVIVORS_ARCHETYPE_IDS: EnemyArchetypeId[] = [
  "grunt",
  "swarmling",
  "charger",
  "shooter",
  "flier",
  "tank",
  "splitter",
];

export function pickWeightedEnemyArchetype(runTime: number, chapterIndex = 0): EnemyArchetypeDef {
  // Divisor renormalized for the 600s reaper timeline (#278): the mix matures
  // near run end just like before — (600-20)/535 ≈ 1.08 vs old (270-20)/230 ≈ 1.09.
  const maturity = Math.max(0, Math.min(1, (runTime - 20) / 535 + chapterIndex * 0.08));
  let total = 0;
  const weighted: { def: EnemyArchetypeDef; weight: number }[] = [];
  for (const id of SURVIVORS_ARCHETYPE_IDS) {
    const def = ENEMY_ARCHETYPES[id];
    if (runTime < def.spawnAfter) continue;
    const weight = def.earlyWeight * (1 - maturity) + def.lateWeight * maturity;
    if (weight <= 0) continue;
    weighted.push({ def, weight });
    total += weight;
  }
  if (total <= 0) return ENEMY_ARCHETYPES.grunt;
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.def;
  }
  return weighted[weighted.length - 1]?.def ?? ENEMY_ARCHETYPES.grunt;
}

export function campaignArchetypeForWave(waveIndex: number, spawnIndex: number, stageIndex: number): EnemyArchetypeDef {
  const cadence = (spawnIndex + waveIndex * 2 + stageIndex) % 8;
  if (waveIndex >= 2 && cadence === 0) return ENEMY_ARCHETYPES.tank;
  if (waveIndex >= 1 && cadence === 2) return ENEMY_ARCHETYPES.charger;
  if (waveIndex >= 1 && cadence === 3) return ENEMY_ARCHETYPES.flier;
  if (cadence === 4 || cadence === 5) return ENEMY_ARCHETYPES.shooter;
  if (waveIndex >= 2 && cadence === 6) return ENEMY_ARCHETYPES.splitter;
  return cadence === 7 ? ENEMY_ARCHETYPES.swarmling : ENEMY_ARCHETYPES.grunt;
}
