# Starblight Runtime Sprites

Generated for Starblight on 2026-06-04 from the lore `DESIGN.md` locked style:
medium-chunky detailed pixel art, side-on/top-down arcade shooter framing, fixed
DOOM palette, and toxic green reserved for Scourge cores only.

Pipeline:

- Prompted each asset as a single sprite on flat `#ff00ff` chroma key.
- Removed chroma with the Codex imagegen `remove_chroma_key.py` helper.
- Cropped, box-downscaled to the lore pixel grid target, hard-remapped to the
  lore palette, added a subtle near-black outline, and saved lossless WebP.
- PNG siblings and `contact-sheet.png` are review copies; runtime code imports
  the WebP files.

Runtime set:

- `player-interceptor.webp`
- `scourge-grunt.webp`
- `scourge-swarmling.webp`
- `scourge-weaver.webp`
- `scourge-spitter.webp`
- `scourge-elite.webp`
- `orbital-breach-carrier.webp`
- `salvage-shard.webp`
