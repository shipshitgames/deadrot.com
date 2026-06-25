---
status: active
last_verified: 2026-06-25
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
- Validates each open target has a single-select `Status` (Backlog, In Progress,
  Done, Deferred) and `Priority` (P0..P3) field, else fails the run.
- Reconciles `deadrot.com` issues only: closed issue -> Status Done (unless
  already Done/Deferred); open issue with no Status -> Backlog; any issue with no
  Priority -> P3. Boardless open repo issues get added to hub `#10`.
- It does NOT touch studio (`shipshit.games`) issues, so it cannot fix drift on
  board `#4`.

## BOARD_BOT — what it is
A dedicated **GitHub App identity** the workflow authenticates as. The default
`GITHUB_TOKEN` cannot write org-level Projects (v2), so the workflow uses
`actions/create-github-app-token@v3` with secrets `BOARD_BOT_APP_ID` +
`BOARD_BOT_PRIVATE_KEY` to mint a scoped installation token, then the script
mutates Project cards over GraphQL.

## Current status (2026-06-25)
The original 2026-06-08 token failure was resolved: `board-hygiene.yml` now uses
`actions/create-github-app-token@v3`, `actions/setup-node@v6`, Node 22, and the
weekly scheduled runs have been succeeding since 2026-06-15.

Status convention:

- `Backlog`: default for unpicked/unassigned open work.
- `In Progress`: work picked up by automation/human, including PR-backed work.
- `Human Review`: only for actual human action/review, not for automation
  handoff.
- `Done`: complete/closed work.
- `Deferred`: explicitly parked.

Live reconciliation on 2026-06-25:

- Renamed the `Todo` Status option to `Backlog` across target projects
  #1, #3, #4, #5, #6, #7, #8, #9, #10, and #11, preserving option ids so
  existing cards stayed in lane.
- Moved closed Lore items #140, #141, #361, #362, #364 to Status `Done`.
- Moved #427 to Status `In Progress`.
- Verification dry-run prepared 0 field updates and 0 boardless issue adds
  across all target projects.

Run the script in write mode only when deliberately reconciling project fields.
See [[workflow]] for the branch/CI gates.
