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
- Targets org ProjectV2 boards `3,10` only. Hub board = `#10` (must be in the
  list or the script throws); Lore `#3` is retained only as an intentional
  secondary board for lore-specific field normalization.
- Validates each open target has a single-select `Status` (Backlog, In Progress,
  Done, Deferred) and `Priority` (P0..P3) field, else fails the run.
- Reconciles `deadrot.com` issues only: closed issue -> Status Done (unless
  already Done/Deferred); open issue with no Status -> Backlog; any issue with no
  Priority -> the issue's `p0`/`p1`/`p2`/`p3` label when present, otherwise P3.
  Open repo issues missing explicit hub `#10` membership get added to hub `#10`;
  membership on any other board does not count.
- It does NOT target archived game boards or the studio (`shipshit.games`) board.

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

Live reconciliation on 2026-07-09:

- Archived game boards #1, #5, #6, #7, #8, #9, #11, and #12 are no longer
  automation targets. Project #4 (`shipshit.games`) is also out of scope for
  this repo automation.
- Verification should report hubless issue adds, not generic boardless adds,
  because Project #10 is the canonical roadmap hub.

Run the script in write mode only when deliberately reconciling project fields.
See [[workflow]] for the branch/CI gates.
