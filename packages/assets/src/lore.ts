/**
 * @shipshitgames/assets/lore — typed, machine-readable Deadrot canon.
 *
 * The Obsidian vault (apps/lore/content) stays the prose source of truth; these
 * JSON tables are its data derivative — consumed by the web hub (instead of its
 * old hand-copied data.json), the in-game codex, and Warline's narrative layer.
 * tests/lore-drift.test.ts pins them against assets-catalog.json and
 * @deadrot/catalog so canon, sprites, and the game roster can never silently
 * diverge.
 */

import bestiaryJson from "../lore/bestiary.json" with { type: "json" };
import charactersJson from "../lore/characters.json" with { type: "json" };
import factionsJson from "../lore/factions.json" with { type: "json" };
import gamesJson from "../lore/games.json" with { type: "json" };
import locationsJson from "../lore/locations.json" with { type: "json" };
import timelineJson from "../lore/timeline-events.json" with { type: "json" };
import universeJson from "../lore/universe.json" with { type: "json" };

export type Accent = "blood" | "hellfire" | "toxic" | "rust" | "bone";

export interface Feature {
  title: string;
  desc: string;
}

/**
 * A game's lore entry. Deploy/status/repo metadata deliberately lives in
 * @deadrot/catalog (the roster source of truth), not here — consumers merge.
 */
export interface GameLore {
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

export type LocationKind = "breach-city" | "holdout" | "lane" | "orbital" | "wreck" | "landmark";
export type LocationControl = "scourge" | "wardens" | "pyre" | "contested" | "dead";
export type HostFamily = "rot-flesh" | "chitin" | "mycelial" | "machine-graft" | "bone-titan" | "voidship";

/** The named climax threat of a location — no more generic "Breach-Boss". */
export interface LocationBoss {
  name: string;
  /** Closest bestiary slug (links the boss to its canon creature entry). */
  entitySlug: string;
  hostFamily: HostFamily;
  /** True when the name was coined for the data layer rather than vault prose. */
  coined: boolean;
}

export interface LoreLocation {
  slug: string;
  name: string;
  kind: LocationKind;
  control: LocationControl;
  accent: Accent;
  tagline: string;
  overview: string;
  warRole: string;
  appearsIn: string[];
  boss: LocationBoss | null;
}

export interface TimelineEvent {
  slug: string;
  /** Exact era name from Universe/Timeline.md. */
  era: string;
  /** Global chronological order, 1-based. */
  order: number;
  title: string;
  blurb: string;
  tags: string[];
  locationSlugs: string[];
  factionSlugs: string[];
}

// JSON literals widen to plain strings; the drift tests validate the unions.
export const gameLore = gamesJson as unknown as GameLore[];
export const factions = factionsJson as unknown as Faction[];
export const characters = charactersJson as unknown as Character[];
export const bestiary = bestiaryJson as unknown as Creature[];
export const universe = universeJson as unknown as Universe;
export const locations = locationsJson as unknown as LoreLocation[];
export const timelineEvents = (timelineJson as unknown as TimelineEvent[]).slice().sort((a, b) => a.order - b.order);

// ── Lookups + relations ──────────────────────────────────────────────────────

export const getGameLore = (slug: string): GameLore | undefined => gameLore.find((g) => g.slug === slug);
export const getFaction = (slug: string): Faction | undefined => factions.find((f) => f.slug === slug);
export const getCharacter = (slug: string): Character | undefined => characters.find((c) => c.slug === slug);
export const getCreature = (slug: string): Creature | undefined => bestiary.find((b) => b.slug === slug);
export const getLocation = (slug: string): LoreLocation | undefined => locations.find((l) => l.slug === slug);

export const charactersByFaction = (factionSlug: string): Character[] =>
  characters.filter((c) => c.factionSlug === factionSlug);
export const locationsForGame = (gameSlug: string): LoreLocation[] =>
  locations.filter((l) => l.appearsIn.includes(gameSlug));
export const eventsForEra = (era: string): TimelineEvent[] => timelineEvents.filter((e) => e.era === era);
export const eventsForLocation = (locationSlug: string): TimelineEvent[] =>
  timelineEvents.filter((e) => e.locationSlugs.includes(locationSlug));
