---
status: active
last_verified: 2026-06-09
---

# Board Automation (board-hygiene + BOARD_BOT)

`scripts/board-hygiene.mjs` + `.github/workflows/board-hygiene.yml` is a weekly
GitHub Projects (v2) reconciler for the org `shipshitgames`.

## What it does
- Cron `17 6 * * 1` (Mondays 06:17 UTC) + `workflow_dispatch` (inputs:
  `dry_run` default true, `rate_floor` default 1500). Scheduled runs WRITE for
  real; manual runs default to dry-run.
- Targets org ProjectV2 boards `1,3,4,5,6,7,8,9,10,11` (project `#2` excluded).
  Hub board = `#10` (must be in the list or the script throws).
- Validates each open target has a single-select `Status` (Todo, In Progress,
  Done, Deferred) and `Priority` (P0..P3) field, else fails the run.
- Reconciles `deadrot.com` issues only: closed issue -> Status Done (unless
  already Done/Deferred); open issue with no Status -> Todo; any issue with no
  Priority -> P3. Boardless open repo issues get added to hub `#10`.
- It does NOT touch studio (`shipshit.games`) issues, so it cannot fix drift on
  board `#4`.

## BOARD_BOT — what it is
A dedicated **GitHub App identity** the workflow authenticates as. The default
`GITHUB_TOKEN` cannot write org-level Projects (v2), so the workflow uses
`actions/create-github-app-token@v2` with secrets `BOARD_BOT_APP_ID` +
`BOARD_BOT_PRIVATE_KEY` to mint a scoped installation token, then the script
mutates Project cards over GraphQL.

## GOTCHA (broken as of 2026-06-09)
The only run in history (Mon 2026-06-08) FAILED at the token step:
`Not Found - get-a-repository-installation-for-the-authenticated-app`. Root
cause: there is **no `board-bot` GitHub App installed on the org** — installed
apps are only `claude`, `vercel`, `claude-design-import`, `socket-security`. So
the weekly reconciler never runs. Fix needs org-admin: create/install a GitHub
App with Projects read-write, set the two secrets, then `workflow_dispatch`
`dry_run=true` to verify. Not a script bug. Secondary: its actions run on Node
20 (force-deprecated 2026-06-16) — bump `actions/*` versions.

Currently harmless: a full scan on 2026-06-09 found 0 mechanical board drift, so
nothing is broken on the boards right now — but drift will accumulate until the
bot runs. See [[workflow]] for the branch/CI gates.
