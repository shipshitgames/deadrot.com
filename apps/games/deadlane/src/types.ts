import type * as THREE from "three";

export type Phase = "menu" | "building" | "wave" | "won" | "lost";

export interface Tower {
  mesh: THREE.Group;
  turret: THREE.Mesh; // the part that rotates toward the target
  col: number;
  row: number;
  cooldown: number; // seconds until it can fire again
}

export interface Creep {
  mesh: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  segment: number; // index of the path segment it is currently on
  t: number; // 0..1 progress along the current segment
  dead: boolean;
  reachedBase: boolean;
}

export interface Projectile {
  mesh: THREE.Mesh;
  target: Creep | null;
  damage: number;
  alive: boolean;
}

/** Mutable shared state owned by the Game class and read by the systems. */
export interface GameState {
  phase: Phase;
  gold: number;
  wave: number; // 1-based; 0 before the first wave
  baseHp: number;

  towers: Tower[];
  creeps: Creep[];
  projectiles: Projectile[];

  // wave runtime
  spawnQueue: number; // creeps left to spawn this wave
  spawnTimer: number; // counts down to next spawn
  interWaveTimer: number; // breathing room between waves
}
