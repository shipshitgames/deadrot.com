import catalogJson from "../../../../packages/assets/assets-catalog.json" with { type: "json" }
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/packageArtGallery.scss"

type GameSlug = "scourge-survivors" | "deadlane" | "pactfall" | "starblight" | "redline" | "rothulk"

type CatalogEntity = {
  id: string
  kind: "entity" | "boss"
  name: string
  faction: string
  variants: Record<GameSlug, string | null>
}

const gameLabels: Record<GameSlug, string> = {
  "scourge-survivors": "Scourge Survivors",
  deadlane: "Deadlane",
  pactfall: "Pactfall",
  starblight: "Starblight",
  redline: "Redline",
  rothulk: "Rothulk",
}

const gameOrder = Object.keys(gameLabels) as GameSlug[]
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

function entityForPage(slug: string | undefined) {
  const pageId = slugify(lastSlugSegment(slug))
  if (!pageId) return undefined

  return catalog.entities.find((entity) => entity.id === pageId || slugify(entity.name) === pageId)
}

function renderedVariants(entity: CatalogEntity) {
  return gameOrder.flatMap((game) => {
    const path = entity.variants[game]
    return path ? [{ game, path }] : []
  })
}

const PackageArtGallery: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const slug = fileData.slug
  if (!slug?.startsWith("Characters/") && !slug?.startsWith("Bestiary/")) return null

  const entity = entityForPage(slug)
  if (!entity) return null

  const variants = renderedVariants(entity)
  if (variants.length === 0) return null

  return (
    <section class="package-art-gallery" aria-labelledby="package-art-gallery-title">
      <h2 id="package-art-gallery-title">Package Art</h2>
      <p class="package-art-gallery__meta">
        {entity.name} / {entity.id} / {entity.faction}
      </p>
      <div class="package-art-gallery__grid">
        {variants.map(({ game, path }) => (
          <figure key={`${game}:${path}`} class="package-art-card">
            <img
              src={`/assets/${path}`}
              alt={`${entity.name} ${gameLabels[game]} package art`}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <strong>{gameLabels[game]}</strong>
              <code>packages/assets/{path}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

PackageArtGallery.css = style

export default (() => PackageArtGallery) satisfies QuartzComponentConstructor
