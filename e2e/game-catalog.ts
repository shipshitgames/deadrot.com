import { GAME_APPS, type GameSlug } from "@deadrot/catalog";

// The catalog (@deadrot/catalog) is the single source of truth for the roster and
// each game's dev port; the Playwright project + webServer fan-out derives from it.
export const allGames = GAME_APPS.map((game) => ({ slug: game.slug, port: game.devPort }));

export type { GameSlug };

// First app port (catalog is ordered ascending by dev port).
export const DEFAULT_PORT_BASE = GAME_APPS[0]?.devPort ?? 5174;

export function parseSelectedGameSlugs(value: string | undefined): GameSlug[] {
  if (!value?.trim()) return [];

  const known = new Set<GameSlug>(allGames.map((game) => game.slug));
  const selected = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const unknown = selected.filter((entry): entry is string => !known.has(entry as GameSlug));
  if (unknown.length) throw new Error(`Unknown E2E_GAME_SLUGS entries: ${unknown.join(", ")}`);

  return selected as GameSlug[];
}

export function parsePortBase(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_PORT_BASE;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_529) {
    throw new Error(`E2E_PORT_BASE must be an integer from 1024 to 65529. Received: ${value}`);
  }

  return port;
}
