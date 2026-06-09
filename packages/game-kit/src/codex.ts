// Lore → in-game codex mapping. Each game app renders @shipshitgames/ui's
// CodexScreen; this module turns the typed canon in @shipshitgames/assets/lore
// into entry props for one game so the apps never hand-copy lore data.

import { type Accent, bestiary, characters, getFaction, locations } from "@shipshitgames/assets/lore";

/**
 * Structural twin of @shipshitgames/ui's CodexEntry. Declared locally so
 * game-kit's data layer never depends on the React UI package — the shapes are
 * kept assignable by the consuming apps' typechecks.
 */
export interface CodexEntryData {
  slug: string;
  name: string;
  kicker?: string;
  tagline: string;
  overview: string;
  sections?: { label: string; items: string[] }[];
  spriteUrl?: string | null;
  accentHex?: string;
  locked?: boolean;
}

export interface CodexEntriesOptions {
  /**
   * Bestiary slugs the player has discovered. When provided, creatures outside
   * the set render locked ("???"); when omitted every entry starts unlocked.
   * Characters and locations are always unlocked.
   */
  unlockedSlugs?: Set<string>;
}

/** Lore accent names → DOOM palette hex (packages/assets/tokens). */
export const CODEX_ACCENT_HEX: Record<Accent, string> = {
  blood: "#c1121f",
  hellfire: "#ff6a00",
  toxic: "#8bdc1f",
  rust: "#8a4b2a",
  bone: "#e9e3d6",
};

/**
 * Build the codex entries for one game: creatures, then characters, then
 * locations — each filtered to lore that lists the game in `appearsIn`.
 * spriteUrl stays null: the web hub's /sprites/ route does not exist inside
 * the game apps, so there is no per-game resolvable portrait URL to offer.
 */
export function codexEntriesForGame(gameSlug: string, opts: CodexEntriesOptions = {}): CodexEntryData[] {
  const { unlockedSlugs } = opts;

  const creatureEntries = bestiary
    .filter((creature) => creature.appearsIn.includes(gameSlug))
    .map(
      (creature): CodexEntryData => ({
        slug: creature.slug,
        name: creature.name,
        kicker: `SCOURGE — TIER ${creature.tier.toUpperCase()}`,
        tagline: creature.tagline,
        overview: creature.overview,
        sections: sections(["Threat Read", creature.gameplayRead], ["Recognize It", creature.visualMotifs]),
        spriteUrl: null,
        accentHex: CODEX_ACCENT_HEX[creature.accent],
        locked: unlockedSlugs ? !unlockedSlugs.has(creature.slug) : false,
      }),
    );

  const characterEntries = characters
    .filter((character) => character.appearsIn.includes(gameSlug))
    .map((character): CodexEntryData => {
      const factionName = getFaction(character.factionSlug)?.name ?? character.factionName;
      return {
        slug: character.slug,
        name: character.name,
        kicker: `${factionName.toUpperCase()} — ${character.role.toUpperCase()}`,
        tagline: character.tagline,
        overview: character.overview,
        sections: sections(["Gameplay Read", character.gameplayRead], ["Visual Motifs", character.visualMotifs]),
        spriteUrl: null,
        accentHex: CODEX_ACCENT_HEX[character.accent],
        locked: false,
      };
    });

  const locationEntries = locations
    .filter((location) => location.appearsIn.includes(gameSlug))
    .map(
      (location): CodexEntryData => ({
        slug: location.slug,
        name: location.name,
        kicker: `LOCATION — ${location.control.toUpperCase()}`,
        tagline: location.tagline,
        overview: location.overview,
        sections: sections(["War Role", [location.warRole]]),
        spriteUrl: null,
        accentHex: CODEX_ACCENT_HEX[location.accent],
        locked: false,
      }),
    );

  return [...creatureEntries, ...characterEntries, ...locationEntries];
}

/** Keep only sections that actually have bullet points. */
function sections(...pairs: [label: string, items: string[]][]): CodexEntryData["sections"] {
  return pairs.filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
}
