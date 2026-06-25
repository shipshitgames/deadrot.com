---
status: active
last_verified: 2026-06-25
---

# Asset Direction & Generation Pipeline

The locked direction for taking all 7 games to finished-product v1, and how
assets are generated. Supersedes the 2026-06-09 HD-2D/pixel target after the
comic/cel lock pass landed on 2026-06-17.

## Art direction = clean comic-book / cel-shaded ink
As of 2026-06-17, Deadrot targets a violent playable comic page: bold black
contours, flat readable value blocks, graphic shadows, controlled grime, sharp
silhouettes, and disciplined faction color. Pixel-art assets may remain as
temporary runtime scaffolding while production comic sheets are generated and
promoted, but new masters must not reinforce the old pixel target.

Avoid halftone dots, stipple fields, noisy speckles, dithered pixel grids, fake
bokeh, and painterly sparkle. The Scourge must read as parasite takeover in
every design: host flesh/armor/machine being worn, ruptured seams, tendrils
through joints, black chitin over stolen bone/metal, and toxic-green breach
cores only as parasite organs.

Per-game camera remains genre-appropriate: scourge-survivors and deadlane use
first-person billboard readability; pactfall is lane/MOBA-isometric; starblight,
redline, and rothulk keep their genre cameras; warline is map/card focused.
Tool mapping remains **Imagen/Codex image generation** for visuals,
**ElevenLabs** for SFX + voice, and **Suno** for music when needed.

## Pipeline (the assetgen art flow)
`assetgen` (sibling `../shipshitgames`, repo `shipshitgames/shipshit.games`) is
still the studio-side generation product. It should produce or promote
comic/cel masters, cutout sheets, runtime WebP assets, and manifest metadata into
`deadrotcom/packages/assets`. Product repos store curated outputs; generator
tooling belongs in the studio repo.

## Hybrid generation policy
- **Route A** (image prompt → curated comic/cel master): static one-offs such as
  key art, OG/social, props, icons, and reference boards.
- **Route B** (production sheet → cutout/runtime pack): players, named enemies,
  bosses, weapons, and UI surfaces that need front/side/back/action/death reads.
- **Route C** (future model/turntable support): still useful for multi-view
  coherence, but the output target is comic/cel runtime readability, not the old
  pixelized DOOM-palette look.

## Masters + sprite packaging
New non-runtime masters use
`packages/assets/masters/<type>/<domain>/<asset-id>/`, with `type` folders such
as `art`, `sprites`, `models`, `audio`, and `ui`. Lore Markdown may reference or
embed package assets, but `apps/lore/content` does not own asset binaries. The
older `apps/lore/content/Assets/Art-Masters` path is legacy/migration debt; use
the package-owned `masters` layout for new work so runtime assets, generated
sources, and approved masters stay in one asset package.

Animation follows the usual metadata-first game-art practice:

- `1xN` source strips for single-view/single-action runs such as weapon tiers,
  one-direction effects, and simple UI/VFX sheets.
- `DxN` source grids when a sprite has multiple views or directions; rows are
  views/directions, columns are frames.
- For Scourge Survivors billboard enemies, default to `3xN` source grids:
  `front`, `side`, `back` rows and frame columns. Side views may be mirrored in
  code unless asymmetry becomes important.

The runtime target is atlas + JSON metadata: `<pack-id>.webp` plus
`<pack-id>.json`, registered in the game manifest. Metadata owns frame rects,
source/trim sizes, anchors, actions, views, frame durations/fps, loop flags, and
provenance/manifest ids. Gameplay asks for `entity/action/view/frame`; loaders
map that to atlas UVs. Split `frame-00.webp` files remain acceptable for early
debug packs until assetgen and the loader support packed atlases.

## Inventory + tracking issues (deadrot.com)
- **#295** epic "Asset generation inventory" + children **#296–#302** (one per
  game) = the consolidated to-generate list (≈627 items). Cross-references the
  ~30 scattered asset issues (#260 music P0, #257/#258 weapons, #97 audio,
  #287–#290 QA, #293 pipeline, catalog null variants, etc.) rather than
  duplicating them.
- The canonical `packages/assets/assets-catalog.json` **variant matrix** is the
  authoritative "to-generate" signal: each entity's per-game `variants` path is
  `null` until rendered. (Warline is intentionally outside the entity matrix — a
  map/icon game.)
- **#278** finale boss = the Perdition Bourdon + "The Collapse" feral-minute
  (canon-grounded; meta-progression-gated win).
- **#427** tracks productionizing the comic/cel pass across Scourge Survivors
  enemies, weapons, UI, arenas, prompts, and asset custody.

See [[workflow]] for branch/CI gates and [[repo-boundary]] for the
deadrot/assetgen split.
