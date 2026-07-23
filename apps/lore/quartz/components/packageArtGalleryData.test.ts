import assert from "node:assert/strict"
import { test } from "node:test"

import { entityForPage, packageAssetUrl, renderedVariants } from "./packageArtGalleryData"

test("Pyre Duelist lore art includes Pactfall and its Brawl alias", () => {
  const entity = entityForPage("Characters/Pyre-Duelist")
  assert.ok(entity)

  const variants = renderedVariants(entity)
  assert.deepEqual(
    variants.map(({ game, sourceGame }) => ({ game, sourceGame })),
    [
      { game: "pactfall", sourceGame: "pactfall" },
      { game: "brawl", sourceGame: "pactfall" },
    ],
  )
  assert.equal(variants[0].path, variants[1].path)
})

test("package art uses the same local asset-origin contract as the web hub", () => {
  assert.match(
    packageAssetUrl("entities/pyre-duelist/pactfall.webp"),
    /\/entities\/pyre-duelist\/pactfall\.webp$/,
  )
})
