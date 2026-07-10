import type { FighterId, FighterSpec } from "./roster";
import type { AttackKind } from "./types";

export interface AttackState {
  kind: AttackKind;
  elapsed: number;
  didHit: boolean;
}

/** Opaque scene handle. Fighter rules never reach into Three.js objects. */
export interface FighterVisual {
  readonly id: number;
}

export interface RuntimeFighter {
  spec: FighterSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  blocking: boolean;
  hurt: number;
  cooldown: number;
  attack: AttackState | null;
  visual: FighterVisual;
  // Arena-only bookkeeping (left at defaults for duel fighters).
  slot: number;
  isPlayer: boolean;
  isBot: boolean;
  damage: number;
  stocks: number;
  eliminated: boolean;
  respawn: number;
  prevY: number;
  grounded: boolean;
  airJumpUsed: boolean;
}

export interface FighterDebug {
  slot: number;
  id: FighterId;
  x: number;
  y: number;
  stocks: number;
  damage: number;
  eliminated: boolean;
  isPlayer: boolean;
  respawn: number;
}

export interface FighterRenderPort {
  createFighterVisual(spec: FighterSpec): FighterVisual;
  transformFighter(fighter: RuntimeFighter): void;
  setFighterVisible(fighter: RuntimeFighter, visible: boolean): void;
  disposeFighterVisual(fighter: RuntimeFighter): void;
  spawnSparks(x: number, y: number, color: string, count?: number): void;
  addShake(amount: number): void;
}

export interface BrawlAudioPort {
  unlock(): void;
  roundStart(mode: "duel" | "arena"): void;
  jump(): void;
  impact(blocked: boolean, damage: number): void;
  miss(): void;
  ringOut(): void;
  roundEnd(outcome: "victory" | "defeat"): void;
  dispose(): void;
}
