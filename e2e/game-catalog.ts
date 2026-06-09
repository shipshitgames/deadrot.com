import { GAME_APPS, type GameSlug } from "@deadrot/catalog";

// The catalog (@deadrot/catalog) is the single source of truth for the roster and
// each game's dev port; the Playwright project + webServer fan-out derives from it.

export type { GameSlug };

// First app port (catalog is ordered ascending by dev port).
export const DEFAULT_PORT_BASE = GAME_APPS[0]?.devPort ?? 5174;

export function parseSelectedGameSlugs(value: string | undefined): GameSlug[] {
  if (!value?.trim()) return [];

  const known = new Set<GameSlug>(GAME_APPS.map((game) => game.slug));
  const selected = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const unknown = selected.filter((entry): entry is string => !known.has(entry as GameSlug));
  if (unknown.length) throw new Error(`Unknown E2E_GAME_SLUGS entries: ${unknown.join(", ")}`);

  return selected as GameSlug[];
}

export type ViewportName = "desktop" | "mobile";

export function parseSelectedViewports(value: string | undefined): ViewportName[] {
  if (!value?.trim()) return [];

  const known = new Set<ViewportName>(["desktop", "mobile"]);
  const selected = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const unknown = selected.filter((entry): entry is string => !known.has(entry as ViewportName));
  if (unknown.length) throw new Error(`Unknown E2E_VIEWPORT entries: ${unknown.join(", ")}`);

  return selected as ViewportName[];
}

export function parsePortBase(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_PORT_BASE;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_529) {
    throw new Error(`E2E_PORT_BASE must be an integer from 1024 to 65529. Received: ${value}`);
  }

  return port;
}
