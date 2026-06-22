# Runtime asset-format policy

The single, shared rule for **what image format a Ship Shit Games title ships**
to the browser. It is enforced in CI and applies to every game in the monorepo.
Source: [deadrot.com#118](https://github.com/shipshitgames/deadrot.com/issues/118).

## The rule

- **Runtime raster ships as WebP.** Sprites, UI art, and textures that the game
  loads at runtime are `.webp`.
- **Pixel art and tiny crisp UI sprites convert lossless.** Lossy WebP smears
  hard pixel edges; icons, tiles, and ≤64×64 sprites use lossless WebP so they
  stay crisp.
- **PNG / JPEG are source/master formats, not runtime imports.** Keep PNG masters
  and provenance under clearly named source trees (`sources/`, `_archive/`,
  `masters/`, `drafts/`, or the sibling `packages/assetgen` studio repo) — never
  as the default runtime import.
- **Source PNGs stay out of the hot bundle.** A runtime bundle must not
  `import.meta.glob` or otherwise pull a source PNG/JPEG into the shipped output.
- **One JPEG exception: Open Graph cards.** `games/<slug>/ui/social/og.jpg`
  stays JPEG (1200×630) because social crawlers prefer it. This is the only
  runtime raster that is allowed to be non-WebP.
- **Three.js textures: WebP now, KTX2/Basis next.** WebP cuts transfer size but
  not GPU memory; large 3D textures should evaluate KTX2/Basis as a follow-up.

## Convert

`cwebp` is the conversion engine. It is **author-run** — CI never converts, it
only validates that the committed `.webp` exists — so the runners do not need
`cwebp` or `sharp` installed.

```sh
# one file
bun run --cwd packages/assets assets:to-webp games/scourge-survivors/ui/cards/codex/breach.png

# a whole folder (recurses; --rm deletes each source after a clean convert)
bun run --cwd packages/assets assets:to-webp games/scourge-survivors/ui --rm

# pixel art / icons — force lossless
bun run --cwd packages/assets assets:to-webp shared/ui/icons/pixel --lossless

# preview the plan without writing anything
bun run --cwd packages/assets assets:to-webp games/<slug>/ui --dry-run
```

Flags: `--lossless` / `--lossy`, `--quality <0..100>` (lossy default `82`),
`--out <path>` (single input), `--rm` (delete source on success), `--force`
(overwrite an existing `.webp`), `--dry-run`. The pixel-art heuristic
(`icons/`, `pixel/`, `tiles/`, `*-icon`, ≤64×64) auto-selects lossless; override
it with `--lossless` / `--lossy`.

Install `cwebp` locally with `brew install webp` (macOS) or your distro's
`webp` package.

## Validate

```sh
bun run --cwd packages/assets assets:check
```

`scripts/check-asset-formats.mjs` is pure JS (no `cwebp`/`sharp`) and runs in CI
as part of `assets:check`. It is deliberately scoped to the **runtime bundle
surface** so it gates what ships without flagging source PNGs that legitimately
live under `sources/` / `_archive/`:

1. **Manifest raster** — every `path` a game's `assets.json` declares must be an
   allowed runtime format (WebP; JPEG only for `ui/social/*.jpg`).
2. **Bundle globs** — every `import.meta.glob` raster pattern under
   `packages/assets/src` must not admit a source PNG/JPEG into the bundle.

The shared policy logic lives in
[`scripts/lib/asset-format-policy.mjs`](../scripts/lib/asset-format-policy.mjs)
and is unit-tested, so the conversion CLI and the validator never disagree.

## Reference implementation

Scourge Survivors is the migrated reference. Its menu hero plate and codex cards
shipped as redundant JPEG + PNG twins inside the runtime UI pack; they were
converted to single WebP files (≈2.8 MB → ≈0.30 MB of runtime raster), the
`assets.json` manifest and the Vite asset glob were narrowed to `.webp`, and the
legacy PNG/JPEG were removed from the runtime tree (PNG masters remain in git
history). See `packages/assets/games/scourge-survivors/ui/`.
