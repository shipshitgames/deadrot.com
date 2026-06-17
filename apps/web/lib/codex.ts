import type { PublicCodexKind } from "@deadrot/game-kit/codex";
import { publicCodexAnchor, publicCodexHref } from "@deadrot/game-kit/codex";
import {
  type Accent,
  bestiary,
  characters,
  factions,
  gameCoverUrl,
  games,
  locations,
  spriteUrl,
  timelineEvents,
} from "@/lib/content";

export interface PublicCodexEntry {
  kind: PublicCodexKind;
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  accent: Accent;
  href: string;
  anchor: string;
  imageUrl?: string | null;
}

export interface PublicCodexSection {
  id: string;
  kind: PublicCodexKind;
  label: string;
  title: string;
  summary: string;
  entries: PublicCodexEntry[];
}

const entry = (
  kind: PublicCodexKind,
  slug: string,
  title: string,
  kicker: string,
  summary: string,
  accent: Accent,
  href: string,
  imageUrl?: string | null,
): PublicCodexEntry => ({
  kind,
  slug,
  title,
  kicker,
  summary,
  accent,
  href,
  anchor: publicCodexAnchor(kind, slug),
  imageUrl,
});

export const publicCodexSections: PublicCodexSection[] = [
  {
    id: "games",
    kind: "game",
    label: "Games",
    title: "Playable Fronts",
    summary: "Every shipped Deadrot game and prototype tied back to the same war.",
    entries: games.map((game) =>
      entry(
        "game",
        game.slug,
        game.title,
        game.genre,
        game.tagline,
        game.accent,
        `/games/${game.slug}`,
        gameCoverUrl(game.slug),
      ),
    ),
  },
  {
    id: "factions",
    kind: "faction",
    label: "Factions",
    title: "Forces In The Pact",
    summary: "The armies, doctrines, and rival pressures that shape each playable front.",
    entries: factions.map((faction) =>
      entry(
        "faction",
        faction.slug,
        faction.name,
        faction.doctrine,
        faction.tagline,
        faction.accent,
        `/factions/${faction.slug}`,
      ),
    ),
  },
  {
    id: "characters",
    kind: "character",
    label: "Characters",
    title: "Operators And Heroes",
    summary: "Playable or canon operators with asset-backed dossiers where portraits exist.",
    entries: characters.map((character) =>
      entry(
        "character",
        character.slug,
        character.name,
        `${character.factionName} - ${character.role}`,
        character.tagline,
        character.accent,
        `/characters/${character.slug}`,
        spriteUrl(character.spriteBase),
      ),
    ),
  },
  {
    id: "bestiary",
    kind: "bestiary",
    label: "Bestiary",
    title: "The Scourge",
    summary: "Enemy forms, bosses, and host families generated from the canonical lore derivative.",
    entries: bestiary.map((creature) =>
      entry(
        "bestiary",
        creature.slug,
        creature.name,
        `Scourge - ${creature.tier}`,
        creature.tagline,
        creature.accent,
        `/bestiary/${creature.slug}`,
        spriteUrl(creature.spriteBase),
      ),
    ),
  },
  {
    id: "locations",
    kind: "location",
    label: "Locations",
    title: "War Zones",
    summary: "Named lanes, breaches, orbital fronts, wrecks, and holdouts from the vault-derived map data.",
    entries: locations.map((location) =>
      entry(
        "location",
        location.slug,
        location.name,
        `${location.kind} - ${location.control}`,
        location.tagline,
        location.accent,
        publicCodexHref("location", location.slug),
      ),
    ),
  },
  {
    id: "timeline",
    kind: "timeline",
    label: "Timeline",
    title: "The Chronicle",
    summary: "Era-ordered canon events with stable anchors for future lore and post-run references.",
    entries: timelineEvents.map((event) =>
      entry(
        "timeline",
        event.slug,
        event.title,
        event.era,
        event.blurb,
        "bone",
        publicCodexHref("timeline", event.slug),
      ),
    ),
  },
];

export const publicCodexEntries = publicCodexSections.flatMap((section) => section.entries);
