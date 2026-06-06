# Deadrot Monorepo - Repo Memory

last_verified: 2026-06-05

## What this is
The shipped Deadrot monorepo (Turborepo + Bun), GitHub
`shipshitgames/deadrotcom`.

This repo owns the player-facing Deadrot products and every runtime package or
asset that ships with them:

- `apps/web` - Deadrot web hub at `deadrot.com`.
- `apps/lore` - lore/canon app. Its Obsidian vault root is
  `apps/lore/content` because that folder contains `.obsidian/`.
- `apps/games/*` - shipped Deadrot games.
- `packages/assets` - shared asset catalog, game runtime packs, audio,
  soundtrack, preserved source history, and generated originals.
- `packages/engine` - shared game runtime engine primitives.
- `packages/ui` - shared game UI primitives.
- `packages/warline` - runtime multiplayer/networking helpers.

## Repo Boundary
Deadrot assets and runtime packages ship from this repo.

Studio tooling that builds/generates those assets lives in the sibling repo:

```txt
../shipshitgames
```

Those tools may read from and write to this repo, especially
`packages/assets`, but the generated outputs ship from `deadrotcom`.

Games in this repo should consume shared runtime packages with workspace
dependencies such as `"@shipshitgames/assets": "workspace:*"`.

Do not move `packages/assetgen` into this repo. Assetgen is the studio/product
CLI we need to ship and dogfood from the sibling `shipshitgames` repo.

Do not create a separate root `deadrotcom/lore` vault unless the user explicitly
asks for that move. The current Deadrot Obsidian vault is
`apps/lore/content`.

## Asset Rule
If it ships to players, is imported by a game, or is part of Deadrot asset
history that must be preserved, it belongs under `packages/assets`.

Runtime asset folders should be semantic and scan-friendly. Prefer grouping by
game, domain, faction, and name, for example:

- `games/<game>/players/pyre/<character-name>/`
- `games/<game>/enemies/scourge/<enemy-name>/`
- `games/<game>/weapons/<faction>/<weapon-name>.*`
- `games/<game>/pickups/<type>/<pickup-name>.*`
- `games/<game>/audio/{music,sfx}/`
- `games/<game>/ui/...`

Do not leave permanent generated-image history in temporary cache folders such
as `~/.codex/generated_images/`; preserve originals under
`packages/assets/sources/generated/`.
