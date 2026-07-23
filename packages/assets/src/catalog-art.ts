/** Runtime-safe catalog helpers for lore and web surfaces. */

import { PLAYABLE_GAME_SLUGS } from "@deadrot/catalog";
import catalogJson from "../assets-catalog.json" with { type: "json" };
import type { AssetCatalog, EntityAsset, GameSlug } from "./index";

export type { GameSlug } from "./index";

/** The canon asset catalog without loading renderer-specific package exports. */
export const catalog = catalogJson as unknown as AssetCatalog;

/** A concrete per-game render, including the source behind an alias. */
export interface ResolvedEntityVariant {
  game: GameSlug;
  path: string;
  sourceGame: GameSlug;
}

function isAlias(value: unknown): value is { type: "alias"; sourceGame: GameSlug } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "alias";
}

function slugifyEntity(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve a local or aliased variant and retain the alias source. */
export function resolveEntityVariant(entity: EntityAsset, game: GameSlug): ResolvedEntityVariant | null {
  let currentGame = game;
  const visited = new Set<GameSlug>();

  while (true) {
    if (visited.has(currentGame)) {
      throw new Error(`Circular variant alias for catalog entity: ${entity.id}`);
    }
    visited.add(currentGame);

    const variant = entity.variants[currentGame];
    if (typeof variant === "string") return { game, path: variant, sourceGame: currentGame };
    if (!isAlias(variant)) return null;
    currentGame = variant.sourceGame;
  }
}

/** Match a lore character to its canonical catalog row. */
export function findEntityForLoreEntry(entry: { slug: string; name: string }): EntityAsset | undefined {
  const slug = slugifyEntity(entry.slug);
  const direct = catalog.entities.find((entity) => slugifyEntity(entity.id) === slug);
  if (direct) return direct;

  const name = slugifyEntity(entry.name);
  const matches = catalog.entities.filter((entity) => slugifyEntity(entity.name) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Every concrete local or aliased render for an entity, in roster order. */
export function resolvedEntityVariants(entity: EntityAsset): ResolvedEntityVariant[] {
  return PLAYABLE_GAME_SLUGS.flatMap((game) => {
    const variant = resolveEntityVariant(entity, game);
    return variant ? [variant] : [];
  });
}
