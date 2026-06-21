---
type: audit
date: 2026-06-21
auditor: claude automation
automation: weekly-canon-consistency-audit
branch: audit/canon-2026-06-21
base: origin/master
status: safe fixes applied; human decisions pending
---

# Canon Consistency Audit — 2026-06-21

**Scope:** full lore vault under `apps/lore/content`, anchored on `CANON.md`, `00-Index.md`,
`README.md`, `DESIGN.md`, and every `Universe/` page before sweeping `Factions/`,
`Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Tech/`, `Art/`, and `Templates/`.

**Result:** no hard contradiction against `CANON.md ## Locked` found. Safe mechanical fixes
applied for index coverage and one cross-game `Appears In` discrepancy. The remaining issues
require Vincent/art-direction judgment.

**Counts:**
- Broken wikilinks fixed: 0
- Missing `00-Index.md` links added: 5 (3 Combat-Wallpapers versions + Audits section + LATEST)
- `Appears In` cross-game fixes applied: 1 (Trucebreaker → added Brawl)
- Hard CANON contradictions found: 0
- New drift/decision items: 5
- Items carried forward from 2026-06-09 audit: 7

---

## Auto-fixed

### 1. `Audits/LATEST.md` orphaned from index

- **File changed:** `00-Index.md`
- **Fix:** Added a new `## Audits` section linking `[[Audits/LATEST|Latest Canon Consistency Audit]]`.
- **Why:** The audit file existed in the vault but had no incoming links and did not appear in
  `00-Index.md`, making it invisible to graph view and agent traversal.

### 2. `Art/Combat-Wallpapers-v02`, `v03`, `v04` orphaned from index

- **File changed:** `00-Index.md`
- **Fix:** Added three entries under the existing Combat Wallpapers v05 line, each marked with
  their frontmatter status (`superseded`).
- **Why:** v05 was the only version indexed. The three earlier versions exist on disk, are
  referenced by their successors' `supersedes:` frontmatter, and belong in the historical
  record. v04 is also independently marked `status: active` in its own frontmatter (a status
  inconsistency flagged below as H4).

### 3. `Trucebreaker.md` missing `[[Brawl]]` in `Appears In`

- **File changed:** `Bestiary/Bosses/Trucebreaker.md`
- **Fix:** Added `[[Brawl]]` to the `## Appears In` list, and updated the **At a glance**
  digest line to include `[[Brawl]]`.
- **Why:** `Games/Brawl.md` explicitly lists Trucebreaker in its "Current roster" under the
  Scourge faction. `00-Index.md` also lists Trucebreaker under the Brawl First Roster entry.
  The creature page itself only acknowledged Pactfall, which was inconsistent with two other
  canon documents.

---

## Needs a human decision

### H1. Cautery-Cleaver prompt seed uses "pixel art" — violates locked house look

- **File:** `Tech/Cautery-Cleaver.md`
- **Issue:** The `## Prompt Seed` section ends with "medium-chunky detailed pixel art." The
  locked house look (Style-Bible §1, locked 2026-06-17) is clean comic-book / cel-shaded ink.
  Pixel art appears under `negativePrompts` in `DESIGN.md` and is categorized as
  "Historical Pixel Recipes" in Style-Bible §14. Using it in an active prompt seed will
  produce an off-canon asset.
- **Recommended resolution:** Replace the pixel-art language with the active Prompt Skeleton
  from Style-Bible §13 (comic-ink lines, flat colour fills, bold black outlines, blood-red/
  gunmetal palette). Do not auto-apply — this touches an art direction call.

### H2. Cairn tier is inconsistent across two pages

- **Files:** `Bestiary/Overview/Scourge.md` vs `Bestiary/index.md`
- **Issue:** `Bestiary/Overview/Scourge.md` lists Cairn under the **Elites** tier
  ("the heavy [[Cairn]]"). `Bestiary/index.md` places Cairn under **Bosses**. These are
  contradictory tier assignments for the same creature.
- **Recommended resolution:** Decide Cairn's canonical tier (Elite = disposable heavy vs Boss =
  named encounter). Update the one page that's wrong. If Cairn is genuinely dual-tier
  (functions as elite in some modes, boss in others), add a note to both pages explaining the
  context split.

### H3. `Survivors-Loop.md` Per Game section incomplete

- **File:** `Universe/Survivors-Loop.md`
- **Issue:** The `## Per Game` section lists only Scourge-Survivors, Deadlane, Pactfall, and
  Starblight. However, `Games/Brawl.md`, `Games/Redline.md`, `Games/Rothulk.md`, and
  `Games/Warline.md` all reference the shared Survivors-Loop in their own pages and are listed
  as playable prototypes in `00-Index.md`. The page's `## Rule` ("The loop is design DNA, not
  a template prison") implies it covers all titles.
- **Recommended resolution:** Add the missing games to the Per Game section with brief notes
  on how the loop manifests in each (trench brawl arena, courier sprint, infiltration climb,
  strategy ops). Do not auto-apply — requires confirming per-game design intent.

### H4. `DESIGN.md` missing `brawl` from `assetgen.referenceImages`

- **File:** `DESIGN.md`
- **Issue:** The `assetgen.referenceImages` YAML block includes entries for scourge-survivors,
  deadlane, pactfall, starblight, redline, rothulk, and shared — but not `brawl`. The
  `perGameFraming` block does include brawl. This inconsistency means the asset pipeline
  compiles style rules for Brawl but has no locked reference images to anchor them.
- **Recommended resolution:** Either add a `brawl:` entry to `referenceImages` with the
  appropriate locked reference(s), or add a comment noting that Brawl deliberately inherits
  the `shared:` references. Also note: `Art/Combat-Wallpapers-v04.md` is marked
  `status: active` in its own frontmatter but is superseded by v05 — that status field should
  be corrected to `superseded` for consistency.

### H5. Style-Bible §13/§14 sub-section numbering error

- **File:** `Universe/Style-Bible.md`
- **Issue:** Section 13 is "Active Comic Prompt Skeleton." Section 14 is "Historical Pixel
  Recipes." However, the sub-sections inside §14 are numbered 13.1 through 13.10 — they
  inherited their numbers from the old structure when the active/historical split created a
  new §13. This is a documentation structural error, not a canon contradiction, but it causes
  confusion for agents reading section headers.
- **Recommended resolution:** Renumber the §14 sub-sections to 14.1–14.10, or relabel them
  clearly (e.g., "Historical 1 of 10") to reflect that they are under the Historical section.
  Do not auto-apply — the Style-Bible is a locked doc and renumbering touches every
  cross-reference to those sub-sections.

---

## Carried forward from 2026-06-09

The following seven items were raised in the previous audit and remain open. They are
reproduced here verbatim for visibility — no new information changes the recommended
resolutions.

### CF-1. Active animation prompt has magenta chroma-key drift

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: batch asks for a flat `#ff00ff` background. Style-Bible allows HERO/VOID (`#0a0a0a`)
  and GAME-CUTOUT (`#00ff00`) only; magenta is forbidden.
- Recommended resolution: change to approved cutout path, or explicitly bless magenta as a
  tooling-only sprite-sheet key in Style-Bible so agents don't treat it as subject palette.

### CF-2. Active animation prompt has off-palette creature language

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: Spitter lane uses "sickly chartreuse / acid yellow-green"; Winged Host uses "bruised
  violet / purple wing membranes." Locked palette is red/fire/metal/bone with toxic green
  (`#8bdc1f`) reserved for Scourge organs only.
- Recommended resolution: constrain to `#8bdc1f` for organs and blood/rust/gunmetal/bone for
  bodies, or add explicit palette exceptions before regenerating.

### CF-3. Style-Bible uses "demon" shorthand in agent-facing prose

- File: `Universe/Style-Bible.md`
- Issue: phrases like "destructible-demon system" and "newly-summoned demon" are DOOM art
  shorthand, but CANON.md §Locked states Scourge is a host-dependent parasite, not a demon.
- Recommended resolution: replace demon shorthand with "DOOM-like creature/subject" if zero
  semantic ambiguity for agents is desired.

### CF-4. Art prompt/reference docs lack type/status metadata

- Files: `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`, `Art/style-refs/README.md`
- Issue: pages are indexed but lack frontmatter `type`/`status` metadata.
- Recommended resolution: decide active/historical/superseded for each, then add frontmatter.

### CF-5. Scourge host-family frontmatter incomplete on draft entries

- Files: `Bestiary/Bosses/Breach-Boss.md`, `Bestiary/Aircraft/Orbital-Breach-Carrier.md`,
  `Bestiary/Aircraft/Scourge-Fighter.md`, `Bestiary/Soldiers/Swarm-Ripper.md`,
  `Bestiary/Soldiers/Swarm-Spitter.md`, `Bestiary/Bosses/Trucebreaker.md`
- Issue: host-family value not pinned on multi-variant/draft entries.
- Recommended resolution: set host-family only after the base shipped variant is decided.

### CF-6. The-Quiet-Rooms.md lacks a prompt seed

- File: `Factions/The-Quiet-Rooms.md`
- Issue: has `Visual / Set Brief` but no `Prompt Seed`, unlike peer prop/detail pages.
- Recommended resolution: add a prompt seed if concept art is planned; otherwise mark as
  narrative-only.

### CF-7. Open TODOs carried forward

| File | Open item | Recommended resolution |
|---|---|---|
| `Universe/Cosmology.md` | What powers towers and Purgers' gear. | Decide the shared power-source rule and update Tech pages together. |
| `Games/Deadlane.md` | Named lanes as Locations plus hold/fall outcomes on Timeline. | Name only after the lane map is settled. |
| `Games/Zero-Day.md` | Name holdout/evac sites and fleet; lock fixed last-stand vs roguelike loop. | Decide game loop first so canon framing supports it. |
