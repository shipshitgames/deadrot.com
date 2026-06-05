# 2026-06-05 Game OG Cards

## Scope

- Seven 1200x630 Open Graph cards for `deadrot.com/games/*`.
- One missing `Zero Day` web gallery thumbnail promoted from existing pre-viz.

## Source Art

The OG cards use existing `gpt-image-2` art rather than new model renders:

- `Scourge Survivors`, `Deadlane`, `Pactfall`, `Starblight`, `Redline`, and
  `Rothulk` use the shipped gallery thumbnail illustrations from
  `apps/web/public/images/games/*.webp`.
- `Zero Day` uses `apps/lore/content/Art/Previs/2026-06-04-game-previs/zero-day-v01.png`,
  generated in the 2026-06-04 game pre-viz batch.

## Composition

- Tooling: Sharp through the bundled Codex Node runtime.
- Size: 1200x630 PNG.
- Layout: gpt-image-2 art on the right, dark Deadrot metadata panel on the
  left, exact SVG/text overlay for the game title, tagline, status, genre, and
  URL.
- Rationale: do not ask the image model to render readable social-card text.
  Deterministic composition keeps titles and URLs exact.

## Results

| Game | Final web asset |
| --- | --- |
| Scourge Survivors | `apps/web/public/images/og/games/scourge-survivors.png` |
| Deadlane | `apps/web/public/images/og/games/deadlane.png` |
| Pactfall | `apps/web/public/images/og/games/pactfall.png` |
| Starblight | `apps/web/public/images/og/games/starblight.png` |
| Redline | `apps/web/public/images/og/games/redline.png` |
| Rothulk | `apps/web/public/images/og/games/rothulk.png` |
| Zero Day | `apps/web/public/images/og/games/zero-day.png` |

## Related Thumbnail

| Game | Final web asset | Notes |
| --- | --- | --- |
| Zero Day | `apps/web/public/images/games/zero-day.webp` | 640x960 crop from the `zero-day-v01` pre-viz source so the game gallery no longer points at a missing image. |
