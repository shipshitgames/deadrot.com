# Repo Boundary

last_verified: 2026-06-05

`deadrotcom` is the shipped Deadrot monorepo.

## Owns

- Player-facing Deadrot apps.
- Shipped games in `apps/games/*`.
- Lore/canon app in `apps/lore`; the Obsidian vault root is
  `apps/lore/content`.
- Runtime packages in `packages/*` that shipped games import.
- Canonical shared assets in `packages/assets`.
- Runtime audio, soundtrack, sprites, textures, fonts, UI art, and preserved
  generated source history.

## Does Not Own

- Asset generation product surfaces.
- Generator CLI, desktop, or app tooling.
- Provider/keychain integrations for asset generation.
- Studio-site product tooling.

Those belong in the sibling `../shipshitgames` repo.

## Rule

If it ships to players or is imported by shipped Deadrot games, it belongs here.
If it builds/generates/edits assets as tooling, it belongs in `../shipshitgames`.

`packages/assetgen` stays in `../shipshitgames` because it is the studio CLI
product to ship and dogfood. `@shipshitgames/assets` stays in this repo because
it is imported by shipped games.
