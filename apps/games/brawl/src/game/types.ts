import type { FighterId } from "./roster";

export type GameStatus = "select" | "playing" | "round-over";
export type GameMode = "duel" | "arena";
export type AttackKind = "light" | "heavy" | "special";
export type InputAction = "left" | "right" | "jump" | "guard" | AttackKind;

export interface FighterHud {
  id: FighterId;
  name: string;
  faction: string;
  health: number;
  maxHealth: number;
  blocking: boolean;
  attacking: AttackKind | null;
}

/** Per-fighter readout for the Arena scoreboard (damage% + stocks, not health). */
export interface ArenaFighterHud {
  slot: number;
  id: FighterId;
  name: string;
  faction: string;
  /** Accumulated damage percent (drives knockback). */
  damage: number;
  stocks: number;
  eliminated: boolean;
  isPlayer: boolean;
  blocking: boolean;
  attacking: AttackKind | null;
}

export interface ArenaHud {
  slots: number;
  fighters: ArenaFighterHud[];
  alive: number;
  winnerName: string | null;
}

export interface RoundResult {
  outcome: "victory" | "defeat";
  winnerName: string;
  loserName: string;
  reason: "ko" | "time" | "last-standing";
}

export interface HudState {
  status: GameStatus;
  mode: GameMode;
  selectedId: FighterId;
  /** Requested Arena fighter count (2-4). */
  arenaSlots: number;
  opponentId: FighterId | null;
  timer: number;
  player: FighterHud | null;
  opponent: FighterHud | null;
  /** Populated only while `mode === "arena"`. */
  arena: ArenaHud | null;
  result: RoundResult | null;
  hits: number;
}

export type StateListener = (state: HudState) => void;
