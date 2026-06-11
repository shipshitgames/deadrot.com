---
name: deadrot-image-generation
description: Use when generating any Deadrot image asset with Codex image generation. Ensures generated images are rescued from CODEX_HOME/generated_images into the current deadrotcom workspace, named semantically, linked to lore design locks, and never left only in the global Codex cache.
license: MIT
metadata:
  version: "0.1.0"
  tags: "image-generation, assets, deadrot, provenance, codex"
  author: Ship Shit Games
---

# Deadrot Image Generation

Codex Desktop saves image generations to `$CODEX_HOME/generated_images`. That is
a global cache, not Deadrot asset custody. Every useful generation must be copied
into this repo before the turn ends.

## Rule

The cache path is transient:

```txt
$CODEX_HOME/generated_images/<generation-id>/<image-id>.png
```

Deadrot custody is durable:

```txt
packages/assets/_archive/raw-generator-cache/codex-generated-images/<yyyy-mm-dd>/raw/
packages/assets/sources/generated/<yyyy-mm-dd>/<collection>/<domain>/<semantic-name>.png
packages/assets/games/<game>/...
```

Do not leave generated assets only under `$CODEX_HOME/generated_images`.

## Workflow

1. Read the relevant lore/design lock first:
   - `apps/lore/content/Universe/Style-Bible.md`
   - `apps/lore/content/DESIGN.md`
   - `apps/lore/content/Design/**/<Subject>-DESIGN.md`
   - the canon page, such as `Bestiary/Swarm-Ripper.md`
2. Generate with `image_gen`.
3. Immediately rescue the cache into the repo:

   ```bash
   bun run --cwd packages/assets assets:sync-codex-images
   ```

4. Promote useful outputs from `_archive/raw-generator-cache/...` into semantic
   `sources/generated/<yyyy-mm-dd>/...` paths.
5. Link promoted candidates from the relevant lore `*-DESIGN.md`.
6. Runtime promotion is a separate step. Do not write generated raw images
   straight into `games/<game>/...` without cleanup, format conversion, manifest
   updates, and validation.
7. Run:

   ```bash
   bun run --cwd packages/assets assets:check
   ```

## Naming

Use date-first generated source paths:

```txt
packages/assets/sources/generated/2026-06-11/lore/bestiary/swarm-ripper-turnaround-candidate.png
packages/assets/sources/generated/2026-06-11/scourge-survivors/animation-sheets/breach-boss-barrage-source.png
```

Never promote provider IDs, hashes, `_image_id_`, or raw cache folder names as
final filenames.

## What This Skill Cannot Do

It cannot change the Codex Desktop built-in image tool's global cache path. If a
future Codex config exposes that setting, prefer pointing it at:

```txt
packages/assets/_archive/raw-generator-cache/codex-generated-images/live/raw
```

Until then, use the sync command as the repo-owned handoff.
