export const allGames = [
  { slug: "deadlane", port: 5174 },
  { slug: "pactfall", port: 5175 },
  { slug: "redline", port: 5176 },
  { slug: "rothulk", port: 5177 },
  { slug: "scourge-survivors", port: 5178 },
  { slug: "starblight", port: 5179 },
  { slug: "warline", port: 5180 },
] as const;

export type GameSlug = (typeof allGames)[number]["slug"];

export const DEFAULT_PORT_BASE = 5174;

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
