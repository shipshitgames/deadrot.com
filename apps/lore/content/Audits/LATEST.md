---
type: audit
date: 2026-06-04
auditor: claude (re-audit + fix pass)
branch: chore/lore-audit-fixes
supersedes: audit/canon-2026-06-04 (canon-guardian-agent)
status: all audit items resolved or routed; 3 content TODOs carried forward
---

# Canon Audit — 2026-06-04 (re-audit + fix pass)

**Scope:** full vault — `Universe/`, `Factions/`, `Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Art/`, `Maps.md`, `00-Index.md`, `CANON.md`, `DESIGN.md`. Re-verified the prior canon-guardian audit (the 10 `D-` items below) against the current tree, ran a fresh canon / cross-ref / convention / prose sweep (every finding adversarially verified), and applied the fixes on branch `chore/lore-audit-fixes`.

**Health:** core fiction is sound — **no CANON contradictions**, no broken wiki-links, no orphaned pages, no duplicate entries (the Ashwall→Ashgate fold is clean). Everything flagged was sync / convention / cross-ref housekeeping.

**Counts:** all 10 `D-` items resolved or routed · 5 fresh judgment-call items resolved · 37 entries given `At a glance` lines (all categories complete) · 3 TODOs carried forward.

---

## Fixed on this branch (`chore/lore-audit-fixes`)

### Art pipeline brought into sync with the 2026-06-04 pixel-art lock
- **D-1** — Removed `pixel art` from `Universe/Style-Bible.md` §12 negative-prompt set (it was telling the generator to avoid the locked house medium). Replaced with the medium-correct exclusions `DESIGN.md` already uses, and added a sync note pointing §12 at `DESIGN.md`'s `assetgen.negativePrompts` as the machine twin.
- **D-2 / D-9** — `Art/Character-Prompt-Library.md` marked `status: superseded` (+ `superseded_by`) with a banner redirecting to `[[Style-Bible]]`; banner explicitly flags the `#00ff00` chroma-key default as wrong under the lock (default is HERO/VOID + rembg, §11).
- **D-3** — `Art/Character-Sprite-Direction.md` marked `status: superseded` (+ banner). The chroma-key sub-finding was overstated; the live conflict was the pre-lock 640–704px sizing without the ~110px grid context, now redirected to the locked medium.
- **D-4** — **Decision (Vincent, 2026-06-04): the locked medium-chunky pixel art governs everything seen by a human — there is NO separate hi-fi/website track.** Recorded explicitly in `Style-Bible.md` §11; the two pre-lock hi-fi batch files (`Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`, `…-website-portrait-placeholders.md`) now carry PRE-LOCK/OFF-CANON banners; the matching `Art/Generation-History.md` entries are annotated with the medium mismatch. The hi-fi placeholder assets they produced are slated for regeneration in the locked pixel style (asset-production task, outside the vault).
- `00-Index.md` Art Direction entries for both superseded files re-tagged `*(superseded — see [[Style-Bible]])*`.

### Cross-references reconciled
- **D-5** — `Bestiary/Render.md`, `Rot-Engine.md`, and `Swarm-Ripper.md` now list `[[Redline]]` in *Appears In* (matching Redline's roster); `Swarm-Spitter.md` now lists `[[Rothulk]]`.
- **D-10** — Removed the stray `[[Pactfall]]` from `Characters/Field-Engineer.md`, `Lane-Gunner.md`, and `Wallwright.md`; Index and `Games/Pactfall.md` already excluded them.
- **D-6** — `Style-Bible.md` §1: `[[Premise|Scourge]]` → `[[Scourge]]`.
- **D-8** — `Characters/Pyre-Saboteur.md`: `[[Scourge|bio-hulk]]` → `[[The-Rothulk|bio-hulk]]`.

### Convention: `At a glance` digest line
- Added the required `**At a glance:**` one-liner to **37 entries** (11 Bestiary, 3 Factions, 16 Characters, 7 Games; Characters retrofitted per Vincent's call). Coverage now complete: 16/16 Bestiary, 16/16 Characters, 3/3 Factions, 11/11 Locations, 7/7 Games. Tracked by lore #29 (Pass 1); the #29 Pass-2 *voice* rewrite remains open.

### Fresh judgment-call items (resolved this pass)
- **Cairn vs Trucebreaker** — removed the Pactfall "neutral Scourge objective" claim from `Bestiary/Cairn.md`; `[[Trucebreaker]]` is the sole neutral objective, matching `Games/Pactfall.md`. Cairn is now Deadlane / Scourge-Survivors only.
- **The-Rothulk** — demoted in `00-Index.md` from a top-level Location peer to a Cinder-Flats sub-feature (`[[Cinder-Flats]] (incl. [[The-Rothulk]])`); it shares the `cinder` id and is already covered under Cinder-Flats in `Maps.md`.
- **Ashgate** — added a `## Role in the war` section for parity with the other 10 locations.

### Auto-fixes from the prior (canon-guardian) audit — retained
00-Index additions and the `Maps.md` Cinder-Flats game-column fix remain in place from commit `b2938d7` (#26).

---

## Closed — D-7 (verified already done in the games repo)

### D-7 · Legacy warline region ids
Already reconciled. The `foundry`/`choir` region slugs were renamed to `ashgate`/`perdition` in the games repo (commit *"warline: rename meta-map to canon geography"*); `warline/src/map.ts` now matches the canon ids in `Maps.md` exactly, and no region with id `foundry`/`choir` exists anywhere in the games code. The stale "reconcile map.ts" note + `(ex …)` annotations were removed from `Maps.md` this pass.

---

## Open TODOs (carried forward, not fixed)

| File | TODO | Tracked |
|---|---|---|
| `Universe/Cosmology.md` | "What powers the towers and the Purgers' gear (see Tech)." — Tech folder doesn't exist yet. | lore #8 |
| `Games/Deadlane.md` | Named non-Ashgate lanes as Locations + their hold/fall outcomes on the Timeline — none exist yet. | lore #6 |
| `Games/Zero-Day.md` | Name the holdout/evac sites + the fleet; lock fixed last-stand vs roguelike loop — game canon unsettled. | lore #34 |

**Also tracked on GitHub:** At-a-glance *voice* rewrite (Pass 2) → lore #29 · cross-repo asset regen → games #86 (Zero-Day cover), #87 (scourge-survivors sprites), #89 (20 website portrait plates).
