---
name: generated-asset-triage
description: Use when organizing, reviewing, rescuing, archiving, deleting, or promoting generated game assets in the Deadrot monorepo, especially raw AI image caches, worktree-generated images, provider UUID folders, and packages/assets/_archive triage buckets.
license: MIT
metadata:
  version: "0.1.0"
  tags: "assets, generated-assets, archive, triage, deadrot"
  author: Ship Shit Games
---

# Generated Asset Triage

Generated assets are never disposable until reviewed, and never shippable until
curated. Preserve custody first, then sort, then promote only named finals.

## Required context

Before moving assets, read:

- `.agents/memory/MEMORY.md`
- `.agents/memory/repo-boundary.md`
- `AGENTS.md`
- `packages/assets/README.md`
- `packages/assets/_archive/README.md` when working inside `packages/assets/_archive`

Use `game-asset-pipeline` for runtime asset registration rules.
Use `deadrot-image-generation` when creating new image assets with Codex.

## Canonical locations

- `packages/assets/_archive/raw-generator-cache/<provider>/<yyyy-mm-dd>/...`
  Raw provider caches, UUID folders, rejected items, and human review buckets.
- `packages/assets/sources/generated/<topic>/<yyyy-mm-dd>/<kebab-name>.<ext>`
  Curated source/history images only. No provider UUID folders or raw cache
  names.
- Runtime package paths such as `packages/assets/games/<game>/...`
  Approved finals only, with semantic names and manifest/export wiring where
  required.

## Review buckets

Use these folder names consistently inside an archive batch:

- `keep/` - human-selected review candidates. Salvageable as source/reference,
  not runtime-approved.
- `promising-needs-cleanup/raw/` - chroma-backed sprites, weapons, projectiles,
  pickups, icons, or sheets that need alpha cleanup, cropping, style work, and
  semantic naming.
- `to_delete/raw/` - off-brand, malformed, generic, duplicate, non-pixel-art, or
  low-priority outputs staged for human review before removal.
- `approved-source/` - optional temporary staging for files that are ready to be
  renamed into `sources/generated`.

Do not delete generated images from a worktree until `git status --short
--ignored` has been reviewed and any wanted assets have been copied into
`packages/assets`.

## Triage workflow

1. Count image files and list ignored files:
   `find <batch> -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l`
   and `git status --short --ignored <batch>`.
2. Remove `.DS_Store` and other local editor noise.
3. Build contact sheets or an HTML grid for visual review. If using ffmpeg,
   normalize thumbnails to fixed dimensions before tiling.
4. Sort into `keep`, `promising-needs-cleanup/raw`, and `to_delete/raw` while
   preserving provider UUID subfolders for provenance.
5. Update the batch `REVIEW.md` with counts, criteria, and next actions.
6. Run `bun run --cwd packages/assets assets:check`.
7. Leave changes unstaged unless the user asked to stage or commit.

## Salvage criteria

Promote only after human review. A raw image is salvageable when it has at
least one of these uses:

- Strong art-direction reference for Deadrot, Scourge, UI, enemy, weapon, or
  environment design.
- Chroma-backed sprite/weapon/effect/icon candidate with clean silhouette.
- Sheet with useful rotations, enemy variants, pickups, or HUD motifs.
- Composition worth regenerating even if text is malformed.

Send to `to_delete/raw` when it is generic, text-mangled with no useful
composition, duplicate noise, off-brand sci-fi, not Deadrot, or merely
non-pixel concept art with no reference value.

## Promotion rules

Raw cache names never become final names. When promoting:

- Rename to lowercase kebab-case.
- Include the semantic subject and role, not provider IDs.
- Keep one date segment immediately before generated source files.
- Convert runtime images to the expected delivery format when appropriate
  (`.webp` for most web runtime sprites/UI; preserve PNG masters only when
  needed).
- Add or update manifests/exports required by the consuming game.
- Record generation provenance where the runtime manifest expects a license
  record.

## Validation

Always run:

```bash
bun run --cwd packages/assets assets:check
```

For runtime promotions, also run the relevant game typecheck/test command.
