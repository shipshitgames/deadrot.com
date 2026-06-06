---
status: active
type: asset-audit
date: 2026-06-05
---

# Style Lock Audit - 2026-06-05

## Answer

Yes, we have the prompt. The exact prompt that produced the locked reference
family is preserved in `Art/style-bakeoff/run-d2.sh`. The specific image
`d2-ripper-medium.png` maps to `PROMPT[ripper-medium]`:

```text
STYLE: HIGH-DETAIL PIXEL ART game sprite tuned for GAMEPLAY readability. TRUE
pixel art on a visible chunky pixel grid: bold hand-placed pixels, hard crisp
pixel edges, NO anti-aliasing, ordered dithered shading. SILHOUETTE-FIRST - a
clean, instantly readable shape - with a subtle dark outline and a single
hellfire rim-light from one low side so it pops off a dark background;
consistent lighting direction across the set. Detailed but NOT noisy. Premium
modern pixel-art (Blasphemous, Dead Cells) crossed with remastered 1990s DOOM
sprites. ABSOLUTELY NOT a smooth 3D render, NOT photorealistic, NOT
anti-aliased, NOT painted concept art - it MUST read as chunky pixel art made
of visible square pixels.
```

The chunkiness clause for the locked file is:

```text
Medium-chunky pixel grid, roughly a 110px-tall sprite - clearly blocky visible
pixels.
```

The subject clause is the Scourge Swarm-Ripper. The palette and parasite rules
are in the same script and are mirrored by `Universe/Style-Bible.md` plus
`DESIGN.md`'s `assetgen:` block.

## Do We Follow It Everywhere?

Not yet.

Mechanically present after this audit pass:

- Website game card images, hero image, OG cards, character sprites, and
  bestiary sprites all resolve to files.
- `packages/assets/assets-catalog.json` has no pending entity renders for the
  games it declares in each entity row.
- Scourge Survivors consumes `@shipshitgames/assets/scourge-survivors`.
- Per-game style-reference files now exist in `Art/style-refs/`.
- The DOOM palette file now exists at `Art/grade/doom.gpl`.
- Shared catalog assets now resolve under `packages/assets/shared/`.

Still drifting / incomplete:

- The 2026-06-04 website key-art and portrait placeholder batches are explicitly
  marked off-canon because they used hi-fi render language instead of the
  locked medium-chunky pixel-art prompt.
- Deadlane, Pactfall, Starblight, Redline, and Rothulk still mostly render
  procedural/prototype shapes in app code instead of consuming the shared entity
  catalog at runtime.
- The shared catalog had missing shared assets: FX, UI icons, font files, and
  audio cues. First-pass placeholders were added on 2026-06-05.
- The entity catalog paths existed, but the entity files were 182-byte placeholder
  WebPs. First-pass visible 256x256 plates were generated from the best existing
  Deadrot sprite/portrait source on 2026-06-05. These unblock resolution, but
  they are not final per-game camera renders.

## Leftovers To Regenerate

Superseded prompt batches:

- `Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`
- `Art/Prompt-Batches/2026-06-04-website-portrait-placeholders.md`

Superseded asset families:

- Website hero/game key art that came from the hi-fi placeholder pass.
- Website portrait plates generated from the hi-fi placeholder pass.
- Any catalog entity plate still sourced from those website portrait plates;
  these are first-pass visibility placeholders until regenerated through the
  locked asset pipeline.
- Any future asset generated from prompt phrases like `hi-fi render`,
  `not pixel art`, `smooth 3D`, `painted concept art`, or cyberpunk neon.

## Pinned Files

- `Art/style-refs/scourge-survivors.webp`
- `Art/style-refs/shared.webp`
- `Art/style-bakeoff/d2-ripper-medium.png`
- `packages/assets/sources/lore-art/style-refs/scourge-survivors.webp`
- `packages/assets/sources/lore-art/style-refs/shared.webp`

The generated-output history remains preserved under
`packages/assets/sources/lore-art/style-bakeoff/`.

## First-Pass Assets Added

- 38 visible entity plates under `packages/assets/entities/**/<game>.webp`,
  replacing 182-byte placeholder files.
- 4 shared FX WebPs under `packages/assets/shared/fx/`.
- 5 shared UI SVGs under `packages/assets/shared/ui/`.
- 2 self-hosted WOFF2 font files under `packages/assets/shared/fonts/`.
- 3 shared synthetic OGG audio cues under `packages/assets/shared/audio/`.
- The post-grade palette file at `Art/grade/doom.gpl`, mirrored under
  `packages/assets/sources/lore-art/grade/doom.gpl`.
