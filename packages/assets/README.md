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
should never be promoted belong in the repo-level `_archive/` review folder or
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
source folders out of `packages/assets`; use the repo-level `_archive/` review
folder or leave them outside git.

Run the package boundary check before merging asset changes:

```bash
bun --cwd packages/assets run assets:check
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
