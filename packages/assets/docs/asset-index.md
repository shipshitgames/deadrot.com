# Canonical asset index

The single, generated source of truth for **resolving Deadrot media**. Every
shipped asset in `packages/assets` gets one stable id and one record in
`assets.index.json`; consumers resolve through the typed resolver instead of
hardcoding folder conventions. Source:
[deadrot.com#343](https://github.com/shipshitgames/deadrot.com/issues/343).

## What it is and why

`assets.index.json` is a committed, deterministic manifest (currently 450
assets). It gives every asset one **stable contract** with two addresses:

- a **package-relative `path`** for dev/build tooling that reads bytes off disk
  (assetgen, the desktop app, Vite), and
- a **CDN-relative `cdnPath`** that joins onto a base origin for the deployed
  runtime.

That separation is the whole point: a game references an asset by id once, and
the same id resolves to a local file in development and an `https://` URL in
production — without every consumer re-deriving `games/<slug>/ui/...` paths.

The manifest is generated, never hand-edited, and CI fails when it drifts from
the files on disk (see [Regenerate](#regenerate)).

## What it covers

The generator walks these runtime roots of `packages/assets`:

`entities`, `games`, `shared`, `brand`, `universe`, `concepts`, `tokens`.

It **excludes**:

- **Source / master trees.** Any path inside a `sources/`, `source/`, `drafts/`,
  `draft/`, `_archive/`, `provenance/`, `masters/`, or `master/` segment is
  skipped — those hold PNG masters and provenance, not runtime imports (see the
  [asset-format policy](./asset-format-policy.md)).
- **Non-media files.** Only known media extensions are indexed (`.webp`, `.png`,
  `.jpg`, `.svg`, `.webm`, `.mp4`, `.mp3`, `.woff2`, fonts, etc.). JSON, code,
  and docs are ignored.
- **The `sites/` mirror.** `packages/assets/sites/**` is deliberately absent; the
  `assets:check` boundary gate forbids tracking a site mirror in this package.
- **The `lore/` root.** `packages/assets/lore` is an `art-masters/` tree (master
  turnarounds plus `runtime-placeholders/`), not shipped runtime media, so it is
  not one of the indexed roots above. Lore is consumed through the dedicated
  `@shipshitgames/assets/lore` entry point, not the canonical index.

## Entry fields

Each record in `assets[]` looks like:

```json
{
  "id": "games/brawl/ui/menu/title",
  "kind": "image",
  "game": "brawl",
  "path": "games/brawl/ui/menu/title.webp",
  "cdnPath": "games/brawl/ui/menu/title.webp",
  "mediaType": "image/webp",
  "bytes": 540182,
  "sha256": "4fd01f10d54a73995300ac2067fc9565db3723f24ac5c221251ce5c84bc9ff1d",
  "width": 2048,
  "height": 1152
}
```

| Field             | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `id`              | Stable id: the POSIX package-relative path **without** the extension.   |
| `kind`            | Semantic family: `image` \| `vector` \| `video` \| `audio` \| `font`.   |
| `game`            | Owning game slug for `games/<slug>/…`, else `null` (shared/brand/etc.). |
| `path`            | Package-relative path **with** extension — for dev/build tooling.       |
| `cdnPath`         | CDN-relative path; joined onto a base origin for deployed runtime.      |
| `mediaType`       | IANA media (MIME) type, e.g. `image/webp`.                              |
| `bytes`           | File size in bytes.                                                      |
| `sha256`          | Hex SHA-256 of the contents, for drift/integrity checks.                |
| `width` `height`  | Intrinsic pixel dimensions, where the format exposes them.              |
| `provenance`      | Provenance note, where recorded in `asset-provenance.json` (optional).  |
| `license`         | License note, where recorded in `asset-provenance.json` (optional).     |

Note on `kind`: a `.webm`/`.mp4` whose path contains an `audio` segment resolves
to `kind: "audio"` (music/sfx in a video container), while `mediaType` stays the
honest container type (`video/webm`).

## Regenerate

```sh
bun run --cwd packages/assets assets:index
```

This rewrites `assets.index.json` deterministically (sorted by path, no
timestamps). Commit the updated manifest alongside the asset change.

CI never regenerates — it only verifies. The drift gate is:

```sh
bun run --cwd packages/assets assets:index:check
```

It exits `0` when the committed manifest matches the files on disk, `1` when the
manifest is stale or missing, and `2` when the root is absent. It is also wired
into `assets:check` (which CI runs), so a stale manifest fails the build with a
pointer back to `assets:index`.

## Resolving assets

Consume the index through `@shipshitgames/assets` (or the lighter
`@shipshitgames/assets/asset-index` entry point) — never by reading
`assets.index.json` directly:

```ts
import {
  resolveAssetPath,
  resolveAssetUrl,
  getAssetEntry,
  listAssets,
} from "@shipshitgames/assets/asset-index";

// dev/build tooling reading bytes off disk (assetgen, desktop, Vite):
const path = resolveAssetPath("games/brawl/ui/menu/title");
// → "games/brawl/ui/menu/title.webp"

// deployed runtime needs an absolute URL:
const url = resolveAssetUrl("games/brawl/ui/menu/title");
// → "https://assets.deadrot.com/games/brawl/ui/menu/title.webp"

// override the origin explicitly (highest precedence):
const staged = resolveAssetUrl("games/brawl/ui/menu/title", {
  baseUrl: "https://staging-cdn.example.com",
});

// query the index:
const titles = listAssets({ game: "brawl", kind: "image" });
const entry = getAssetEntry("games/brawl/ui/menu/title"); // full record
```

Unknown ids return `undefined` from `getAssetEntry`, `resolveAssetPath`, and
`resolveAssetUrl` — no throw. `listAssets({ game: null })` matches shared
(non-game) assets.

### Base-origin precedence

`resolveAssetUrl` / `assetBaseUrl` pick the CDN origin in this order:

1. explicit `baseUrl` option,
2. the `ASSET_BASE_URL` environment variable,
3. the manifest's baked-in `cdnBase` (`https://assets.deadrot.com`).

The resolver tolerates a trailing slash on the base and a leading slash on the
cdn path, and reads `process.env` defensively so it is safe to bundle for the
browser.

## Local vs production mode

| Consumer       | Mode                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| **assetgen**   | Dev/build — use `resolveAssetPath(id)` to read bytes from `packages/assets`. |
| **desktop**    | Bundles assets locally — `resolveAssetPath(id)` for on-disk reads.        |
| **apps/web**   | Deployed runtime — `resolveAssetUrl(id)`; set `ASSET_BASE_URL` per env, or fall through to the manifest `cdnBase` in production. |
| **apps/app**   | Same as `apps/web`: `resolveAssetUrl(id)` with `ASSET_BASE_URL` override for staging/preview, manifest default in production. |

Rule of thumb: anything that **reads files** uses `resolveAssetPath`; anything
that **serves a URL to a browser** uses `resolveAssetUrl`. Use `ASSET_BASE_URL`
(or an explicit `baseUrl`) to point at a staging/preview CDN without editing the
committed manifest.

## Adding a new asset

1. Drop the file under the correct runtime root (`games/<slug>/…`, `shared/…`,
   etc.) in the right format — runtime raster is **WebP** per the
   [asset-format policy](./asset-format-policy.md).
2. Regenerate: `bun run --cwd packages/assets assets:index`.
3. Commit the file **and** the updated `assets.index.json` together. (Forgetting
   the manifest is exactly what the `assets:index:check` drift gate catches.)

The id is derived from the path with the extension stripped, so the asset is
immediately resolvable by `games/<slug>/…/<name>`.

### Optional provenance sidecar

To enrich entries with `provenance` / `license`, add a top-level
`asset-provenance.json` keyed by package-relative path:

```json
{
  "games/brawl/ui/menu/title.webp": {
    "provenance": "assetgen · codex · 2026-06",
    "license": "CC0-1.0"
  }
}
```

Keys are the full relative `path` (with extension). On the next `assets:index`
run, matching entries gain `provenance` and/or `license` fields. The sidecar is
optional and missing/invalid files are ignored.
