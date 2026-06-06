# Workflow

last_verified: 2026-06-06

This repo uses short-lived task branches and PRs for shipped work, with a
branch-based release lane:

```txt
feature/fix/chore branch -> develop -> staging -> master
```

`staging` is useful even without a preview deployment org: it gives the team a
stable pre-production branch where CI can prove a release candidate before
promotion to `master`.

## Branches

- Verify the current branch and worktree before starting and before reporting:
  `git status --short --branch`.
- As of 2026-06-06, the intended integration branch is `origin/develop`.
- The intended pre-production branch is `origin/staging`.
- The production branch is `origin/master`, which is also the GitHub default
  branch until the repo default is explicitly changed.
- Do not push directly to `develop`, `staging`, or `master`; use PRs.
- Create one task branch per request, based on the verified integration branch:
  `feat/<slug>`, `fix/<slug>`, or `chore/<slug>`.

## Task Flow

1. Inspect status and preserve unrelated user changes.
2. Branch from `origin/develop` unless it does not exist yet or the user
   directs otherwise.
3. Implement the requested change with repo-local patterns.
4. Run focused checks first, then the relevant repo gate.
5. Commit on the task branch with a concise conventional message.
6. Push with `git push -u origin <branch>`.
7. Open or share the PR URL for the task branch into `develop`.
8. Report the final branch and whether the worktree is clean.

## Release Flow

- Feature PRs target `develop`.
- Release candidate PRs promote `develop` into `staging`.
- Production PRs promote `staging` into `master`.
- If `staging` is unavailable, say so explicitly before using a direct
  `develop` -> `master` release PR.
- Do not merge production PRs without explicit confirmation.
- Do not call a release ready when required checks are failing or unknown.

## Return State

- After pushing a task branch, return to the integration branch only when the
  user asks or the active workflow explicitly requires it.
- If asked to be "back on develop", verify `develop` exists locally or on
  `origin`, then switch only when the worktree is clean or the user-approved
  work has been committed/stashed.
- Never claim the worktree is clean without checking `git status --short
  --branch`.
- If the integration branch has local commits, diverged history, or unrelated
  user changes, do not reset or force-switch. Report the exact state.

## Quality Gates

- Use Bun for package management and scripts.
- For broad repo work, run `bun run ci` when feasible. It currently covers:
  `format:check`, `lint`, `typecheck`, and `assets:check`.
- The Quality and Game E2E workflows should run on PRs and on pushes to
  `develop`, `staging`, and `master`.
- For Scourge Survivors game changes, also run focused checks when relevant:
  `cd apps/games/scourge-survivors && bun run typecheck` and
  `cd apps/games/scourge-survivors && bun run test:unit`.
- If a command cannot be run, report why and what risk remains.

## Generated Assets

- Shipped generated outputs belong under `packages/assets`, not temporary
  generator caches.
- Register generated runtime files in one of the checked asset surfaces:
  `packages/assets/assets-catalog.json`,
  `packages/assets/games/<game>/assets.json`, or a game
  `animation-pack.json`.
- `bun run assets:check` must pass before PR-ready status. It verifies
  referenced files exist, are files, are non-empty, stay inside
  `packages/assets`, and that animation-pack frames are complete.
- Generator tooling itself stays in the sibling `../shipshitgames` repo; only
  shipped outputs and preserved asset history belong here.
