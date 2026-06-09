import type * as THREE from "three";
import type { Team } from "./constants";

export type EntityKind = "champion" | "minion" | "scourge" | "base";

// A flat, struct-ish entity. Systems read/write these fields directly; the
// mesh is the visual twin kept in sync each frame.
export interface Entity {
  id: number;
  kind: EntityKind;
  team: Team | "neutral";
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  // combat
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  cooldown: number; // current time left until next attack
  // resources (champions only — everyone else stays at 0)
  mana: number;
  maxMana: number;
  // status: seconds of Pact Brand slow remaining (0 = full speed)
  slowTimer: number;
}

export type Phase = "title" | "playing" | "won" | "lost";

// ---- gameplay events --------------------------------------------------------
// The simulation accumulates these each tick; the Game consumes them once per
// displayed frame for juice (damage numbers, bursts, shake) and audio, then
// clears them. Keeps presentation entirely out of the entity/ability systems.

export interface HitEvent {
  x: number;
  y: number;
  z: number;
  amount: number;
  ability: boolean; // true for Q/W damage, false for auto-attacks
  dealerTeam: Team;
  dealerIsPlayer: boolean;
  targetIsPlayer: boolean;
}

export interface KillEvent {
  x: number;
  y: number;
  z: number;
  kind: EntityKind;
  dealerTeam: Team | null; // null when the killer is unknown
  dealerIsPlayer: boolean;
  victimIsPlayer: boolean;
}

export interface GameEvents {
  hits: HitEvent[];
  kills: KillEvent[];
  playerDamage: number; // total damage the player champion took this frame
  playerDied: boolean;
  buffGained: boolean; // the Scourge fell and the buff was granted
}
