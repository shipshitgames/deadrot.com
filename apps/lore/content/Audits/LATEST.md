---
type: audit
date: 2026-06-22
auditor: claude automation
automation: canon-consistency-audit
branch: audit/canon-2026-06-22
base: origin/master e577164
status: safe fixes applied; human decisions pending
---

# Canon Consistency Audit — 2026-06-22

**Scope:** full lore vault under `apps/lore/content`, anchored on `CANON.md`, `00-Index.md`,
`README.md`, `DESIGN.md`, and every `Universe/` page before sweeping `Factions/`,
`Characters/`, `Bestiary/`, `Locations/`, `Games/`, `Tech/`, `Art/`, `Design/`, and
`Templates/`. Approximately 139 markdown files examined, 260 unique wikilink targets traced.

**Result:** no hard contradiction against `CANON.md ## Locked` found. Two style-drift fixes
applied (outdated pixel-art references), four `00-Index.md` coverage gaps closed. Seven
human-decision items from the 2026-06-09 audit remain unresolved and are carried forward.

**Counts:**
- Style-drift safe fixes applied: 2
- Missing `00-Index.md` links added: 4
- Hard CANON contradictions found: 0
- Broken wikilinks found: 0
- New drift items needing a human decision: 0
- Human-decision items carried forward from 2026-06-09: 7

---

## Auto-fixed

### 1. `Templates/Design-Lock.md` — outdated style reference in validation checklist

- **Before:** `- [ ] Matches [[Style-Bible]] medium-chunky pixel art.`
- **After:** `- [ ] Matches [[Style-Bible]] comic-book / cel-shaded ink (house look locked 2026-06-17).`
- **Why:** The house look changed to clean comic-book / cel-shaded ink on 2026-06-17
  (per `Style-Bible.md` and `DESIGN.md` which list `styleSuffix: comic-ink` and include
  `pixel art` in `negativePrompts`). The template checklist still referenced the superseded
  pixel-art direction, which would cause every new design-lock to validate against a dead
  standard.

### 2. `Tech/Cautery-Cleaver.md` — outdated style tag in Prompt Seed

- **Before:** `... single object on near-black background, medium-chunky detailed pixel art, no medieval sword ...`
- **After:** `... single object on near-black background, comic-book ink, cel-shaded, bold outlines, no medieval sword ..., no pixel art.`
- **Why:** Same 2026-06-17 style lock. The Prompt Seed explicitly called for pixel art and
  did not include `no pixel art` in negativePrompts, which would direct any asset-generation
  run against the superseded standard.

### 3. `00-Index.md` — `Characters/index.md` was an orphan hub (no index link)

- **Added:** `[[Characters/index|Characters]]` in the Compendium line.
- **Why:** `Characters/index.md` is the hub for all 15 named operators. It existed and
  was populated but had no entry in `00-Index.md`, making it unreachable from the vault
  root in graph view.

### 4. `00-Index.md` — `Bestiary/index.md` was an orphan hub (no index link)

- **Added:** `[[Bestiary/index|Bestiary]]` in the Compendium line.
- **Why:** Same as above for the 40+ creature catalogue hub page.

### 5. `00-Index.md` — `Art/Combat-Wallpapers-v02.md` was an unreferenced file

- **Added:** archived entry for `[[Art/Combat-Wallpapers-v02|Combat Wallpapers v02]]`
  in the Art Direction section, labelled `(archived)` and pointing readers to v05.
- **Why:** v02 was the only Art iteration file with no index link. v03, v04, and v05 are
  all indexed. Leaving one version invisible breaks the provenance trail.

### 6. `00-Index.md` — `Audits/LATEST.md` had no index entry

- **Added:** new `## Audits` section with `[[Audits/LATEST|Latest Canon Audit]]`.
- **Why:** The audit log is agent-facing working memory. With no path from the vault root,
  future agents cannot discover it in graph traversal without knowing the file path.

---

## Needs a human decision

All seven items from the 2026-06-09 audit remain unresolved. They are reproduced here with
their original file references and recommended resolutions so they are not lost.

### 1. Active animation prompt has magenta chroma-key drift

- **File:** `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- **Issue:** The batch asks for a flat `#ff00ff` background in every animation cell.
  `Style-Bible.md` allows HERO/VOID by default and a `#00ff00` GAME-CUTOUT fallback, while
  both `DESIGN.md` and `Style-Bible.md` explicitly forbid magenta/cyan/neon.
- **Recommended resolution:** Either change the animation batch to use the `#00ff00`
  approved cutout path, or explicitly bless magenta as a tooling-only sprite-sheet chroma
  key in `Style-Bible.md` so future agents do not treat it as subject palette.

### 2. Active animation prompt has off-palette creature language

- **File:** `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`
- **Issue:** The Spitter lane uses "sickly chartreuse / acid yellow-green"; the Winged Host
  lane uses "bruised violet / purple wing membranes." The locked palette is
  red/fire/metal/bone with toxic green (`#8bdc1f`) reserved for Scourge cores, nodes,
  signal, and breach matter only.
- **Recommended resolution:** Constrain these lanes to `toxic #8bdc1f` for Scourge organs
  only and keep bodies in blood/rust/gunmetal/bone — or explicitly add a Scourge-wing
  palette exception to `Style-Bible.md` before regenerating or expanding animation sheets.

### 3. Style-Bible uses demon shorthand in agent-facing prose

- **File:** `Universe/Style-Bible.md`
- **Issue:** Section §4 heading reads "Anatomy & gore — the destructible-demon system"
  and the body references "newly-summoned demon." `CANON.md ## Locked` §1 states the
  Scourge is a host-dependent parasite, not a demon. The shorthand is clearly borrowed from
  DOOM as art direction, but agents consuming Style-Bible as memory may infer the wrong
  ontology.
- **Recommended resolution:** If zero semantic ambiguity is required for agents, replace
  demon shorthand with "DOOM-like creature/subject" language while preserving the gore and
  material direction. Low urgency if agents can be reliably instructed to treat it as art
  shorthand only.

### 4. Art prompt/reference docs need metadata status calls

- **Files:** `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`,
  `Art/Prompt-Batches/2026-06-05-game-og-cards.md`,
  `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`, and
  `Art/style-refs/README.md`
- **Issue:** These pages are indexed but lack frontmatter `type`/`status` metadata,
  unlike peer prompt-batch and audit pages.
- **Recommended resolution:** Decide whether each is `active`, `historical`, or `superseded`
  before adding frontmatter. Do not infer this automatically because the status affects
  future asset-generation behaviour.

### 5. Scourge host-family frontmatter remains incomplete on draft/mixed entries

- **Files:** `Bestiary/Bosses/Breach-Boss.md`, `Bestiary/Aircraft/Orbital-Breach-Carrier.md`,
  `Bestiary/Aircraft/Scourge-Fighter.md`, `Bestiary/Soldiers/Swarm-Ripper.md`,
  `Bestiary/Soldiers/Swarm-Spitter.md`, `Bestiary/Bosses/Trucebreaker.md`
- **Issue:** `Scourge-Host-Families.md` says generation batches should record threat role
  and host family. These entries either represent draft, multi-variant, or cross-family roles
  where the host-family value is not yet pinned.
- **Recommended resolution:** Set host-family frontmatter only after the shipped variant or
  per-game variants are decided. Do not collapse multi-family concepts into one value unless
  that is intended canon.

### 6. Quiet Rooms lacks a Prompt Seed while matching visual-detail peers have one

- **File:** `Factions/The-Quiet-Rooms.md`
- **Issue:** The page has a `Visual / Set Brief` section but no `Prompt Seed`, while peer
  prop/detail pages (`The-Dead-Air-Liturgy.md`, `The-Last-Manifest.md`) include one.
- **Recommended resolution:** Add a prompt seed if Quiet Rooms are intended for concept-art
  generation; otherwise leave it as a narrative/set briefing page.

### 7. Open TODOs carried forward

| File | Open item | Recommended resolution |
|---|---|---|
| `Universe/Cosmology.md` | What powers towers and Purgers' gear. | Decide the shared power-source rule, then update Tech pages together. |
| `Games/Deadlane.md` | Named lanes as Locations plus hold/fall outcomes on `Timeline.md`. | Name only after the lane map is settled. |
| `Games/Zero-Day.md` | Name holdout/evac sites and fleet; lock fixed last-stand vs roguelike loop. | Decide game loop first so the canon event framing and sites support it. |
