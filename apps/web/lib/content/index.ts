import { CONCEPTS, GAME_APPS, gameRoute } from "@deadrot/catalog";
import {
  type Accent,
  bestiary,
  type Character,
  type Creature,
  characters,
  charactersByFaction,
  type Faction,
  type Feature,
  factions,
  type GameLore,
  gameLore,
  getCharacter,
  getCreature,
  getFaction,
  type LoreLocation,
  locations,
  type TimelineEvent,
  timelineEvents,
  type Universe,
  universe,
} from "@shipshitgames/assets/lore";
import type { CSSProperties } from "react";

// The lore tables (canon copy) live in @shipshitgames/assets/lore — the typed
// derivative of the Obsidian vault — so this hub can never drift from canon.
// This module layers the roster metadata from @deadrot/catalog on top.

export type { Accent, Character, Creature, Faction, Feature, LoreLocation, TimelineEvent, Universe };
export type GameStatus = "PLAYABLE" | "IN DEV" | "CONCEPT";

export interface Game extends GameLore {
  repo?: string;
  demo?: string;
  status: GameStatus;
}

// Derived from @deadrot/catalog (the single source of truth) rather than re-listed
// here: each game app gets a source link + same-origin demo route + its status;
// concept titles (e.g. zero-day) get status only.
const GAME_SOURCE_ROOT = "https://github.com/shipshitgames/deadrot.com/tree/master/apps/games";
const gameSource = (slug: string) => `${GAME_SOURCE_ROOT}/${slug}`;

const GAME_META: Record<string, { repo?: string; demo?: string; status: GameStatus }> = {};
for (const game of GAME_APPS) {
  GAME_META[game.slug] = { repo: gameSource(game.slug), demo: gameRoute(game.slug), status: game.status };
}
for (const concept of CONCEPTS) {
  GAME_META[concept.slug] = { status: concept.status };
}

export const games: Game[] = gameLore.map((g) => ({
  ...g,
  ...(GAME_META[g.slug] ?? { status: "CONCEPT" as GameStatus }),
}));
export { bestiary, characters, factions, locations, timelineEvents, universe };

// ── Accent system ────────────────────────────────────────────────────────────
export const ACCENT_HEX: Record<Accent, string> = {
  blood: "#c1121f",
  hellfire: "#ff6a00",
  toxic: "#8bdc1f",
  rust: "#a35a33",
  bone: "#e9e3d6",
};

/** Spread onto a wrapper to tint everything under it via `var(--page-accent)`. */
export function accentVars(accent: Accent): CSSProperties {
  return { ["--page-accent" as string]: ACCENT_HEX[accent] } as CSSProperties;
}

// ── Lookups + relations ──────────────────────────────────────────────────────
export const getGame = (slug: string) => games.find((g) => g.slug === slug);
export { charactersByFaction, getCharacter, getCreature, getFaction };

export const playableGames = games.filter((g) => g.status === "PLAYABLE");

export const factionGames = (f: Faction) => f.gameSlugs.map(getGame).filter(Boolean) as Game[];
export const gameCharacters = (g: Game) => g.characterSlugs.map(getCharacter).filter(Boolean) as Character[];
export const gameCreatures = (g: Game) => g.enemySlugs.map(getCreature).filter(Boolean) as Creature[];
export const characterGames = (c: Character) => c.appearsIn.map(getGame).filter(Boolean) as Game[];
export const creatureGames = (b: Creature) => b.appearsIn.map(getGame).filter(Boolean) as Game[];

export const spriteUrl = (base: string | null) =>
  base ? `/sprites/${base.includes(".") ? base : `${base}.webp`}` : null;
