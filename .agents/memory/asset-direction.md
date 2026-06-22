---
status: active
last_verified: 2026-06-12
---

# Asset Direction & Generation Pipeline

The locked direction for taking all 7 games to finished-product v1, and how
assets are generated. Decided 2026-06-09 (Session 4).

## Art direction = 3D pixel art (HD-2D)
The house style in `DESIGN.md` is **medium-chunky high-detail pixel art**
("visible square pixels, hard crisp edges, no anti-aliasing… ABSOLUTELY NOT a
smooth 3D render"). "3D pixel art" does NOT move off pixel art — it means
**pose/render 3D forms, then pixelize them to the locked 26-colour DOOM palette**.
Per-game camera is genre-appropriate (`DESIGN.md` `gameArtDirection`): only
**pactfall** is isometric; scourge-survivors + **deadlane** are first-person
billboard (deadlane locked to first-person walk-the-lane 2026-06-09, was
top-down); starblight/redline/rothulk side-on; warline map view. Tool mapping:
**Imagen** = visuals, **ElevenLabs** = SFX + voice, **Suno** = music.

## Pipeline (the assetgen art flow)
`assetgen` (sibling `../shipshitgames`, repo `shipshitgames/shipshit.games`) does
**2D text-to-image (Codex/Imagen) → `assetgen/src/pixelize.ts`** (flood-fill
cutout → downscale ~110px → quantize to the fixed DOOM palette → hard 1px alpha).
There is **no 3D step today** (Replicate provider is stubbed for `model`/`3d`
kinds but unused). Animation frames are each generated independently, so they
wobble — which is why no game has a real animation pack yet.

## Hybrid generation policy
- **Route A** (prompt → pixelize, exists): static one-offs — key art, OG, props,
  icons, single-pose enemies.
- **Route B** (3D model → offscreen Three.js turntable → pixelize): anything
  **animated or multi-view** — players, named enemies, bosses. Fixes frame
  coherence + front/side/back consistency. The "bake stage" is the missing tooling
  → tracked in **shipshit.games#164** (lives in assetgen per [[repo-boundary]]).

## Masters + sprite packaging
New non-runtime masters use
`packages/assets/masters/<type>/<domain>/<asset-id>/`, with `type` folders such
as `art`, `sprites`, `models`, `audio`, and `ui`. Lore Markdown may reference or
embed package assets, but `apps/lore/content` does not own asset binaries. The
older `apps/lore/content/Assets/Art-Masters` path is legacy/migration debt; use
the package-owned `masters` layout for new work so runtime assets, generated
sources, and approved masters stay in one asset package.

Pixel animation follows the usual metadata-first game-art practice:

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

See [[workflow]] for branch/CI gates and [[repo-boundary]] for the
deadrot/assetgen split.
