---
type: registry
status: locked
front-taxonomy:
  - holdout
  - lane
  - breach
  - orbital
---
# Maps — the cross-game map registry

**At a glance:** the single source of truth tying the [[War-for-the-Lanes]] meta-map, the lore [[00-Index|Locations]], and every game's in-code maps together · one canon `id` per place · `loreId` + `front` are the join keys · `warline/src/map.ts` is the live meta-map.

One war, one map, many games shooting at it from different angles. A place is the same place whether a Purger is dying in it, a Warden is walling it, a champion is settling a grudge over it, or a lost fighter is clawing out of a trench pocket — so it gets **one canon id**, and every game that touches it carries that id home. This file is where the [[War-for-the-Lanes]] front, the authored [[00-Index|Location]] notes, and the in-code map data agree on what's real. Edit a place here first; the games inherit it. Nothing on this list contradicts [[CANON]] — the breaches are physical nests, [[Perdition]] is the deepest of them where the source pulses, [[Ashgate]] is the Warden capital where three lanes converge.

| Location | id | front | faction | breach/lane | warline region | Game(s) + in-game map name |
|---|---|---|---|---|---|---|
| [[Ashgate]] | `ashgate` | holdout | Wardens | — (3 lanes converge) | `ashgate` | [[Scourge-Survivors]] 'Ashgate' stage 1 · [[Deadlane]] 'Ashgate — Eastern Lane' · [[Pactfall]] 'Ashgate Arena District' |
| [[The-Spire]] | `spire` | holdout | Wardens | [[The-Spire-Causeway|Spire Causeway]] | `spire` | — |
| [[The-Pyre-Gate]] | `pyregate` | holdout | Pyre | Pyre Road | `pyregate` | — |
| [[Ash-Reach]] | `ashreach` | holdout | Pyre | Ash Front | `ashreach` | — |
| [[Rustmarch]] | `rustmarch` | lane | neutral | North Front | `rustmarch` | — |
| [[The-Hollow-Lanes]] | `hollowlanes` | lane | neutral | Foundry Front | `hollowlanes` | [[Scourge-Survivors]] 'The Hollow Lanes' stage 2 · [[Redline]] 'The Hollow Lanes — Dead Road' · [[Brawl]] 'No-Man's-Land Pocket' |
| [[The-Skyhook]] | `skyhook` | orbital | neutral | Orbital Descent | `skyhook` | [[Starblight]] 'The Skyhook — Orbital Ring' |
| [[The-Maw]] | `maw` | breach | Scourge | The Maw Lane (Breach Primus) | `maw` | [[Scourge-Survivors]] 'The Maw' stage 3 |
| [[Cinder-Flats]] | `cinder` | breach | Scourge | Cinder Lane (The Cinder Breach) | `cinder` | [[Rothulk]] 'The Rothulk' (bio-hulk climb level) |
| [[Perdition]] | `perdition` | breach | Scourge | Choir Lane (The Choir Node) | `perdition` | [[Scourge-Survivors]] 'Perdition' stage 4 (final descent) |

## How games wire to canon

Each game's map data carries **`loreId`** (the canon `id` above) plus **`front`**, and opens with a header comment pointing back here. That's the whole contract: an in-game map says *which canon place it is*, and everything else — the [[War-for-the-Lanes]] front it moves, the authored note that voices it — hangs off the id.

- **`warline/src/map.ts`** is the live meta-map. Its regions/lanes/breaches use these same ids; results from the small games shift the front through them.
- **`lore/Locations/*.md`** are the authored notes — the voiced, witnessed account of each place. The registry row points at the note; the note points back at its games.
- `warline/src/map.ts` region/lane/breach ids match the canon ids in this table. *(The early-draft `foundry`/`choir` region slugs were renamed to `ashgate`/`perdition` when the meta-map was reconciled to canon geography — no legacy ids remain in the games code.)*
