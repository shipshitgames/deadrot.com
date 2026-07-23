import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import {
  entityForPage,
  gameLabels,
  packageAssetUrl,
  renderedVariants,
} from "./packageArtGalleryData"
import style from "./styles/packageArtGallery.scss"

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
        {variants.map(({ game, path, sourceGame }) => (
          <figure key={`${game}:${path}`} class="package-art-card">
            <img
              src={packageAssetUrl(path)}
              alt={`${entity.name} ${gameLabels[game]} package art`}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <strong>{gameLabels[game]}</strong>
              {sourceGame !== game && <span>Reuses {gameLabels[sourceGame]} plate</span>}
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
