# Deadrot - Agent Instructions

Scope: this entire `deadrotcom` repository.

## Agent Entry Point

- Read `.agents/memory/MEMORY.md` first.
- Read `.agents/memory/repo-boundary.md` before moving apps, packages, or assets.
- Claude Code: read `CLAUDE.md`, then follow this file.
- Codex and other coding agents: follow this `AGENTS.md`.

## Project Role

- This is the shipped Deadrot monorepo: web hub, lore app, games, runtime
  packages, and shipped assets.
- `apps/lore/content` is the Obsidian vault root for Deadrot canon.
- `apps/games/*` contains shipped Deadrot games.
- `packages/assets` is the canonical shared asset package for Deadrot games.
- `packages/engine`, `packages/ui`, and `packages/warline` are runtime packages
  consumed by shipped games.

## Boundary

- Studio tooling for building/generating assets belongs in sibling repo
  `../shipshitgames`.
- `packages/assetgen` stays in `../shipshitgames`; do not move it here.
- Generated outputs, runtime packs, audio, soundtrack, and preserved asset
  history belong in this repo, usually under `packages/assets`.
- Games should consume shared packages with `workspace:*`, including
  `@shipshitgames/assets` when they use shared runtime assets.

## Engineering Rules

- Use Bun for package management.
- Prefer workspace packages over local duplication.
- Keep gameplay loops imperative and Three.js-centered; keep React in app shells
  and UI overlays.
- Do not commit secrets, `.env` files, generated `dist`, `node_modules`, or
  local editor state.
- Inspect `git status` before edits and preserve unrelated user changes.

## Useful Commands

- `bun install`
- `bun run build`
- `bun run typecheck`
- `cd apps/games/scourge-survivors && bun run typecheck`
- `cd apps/games/scourge-survivors && bun run test:unit`
