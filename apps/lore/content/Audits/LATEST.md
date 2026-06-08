---
type: audit
date: 2026-06-09
auditor: codex automation
automation: weekly-canon-consistency-audit
branch: audit/canon-2026-06-09
base: origin/master 458509c
status: safe fixes applied; human decisions pending
---

# Canon Consistency Audit - 2026-06-09

**Scope:** full lore vault under `apps/lore/content`, anchored on `CANON.md`, `00-Index.md`,
`README.md`, `DESIGN.md`, and every `Universe/` page before sweeping `Factions/`,
`Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Tech/`, `Art/`, and `Templates/`.

**Result:** no hard contradiction against `CANON.md ## Locked` found. Safe mechanical fixes
were applied for index coverage, one broken path-qualified wikilink, and missing bestiary
digest structure. The remaining issues require Vincent/art-direction judgment.

**Counts:**
- Broken wikilinks fixed: 1
- Missing `00-Index.md` links added: 8
- Structural digest fixes applied: 4
- Hard CANON contradictions found: 0
- Drift items needing a human decision: 3
- Structural/content decision categories carried forward: 4

## Auto-fixed

- `00-Index.md` now links the orphaned/deep Art pages:
  `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-03-scourge-host-family-concepts.md`,
  `Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`,
  `Art/Prompt-Batches/2026-06-04-website-portrait-placeholders.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`,
  `Art/Style-Lock-Audit-2026-06-05.md`, and `Art/style-refs/README.md`.
- `index.md` fixed the broken path-qualified wikilink from `[[Factions/Scourge|Scourge]]`
  to `[[Bestiary/Scourge|Scourge]]`.
- Added missing `**At a glance:**` digest lines to four canon bestiary entries that already
  had full body sections and `Appears In` blocks: `Bestiary/Aeolian.md`,
  `Bestiary/Bourdon.md`, `Bestiary/Chorister.md`, and `Bestiary/Descant.md`.

## Needs a human decision

### 1. Active animation prompt has magenta chroma-key drift

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: the batch asks for a flat `#ff00ff` background in every cell. `Style-Bible.md`
  allows HERO/VOID by default and a `#00ff00` GAME-CUTOUT fallback, while `DESIGN.md` and
  `Style-Bible.md` forbid magenta/cyan/neon drift.
- Recommended resolution: either change the animation batch to the approved cutout path, or
  explicitly bless magenta as a tooling-only sprite-sheet key in `Style-Bible.md` so future
  agents do not treat it as subject palette.

### 2. Active animation prompt has off-palette creature language

- File: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- Issue: the Spitter lane uses "sickly chartreuse / acid yellow-green"; the Winged Host lane
  uses "bruised violet / purple wing membranes." The locked palette is red/fire/metal/bone
  with toxic green reserved for Scourge cores, nodes, signal, and breach matter.
- Recommended resolution: constrain these lanes to `toxic #8bdc1f` only for Scourge organs
  and keep bodies in blood/rust/gunmetal/bone, or explicitly add a Scourge-wing palette
  exception before regenerating/expanding animation sheets.

### 3. Style Bible still uses demon shorthand in agent-facing prose

- File: `Universe/Style-Bible.md`
- Issue: sections such as "destructible-demon system" and "newly-summoned demon" are DOOM
  art shorthand, but `CANON.md ## Locked` says the Scourge is a host-dependent parasite,
  not a demon.
- Recommended resolution: if Vincent wants zero semantic ambiguity for agents, replace the
  demon shorthand with "DOOM-like creature/subject" language while preserving the gore and
  material direction.

### 4. Art prompt/reference docs need metadata status calls

- Files: `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`, and
  `Art/style-refs/README.md`
- Issue: these pages are now indexed, but they lack frontmatter `type`/`status` metadata
  unlike nearby prompt-batch and audit pages.
- Recommended resolution: decide whether each is `active`, `historical`, or `superseded`
  before adding frontmatter. Do not infer this automatically because it affects future asset
  generation behavior.

### 5. Scourge host-family frontmatter remains incomplete on draft/mixed entries

- Files: `Bestiary/Breach-Boss.md`, `Bestiary/Orbital-Breach-Carrier.md`,
  `Bestiary/Scourge-Fighter.md`, `Bestiary/Swarm-Ripper.md`,
  `Bestiary/Swarm-Spitter.md`, and `Bestiary/Trucebreaker.md`
- Issue: `Scourge-Host-Families.md` says generation batches should record threat role and
  host family. These pages either represent draft, mixed, or multi-variant roles where the
  host-family value is not fully pinned.
- Recommended resolution: set host-family frontmatter only after the base shipped variant
  or per-game variants are decided. Do not collapse multi-family concepts into one value
  unless that is the intended canon.

### 6. Quiet Rooms lacks a prompt seed while matching visual-detail peers have one

- File: `Factions/The-Quiet-Rooms.md`
- Issue: the page has `Visual / Set Brief` but no `Prompt Seed`, while peer prop/detail pages
  such as `The-Dead-Air-Liturgy.md` and `The-Last-Manifest.md` include one.
- Recommended resolution: add a prompt seed if Quiet Rooms are intended for concept-art
  generation; otherwise leave it as a narrative/set briefing page.

### 7. Open TODOs carried forward

| File | Open item | Recommended resolution |
|---|---|---|
| `Universe/Cosmology.md` | What powers towers and Purgers' gear. | Decide the shared power-source rule and then update Tech pages together. |
| `Games/Deadlane.md` | Named lanes as Locations plus hold/fall outcomes on `Timeline.md`. | Name only after the lane map is settled. |
| `Games/Zero-Day.md` | Name holdout/evac sites and fleet; lock fixed last-stand vs roguelike loop. | Decide game loop first so the canon event framing and sites support it. |
