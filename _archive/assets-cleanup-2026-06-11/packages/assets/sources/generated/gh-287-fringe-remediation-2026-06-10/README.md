# GH-287 Asset QA Remediation — Dark fringe + clipped tier sheets

Issue: https://github.com/shipshitgames/deadrotcom/issues/287
Branch: feat/287-scourge-survivors-regenerate-dark-fringe-sprites-f (worktree)

## What was fixed
- 4 sprites with dark halo/fringe on alpha edges (per automated edge-quality scan):
  - players/pyre/vector/side.webp
  - players/pyre/ranger/side.webp
  - fx/pyre/muzzle-flash.webp
  - projectiles/scourge/enemy-spit.webp
- 2 weapon tier sheets clipped at border (art touching frame edge):
  - weapons/pyre/smg-tiers.webp
  - weapons/pyre/cannon-tiers.webp

## Generation
- Tool: xAI Grok Imagine via image_edit (reference-conditioned on the prior runtime assets)
- Date: 2026-06-10
- Method: precise prompts for clean alpha matte (no dark fringe/bleed), added breathing room margin on tier sheets, exact fidelity to pose/style/details/lighting.
- References: the original shipped sprites in packages/assets/games/scourge-survivors/...

## Outputs (source)
- *.jpg here are the direct Grok edited results.
- Converted to lossless .webp and placed in the runtime locations (see packages/assets/games/scourge-survivors/...).
- License records in packages/assets/games/scourge-survivors/assets.json updated for the affected entries.

## Post-processing
- Converted via ffmpeg to .webp (lossless where possible for sprites).
- For tier sheets: canvas expanded with padding; dimensions in manifest will be updated to match new files.
- All files remain under packages/assets (required).

See original issue for the scan metrics and related #290, #265, #279.
