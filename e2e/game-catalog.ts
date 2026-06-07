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
