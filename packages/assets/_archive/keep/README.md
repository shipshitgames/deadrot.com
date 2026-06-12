# Archive Keep Review

Human-selected generated assets worth reviewing before deletion or promotion.
These are not approved runtime assets.

## Current Batch

Source batch:
`raw-generator-cache/gpt-image-2/2026-06-05`

- `scourge-reference-*.png`: 25 reference images for Scourge art direction,
  enemies, characters, environments, UI/menu composition, and key art.
- `scourge-cleanup-candidate-*.png`: 32 chroma-backed or sheet-like images that
  may be useful after alpha cleanup, cropping, style normalization, semantic
  naming, and human approval.

## Next Step

Promote only after review:

- Curated references go to
  `packages/assets/sources/generated/<topic>/<yyyy-mm-dd>/<kebab-name>.png`.
- Runtime-ready finals go to semantic runtime paths such as
  `packages/assets/games/<game>/...` after cleanup/export.
- Rejected files can move to `to_delete/raw/` or be removed after review.
