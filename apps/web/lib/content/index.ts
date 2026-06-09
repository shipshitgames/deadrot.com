import { CONCEPTS, GAME_APPS, gameRoute } from "@deadrot/catalog";
import type { CSSProperties } from "react";
import data from "./data.json";

export type Accent = "blood" | "hellfire" | "toxic" | "rust" | "bone";
export type GameStatus = "PLAYABLE" | "IN DEV" | "CONCEPT";

export interface Feature {
  title: string;
  desc: string;
}

export interface Game {
  slug: string;
  title: string;
  tagline: string;
  genre: string;
  factionSlug: string;
  factionName: string;
  accent: Accent;
  overview: string;
  features: Feature[];
  characterSlugs: string[];
  enemySlugs: string[];
  repo?: string;
  demo?: string;
  status: GameStatus;
}

export interface Faction {
  slug: string;
  name: string;
  doctrine: string;
  tagline: string;
  accent: Accent;
  overview: string;
  playstyle: string;
  rivalry: string;
  crestMotif: string;
  gameSlugs: string[];
}

export interface Character {
  slug: string;
  name: string;
  factionSlug: string;
  factionName: string;
  role: string;
  tagline: string;
  accent: Accent;
  overview: string;
  gameplayRead: string[];
  visualMotifs: string[];
  appearsIn: string[];
  spriteBase: string | null;
}

export interface Creature {
  slug: string;
  name: string;
  tier: string;
  tagline: string;
  accent: Accent;
  overview: string;
  gameplayRead: string[];
  visualMotifs: string[];
  appearsIn: string[];
  spriteBase: string | null;
}

export interface Universe {
  premise: string;
  pillars: Feature[];
  eras: { name: string; blurb: string }[];
}

// Deploy + status metadata (lives here, not in the lore vault).
const GAME_SOURCE_ROOT = "https://github.com/shipshitgames/deadrot.com/tree/master/apps/games";
const gameSource = (slug: string) => `${GAME_SOURCE_ROOT}/${slug}`;

// Derived from @deadrot/catalog (the single source of truth) rather than re-listed
// here: each game app gets a source link + same-origin demo route + its status;
// concept titles (e.g. zero-day) get status only.
const GAME_META: Record<string, { repo?: string; demo?: string; status: GameStatus }> = {};
for (const game of GAME_APPS) {
  GAME_META[game.slug] = { repo: gameSource(game.slug), demo: gameRoute(game.slug), status: game.status };
}
for (const concept of CONCEPTS) {
  GAME_META[concept.slug] = { status: concept.status };
}

const raw = data as unknown as {
  games: Omit<Game, "repo" | "demo" | "status">[];
  factions: Faction[];
  characters: Character[];
  bestiary: Creature[];
  universe: Universe;
};

export const games: Game[] = raw.games.map((g) => ({
  ...g,
  ...(GAME_META[g.slug] ?? { status: "CONCEPT" as GameStatus }),
}));
export const factions: Faction[] = raw.factions;
export const characters: Character[] = raw.characters;
export const bestiary: Creature[] = raw.bestiary;
export const universe: Universe = raw.universe;

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
export const getFaction = (slug: string) => factions.find((f) => f.slug === slug);
export const getCharacter = (slug: string) => characters.find((c) => c.slug === slug);
export const getCreature = (slug: string) => bestiary.find((b) => b.slug === slug);

export const playableGames = games.filter((g) => g.status === "PLAYABLE");

export const factionGames = (f: Faction) => f.gameSlugs.map(getGame).filter(Boolean) as Game[];
export const charactersByFaction = (factionSlug: string) => characters.filter((c) => c.factionSlug === factionSlug);
export const gameCharacters = (g: Game) => g.characterSlugs.map(getCharacter).filter(Boolean) as Character[];
export const gameCreatures = (g: Game) => g.enemySlugs.map(getCreature).filter(Boolean) as Creature[];
export const characterGames = (c: Character) => c.appearsIn.map(getGame).filter(Boolean) as Game[];
export const creatureGames = (b: Creature) => b.appearsIn.map(getGame).filter(Boolean) as Game[];

export const spriteUrl = (base: string | null) =>
  base ? `/sprites/${base.includes(".") ? base : `${base}.webp`}` : null;
