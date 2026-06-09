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

interface RawContent {
  games: Omit<Game, "repo" | "demo" | "status">[];
  factions: Faction[];
  characters: Character[];
  bestiary: Creature[];
  universe: Universe;
}

// data.json is generated lore content. TS infers its string fields wider than
// our literal unions (e.g. `accent: string` vs the `Accent` union), so a direct
// `as RawContent` is rejected and the assertion must pass through `unknown`.
// The shape itself is owned by the generator and matches RawContent.
const raw = data as unknown as RawContent;

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

const STATUS_RANK: Record<GameStatus, number> = {
  PLAYABLE: 0,
  "IN DEV": 1,
  CONCEPT: 2,
};

/** All games ordered playable-first, then in-dev, then concept. */
export const gamesByStatus: Game[] = [...games].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

/** Resolve slugs through a lookup, dropping any that are unknown. */
const resolve = <T>(slugs: string[], lookup: (s: string) => T | undefined): T[] =>
  slugs.flatMap((s) => {
    const v = lookup(s);
    return v ? [v] : [];
  });

export const factionGames = (f: Faction) => resolve(f.gameSlugs, getGame);
export const charactersByFaction = (factionSlug: string) => characters.filter((c) => c.factionSlug === factionSlug);
export const gameCharacters = (g: Game) => resolve(g.characterSlugs, getCharacter);
export const gameCreatures = (g: Game) => resolve(g.enemySlugs, getCreature);
export const characterGames = (c: Character) => resolve(c.appearsIn, getGame);
export const creatureGames = (b: Creature) => resolve(b.appearsIn, getGame);

export const spriteUrl = (base: string | null) =>
  base ? `/sprites/${base.includes(".") ? base : `${base}.webp`}` : null;
