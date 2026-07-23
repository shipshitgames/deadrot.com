import catalogJson from "../../../../packages/assets/assets-catalog.json" with { type: "json" }

export type GameSlug =
  "scourge-survivors" | "deadlane" | "pactfall" | "brawl" | "starblight" | "redline" | "rothulk"

type Variant =
  string | { type: "alias"; sourceGame: GameSlug } | { type: "placeholder"; note: string } | null

export type CatalogEntity = {
  id: string
  kind: "entity" | "boss"
  name: string
  faction: string
  games: GameSlug[]
  variants: Record<GameSlug, Variant>
}

export const gameLabels: Record<GameSlug, string> = {
  "scourge-survivors": "Scourge Survivors",
  deadlane: "Deadlane",
  pactfall: "Pactfall",
  brawl: "Brawl",
  starblight: "Starblight",
  redline: "Redline",
  rothulk: "Rothulk",
}

const catalog = catalogJson as { entities: CatalogEntity[] }

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function lastSlugSegment(slug: string | undefined) {
  return slug?.split("/").at(-1) ?? ""
}

export function entityForPage(slug: string | undefined) {
  const pageId = slugify(lastSlugSegment(slug))
  if (!pageId) return undefined

  return catalog.entities.find((entity) => entity.id === pageId || slugify(entity.name) === pageId)
}

function resolveVariant(entity: CatalogEntity, game: GameSlug) {
  let sourceGame = game
  const visited = new Set<GameSlug>()

  while (!visited.has(sourceGame)) {
    visited.add(sourceGame)
    const variant = entity.variants[sourceGame]
    if (typeof variant === "string") return { game, path: variant, sourceGame }
    if (variant?.type === "alias") {
      sourceGame = variant.sourceGame
      continue
    }
    return null
  }

  throw new Error(`Circular package-art alias for ${entity.id}.${game}`)
}

export function renderedVariants(entity: CatalogEntity) {
  return entity.games.flatMap((game) => {
    const variant = resolveVariant(entity, game)
    return variant ? [variant] : []
  })
}

const configuredAssetOrigin = process.env.NEXT_PUBLIC_DEADROT_ASSET_ORIGIN?.trim()
const assetOrigin = configuredAssetOrigin ? configuredAssetOrigin.replace(/\/+$/, "") : "/assets"

export function packageAssetUrl(path: string) {
  return `${assetOrigin}/${path.replace(/^\/+/, "")}`
}
