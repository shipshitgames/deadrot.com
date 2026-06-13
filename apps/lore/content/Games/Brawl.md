---
genre: trench brawler / battlefield fighter
repo: shipshitgames/deadrot.com/apps/games/brawl
faction: Pyre / Wardens / Scourge
status: playable prototype
---
# Brawl

**At a glance:** playable prototype · Duel mode is the lost-soldier fight in a shell hole,
one body against one body after the line disappears · Arena Brawl widens that no-man's-land
pocket to 2-4 fighters, Scourge pressure, hazards, and extraction panic · the close-combat
front of the [[War-for-the-Lanes]].

The touchstone is trench-war panic: wire, mud, shell holes, wrong turns, dead comms, and the
moment a soldier realizes the front line is behind them now. Brawl is not a clean tournament.
It is what happens after a lane breaks, the map goes useless, and two shapes find each other in
the smoke.

Sometimes that shape is [[Scourge|Scourge]] wearing a dead machine and dragging a blade through
the ash. Sometimes it is a Pyre operator and a Warden soldier with bad intel, old blood, and
about six seconds before the breach hears them both. The [[The-Pact|Pact]] still matters: if
the Scourge is the live threat, humans are supposed to turn together. Brawl gets its heat from
the moments when the battlefield makes "supposed to" hard.

## Canon role

Brawl is the close-combat no-man's-land game. [[Deadlane]] holds the lane from the wall,
[[Scourge-Survivors]] descends into the breach, and Brawl lives in the torn space between:
collapsed trench pockets, broken causeways, crater yards, and dead-air cuts where a fighter is
too isolated for command and too close to run.

Warline can treat a Brawl result as a pocket resolved: one survivor extracted, one Scourge
duelist killed, one trench gate reopened, one bad human incident buried before it becomes a
Pact rupture.

Brawl outcomes are **prototype war signals**, not permanent canon by default. A duel can rally
a lane, humiliate a faction, or mark a Scourge champion for later lore, but authored canon still
has to promote the event.

## Modes

### Duel

One fighter. One opponent. No crowd, no clean ring, no polite bell.

Duel mode is the first proof and the current playable prototype: character select, a
game-selected rival, a single battlefield pocket, readable spacing, hitboxes and hurtboxes,
movement, guard, light/heavy/special attacks, KO, result, rematch, and Warline record banking.
The camera can be tight because the story is tight: two bodies in a crater with the war roaring
out of frame.

### Arena Brawl

Arena Brawl is the same war widened until the pocket starts eating everyone.

Two to four fighters enter a trench yard, shattered bridge, ruined gun pit, or breach-lit
platform stack. Ring-outs are not cartoon ring-outs; they are falls into wire, pits, furnace
shafts, dead-air gaps, or Scourge growth. Stocks and lives are the arcade grammar for a squad
running out of bodies before extraction opens.

Local and AI fighters prove the mode first. Online rooms come later, after the fighter
foundation is fun enough to deserve the netcode.

## Design target

- **Duel first:** tight 1v1 survival fights, AI/local opponent, clear reads, fast rematch.
- **Arena second:** Smash-style 2-4 player brawler with stocks/ring-outs, platform stages,
  hazards, pickups, bot fill, and extraction pressure.
- **Online third:** rooms, presence, ready state, sync/fallback behavior, and early-buyer
  preview access once the multiplayer layer is worth inviting people into.

## Current roster

- Pyre: [[Pyre-Duelist]].
- Wardens: [[Warden-Bastion]].
- Scourge: [[Render]], [[Trucebreaker]].

## Roster target

- Pyre expansion: [[Ranger]], [[Vector]], [[Pyre-Cauterizer]].
- Warden expansion: [[Lane-Gunner]], [[Warden-Artillerist]].
- Scourge pressure: [[Graft-Breacher]] and authored champion variants.

## Sprite target

The production target is a real fighting-game sheet per character: idle, walk, jump, crouch,
guard, light, heavy, special, hurt, knockdown, KO, win, and taunt. The current prototype can
reuse existing package entity plates while the rules and camera prove the pipeline.

## Hooks

- [[The-Hollow-Lanes]] - the default no-man's-land theater: broken roads, trench pockets,
  dead-air cuts, and lost patrol fights.
- [[The-Pact]] - the rule Brawl stresses without casually breaking: humans stand together
  when the Scourge is live, but the field is ugly and signal-poor.
- [[Warline]] - Brawl results report close-combat pocket outcomes into the front.
- [[Pactfall]] - the formal arena cousin. Pactfall is sanctioned doctrine combat; Brawl is
  what happens when doctrine falls into the mud.

## Status

Playable prototype. The first cut proves Duel mode: character select, game-selected rival,
movement, guard, light/heavy/special attacks, KO, rematch, and Warline record banking. The board
target remains Duel first, Arena Brawl second, online multiplayer third. The lore target is locked
here: Brawl is trench-war close combat, not a clean esports arena and not random party chaos.
