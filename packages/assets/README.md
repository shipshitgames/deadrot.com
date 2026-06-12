# @shipshitgames/assets

Shared, game-agnostic assets plus the **canon asset catalog** for the Scourge
universe. One source of truth for what entities exist in the lore and which
assets every game shares identically.

## What lives here

- **Runtime/CDN assets plus curated generation history.** The runtime folders
  are what `/assets` points at today and what `cdn.deadrot.com` should mirror
  later. Curated source history lives only under `sources/generated/` and is
  excluded from the package export list.
- **`assets-catalog.json`** — the canon catalog (schema: `assets-catalog.schema.json`).
  Two parts:
  - `entities` — the canonical roster (22 entities) pulled from the lore vault:
    the Scourge bestiary (`scourge-swarm`, `scourge-spitter`, `scourge-elite`,
    `graft-breacher`, `rot-engine`, `breach-boss`, `trucebreaker`,
    `scourge-fighter`, `orbital-breach-carrier`) and the human factions
    (`pyre-*`, `warden-*`). Each entity carries its `faction`, Scourge
    `hostFamily` (or `null`), one-line `canon`, a generation `promptBase`, the
    `games` it renders in (**the matrix row**), and a `variants` map of per-game
    render paths (`null` until rendered).
  - `shared` — truly game-agnostic assets used **identically** by every game:
    FX (blood / ember / muzzle / breach-glow), UI icons (Pyre / Warden / Scourge
    / breach / lane), fonts (Press Start 2P / SSG Press Start), and audio.
- **`brand/`** — Deadrot marks and title/wordmark art used by apps.
- **`universe/`** — global Deadrot hero/social art.
- **`lore/`** — machine-readable canon data plus lore-facing art masters,
  status previews, and other assets that lore pages embed through `/assets/...`.
- **`games/<slug>/...`** — game-owned runtime packs and game web art.
- **`entities/<id>/<game>.webp`** — per-game entity renders produced by the
  variant-matrix generator. This is what makes the catalog's `variants` paths
  resolve.
- **`shared/{audio,fonts,fx,ui}/`** — game-agnostic binary assets used
  identically by multiple games.
- **`games/<slug>/ui/menu/title.webp`** — game-owned 16:9 title/key art used by
  both the game shell and the web hub gallery.
- **`games/<slug>/ui/social/og.jpg`** — compatible `1200x630` social-card
  export. Prefer JPG for Open Graph crawlers even when browser delivery uses
  WebP; replace these with approved, beautiful Imagen-generated landscape cards
  when available.
- **`concepts/<slug>/`** — concept-only presentation art for titles that are
  not shipped game packages yet.
- **`src/index.ts`** — TypeScript types (`Asset`, `AssetCatalog`, `EntityAsset`,
  `Faction`, `HostFamily`, `GameSlug`, ...), the `getAsset(catalog, id, game)`
  resolver, and matrix helpers (`gamesFor`, `renderedGames`, `pendingGames`,
  `matrixRows`).

Never add runtime files under `sources/`, `sites/`, a flat `sprites/` folder, or
any `source/` subfolder inside a game pack. Successful generation history that
explains promoted runtime assets belongs under `sources/generated/`. Rejected
outputs, banned-provider outputs, temporary drafts, and source-like material that
should never be promoted belong in `packages/assets/_archive/` or
outside git.

## Scourge Survivors runtime pack

Scourge Survivors consumes its assets through the subpath export:

```ts
import {
  SCOURGE_SURVIVORS_ASSET_MANIFEST,
  scourgeSurvivorsAssetUrl,
  scourgeSurvivorsSpriteScale,
  scourgeSurvivorsSpriteUrl,
} from "@shipshitgames/assets/scourge-survivors";
```

The package keeps runtime files grouped by lore/type:

```txt
games/scourge-survivors/
  players/pyre/{ranger,bulwark,vector,patch}/
  enemies/scourge/{host-grunt,spitter-host,winged-host,breach-boss}/
  weapons/pyre/
  pickups/{ammo,bonus,health,xp}/
  projectiles/scourge/
  textures/arenas/generic/
  ui/{cards,icons,menu}/
  audio/{music,sfx}/
  fonts/
```

`games/scourge-survivors/assets.json` is the runtime manifest. Its paths point
at these package-relative files, so Vite games get final URLs through
`scourgeSurvivorsAssetUrl(path)`.

The manifest also carries the Scourge Survivors runtime alias table that the old
standalone game tracked as `src/assets/assets.json`: enemy roles, player avatars,
weapons, pickups, projectiles, FX, and menu/card UI all resolve to manifest asset
IDs with license records. The game consumes that table through its local
`AssetCatalog` loader instead of importing package file paths directly.

## Source material

Runtime packs should only commit files that games load at build time or runtime.
Curated prompt/history docs and source images for approved generations should be
preserved under `sources/generated/` so future asset work can trace what was
generated, reviewed, promoted, or replaced. That archive is not part of
`package.json#files`, should never be imported by apps or manifests, and should
not be mirrored to the asset CDN.

Keep rejected outputs, banned-provider outputs, temporary drafts, and exploratory
source folders out of `sources/generated`; use `packages/assets/_archive/` for
package-local review material that still needs durable custody. Only leave files
outside git when they are truly disposable.

Raw provider caches do not belong in `sources/generated`, even when they contain
images worth reviewing. Put them under `packages/assets/_archive/` until a human
curates and renames selected files into semantic dated generated-history paths.
Archive batches may preserve provider cache folder names and raw filenames for
traceability while review is pending.

### Naming conventions

Use lowercase kebab-case for every asset directory and filename. Keep dates as
`YYYY-MM-DD`. Avoid spaces, underscores, provider IDs, hashes, and ambiguous
names like `final`, `clean`, `draft`, `source`, or `copy`.

Runtime assets should be named by stable game meaning:

```txt
games/<game>/ui/menu/title.webp
games/<game>/ui/social/og.jpg
games/<game>/players/<faction>/<character>/<view>.webp
games/<game>/enemies/<faction>/<enemy>/<view>.webp
games/<game>/weapons/<faction>/<weapon>-tiers.webp
entities/<entity-id>/<game>.webp
lore/art-masters/<faction-or-domain>/<subject>/<subject>-<purpose>.<ext>
lore/asset-status/previews/<group>/<subject>.webp
```

Generated-history assets should be named by what they document, not where they
came from:

```txt
sources/generated/<YYYY-MM-DD>/<collection>/<subject>-<purpose>.<ext>
sources/generated/<YYYY-MM-DD>/<game>/<domain>/<subject>-<purpose>.<ext>
sources/generated/<collection>/<YYYY-MM-DD>/<subject>-<purpose>.<ext>
sources/generated/<game>/<domain>/<YYYY-MM-DD>/<subject>-<purpose>.<ext>
```

Good examples:

- `sources/generated/2026-06-11/lore/bestiary/swarm-ripper-turnaround-candidate.png`
- `sources/generated/og-social/2026-06-11/scourge-survivors-fps-og-source.png`
- `sources/generated/scourge-survivors/animation-sheets/2026-06-11/host-grunt-walk-sheet.png`
- `sources/generated/title-screens/2026-06-07/deadlane-title-source.png`

Run the package boundary check before merging asset changes:

```bash
bun run --cwd packages/assets assets:check
```

When Codex generates images, immediately rescue the global Codex cache into this
repo before reviewing or pruning anything:

```bash
bun run --cwd packages/assets assets:sync-codex-images
```

## Generator boundary

This package is the Deadrot asset source of truth. Generation tooling does not
live here.

The asset generation product surface belongs in the sibling studio repo:

```txt
../shipshitgames/
  apps/{cli,desktop,app}/
  packages/assetgen/
```

Those tools should read from and write to this package.

## The variant matrix (issue #6)

Each entity is **one canon id** rendered per game. `entity.games` declares which
games render it (the matrix's intent); `entity.variants[game]` holds the actual
render path once produced. The renders are generated by studio tooling in
`../shipshitgames`, then written back into this package.

Inspect coverage in code with `matrixRows(catalog)` — per entity, which games are
`intended` vs already `rendered`.

## The rule: entities are per-game renders

> **ENTITY sprites are per-game RENDERS** — shared canon, per-game variants.
> This package is the companion to issue #6.

A monster like the Scourge Swarm is **one canon entity** in the lore, but each
game renders it in its own style and resolution. So the catalog stores the canon
once and a `variants` path per game. `getAsset(catalog, id, game)` returns the
requested game's variant; if you ask for an entity without a `game`, you get the
canon record with a `null` path (there is no single "shared" sprite for an
entity by design).

Only **truly game-agnostic** assets (FX, UI, fonts, shared audio) live in
`shared/` and resolve the same for every game.

## Usage

```ts
import { catalog, getAsset, GAME_SLUGS } from "@shipshitgames/assets";

// Per-game entity render (companion to issue #6):
getAsset(catalog, "scourge-swarm", "deadlane");
//   { id, kind: "entity", name, path: "entities/scourge-swarm/deadlane.webp", game: "deadlane" }

// A game the entity does not render in -> path is null:
getAsset(catalog, "scourge-swarm", "starblight");
//   { ..., path: null, game: "starblight" }

// A shared, game-agnostic asset (game arg is ignored):
getAsset(catalog, "fx-blood-splatter");
//   { id, kind: "fx", name, path: "shared/fx/blood-splatter.png", game: null }
```

## Distribution

Inside this repo, games in `apps/games/*` consume this package with
`"@shipshitgames/assets": "workspace:*"`.

If the package is published later, external consumers can import the catalog,
runtime manifests, and `getAsset` resolver from `@shipshitgames/assets` like any
other dependency.

## Design canon

DOOM, not neon. Blood `#c1121f`, hellfire `#ff6a00`, gunmetal, bone; all
player-facing UI uses the shared Press Start 2P pixel face. See
`apps/lore/content/DESIGN.md`.
