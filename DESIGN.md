---
version: "0.2.0"
name: "DEADROT"
description: >-
  Player-facing Deadrot visual identity: brutal comic-book / cel-shaded ink,
  hard industrial UI, and Scourge parasite infestation.
canonicalDesign: apps/lore/content/DESIGN.md
canonicalArtBible: apps/lore/content/Universe/Style-Bible.md
---

# DEADROT Design Contract

This is the root orientation document. The canonical design tokens and runtime
art-production constraints live in [`apps/lore/content/DESIGN.md`](apps/lore/content/DESIGN.md);
the canonical visual prose, prompt skeleton, and historical pixel recipes live
in [`apps/lore/content/Universe/Style-Bible.md`](apps/lore/content/Universe/Style-Bible.md).
Do not duplicate or extend the active art contract here.

## Locked Direction

Deadrot is a violent playable comic page: **clean comic-book / cel-shaded ink**
with bold black contour lines, flat readable value blocks, controlled grime, and
sharp silhouettes. The Scourge must read as parasite takeover — hosts worn and
rewritten by chitin, tendrils, ruptured seams, and constrained toxic-green breach
organs.

Pixel art is historical/runtime scaffolding only. Do not commission new masters
or promoted runtime sheets with visible pixel grids, dithering, halftone dots,
stipple, noisy speckles, or faux-retro post-processing.

## Repository Boundary

This repository owns player-facing apps, curated source history, approved
masters, and runtime packs. Asset-generator products and reusable generation
automation belong in `../shipshitgames`; `packages/assetgen` is not local.
Use the sibling tooling to create assets, then preserve approved originals under
`packages/assets/sources/generated`, masters under `packages/assets/masters`,
and runtime rasters as WebP under `packages/assets/games`.

For the current workspace and seven-playable-fronts-plus-Warline architecture,
see the generated [repository catalog](docs/repository-catalog.generated.md).
