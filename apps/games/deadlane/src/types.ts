import type * as THREE from "three";
import type { CONSTANTS } from "./constants";

export type Phase = "menu" | "building" | "wave" | "won" | "lost";

/** Tower archetypes — keys of the CONSTANTS.towers table. */
export type TowerKind = keyof (typeof CONSTANTS)["towers"];
/** Creep archetypes — keys of the CONSTANTS.creeps table. */
export type CreepKind = keyof (typeof CONSTANTS)["creeps"];

export interface Tower {
  mesh: THREE.Group;
  turret: THREE.Mesh; // the part that rotates toward the target
  kind: TowerKind;
  col: number;
  row: number;
  cooldown: number; // seconds until it can fire again
}

export interface Creep {
  mesh: THREE.Mesh;
  kind: CreepKind;
  hp: number;
  maxHp: number;
  speed: number; // base speed before stasis slow
  slowTimer: number; // seconds of stasis slow remaining
  segment: number; // index of the path segment it is currently on
  t: number; // 0..1 progress along the current segment
  dead: boolean;
  reachedBase: boolean;
}

export interface Projectile {
  mesh: THREE.Mesh;
  kind: TowerKind; // firing archetype: decides damage, slow, and splash on impact
  target: Creep | null;
  damage: number;
  alive: boolean;
}

/** A creep death this step — position + kind so the Game can drive juice/audio. */
export interface KillEvent {
  x: number;
  z: number;
  kind: CreepKind;
}

/** Mutable shared state owned by the Game class and read by the systems. */
export interface GameState {
  phase: Phase;
  gold: number;
  wave: number; // 1-based; 0 before the first wave
  baseHp: number;
  hintText: string;
  selectedTower: TowerKind;

  towers: Tower[];
  creeps: Creep[];
  projectiles: Projectile[];

  buildProgress: number; // seconds spent holding build on the current tile
  buildTargetKey: string | null;
  buildSpeedLevel: number;
  runSpeedLevel: number;
  lastBonus: string | null;

  // wave runtime
  spawnList: CreepKind[]; // creeps left to spawn this wave, in order
  spawnTimer: number; // counts down to next spawn
  interWaveTimer: number; // breathing room between waves
}
