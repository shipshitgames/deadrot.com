# Deadrot Monorepo - Repo Memory

last_verified: 2026-06-12

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
  soundtrack, preserved source history, generated originals, and Deadrot IP
  runtime data. Internal `@deadrot/*` aliases should resolve into this package
  or nearby Deadrot packages while they are monorepo-only.
- `packages/ui` - shared game UI primitives (incl. the shared `CodexScreen`
  dossier browser).
- `packages/warline` - runtime multiplayer/networking helpers (pure state
  machine; deliberately dependency-free, incl. deterministic narrative events).
- `packages/game-kit` - `@deadrot/game-kit` (private, workspace-only): shared
  game runtime — audio engine + procedural SFX palette, juice/VFX (shake,
  particles, damage numbers, flash), core utils (fixed loop, seeded RNG, typed
  localStorage, pools, input latch), codex/lore mapping, cross-game war record.
  Upstream candidates for `@shipshitgames/engine` are listed in its README —
  graduate by upstream+publish, never fork.
- `packages/assets` also exports `./lore` — typed JSON derivative of the vault
  (games/factions/characters/bestiary/locations/timeline), drift-tested against
  the asset catalog and `@deadrot/catalog`. Vault leads, data follows; coined
  names stay `coined: true` + "(provisional)" in the vault until promoted.

## Testing gotcha
`apps/games/scourge-survivors` MUST stay on vitest: its tests import
`@shipshitgames/assets/scourge-survivors`, which uses Vite's
`import.meta.glob` — `bun test` cannot load it. Every other game/package uses
`bun test`.

## Repo Boundary
Deadrot assets and Deadrot-specific runtime packages ship from this repo.
`@shipshitgames/engine` is the exception: it is the org-level reusable engine
owned by the sibling `../shipshitgames` repo, not a Deadrot-owned package.

Workflow expectations for agents are documented in
`.agents/memory/workflow.md`.
Master asset layout and sprite atlas conventions are documented in
`.agents/memory/masters-and-sprite-atlases.md`.

Studio tooling that builds/generates those assets lives in the sibling repo:

```txt
../shipshitgames
```

Those tools may read from and write to this repo, especially
`packages/assets`, but the generated outputs ship from `deadrotcom`.

Games in this repo should consume Deadrot-owned shared runtime packages with
workspace dependencies such as `"@shipshitgames/assets": "workspace:*"`.
They should consume `@shipshitgames/engine` from the canonical studio/org
package path or release, not from a divergent local fork.

Do not move `packages/assetgen` into this repo. Assetgen is the studio/product
CLI we need to ship and dogfood from the sibling `shipshitgames` repo.

When asset generation, cleanup, sprite splitting, atlas packing, pixelization,
promotion, indexing, provider-cache rescue, or other reusable asset tooling is
needed, implement or extend it in `../shipshitgames/packages/assetgen` or the
Ship Shit Games CLI first. Product repos such as `deadrotcom` should call that
CLI and store curated outputs, not grow duplicate one-off scripts. Track CLI
coverage in `shipshitgames/shipshit.games#204`.

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

Non-runtime master assets also belong under `packages/assets`, not in the lore
vault. Use `packages/assets/masters/<type>/<domain>/<asset-id>/` for new master
types (`art`, `sprites`, `models`, `audio`, `ui`, etc.). Lore Markdown may
reference/embed those package assets, but `apps/lore/content` should not become
a second asset store. Existing `apps/lore/content/Assets/Art-Masters` files are
legacy/migration debt until they are deliberately moved with links preserved.

Sprite runtime should move toward atlas + JSON metadata packs. Source sheets may
be `1xN` for single-view strips or `DxN` grids for directional animation; for
Scourge Survivors billboard enemies, use `3xN` source sheets (`front`, `side`,
`back` rows; frames as columns). Runtime systems should resolve sprites by
manifest id and metadata, not by hardcoded grid math.

## Package Publishing Rule
Do not publish Deadrot-specific `@deadrot/*` aliases/packages by default. While
all consumers live in this monorepo, keep them as workspace/private aliases into
`packages/assets` or other Deadrot packages. Publish only when there is a real
external consumer, a public SDK/modding use case, or an independent release
contract that needs npm distribution.
