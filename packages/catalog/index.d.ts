// Public types for @deadrot/catalog. Kept hand-written (no build step) so the
// plain-ESM index.js stays importable by Node (next.config.mjs) while TS
// consumers still get full types.

export type GameSlug = "deadlane" | "pactfall" | "redline" | "rothulk" | "scourge-survivors" | "starblight" | "warline";

export type GameStatus = "PLAYABLE" | "IN DEV" | "CONCEPT";

export interface GameApp {
  slug: GameSlug;
  devPort: number;
  deployUrl: string;
  status: GameStatus;
}

export interface ConceptEntry {
  slug: string;
  status: GameStatus;
}

export declare const GAME_APPS: readonly GameApp[];
export declare const CONCEPTS: readonly ConceptEntry[];
export declare const LOBBY_SLUG: GameSlug;
export declare function gameRoute(slug: string): string;
export declare const gameDeploys: Record<string, string>;
export declare const gameDevPorts: Record<string, number>;
export declare const gameSlugs: readonly GameSlug[];
