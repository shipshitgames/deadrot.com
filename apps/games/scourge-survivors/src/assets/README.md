# Scourge Survivors Assets

Runtime binaries moved to `@shipshitgames/assets`.

This folder keeps only compatibility shims used by existing game imports:

- `catalog.ts` wraps `@shipshitgames/assets/scourge-survivors` and adds local
  Three.js texture helpers. It also exposes the game `AssetCatalog` loader used
  by runtime systems and React UI to resolve semantic aliases from the packaged
  manifest instead of importing asset file paths directly.
- `ui/pixelIcons.ts` re-exports packaged pixel icon IDs and URLs.

Source masters, drafts, generated originals, audio credits, and runtime files
live in:

`@shipshitgames/assets/games/scourge-survivors/`
