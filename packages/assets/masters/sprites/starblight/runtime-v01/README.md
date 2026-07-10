# Starblight Sprite Masters

Generated for Starblight on 2026-06-04 from the lore `DESIGN.md` locked style:
medium-chunky detailed pixel art, side-on/top-down arcade shooter framing, fixed
DOOM palette, and toxic green reserved for Scourge cores only.

Pipeline:

- Prompted each asset as a single sprite on flat `#ff00ff` chroma key.
- Removed chroma with the Codex imagegen `remove_chroma_key.py` helper.
- Cropped, box-downscaled to the lore pixel grid target, hard-remapped to the
  lore palette, added a subtle near-black outline, and saved lossless WebP.
- PNG files and `contact-sheet.png` are preserved review/master copies. Runtime
  WebPs live in `packages/assets/games/starblight` and are registered in that
  pack's `assets.json`; app source must not own raster assets.

Runtime set:

- `player-interceptor.webp`
- `scourge-grunt.webp`
- `scourge-swarmling.webp`
- `scourge-weaver.webp`
- `scourge-spitter.webp`
- `scourge-elite.webp`
- `orbital-breach-carrier.webp`
- `salvage-shard.webp`
