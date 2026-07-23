# Starblight Hull Language v01

Approved design master for the four-body Starblight hull silhouette lock in
deadrot.com#160.

## Contents

- `hull-silhouette-sheet-v01.png` — 1672×941 comic-ink reference sheet. The
  upper row locks faction materials; the lower row repeats all four bodies as
  pure-black silhouettes for reduction testing.
- `hull-silhouette-gameplay-scale-1080p-v01.png` — 1920×1080 validation plate
  with the four black reads at approximately 58 px ship height, derived from
  the locked `2.6 / 48 × 1080` camera ratio.

Left to right: Pyre Razor, Pyre Furnace, Warden Bastion, Warden Shepherd.

## Provenance

- Generated: 2026-07-22 with Codex built-in `image_gen` (`gpt-image-2`).
- Source generation: `019f88e6-8adb-7a72-8fd2-422f7f9281aa`.
- Curated source copy:
  `packages/assets/sources/generated/2026-07-22/games/starblight/hull-silhouettes/hull-silhouette-sheet-v01.png`.
- Prompt record:
  `apps/lore/content/Art/Prompt-Batches/2026-07-22-starblight-hull-silhouettes.md`.
- Post-processing: the approved full sheet is byte-identical to the generated
  source. The gameplay-scale plate was deterministically cropped and reduced
  from the sheet with FFmpeg; no hull shape was redrawn.

This is a design master, not a runtime asset. Runtime promotion requires the
IDs and manifest contract in `apps/games/starblight/DESIGN.md`, an approved body
mechanic, and a WebP derivative in `packages/assets/games/starblight`.
