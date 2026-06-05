# Ship Shit Games — Lore

The shared canon for the **Ship Shit Games** universe — one consistent world across every
title. This is an **Obsidian vault** (plain Markdown + `[[wikilinks]]`), which means it
doubles as **cross-game agent memory**: the same format our `.agents/memory/` uses, and
readable by Claude/Codex when building any game.

## Open in Obsidian

Open this folder as a vault and start at [[00-Index]]. Wikilinks + the graph view map the
universe; the `Templates/` folder scaffolds new entries.

## How games consume the canon

Each game repo includes this vault as shared memory — a git submodule at `.agents/lore/`:

```bash
git submodule add https://github.com/shipshitgames/lore .agents/lore
```

So generated names, enemies, locations, and flavor text stay canon. Update lore here →
each game pulls the pinned version. Humans read it in Obsidian; agents read the same files.

## Structure

| Folder | Holds |
|--------|-------|
| `Universe/` | premise, timeline, cosmology, style bible |
| `Factions/` | who's who |
| `Characters/` | the named cast |
| `Locations/` | places — incl. the fronts the games take place on |
| `Bestiary/` | the horde / enemies |
| `Tech/` | weapons, towers, items |
| `Games/` | each title's place in the canon |
| `Templates/` | Obsidian templates for new entries |

## Status

**DRAFT.** Vincent owns the canon — rewrite freely. License: CC BY 4.0 (lore/text);
code samples MIT.
