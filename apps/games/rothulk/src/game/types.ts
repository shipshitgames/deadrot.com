// Shared geometry + state contracts for the systems.

export interface AABB {
  x: number; // center x
  y: number; // center y
  hw: number; // half-width
  hh: number; // half-height
}

export type PlatformKind = "slab" | "flesh";

export interface Platform {
  kind: PlatformKind;
  x: number; // center
  y: number; // center
  w: number;
  h: number;
}

export interface MovingPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  // Travels along a segment from (x,y) to (toX,toY) and back.
  toX: number;
  toY: number;
  // Internal: 0..1 ping-pong phase and direction.
  t: number;
  dir: number;
  // Per-frame velocity, so the rider can be carried.
  vx: number;
  vy: number;
}

export type HazardKind = "acid" | "spikes";

export interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scourge {
  x: number;
  y: number;
  vx: number;
  size: number;
  minX: number; // patrol bounds
  maxX: number;
  alive: boolean;
  popTimer: number; // >0 while playing the death pop
}

export interface Ember {
  x: number;
  y: number;
  collected: boolean;
  bob: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  reached: boolean;
}

export interface CoreGoal {
  x: number;
  y: number;
  ignited: boolean;
}

export interface LevelData {
  name: string; // canon location name (e.g. 'The Rothulk')
  loreId: string; // cross-game map registry id (e.g. 'cinder')
  front: "hulk"; // which war-front this level belongs to
  width: number; // total level length in world-units
  platforms: Platform[];
  movers: MovingPlatform[];
  hazards: Hazard[];
  scourge: Scourge[];
  embers: Ember[];
  checkpoint: Checkpoint;
  core: CoreGoal;
}

export type GameMode = "title" | "playing" | "dead" | "won" | "gameover";
