---
type: audit
date: 2026-06-20
auditor: claude automation
automation: weekly-canon-consistency-audit
branch: audit/canon-2026-06-20
base: origin/master
status: safe fixes applied; human decisions pending
---

# Canon Consistency Audit — 2026-06-20

**Scope:** full lore vault under `apps/lore/content`, anchored on `CANON.md`, `DESIGN.md`,
`00-Index.md`, `README.md`, and every `Universe/` page before sweeping `Factions/`,
`Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Tech/`, `Art/`, and `Templates/`.

**Result:** no hard contradiction against `CANON.md ## Locked` found. Three safe mechanical
fixes were applied. Seven issues from the 2026-06-09 audit remain unresolved and are carried
forward. Three new issues require Vincent/art-direction judgment.

**Counts:**
- Broken wikilinks fixed: 0
- Missing `00-Index.md` links added: 2 (Trucebreaker-DESIGN + Audits/LATEST)
- Stale checklist text fixed: 1 (Templates/Design-Lock.md)
- Hard CANON contradictions found: 0
- New drift/decision items: 3
- Issues carried forward from 2026-06-09: 7

## Auto-fixed

### 1. Trucebreaker Design Lock was orphaned from 00-Index.md

- File: `Design/Bestiary/Trucebreaker-DESIGN.md`
- Issue: all other eight entries in the "Active Design Locks" section of `00-Index.md`
  were listed; Trucebreaker-DESIGN was the only one missing.
- Fix: added `[[Design/Bestiary/Trucebreaker-DESIGN|Trucebreaker Design Lock]]` to
  the Active Design Locks list in `00-Index.md`.

### 2. Audits/LATEST.md was orphaned (no 00-Index link)

- File: `Audits/LATEST.md`
- Issue: no page in the vault linked to the audit file, making it invisible in graph view
  and unreachable via normal navigation.
- Fix: added an `## Audits` section at the bottom of `00-Index.md` with a link to
  `[[Audits/LATEST|Canon Consistency Audit]]`.

### 3. Templates/Design-Lock.md checklist used superseded style

- File: `Templates/Design-Lock.md`
- Issue: line 59 read `Matches [[Style-Bible]] medium-chunky pixel art.` — the old style.
  The style lock changed to "clean comic-book / cel-shaded ink" on 2026-06-17 (Style-Bible
  status: LOCKED). Every new design lock scaffolded from this template would carry the
  stale phrase into its validation checklist.
- Fix: updated the checklist item to `Matches [[Style-Bible]] clean comic-book / cel-shaded ink.`

## Needs a human decision

### NEW-1. Style-Bible section 14 has wrong internal subsection numbering

- File: `Universe/Style-Bible.md`
- Issue: Section 13 is "Active Comic Prompt Skeleton"; Section 14 is "Historical Pixel
  Recipes." The subsections inside Section 14 are still labeled `### 13.1` through
  `### 13.10` (the old numbering from when pixel recipes were Section 13). They should
  be `### 14.1` through `### 14.10`.
- Recommended resolution: do a global find-replace inside Section 14 only, renaming
  `13.1`–`13.10` → `14.1`–`14.10`. Verify no cross-links use the old heading anchors
  before applying.

### NEW-2. Cautery-Cleaver.md prompt seed uses superseded pixel-art style

- File: `Tech/Cautery-Cleaver.md`
- Issue: the `Prompt Seed` block ends with "medium-chunky detailed pixel art" — the style
  that was superseded by the 2026-06-17 comic/cel-ink lock.
- Recommended resolution: rewrite the prompt seed tail to match the approved Style-Bible
  §13 (Comic Prompt Skeleton) language. Do not auto-apply; the exact prompt phrasing is a
  creative/generation decision.

### NEW-3. Three provisional Named Threats in new location pages need promotion decisions

- Files: `Locations/The-Maw.md` (Maw Shepherd), `Locations/The-Rothulk.md` (Hull Chorus),
  `Locations/The-Hollow-Lanes.md` (Junction Knell)
- Issue: PR #316 coined these boss names for the runtime lore data layer; they are correctly
  marked `(provisional)` in each location's "Named Threats" section. They have not been
  elevated to canon bestiary entries with full vault pages.
- Recommended resolution: for each, either (a) promote to a full bestiary page + remove
  the provisional tag, or (b) rename/discard and update both the location page and the
  corresponding JSON entry.

---

### Carried from 2026-06-09 (still unresolved)

#### 1. Active animation prompt has magenta chroma-key drift

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: batch asks for flat `#ff00ff` background; Style-Bible §11 forbids magenta;
  approved cutout key is `#00ff00`.
- Recommended resolution: change batch to `#00ff00` or explicitly bless magenta as a
  tooling-only sprite-sheet key in Style-Bible §11.

#### 2. Active animation prompt has off-palette Spitter lane language

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: Spitter lane uses "sickly chartreuse / acid yellow-green"; locked palette uses
  `acidOchre #b9a83a` for ranged hazard reads.
- Note: the Winged Host lane "bruised violet / purple wing membranes" is VALID —
  Style-Bible Airborne color lane explicitly lists `bruisedViolet` membranes.
- Recommended resolution: constrain Spitter lane to `acidOchre #b9a83a` before
  regenerating animation sheets.

#### 3. Style-Bible still uses demon shorthand in agent-facing prose

- File: `Universe/Style-Bible.md`
- Issue: §4 heading "destructible-demon system" and §6 phrase "newly-summoned demon"
  use DOOM art shorthand. `CANON.md ## Locked` says the Scourge is a host-dependent
  parasite, not a demon.
- Recommended resolution: replace with "DOOM-like creature/subject" language to remove
  semantic ambiguity for AI agents while preserving the gore direction.

#### 4. Art prompt/reference docs lack frontmatter type/status

- Files: `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`,
  `Art/style-refs/README.md`
- Recommended resolution: decide active / historical / superseded status, then add
  frontmatter. Do not infer — affects future asset generation behavior.

#### 5. Scourge host-family frontmatter incomplete on draft/mixed bestiary entries

- Files: `Bestiary/Bosses/Breach-Boss.md`, `Bestiary/Aircraft/Orbital-Breach-Carrier.md`,
  `Bestiary/Aircraft/Scourge-Fighter.md`, `Bestiary/Soldiers/Swarm-Ripper.md`,
  `Bestiary/Soldiers/Swarm-Spitter.md`, `Bestiary/Bosses/Trucebreaker.md`
- Recommended resolution: set host-family frontmatter only after shipped variants are
  decided; do not collapse multi-family concepts prematurely.

#### 6. The Quiet Rooms lacks a prompt seed

- File: `Factions/The-Quiet-Rooms.md`
- Issue: has `Visual / Set Brief` but no `Prompt Seed`; peer pages include one.
- Recommended resolution: add a prompt seed if concept-art generation is intended.

#### 7. Open TODOs carried forward

| File | Open item | Recommended resolution |
|---|---|---|
| `Universe/Cosmology.md` | What powers towers and Purgers' gear. | Decide the shared power-source rule and update Tech pages together. |
| `Games/Deadlane.md` | Named lanes as Locations plus hold/fall outcomes on `Timeline.md`. | Name only after the lane map is settled. |
| `Games/Zero-Day.md` | Name holdout/evac sites and fleet; lock fixed last-stand vs roguelike loop. | Decide game loop first so the canon event framing and sites support it. |
