import pyreDuelistUrl from "@shipshitgames/assets/entities/pyre-duelist/pactfall.webp";
import scourgeEliteUrl from "@shipshitgames/assets/entities/scourge-elite/pactfall.webp";
import trucebreakerUrl from "@shipshitgames/assets/entities/trucebreaker/pactfall.webp";
import wardenBastionUrl from "@shipshitgames/assets/entities/warden-bastion/pactfall.webp";

export type FighterId = "pyre-duelist" | "warden-bastion" | "scourge-render" | "trucebreaker";

export interface FighterSpec {
  id: FighterId;
  name: string;
  faction: "Pyre" | "Wardens" | "Scourge";
  role: string;
  spriteUrl: string;
  tint: string;
  maxHealth: number;
  speed: number;
  jump: number;
  scale: number;
  lightDamage: number;
  heavyDamage: number;
  specialDamage: number;
}

export const DEFAULT_PLAYER_ID: FighterId = "pyre-duelist";

export const FIGHTERS: readonly FighterSpec[] = [
  {
    id: "pyre-duelist",
    name: "Pyre Duelist",
    faction: "Pyre",
    role: "fast pressure",
    spriteUrl: pyreDuelistUrl,
    tint: "#ff7a1a",
    maxHealth: 105,
    speed: 7.2,
    jump: 11.8,
    scale: 1,
    lightDamage: 7,
    heavyDamage: 13,
    specialDamage: 18,
  },
  {
    id: "warden-bastion",
    name: "Warden Bastion",
    faction: "Wardens",
    role: "guard bruiser",
    spriteUrl: wardenBastionUrl,
    tint: "#d8d2c4",
    maxHealth: 130,
    speed: 5.4,
    jump: 10.4,
    scale: 1.08,
    lightDamage: 6,
    heavyDamage: 15,
    specialDamage: 20,
  },
  {
    id: "scourge-render",
    name: "Render",
    faction: "Scourge",
    role: "feral striker",
    spriteUrl: scourgeEliteUrl,
    tint: "#9fe22e",
    maxHealth: 115,
    speed: 6.5,
    jump: 11,
    scale: 1.04,
    lightDamage: 8,
    heavyDamage: 14,
    specialDamage: 19,
  },
  {
    id: "trucebreaker",
    name: "Trucebreaker",
    faction: "Scourge",
    role: "heavy boss",
    spriteUrl: trucebreakerUrl,
    tint: "#d03428",
    maxHealth: 150,
    speed: 4.7,
    jump: 9.8,
    scale: 1.18,
    lightDamage: 8,
    heavyDamage: 17,
    specialDamage: 24,
  },
];

export function fighterById(id: FighterId): FighterSpec {
  return FIGHTERS.find((fighter) => fighter.id === id) ?? FIGHTERS[0];
}

export function pickOpponent(selectedId: FighterId): FighterId {
  const selected = fighterById(selectedId);
  const candidates = FIGHTERS.filter((fighter) => fighter.id !== selectedId);
  const scourgeCandidate = candidates.find((fighter) => fighter.faction === "Scourge");
  if (selected.faction !== "Scourge" && scourgeCandidate) return scourgeCandidate.id;
  return candidates[0]?.id ?? DEFAULT_PLAYER_ID;
}
