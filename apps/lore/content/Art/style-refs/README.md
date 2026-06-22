# Locked Style References

Status: locked
Last updated: 2026-06-05

This folder pins the image-reference files named by `DESIGN.md`
`assetgen.referenceImages`.

## Primary Visual Pin

`packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp` is sourced from
`packages/assets/sources/generated/lore-art-style-bakeoff/2026-06-04/d2-ripper-medium.png`. This is the locked house look:

- high-detail medium-chunky pixel art
- visible square pixel grid, roughly 110px-tall runtime sprite target
- hard crisp edges, ordered dithering, no anti-aliasing
- silhouette-first Scourge parasite read
- blood / rust / gunmetal / bone with Scourge-only toxic green
- near-black void, one low hellfire rim light
- not hi-fi render, not smooth 3D, not painted concept art

The source prompt is preserved in `../style-bakeoff/run-d2.sh`, under
`PROMPT[ripper-medium]`. Use that prompt family and `Style-Bible.md` for every
new asset.

## First-Pass Per-Game Refs

These are style pins, not final gameplay assets. Replace a game's file only with
a stronger locked-medium image in that game's camera:

- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp` - exact `d2-ripper-medium` visual lock.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/deadlane.webp` - first top-down/lane pre-viz ref.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/pactfall.webp` - first isometric arena pre-viz ref.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/starblight.webp` - first side/top-down orbital pre-viz ref.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/redline.webp` - first runner-camera pre-viz ref.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/rothulk.webp` - first platformer-camera pre-viz ref.
- `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp` - exact `d2-ripper-medium` visual lock for fallback use.

## Drift Rule

Any prompt or asset asking for `hi-fi render`, `smooth 3D render`,
`not pixel art`, blue/teal/cyan/magenta neon, fantasy knights, or polished
clean sci-fi is off-canon unless the Style Bible is explicitly changed first.
