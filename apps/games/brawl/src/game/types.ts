import type { FighterId } from "./roster";

export type GameStatus = "select" | "playing" | "round-over";
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

export interface RoundResult {
  outcome: "victory" | "defeat";
  winnerName: string;
  loserName: string;
  reason: "ko" | "time";
}

export interface HudState {
  status: GameStatus;
  selectedId: FighterId;
  opponentId: FighterId | null;
  timer: number;
  player: FighterHud | null;
  opponent: FighterHud | null;
  result: RoundResult | null;
  hits: number;
}

export type StateListener = (state: HudState) => void;
