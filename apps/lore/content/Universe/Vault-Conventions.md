---
status: active
type: vault-convention
---

# Writing Vault Entries — voice vs definitions

The *visual* art direction now lives in [[Style-Bible]]. This is the **writing**
convention for vault entries (preserved from the original Style-Bible draft so it
isn't lost in the art-bible rewrite).

## Two audiences — write for players *and* agents

This vault serves two readers at once (see the [[README]]): **players / humans**, who read for
tone and story, and **agents / devs**, who pull it as submodule memory to build the games.
They want opposite things, so every entry carries **two layers, kept separate**:

- **Voice (for players)** — the entry's narrative body: in-world, witnessed, concrete, in the
  house voice. Written with the `lore-craft` skill. This is the soul, and the seed of
  in-game codex / marketing text.
- **Definitions (for agents)** — the machine-readable facts: rich **frontmatter**, a one-line
  **At a glance** digest under the title, and terse spec blocks (`Gameplay Read`,
  `Sprite Brief`, `Prompt Seed`). An agent or artist should get the canon facts here without
  parsing a paragraph of prose.
- **[[CANON]] is pure definitions** — the global rulebook and source of truth. Never write it
  in narrative voice; ambiguity is the enemy there.

Rule of thumb: **voice on top, facts underneath — never blend them.** A canon contract
written as prose goes ambiguous; an entry that's only a spec block reads lazy. Each failure
mode loses a different reader.

**At a glance** template (one line directly under the `#` title):
`**At a glance:** <type / role> · <key trait> · <key trait> · appears in [[Game]] / [[Game]].`

## The runtime data derivative

This vault is the **prose source of truth**. The shipped repo carries a typed derivative at
`packages/assets/lore/*.json` (games, factions, characters, bestiary, locations,
timeline-events, universe) consumed by the web hub, the in-game codex, and Warline's
narrative events. Drift tests (`packages/assets/tests/lore-drift.test.ts`) pin the
derivative against the asset catalog and the game roster.

Two rules keep the relationship honest:

- **Vault leads, data follows.** Change canon here first; mirror it into the JSON (or ask an
  agent to). The drift tests fail loudly when the two diverge.
- **Coined names are provisional until promoted.** Where the data layer needed a name the
  vault hadn't authored yet (e.g. per-location bosses), the JSON marks it `coined: true` and
  the location note lists it under **Named Threats** with a *(provisional)* tag. Rename or
  promote them freely — then flip the flag.
