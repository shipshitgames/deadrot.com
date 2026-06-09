# Repo Boundary

last_verified: 2026-06-09

`deadrotcom` is the shipped Deadrot monorepo.

## Owns

- Player-facing Deadrot apps.
- Shipped games in `apps/games/*`.
- Lore/canon app in `apps/lore`; the Obsidian vault root is
  `apps/lore/content`.
- Deadrot-specific runtime packages in `packages/*` that shipped games import.
- Canonical shared assets in `packages/assets`.
- Runtime audio, soundtrack, sprites, textures, fonts, UI art, and preserved
  generated source history.

## Does Not Own

- Asset generation product surfaces.
- Generator CLI, desktop, or app tooling.
- Provider/keychain integrations for asset generation.
- Studio-site product tooling.
- The canonical org-level engine package `@shipshitgames/engine`; it belongs in
  the sibling `../shipshitgames` repo and may be consumed by Deadrot games.

Those belong in the sibling `../shipshitgames` repo.

## Rule

If it ships to players or is Deadrot-specific runtime data/assets, it belongs
here. If it builds/generates/edits assets as tooling, it belongs in
`../shipshitgames`.

`packages/assetgen` stays in `../shipshitgames` because it is the studio CLI
product to ship and dogfood. `@shipshitgames/assets` stays in this repo because
it is imported by shipped games.

`@shipshitgames/engine` is intentionally different from Deadrot-specific runtime
packages. Keep it canonical in `../shipshitgames/packages/engine`, do not rename
it to `@deadrot/engine`, and do not create a separate engine repo/board until
the release cadence or external consumers justify that overhead.

Status (2026-06-09): the temporary Deadrot fork at `packages/engine` has been
RETIRED. Its camera + input extraction (#87/#88) was upstreamed into the
canonical parent and published as `@shipshitgames/engine@0.2.0`;
`scourge-survivors`, `deadlane`, and `warline` now depend on the published
`^0.2.0` (not `workspace:*`). Do not re-create a `packages/engine` fork here —
consume the published package, and upstream any engine change to
`../shipshitgames/packages/engine` first (publish a new version, then bump here).

Deadrot-specific `@deadrot/*` aliases do not need publishing while all consumers
are inside this monorepo; keep them private/workspace-only unless an external
consumer or public SDK contract appears.
