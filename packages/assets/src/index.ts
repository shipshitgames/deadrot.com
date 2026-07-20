/**
 * @shipshitgames/assets — shared, game-agnostic assets and the canon asset catalog
 * for the Scourge universe.
 *
 * ENTITY sprites are PER-GAME renders of shared canon (companion to issue #6):
 * the catalog records one canonical entity, then a per-game variant record.
 * Truly game-agnostic assets (FX, UI, fonts, audio) live in the `shared`
 * section and are used identically by every game.
 */

import type { PlayableGameSlug } from "@deadrot/catalog";
import { PLAYABLE_GAME_SLUGS } from "@deadrot/catalog";
import catalogJson from "../assets-catalog.json" with { type: "json" };

/** Every playable game in the shared Scourge universe. */
export type GameSlug = PlayableGameSlug;

/** Ordered list of every game slug, for iteration/validation. */
export const GAME_SLUGS: readonly GameSlug[] = PLAYABLE_GAME_SLUGS;
const GAME_SLUG_SET = new Set<string>(GAME_SLUGS);

/** What an asset represents. */
export type AssetKind = "entity" | "boss" | "fx" | "ui" | "font" | "audio";

/** The factions of the Scourge universe (drives material/silhouette canon). */
export type Faction = "scourge" | "pyre" | "wardens" | "neutral";

/**
 * Scourge host families from the lore Variation-Matrix — the conquered medium a
 * Scourge form visibly wears. `null` for non-Scourge entities.
 */
export type HostFamily = "rot-flesh" | "chitin" | "mycelial" | "machine-graft" | "bone-titan" | "voidship";

/**
 * Per-game variant paths for a canonical entity. Each game slug maps to the
 * relative path of that game's render, an explicit alias, a planned placeholder,
 * or `null` when the entity is not intended for that game.
 */
export type AssetVariant = string | AssetVariantAlias | AssetVariantPlaceholder | null;

/** An explicit reuse of the same entity's render from another playable game. */
export interface AssetVariantAlias {
  type: "alias";
  sourceGame: GameSlug;
}

/** An intended render whose visual asset has not been produced yet. */
export interface AssetVariantPlaceholder {
  type: "placeholder";
  note: string;
}

export type AssetVariants = Record<GameSlug, AssetVariant>;

/**
 * A canonical universe entity (enemy, boss, ...). The render is per-game:
 * shared canon, per-game `variants`. Companion to issue #6.
 */
export interface EntityAsset {
  /** Stable identifier, e.g. "scourge-swarm". */
  id: string;
  kind: "entity" | "boss";
  /** Display name. */
  name: string;
  /** Faction this entity belongs to (drives material/silhouette canon). */
  faction: Faction;
  /** Scourge host family, or `null` for non-Scourge (human-faction) entities. */
  hostFamily: HostFamily | null;
  /** One-line canon description (kept in sync with lore/CANON.md). */
  canon: string;
  /**
   * Generation seed for the matrix generator: the entity's body/silhouette/
   * materials WITHOUT camera framing or the DOOM style suffix (those are added
   * per game by `@shipshitgames/assetgen`).
   */
  promptBase: string;
  /**
   * The games this entity is intended to render in — the variant-matrix row.
   * A non-null `variants[game]` exists exactly when `game` is listed here.
   */
  games: GameSlug[];
  /** Per-game render paths, relative to this package. */
  variants: AssetVariants;
}

/**
 * A truly game-agnostic asset used identically by every game: FX, UI icons,
 * fonts, shared audio.
 */
export interface SharedAsset {
  /** Stable identifier, e.g. "fx-blood-splatter". */
  id: string;
  kind: Exclude<AssetKind, "entity" | "boss">;
  /** Display name. */
  name: string;
  /** Path to the asset, relative to this package. */
  path: string;
}

/** A resolved asset reference returned by {@link getAsset}. */
export interface Asset {
  /** The asset's stable identifier. */
  id: string;
  /** The asset's kind. */
  kind: AssetKind;
  /** Display name. */
  name: string;
  /**
   * Resolved path relative to this package, or `null` for a per-game entity
   * that has no render for the requested game.
   */
  path: string | null;
  /**
   * The game whose variant was resolved, or `null` for a shared
   * (game-agnostic) asset.
   */
  game: GameSlug | null;
}

/** The full canon asset catalog: per-game entities plus shared assets. */
export interface AssetCatalog {
  /** JSON Schema reference (`./assets-catalog.schema.json`). */
  $schema?: string;
  version: string;
  /** Human note describing the catalog (preserved on generator write-back). */
  note?: string;
  entities: EntityAsset[];
  shared: SharedAsset[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGameSlug(value: unknown): value is GameSlug {
  return typeof value === "string" && GAME_SLUG_SET.has(value);
}

export function isAssetVariantAlias(variant: AssetVariant): variant is AssetVariantAlias {
  return typeof variant === "object" && variant !== null && variant.type === "alias";
}

export function isAssetVariantPlaceholder(variant: AssetVariant): variant is AssetVariantPlaceholder {
  return typeof variant === "object" && variant !== null && variant.type === "placeholder";
}

function isAssetVariant(value: unknown): value is AssetVariant {
  if (value === null || typeof value === "string") return true;
  if (!isRecord(value)) return false;
  if (value.type === "alias") return isGameSlug(value.sourceGame);
  return value.type === "placeholder" && typeof value.note === "string" && value.note.length > 0;
}

/** Fail at package load when the checked-in JSON drifts from the catalog contract. */
function assertCatalog(value: unknown): asserts value is AssetCatalog {
  if (
    !isRecord(value) ||
    !Array.isArray(value.entities) ||
    !Array.isArray(value.shared) ||
    typeof value.version !== "string"
  ) {
    throw new Error("Invalid asset catalog root.");
  }

  for (const entity of value.entities) {
    if (
      !isRecord(entity) ||
      typeof entity.id !== "string" ||
      !Array.isArray(entity.games) ||
      !isRecord(entity.variants)
    ) {
      throw new Error("Invalid asset catalog entity.");
    }
    if (!entity.games.every(isGameSlug)) throw new Error(`Invalid game intent for catalog entity: ${entity.id}`);

    const variantKeys = Object.keys(entity.variants);
    if (variantKeys.length !== GAME_SLUGS.length || !GAME_SLUGS.every((game) => variantKeys.includes(game))) {
      throw new Error(`Incomplete variant record for catalog entity: ${entity.id}`);
    }
    for (const game of GAME_SLUGS) {
      if (!isAssetVariant(entity.variants[game])) {
        throw new Error(`Invalid ${game} variant for catalog entity: ${entity.id}`);
      }
    }
  }
}

assertCatalog(catalogJson);

/** The canon asset catalog, loaded from `assets-catalog.json`. */
export const catalog: AssetCatalog = catalogJson;

/** Resolve an entity's local or aliased variant path; placeholders resolve to `null`. */
export function resolveEntityVariantPath(entity: EntityAsset, game: GameSlug): string | null {
  let currentGame = game;
  const visited = new Set<GameSlug>();

  while (true) {
    if (visited.has(currentGame)) {
      throw new Error(`Circular variant alias for catalog entity: ${entity.id}`);
    }
    visited.add(currentGame);

    const variant = entity.variants[currentGame];
    if (typeof variant === "string") return variant;
    if (isAssetVariantAlias(variant)) {
      currentGame = variant.sourceGame;
      continue;
    }
    return null;
  }
}

/**
 * Resolve an asset by id.
 *
 * - For an ENTITY, returns the requested `game`'s variant (its `path` may be
 *   `null` if that game has no render yet). If `game` is omitted, the entity's
 *   `path` is `null` and `game` is `null`.
 * - For a SHARED asset, returns the game-agnostic asset (`game` is `null`),
 *   regardless of the `game` argument.
 * - Returns `undefined` if no asset with `id` exists.
 */
export function getAsset(catalog: AssetCatalog, id: string, game?: GameSlug): Asset | undefined {
  const entity = catalog.entities.find((e) => e.id === id);
  if (entity) {
    const path = game ? resolveEntityVariantPath(entity, game) : null;
    return {
      id: entity.id,
      kind: entity.kind,
      name: entity.name,
      path,
      game: game ?? null,
    };
  }

  const shared = catalog.shared.find((s) => s.id === id);
  if (shared) {
    return {
      id: shared.id,
      kind: shared.kind,
      name: shared.name,
      path: shared.path,
      game: null,
    };
  }

  return undefined;
}

/** One cell of the variant matrix: an entity's intent/state for a single game. */
export interface MatrixCell {
  game: GameSlug;
  /** This game is in the entity's `games` (the matrix intends a render here). */
  intended: boolean;
  /** A local or aliased render exists for this game. */
  rendered: boolean;
  /** The render path, or `null` when not yet rendered. */
  path: string | null;
}

/** A full matrix row: one entity across every game. */
export interface MatrixRow {
  id: string;
  name: string;
  faction: Faction;
  cells: MatrixCell[];
}

/** The games an entity is intended to render in (the matrix row's intent). */
export function gamesFor(catalog: AssetCatalog, id: string): GameSlug[] {
  return catalog.entities.find((e) => e.id === id)?.games ?? [];
}

/** The games for which an entity has an actual render (non-null variant path). */
export function renderedGames(entity: EntityAsset): GameSlug[] {
  return GAME_SLUGS.filter((g) => resolveEntityVariantPath(entity, g) !== null);
}

/**
 * The games an entity is intended to render in but has not rendered yet — the
 * work the matrix generator still has to do for that entity.
 */
export function pendingGames(entity: EntityAsset): GameSlug[] {
  return entity.games.filter((g) => resolveEntityVariantPath(entity, g) === null);
}

/**
 * The variant matrix as rows × game cells — the populated state of the catalog.
 * Use it to drive the studio's matrix view or to audit coverage.
 */
export function matrixRows(catalog: AssetCatalog): MatrixRow[] {
  return catalog.entities.map((e) => ({
    id: e.id,
    name: e.name,
    faction: e.faction,
    cells: GAME_SLUGS.map((game) => {
      const path = resolveEntityVariantPath(e, game);
      return {
        game,
        intended: e.games.includes(game),
        rendered: path !== null,
        path,
      };
    }),
  }));
}

export * as scourgeSurvivors from "./scourge-survivors";

// Canonical asset index resolver (deadrot.com#343): local path + CDN URL
// resolution over the generated `assets.index.json`.
export * from "./asset-index";

// 3D model manifest resolver (deadrot.com#493): resolve LFS-tracked GLB/glTF
// masters by stable id, the same way sprites resolve.
export * from "./models";
