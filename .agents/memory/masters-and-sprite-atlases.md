---
status: active
last_verified: 2026-06-12
---

# Masters, Sprites, and Atlases

Decided 2026-06-12.

## Canonical master location

Use the shared asset package for all non-runtime masters:

```txt
packages/assets/masters/<type>/<domain>/<asset-id>/
```

Examples:

```txt
packages/assets/masters/art/scourge/swarm-spitter/
packages/assets/masters/sprites/scourge-survivors/host-grunt/
packages/assets/masters/models/scourge/breach-boss/
packages/assets/masters/audio/scourge-survivors/music/
packages/assets/masters/ui/web/cards/
```

Use `packages/assets/masters`, not lore-local `Art-Masters`, for new master
assets. `apps/lore/content/Assets/Art-Masters` was an early art-only location
and should be treated as legacy/migration debt, not a precedent.

Do not create a separate root `deadrotcom/lore/masters` folder or store binary
asset masters inside `apps/lore/content`. The lore vault owns canon Markdown and
may reference/embed package assets, but `packages/assets` is the one home for
asset binaries, runtime packs, generated originals, and approved masters.

## What belongs where

- `packages/assets/masters/**`: approved source masters, turnarounds,
  reference locks, editable source exports, and non-runtime master material.
- `packages/assets/sources/generated/**`: preserved generated originals and
  provenance/source history.
- `packages/assets/games/<game>/**`: curated runtime files imported by shipped
  games.
- `apps/lore/content/**`: canon/lore Markdown and asset references; no new
  binary master asset ownership.
- `../shipshitgames/packages/assetgen`: reusable generation, slicing, pixelizing,
  packing, and atlas tooling.

## Sprite sheet standards

Industry practice is metadata-first, not one universal grid shape.

- Use `1xN` horizontal strips for a single view/action: weapon tiers, simple VFX,
  UI effects, one-direction characters, or one animation state.
- Use `DxN` grids for directional/multi-view animation: directions or views are
  rows, frames are columns.
- For Scourge Survivors billboard enemies, the source sheet convention is `3xN`:
  rows are `front`, `side`, `back`; columns are frames. Side can be mirrored by
  runtime code unless asymmetry matters.
- Keep cell dimensions, action names, view order, frame count, fps/duration,
  loop behavior, and anchor/pivot in manifest or atlas metadata. Do not infer
  them from filenames or hardcode them in gameplay code.

## Runtime atlas target

The long-term runtime format for sprites is:

```txt
<pack-id>.webp
<pack-id>.json
```

The JSON metadata should describe:

- atlas image path, atlas dimensions, and content hash/version.
- each frame rectangle: `x`, `y`, `w`, `h`.
- original source size and trimmed rectangle when trimming is used.
- anchor/pivot per frame or per animation.
- action/tag, view/direction, frame index, duration/fps, and loop mode.
- license/provenance reference or asset manifest id.

The game manifest points at the atlas/metadata pair by stable id. Runtime systems
ask for `entity/action/view/frame`, and the loader maps that to atlas UVs.
Gameplay code should never know the atlas grid, cell size, or file layout.

Split WebP frame files are acceptable for early packs and debugging. Promote to
atlas + JSON metadata once the loader and assetgen packer support the pack.
