# Workflow

last_verified: 2026-07-09

This repo is **trunk-based**: `master` is the single long-lived branch (and the
GitHub default). Shipped work flows through short-lived task branches and squash
PRs into `master`; production is cut deliberately with a semver tag.

```txt
claude/<slug> | codex/<slug> task branch -> squash PR -> master -> tag vX.Y.Z -> release deploy
```

> Historical: an aspirational `develop -> staging -> master` lane appeared in
> earlier docs but was never adopted. Those branches do not exist on `origin`;
> do not look for or target them.

## Branches

- Verify the current branch and worktree before starting and before reporting:
  `git status --short --branch`.
- `master` is the only long-lived branch on `origin` and the GitHub default
  branch. There is no `develop` or `staging`.
- Create one short-lived task branch per request, branched from `origin/master`:
  `claude/<slug>` for Claude work, `codex/<slug>` for Codex work (`feat/<slug>`,
  `fix/<slug>`, `chore/<slug>` are also acceptable names).
- Do not push directly to `master`; land work via a squash-merge PR into
  `master`.

## Task Flow

1. Inspect status and preserve unrelated user changes.
2. Branch from `origin/master`.
3. Implement the requested change with repo-local patterns.
4. Run focused checks first, then the relevant repo gate (`bun run ci`).
5. Commit on the task branch with a concise conventional message.
6. Push with `git push -u origin <branch>`.
7. Open or share the PR URL for the task branch into `master`.
8. Report the final branch and whether the worktree is clean.

The PR gate (runs on pull requests into `master`) is the **fast** gate:

- **CI** (`ci.yml`): `quality` (format + lint + import order, typecheck,
  generated-assets check, deterministic full build), `unit` (package +
  cross-game catalog unit tests), and `coverage` (coverage gate over the agreed
  scope).
- **React Doctor** (`react-doctor.yml`).
- **Secret Scan** (`secret-scan.yml`).
- **Game E2E** (`e2e.yml`) and **Web E2E** (`web-e2e.yml`) start on every PR so
  their required aggregate gates always report. Cheap detector jobs skip the
  heavy matrices when no affected game or web/package files changed.

The full every-game Playwright matrix is **not** on the PR gate — it runs at
release time (see below) so merges stay quick.

## Release Flow

- Releases are **tag-cut**, not branch-promoted. Pushing a semver tag matching
  `v*.*.*` triggers `release.yml`:

  ```bash
  git tag v1.4.0 && git push origin v1.4.0
  ```

- The tag runs the FULL heavy suite: `quality`, deterministic `build`, `unit`, `web-e2e`
  (desktop + mobile), every game's Playwright E2E sharded game x viewport, and a
  full-history `secret-scan`. A single `release-gate` job aggregates them.
- Only if every gate is green do the deploy jobs run:
  - `deploy`: promotes the whole catalog (all games + web + lore) to Vercel
    production via `scripts/deploy-changed-games.mjs --all`.
  - `deploy-api`: builds/pushes the `deadrot-api` image to ghcr and deploys it,
    co-located on the `shipshit-api` EC2 host over Tailscale SSH.
- Pushing to `master` does **not** deploy on its own — a release is always a
  deliberate tag.
- Do not cut a release tag without explicit confirmation.
- Do not call a release ready when required checks are failing or unknown.

## Return State

- After pushing a task branch, return to `master` only when the user asks or the
  active workflow explicitly requires it.
- If asked to be "back on master", verify the worktree is clean (or the
  user-approved work is committed/stashed) before switching.
- Never claim the worktree is clean without checking `git status --short
  --branch`.
- If `master` has local commits, diverged history, or unrelated user changes, do
  not reset or force-switch. Report the exact state.

## Quality Gates

- Use Bun for package management and scripts.
- For broad repo work, run `bun run ci` when feasible. It currently covers:
  `check` (biome format + lint + import order), `typecheck`, `social:check`, and
  `assets:check`.
- The CI, Game E2E, Web E2E, React Doctor, and Secret Scan workflows run on PRs
  and on pushes to `master`.
- For Scourge Survivors game changes, also run focused checks when relevant:
  `cd apps/games/scourge-survivors && bun run typecheck` and
  `cd apps/games/scourge-survivors && bun run test:unit`.
- If a command cannot be run, report why and what risk remains.

## Generated Assets

- Shipped generated outputs belong under `packages/assets`, not temporary
  generator caches.
- Register generated runtime files in one of the checked asset surfaces:
  `packages/assets/assets-catalog.json`,
  `packages/assets/games/<game>/assets.json`, or a game `animation-pack.json`.
- `bun run assets:check` must pass before PR-ready status. It verifies referenced
  files exist, are files, are non-empty, stay inside `packages/assets`, that
  animation-pack frames are complete, and that asset budgets are within limits.
- Generator tooling itself stays in the sibling `../shipshitgames` repo; only
  shipped outputs and preserved asset history belong here.
