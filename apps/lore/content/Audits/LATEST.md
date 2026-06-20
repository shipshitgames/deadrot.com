---
type: audit
date: 2026-06-20
auditor: claude automation (two-pass)
branch: audit/canon-2026-06-20
base: origin/master
status: safe fixes applied; human decisions pending
---

# Canon Consistency Audit — 2026-06-20

**Scope:** full lore vault under `apps/lore/content`, anchored on `CANON.md`, `DESIGN.md`,
`00-Index.md`, `README.md`, and every `Universe/` page before sweeping `Factions/`,
`Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Tech/`, `Art/`, `Design/`,
`Templates/`, and `Audits/`.

**Prior audit:** `Audits/LATEST.md` dated 2026-06-09. No prior auto-fixes were overwritten;
new safe fixes are additive. Prior "Needs a human decision" items are carried forward below.

**Result:** no hard contradiction against `CANON.md ## Locked` found. Four safe mechanical
fixes were applied. Ten issues (3 new + 7 prior) require Vincent/art-direction judgment.

**Counts:**
- Broken wikilinks fixed: 0
- Missing `00-Index.md` links added: 3 (Trucebreaker-DESIGN + Audits/LATEST + v04 wallpapers)
- Stale checklist text fixed: 1 (`Templates/Design-Lock.md`)
- Hard CANON contradictions found: 0
- New drift / structural items needing a human decision: 3
- New operational items needing a human decision: 2
- Prior human-decision items carried forward (still unresolved): 7

---

## Auto-fixed

### 1. `Design/Bestiary/Trucebreaker-DESIGN.md` was orphaned from `00-Index.md`

All other eight `Design/Bestiary/*-DESIGN` and `Design/Locations/*-DESIGN` files were
listed in the Active Design Locks section; `Trucebreaker-DESIGN` was the only one missing.
Added with a `_(candidate-review)_` label to reflect its current frontmatter status.

### 2. `Audits/LATEST.md` was orphaned (no `00-Index.md` link)

No vault page linked to the audit file, making it invisible in graph view and unreachable
via normal navigation. Added an `## Audits` section at the bottom of `00-Index.md` with a
link to `[[Audits/LATEST|Canon Consistency Audit]]`.

### 3. `Art/Combat-Wallpapers-v04.md` was orphaned while carrying `status: active`

`v02` and `v03` are marked `status: superseded` in their frontmatter and correctly left
unindexed. `v04` still carries `status: active` but was also not indexed — inconsistent.
Added to the Art Direction section with a caveat noting the status ambiguity. A human
decision is still needed (see item 4 below).

### 4. `Templates/Design-Lock.md` validation checklist used superseded style language

Line 59 read `Matches [[Style-Bible]] medium-chunky pixel art.` The style lock changed to
"clean comic-book / cel-shaded ink" on 2026-06-17. Every new design-lock scaffolded from
this template would carry the stale phrase into its validation checklist. Updated to:
`Matches [[Style-Bible]] clean comic-book / cel-shaded ink.`

---

## Needs a human decision

### 1. `Universe/Style-Bible.md` — section 14 subsections numbered as §13.x

- **File:** `Universe/Style-Bible.md`
- **Issue:** `## 13. Active Comic Prompt Skeleton` is the active recipe; `## 14. Historical
  Pixel Recipes` introduces the archived pixel skeletons. The subsections inside §14 are
  still labeled `### 13.1 FPS billboard` through `### 13.10 FX` — the old numbering from
  when pixel recipes were §13. An agent reading linearly sees `## 14.` (historical) then
  `### 13.x` subsections and cannot reliably tell which recipes are active.
- **Recommended resolution:** Renumber only the subsections inside §14: `13.1`–`13.10` →
  `14.1`–`14.10`. Verify no cross-links reference these headings by anchor before applying.

### 2. `Tech/Cautery-Cleaver.md` — Prompt Seed uses superseded pixel-art language

- **File:** `Tech/Cautery-Cleaver.md` — `## Prompt Seed` block
- **Issue:** The prompt seed ends with `"medium-chunky detailed pixel art"`. `DESIGN.md`
  (`assetgen.styleSuffix`) and `Style-Bible.md` §2 both lock the house look as **"clean
  comic-book / cel-shaded ink"** and list `pixel art` among the negative-prompt exclusions.
  The three peer `Tech/` pages (`Dead-Air-Beacon.md`, `Blackout-Nail.md`, `Tuning-Fork.md`)
  all use palette-correct prompt seeds without pixel-art language.
- **Recommended resolution:** Rewrite the prompt seed tail to match `Style-Bible.md` §13
  (Active Comic Prompt Skeleton). Do not auto-apply; the exact prompt phrasing is a
  creative/generation call.

### 3. Three provisional Named Threats in location pages need promotion decisions

- **Files:** `Locations/The-Maw.md` (`Maw Shepherd`), `Locations/The-Rothulk.md`
  (`Hull Chorus`), `Locations/The-Hollow-Lanes.md` (`Junction Knell`)
- **Issue:** These boss names were coined for the runtime lore data layer and are correctly
  marked `(provisional)` in each location's "Named Threats" section, per `Vault-Conventions`
  rules. They do not yet have full bestiary pages.
- **Recommended resolution:** For each: either (a) promote to a full bestiary page + remove
  the provisional tag, or (b) rename/discard and update both the location page and the
  corresponding JSON entry in `packages/assets/lore/`.

### 4. `Art/Combat-Wallpapers-v04.md` frontmatter status conflicts with `v05` active status

- **File:** `Art/Combat-Wallpapers-v04.md`
- **Issue:** The file carries `status: active` but `00-Index.md` treats `v05` as the sole
  active combat-wallpaper reference. `v02` and `v03` were correctly marked `superseded`
  when retired; `v04` was not updated. Two files now claim active status on the same topic.
- **Recommended resolution:** If `v05` supersedes `v04`, update `v04`'s frontmatter to
  `status: superseded` and remove the caveat from the index entry. If `v04` remains an
  active companion to `v05`, add a description clarifying what it adds.

### 5. `Design/Bestiary/Trucebreaker-DESIGN.md` status `candidate-review` — placement decision needed

- **File:** `Design/Bestiary/Trucebreaker-DESIGN.md`
- **Issue:** The file is now indexed (auto-fixed above) under "Active Design Locks" with a
  `_(candidate-review)_` label, but its peers in that section are `active` or `locked`.
- **Recommended resolution:** Either (a) promote to `status: active` if the design is ready
  and leave it in Active Design Locks, or (b) create a `### Candidate Design Reviews`
  subsection in `00-Index.md` and move the link there.

---

## Carried from 2026-06-09 (still unresolved)

### [PRIOR 1] Animation pack uses magenta chroma-key background (`#ff00ff`)

- **File:** `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- **Issue:** Batch asks for a flat `#ff00ff` background. `Style-Bible.md` §11 permits only
  HERO/VOID (`void #0a0a0a`) or the approved GAME-CUTOUT path (`#00ff00`). `DESIGN.md`
  explicitly lists magenta among forbidden colors (`magenta cyan or any neon glow`).
- **Recommended resolution:** Change the batch to `#00ff00` (approved cutout), or explicitly
  bless magenta as a tooling-only sprite-sheet key in `Style-Bible.md` §11.

### [PRIOR 2] Animation pack Spitter lane uses off-palette color language

- **File:** `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- **Issue:** Spitter lane uses "sickly chartreuse / acid yellow-green". The locked ranged
  hazard color is `acidOchre #b9a83a`. Note: the Winged Host "bruised violet / purple wing
  membranes" language *is* valid — `Style-Bible.md` §7 (Airborne lane) explicitly permits
  `bruisedViolet` membranes.
- **Recommended resolution:** Constrain the Spitter lane to `acidOchre #b9a83a` and `toxic
  #8bdc1f` for organs only, before regenerating animation sheets.

### [PRIOR 3] `Universe/Style-Bible.md` uses "demon" shorthand in agent-facing prose

- **File:** `Universe/Style-Bible.md` §4 heading and §6 body
- **Issue:** "destructible-demon system" (§4 heading) and "A newly-summoned demon should
  look like it's lit from the inside by a furnace" (§6) use DOOM art shorthand. `CANON.md
  ## Locked` §1 states the Scourge is a **host-dependent parasite**, not a demon.
- **Recommended resolution:** Replace "demon" shorthand with "DOOM-like creature / Scourge
  subject" to eliminate semantic ambiguity for agents while preserving the gore direction.

### [PRIOR 4] Art prompt/reference docs lack frontmatter `type`/`status`

- **Files:** `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`, `Art/style-refs/README.md`
- **Issue:** Now indexed, but still lack frontmatter `type`/`status` metadata unlike all
  peer prompt-batch pages.
- **Recommended resolution:** Decide whether each is `active`, `historical`, or `superseded`,
  then add frontmatter accordingly.

### [PRIOR 5] Scourge host-family frontmatter missing or ambiguous on draft bestiary entries

- **Files:** `Bestiary/Bosses/Breach-Boss.md`, `Bestiary/Aircraft/Orbital-Breach-Carrier.md`,
  `Bestiary/Aircraft/Scourge-Fighter.md`, `Bestiary/Soldiers/Swarm-Ripper.md`,
  `Bestiary/Soldiers/Swarm-Spitter.md`, `Bestiary/Bosses/Trucebreaker.md`
- **Issue:** `Bestiary/Overview/Scourge-Host-Families.md` states batches should record both
  `threat-role` and `host-family`. These entries omit it or represent multi-variant concepts
  where pinning a single value prematurely would collapse variant intent.
- **Recommended resolution:** Pin `host-family` frontmatter only after the shipped variant
  is decided per game; do not force a single value on entries intended to support multiple
  host readings.

### [PRIOR 6] `Factions/The-Quiet-Rooms.md` lacks a Prompt Seed while peers have one

- **File:** `Factions/The-Quiet-Rooms.md`
- **Issue:** Has `## Visual / Set Brief` with detailed art direction but no `## Prompt Seed`,
  unlike structural peers `The-Dead-Air-Liturgy.md` and `The-Last-Manifest.md`.
- **Recommended resolution:** Add a Prompt Seed if concept art generation is intended;
  otherwise note the deliberate absence so future agents know not to add one automatically.

### [PRIOR 7] Open TODOs in canonical documents

| File | Open item | Recommended resolution |
|---|---|---|
| `Universe/Cosmology.md` | "What powers the towers and the Purgers' gear" | Decide the shared power-source rule; update `Tech/` pages together. |
| `Games/Deadlane.md` | Named lanes as `Locations/` entries + hold/fall outcomes on `Timeline.md` | Name lanes only after the lane map is finalized. |
| `Games/Zero-Day.md` | Name holdout/evac sites and fleet; lock fixed last-stand vs roguelike loop | Decide game loop first so the canon event framing and sites can support it. |

---

## Clean bill of health

The following checks found **no issues**:

- **CANON §1–8 contradictions:** Zero. Scourge correctly described as a host-dependent
  parasite (not evil, not demonic in substance) across Bestiary, Factions, Characters,
  Locations, Tech, and Games pages.
- **Faction doctrine consistency:** Pyre = offense/burn-source, Wardens = defense/hold-line,
  Listeners = story-thread only (not a playable fourth faction), Pact = field compact —
  consistent across all pages.
- **Wikilink targets:** All `[[wikilinks]]` in indexed pages resolve to existing files. No
  broken links found in `00-Index.md`, `CANON.md`, `Universe/`, `Factions/`, `Tech/`,
  `Locations/`, `Games/`, or `Bestiary/` entries audited.
- **Timeline order:** Zero-Day → Long Fall → Schism → Pact → Lane Wars → Descent →
  Listeners Emerge. All pages agree on this sequence.
- **Palette discipline:** No neon/magenta/cyan found in Character, Bestiary, Location, or
  Faction prose. Toxic-green correctly reserved for Scourge across all content pages.
- **Style lock:** Comic/cel-shaded ink medium consistently referenced in `DESIGN.md`,
  `Universe/Style-Bible.md`, and `Design/Bestiary/*` design-lock pages.
- **Tech page coverage:** All four `Tech/` items (`Cautery-Cleaver`, `Dead-Air-Beacon`,
  `Blackout-Nail`, `Tuning-Fork`) are indexed and contain correct cross-references.
- **Maps.md registry:** All 10 location entries have correct `loreId`, `front`, `faction`,
  and game-map associations; no legacy region slugs remain.
- **Templates:** `Templates/Creature.md` and `Templates/Character.md` exist and provide
  minimal-viable structure for new entries. `Templates/Design-Lock.md` validation checklist
  updated (auto-fix 4 above).
