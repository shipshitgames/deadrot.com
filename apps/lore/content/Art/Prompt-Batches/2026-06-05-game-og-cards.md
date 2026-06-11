# 2026-06-05 Game OG Cards

## Scope

- Seven 1200x630 Open Graph cards for `deadrot.com/games/*`.
- One missing `Zero Day` web gallery thumbnail promoted from existing pre-viz.

## Source Art

The OG cards use existing `gpt-image-2` art rather than new model renders:

- `Scourge Survivors`, `Deadlane`, `Pactfall`, `Starblight`, `Redline`, and
  `Rothulk` use the package title illustrations from
  `packages/assets/games/<slug>/ui/menu/title.webp`.
- `Zero Day` uses `apps/lore/content/Art/Previs/2026-06-04-game-previs/zero-day-v01.png`,
  generated in the 2026-06-04 game pre-viz batch.

## Composition

- Tooling: Sharp through the bundled Codex Node runtime.
- Size: 1200x630. Shipped games export JPG for crawler compatibility; concept
  titles may remain PNG until promoted.
- Layout: gpt-image-2 art on the right, dark Deadrot metadata panel on the
  left, exact SVG/text overlay for the game title, tagline, status, genre, and
  URL.
- Rationale: do not ask the image model to render readable social-card text.
  Deterministic composition keeps titles and URLs exact.

## Results

| Game | Final web asset |
| --- | --- |
| Scourge Survivors | `packages/assets/games/scourge-survivors/ui/social/og.jpg` |
| Deadlane | `packages/assets/games/deadlane/ui/social/og.jpg` |
| Pactfall | `packages/assets/games/pactfall/ui/social/og.jpg` |
| Starblight | `packages/assets/games/starblight/ui/social/og.jpg` |
| Redline | `packages/assets/games/redline/ui/social/og.jpg` |
| Rothulk | `packages/assets/games/rothulk/ui/social/og.jpg` |
| Zero Day | `packages/assets/concepts/zero-day/ui/social/og.png` |

## Related Thumbnail

| Game | Final web asset | Notes |
| --- | --- | --- |
| Zero Day | `packages/assets/concepts/zero-day/ui/social/og.png` | Current concept image used until Zero Day has a shipped runtime pack. |
