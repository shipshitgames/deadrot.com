# GitHub Roadmap Triage — deadrot.com

**Date:** 2026-07-03
**Scope:** All open issues/PRs on `shipshitgames/deadrot.com`, cross-checked against actual codebase state.
**Method:** `gh issue list`/`gh pr list` full pagination, label/milestone/age analysis, spot-verification of high-leverage claims against source (game LOC, CI workflows, Stripe/Clerk wiring, asset folder contents, engine dependency versions). Read-only — no GitHub state was modified.

---

## 1. GitHub issue/PR inventory

**Open issues:** 219
**Open PRs:** 9 (all authored by `VincentShipsIt`, all machine-generated via a Codex automation lane)
**Closed issues (recent 30 sampled):** span 2026-06-10 to 2026-06-22 — steady closure velocity, no gap.
**Stale issues (no update >30 days):** **0**. Every open issue has been touched within the last month.
**Unlabeled issues:** 3 (#441, #427, #417)
**Unassigned issues:** 215 of 219 (only 4 explicitly assigned to Vincent) — assignment is not how this tracker routes work; labels (`claude:routine` / `codex:automation`) are the routing mechanism instead.

### By label

| Label | Count | Note |
|---|---|---|
| enhancement | 199 | Applied to nearly everything — not discriminating |
| claude:routine | 157 | Routed to Claude agent lane |
| p1 | 130 | |
| scourge-survivors | 69 | |
| design-assets-arch | 67 | |
| starblight | 53 | |
| codex:automation | 52 | Routed to Codex agent lane (mutually exclusive with claude:routine — 0 overlap) |
| p0 | 45 | **Diluted** — 1 in 5 issues is "priority 0" |
| epic | 35 | |
| p2 | 34 | |
| integration | 30 | |
| pactfall | 24 | |
| engine | 24 | |
| lore | 15 | |
| deadlane | 11 | |
| redline | 10 | |
| rothulk | 9 | |
| p3 | 7 | |
| warline | 6 | |
| campaign | 6 | |
| brawl | 5 | |
| bug | 4 | |
| documentation | 2 | |
| security | 1 | |

### By milestone (all 2026 weekly sprints, well-formed)

19× W27 Scourge P1, 19× W28 Scourge P2, 18× W29 Scourge P3, 17× W30 Scourge P4, 18× W35/36/37 Starblight P1-3, 11× W40/13× W41 Pactfall MOBA, 11× W32 Redline, 11× W34 Deadlane, 9× W33 Rothulk, 8× W26 Platform&Access P2, 7× W25 Platform&Access P1, 8× W31 Warline Community, 5× W39 Multiplayer Preview, 3× W38 Brawl. Only 6 issues have no milestone.

### Open PR list (all 9, all green except one)

| PR | Title | Closes/refs | CI | Merge state |
|---|---|---|---|---|
| #466 | Feat #207: Pactfall champion roster kits | #207 | pass | CLEAN |
| #465 | Docs #143: Bloodlane design doc | #143 | **FAIL** (lint/typecheck) | BLOCKED |
| #464 | Fix #77: Scourge run vocabulary | #77 | pass | CLEAN |
| #463 | Feat #76: Scourge loot assets through catalog | #76 | pass | CLEAN |
| #462 | Fix #75: run summaries for all run modes | #75 | pass | CLEAN |
| #461 | Feat #72: make Survivors default mode | #72 | pass | CLEAN |
| #460 | Fix #289: Deadrot brand alpha fringe | #289 | pass | CLEAN |
| #459 | Fix #288: Warline portal prop clipping | #288 | pass | CLEAN |
| #458 | Fix #287: Scourge Survivors asset edge QA | #287 | pass | CLEAN |

**Process gap found:** none of these 9 PRs use GitHub auto-close syntax (`Closes #N`) consistently — several say "requested by #72" or just reference the number in the title. Result: 8 mergeable, CI-green PRs are sitting unmerged and their linked issues (#72, #75, #76, #77, #207, #287, #288, #289) will stay open even after merge unless someone closes them manually. This looks like a merge-queue backlog waiting on Vincent, not a broken pipeline — but it means the "219 open issues" figure already overcounts by at least 8 (work is done, just not merged/closed).

---

## 2. Duplicate / stale / obsolete candidates

- **Exact-title duplicates:** 0.
- **Stale (>30d):** 0. This tracker has no rot — it's actively curated (see board-hygiene bot, section 5).
- **Effectively-resolved-but-open** (blocked only by unmerged PRs, not real work): **#72, #75, #76, #77, #207, #287, #288, #289** (8 issues). Recommend closing on merge.
- **Overcounted P0 label:** 45 of 219 issues (20.5%) carry `p0`. That's not a priority signal anymore — true blockers get lost in noise. Recommend re-triaging p0 down to a genuinely small set (see section 7).
- **Near-duplicate epic vs. sub-issue pairs** (not exact dupes, legitimate parent/child, but worth flagging for hygiene): #295 (asset-gen epic) has 5 identical per-game children (#296-301) — correct epic decomposition, not noise.
- **No evidence of bot-generated spam, drive-by community noise, or off-topic issues.** Every issue reads like it was authored by the same operator/process (consistent PRD template: Problem/Goal/Scope/Acceptance criteria). This is a self-authored synthetic backlog, not organic GitHub traffic.

---

## 3. Confirmed bugs (verified against code)

Only 4 issues carry the `bug` label — all three "asset QA" ones and one legacy sprite issue:

1. **#287 — Scourge Survivors dark-fringe/clipped weapon sprites.** VERIFIED PLAUSIBLE: `packages/assets/games/scourge-survivors` has 794 real files (the only game with a real generated-art corpus), so edge-quality defects at that volume are credible. PR #458 already fixes it, green CI, unmerged.
2. **#288 — Warline clipped portal-deck props.** `packages/assets/games/warline` has only 20 files — plausible, narrower blast radius than #287. PR #459 fixes it, green, unmerged.
3. **#289 — deadrot.com brand wordmark/logo alpha-halo fringe.** Cosmetic branding bug, PR #460 fixes it, green, unmerged.
4. **#17 — Re-extract enemy sprites.** Oldest bug in the tracker (created 2026-06-06), likely superseded by the newer #287 asset-QA pass covering the same game; worth checking for overlap before working it standalone.

**Worst 3 (by player-facing impact, not label):**
1. **#385 — CI requires only 2 of 6 checks on master/staging.** VERIFIED: `gh api branches/.../protection` (per issue body) and this audit's read of `.github/workflows/ci.yml` confirm only "Lint, format, typecheck, assets" + "Unit tests" are required; E2E and secret-scan run but don't gate merges. This is the one item in the whole backlog that's an actual release-safety hole, not a feature gap.
2. **#342 — No CDN for `@shipshitgames/assets`.** VERIFIED GREENFIELD: no S3/R2/Blob client exists anywhere in the repo; the only asset script is a local-filesystem copy (`sync-codex-generated-images.mjs`). Every deployed consumer today is baking package-relative assets into build output. This is correctly P0 — it's an actual scaling/drift risk, not aspirational.
3. **#41 — PR AI reviewers / Socket security app not enabled.** VERIFIED: Socket Security checks already run in CI (`Socket Security: Project Report`/`Pull Request Alerts` both green on recent PRs) so this is partially done; CodeRabbit/Codex-review install still appears outstanding. Low effort, real security-process gap.

No evidence of runtime-breaking bugs in the shipped game (scourge-survivors) — the `bug` label is nearly empty, and CI is consistently green across the full Playwright matrix (all 7 games × desktop/mobile) on every sampled PR.

---

## 4. Roadmap themes / epics

Nine coherent epics/streams, ranked by what the code shows is actually near completion vs. greenfield:

1. **Scourge Survivors → v1** (epic #242, 69 issues, `claude:routine`+`codex:automation` mixed). VERIFIED FAR ALONG: 59 files, ~14,670 LOC, real `modes/` (SurvivorsSystem, PveDirectorSystem, GameOverSystem), 794 asset files, full E2E coverage. This is the only game close to "finished product." Remaining issues are mostly balance/polish (weapon tiers, boss encounters, HUD copy) not architecture.
2. **Design/Asset Architecture rollout** (67 issues, label `design-assets-arch`). Spans CDN publishing (#342, greenfield), asset-gen inventory per game (#295-301, epic), and edge-quality QA (#287-290). This is the connective tissue across every other game epic — most other games' issues are blocked on asset volume this theme is supposed to produce.
3. **Starblight → v1** (epic #247, 53 issues across 3 milestones). VERIFIED PARTIAL: 46 files, 4,621 LOC — most-developed of the six non-Scourge games, but nowhere near Scourge's depth. Only 2 asset files in `packages/assets/games/starblight` (essentially no real generated art yet) despite 53 open issues — feature/design work is outpacing asset production here.
4. **Pactfall MOBA** (epic #205/#246, 24 issues). VERIFIED EARLY: 17 files, 2,883 LOC. Full MOBA scope (champions, lanes, towers, minions, PvP netcode) is being spec'd (#206-211, #144) against a 2,883-LOC codebase — this is a from-scratch build, not a finishing pass, and the issue volume/milestone timeline (W40-41) should reflect "new game," not "polish."
5. **Engine consumption / shared runtime** (24 issues, label `engine`). VERIFIED RESOLVED FOR THE BIG THREE: scourge-survivors, deadlane, and warline all correctly depend on published `@shipshitgames/engine@^0.2.0` (not a workspace fork), matching the locked repo-boundary decision. Remaining engine issues (#93 HUD core, #94 transport/presence, #92 wave director) are upstream-candidate extractions, not fork-maintenance debt.
6. **Deadlane / Redline / Rothulk / Warline / Brawl "preview" tier** (11/10/9/6/5 issues respectively). All VERIFIED as real, moderate-scale prototypes (2,000-2,800 LOC each, real game-loop code) — not skeletons, but an order of magnitude smaller than Scourge. Asset folders for deadlane/redline/rothulk/brawl/pactfall each have only 2 files (placeholder manifests) — these games have design/code work ahead of art production.
7. **Lore/canon** (15 issues). Steady drumbeat of "Lore pass" issues per game (#360-370), mostly `claude:routine`, low risk, feeds the `apps/lore` Quartz vault and the typed lore export consumed by `packages/assets`.
8. **Platform & trunk-based CI hardening** (#385, #386 tracking issue, #384 PostHog flags, #355 waitlist gate). VERIFIED CI is "~8/10" per the issue's own (accurate) self-assessment — E2E and secret-scan already exist, just aren't required-status yet. This is the cheapest real risk-reduction in the backlog.
9. **Distribution & monetization** (#330 epic — Steam + web unlock). Depends on Stripe/Clerk, which VERIFIED as genuinely production-wired (real webhook signature verification, live-looking Stripe price ID `price_1Tgri8JLFu10NpzMceH1KZsS`, Clerk entitlement metadata) — this is not vaporware, there is a real paywall today gating at least Scourge Survivors.

---

## 5. Blockers / dependencies

- **#342 (CDN) blocks #295 and its 5 per-game children** (#296-301) at production scale — asset-gen inventory work can proceed locally, but "finished product" for any game implies deployed asset delivery, which has no origin today.
- **#385 blocks #386** (trunk-based migration tracking issue explicitly lists #385 as a prerequisite) and #384 (PostHog flags) is the other listed prerequisite — both open, migration cannot proceed until they land.
- **8 unmerged-but-green PRs block issue closure** for #72, #75, #76, #77, #207, #287, #288, #289 — pure process lag, not technical blockage. #465 (Bloodlane design doc) is additionally blocked by a real CI failure (lint/typecheck), separate from the merge-queue lag.
- **Pactfall epic (#205/#246) is blocked on itself** — #144 (server-authoritative PvP spike) and #145 (camera/controls spike) are prerequisites to #206-211 (map, champions, abilities, minions, towers, match rules) per the codebase's current 2,883-LOC state; sequencing in the tracker doesn't yet reflect that spikes should land before the full feature slate is milestoned into W40/41.
- **Starblight (53 issues) and asset production (#295 epic) are mutually blocking**: Starblight has almost no real generated art (2 files) but the largest non-Scourge issue count — feature/design issues are being filed faster than the asset pipeline can support them.
- **Board hygiene bot** (`.github/workflows/board-hygiene.yml`, weekly cron, GitHub App-authenticated) already keeps 10 project boards in sync — likely why stale-issue count is 0. This is infrastructure, not a blocker, but it explains why this tracker doesn't look like a typical neglected 219-issue backlog.

---

## 6. Suggested issue labels / milestones

- **Split `p0` into `p0` (true blocker, ship-stopping) and a new `now` or `sprint` label** for "this week's committed work." Current 45-issue p0 bucket conflates "release-blocking" (#385, #342) with "next sprint content" (per-game asset inventories) — they don't carry the same urgency and shouldn't share a label.
- **Add a `merged-pending-close` or rely on strict `Closes #N` syntax** in the automation lane's PR template (both `codex:automation` and `claude:routine` PR generators) so issue state and PR state stay in sync without manual bookkeeping.
- **Add a `prototype` or `preview-tier` label** for deadlane/redline/rothulk/brawl/pactfall to distinguish "early build, sparse assets" from starblight/scourge-survivors which are further along — useful for anyone triaging by "is this game playable yet."
- **Consider retiring `enhancement`** as a default — at 199/219 (91%) it carries no signal. Either enforce mutually-exclusive `bug`/`feature`/`chore`/`design` typing, or drop it as noise.
- **Milestones are already well-formed** (weekly, per-game) — no changes needed there.

---

## 7. Ranked backlog (top ~20)

Ranked by real leverage: release-safety and cross-cutting infra first, then the epic closest to shippable, then process cleanup, then new-game work last (since new-game work is least differentiated from "more of the same 24-53 issue pile").

1. **#385 — Require full CI check set on master/staging.** Verified real gap (2 of 6 checks required). Cheapest, highest-leverage risk reduction in the whole tracker; unblocks #386.
2. **Merge the 8 green, unmerged PRs** (#458-464, #466) and close their linked issues. Zero new work, immediately shrinks "219 open issues" to ~211 and ships Survivors-default-mode, run-summary, and asset-QA fixes already sitting done.
3. **Fix #465's CI failure** (lint/typecheck) and merge — Bloodlane design doc is otherwise ready.
4. **#342 — Publish `@shipshitgames/assets` to a CDN.** Verified greenfield, correctly P0, blocks every other game's "finished product" epic at deploy time, not just Scourge.
5. **#287/#458 — Scourge Survivors asset edge-quality fix.** Highest-asset-volume game (794 files); already has a green PR, just needs merge (folds into #2 above but called out because it's the only `bug`-labeled item with real user-facing impact).
6. **#242 — Scourge Survivors finished-product v1 epic.** Furthest-along game by ~3x LOC over anything else; closing this epic's remaining sub-issues (weapon tiers #257/#258, boss encounter #278, HUD/economy polish) is the fastest path to an actually-complete shipped title.
7. **#41 — Enable remaining PR reviewers (CodeRabbit/Codex review).** Socket already verified live; this is a small remaining config step for real security/quality coverage.
8. **Re-triage the 45-issue p0 label** down to genuinely blocking work (see section 6) before planning further sprints — current p0 bucket is not usable as a priority signal.
9. **#295 epic + #296-301 — asset generation inventory per game.** Directly unblocks Starblight/Pactfall/etc. from their current "2-file placeholder" asset state; sequence after #342 (CDN) so output has somewhere to live.
10. **#144/#145 — Pactfall server-authoritative PvP + camera/controls spikes.** Verified prerequisite work for the entire #205 MOBA epic; currently at risk of being skipped in favor of milestoned feature issues (#206-211) that assume these spikes are done.
11. **#386 — Trunk-based migration tracking.** Sequenced after #385/#384; CI is "~8/10" per the issue's own accurate assessment, so this is a policy/process finish, not new engineering.
12. **#384 — PostHog feature-flag layer.** Second prerequisite for #386, otherwise standalone-shippable.
13. **#157 — Build Starblight end-to-end (epic).** Most-developed non-Scourge game; worth a deliberate push before its 53 open issues balloon further relative to its 4,621-LOC base.
14. **#330 — Distribution & monetization (Steam + web unlock).** Stripe/Clerk are verified production-real, so this epic has a live foundation to build on rather than needing payment infra from scratch.
15. **#355 — Deadrot access waitlist and preview gate.** p0, ties into the monetization/access story; check for overlap with existing Clerk-gated access before scoping new work.
16. **#264 — Arena maps: replace flat procedural floor/wall tiles.** Explicitly notes a known AI-generation limitation ("codex can't seamless-tile") — good candidate for human/different-tool intervention rather than another automation-lane attempt.
17. **#219 — Sync lore canon and sprite roster.** Cross-cutting hygiene between `apps/lore` and `packages/assets`; low urgency but prevents drift as more games get real assets.
18. **#125 — Scaffold Deadlane app (epic).** Already has real code (18 files, 2,251 LOC) so "scaffold" is stale framing — likely should be re-scoped to reflect actual state rather than closed/reopened.
19. **#205 — Pactfall MOBA vertical slice (epic).** Sequence after #144/#145 spikes land; currently the most ambitious ask (full MOBA) against the smallest non-brawl codebase.
20. **#1 — Consolidate games and lore.** Oldest open issue (created 2026-06-05, tracker's genesis issue). Worth a check on whether its original scope is still accurate or if it should be closed/replaced now that `apps/lore` + `packages/assets` lore export already exist per repo memory.

---

## Appendix: red flags for tracker health

- **This is not an organic community backlog.** Every issue follows an identical PRD template (Problem/Goal/Scope/Acceptance criteria), all created within a tight 2026-06-02 to 2026-06-20 window (plus a July 3 outlier, #441), and work is dispatched via two mutually-exclusive automation labels (`claude:routine` 157, `codex:automation` 52, zero overlap) rather than human assignment (215/219 unassigned). Treat backlog size (219) as "queued automation work," not "user-reported problems."
- **91% carry `enhancement`, 20% carry `p0`** — both labels are diluted past usefulness for prioritization.
- **~55% of open issues (starblight 53 + pactfall 24 + deadlane 11 + redline 10 + rothulk 9 + warline 6 + brawl 5 ≈ 118 of 219) target games that are verified prototype-scale (2,000-4,600 LOC, 2-file placeholder asset sets)**, not shipped/playable titles. Only Scourge Survivors (69 issues) is verified far along. Roadmap volume is heavily weighted toward games nobody can currently play.
- **Real revenue/paywall infrastructure exists.** `apps/web/app/api/stripe/webhook/route.ts` does genuine signature verification and Clerk entitlement writes; `apps/web/lib/access.ts` references a live-looking Stripe price ID and a `FIRSTROT` promo code. No seed/analytics data was found to confirm actual paying customers, but the integration itself is production-grade, not a stub — this is a real monetized product surface, at minimum for Scourge Survivors.
- **CI is genuinely strong** (7 workflows, full Playwright matrix across all 7 games × desktop/mobile, Socket security scanning, secret scanning, weekly board-hygiene bot via GitHub App) — the tracker's cleanliness (0 stale issues) is a direct result of this automation, not manual hygiene.
- **8 of 9 open PRs are green and mergeable but unmerged** — the bottleneck right now is human merge/review throughput, not code quality or CI.
