---
genre: strategy-lite campaign layer
repo: shipshitgames/warline
faction: The Pact / Scourge
status: playable prototype
---
# Warline

**At a glance:** playable prototype / experimental campaign layer · manage the [[War-for-the-Lanes]] across the shared map · every other game reports an operation into the front · spend shared resources, fortify regions, muster the Pact, recon dark sectors, and push back the [[Scourge]] without pretending the whole system is locked yet.

Warline is not another isolated arcade pillar. It is the strategic layer that makes the other
games matter to the same war: [[Scourge-Survivors]] purges breaches, [[Deadlane]] holds lanes,
[[Pactfall]] contests territory, [[Brawl]] settles grudges in sanctioned arenas, [[Starblight]]
intercepts orbit, [[Redline]] runs logistics, and [[Rothulk]] sabotages breach-hearts from
inside the nest.

The current build should be read as **strategy-lite**: a living front, four resources, simple
commands, and a game-to-operation loop. If it proves fun, it can grow toward a deeper strategy
game. Until then, it stays a fast, testable campaign wrapper.

## Canon Role

The campaign layer for the Resistance era. Warline tracks where the Pact is holding, where the
Scourge is pressuring the lanes, and which operations buy the world more time.

Warline outcomes are **provisional** until promoted into authored lore. A run can shift the
prototype front without automatically rewriting [[Timeline]] or a Location page.

**Warline operation — The Front:** The war console itself: every purge, hold, duel, intercept, run, and sabotage reports here, spending shared resources to buy the world more time.

## Current Resources

- `scrap` — Warden material, repairs, tower parts, field industry.
- `fuel` — convoy movement, orbital burn, engines, generators.
- `biomass` — Scourge residue recovered from purges and sabotage.
- `intel` — maps, Choir readings, route data, and target certainty.

## Operation Contract

- [[Scourge-Survivors]] → Purge a Breach.
- [[Deadlane]] → Hold the Lane.
- [[Pactfall]] → Contest Territory.
- [[Brawl]] → Settle a Grudge.
- [[Starblight]] → Orbital Intercept.
- [[Redline]] → Run Logistics.
- [[Rothulk]] → Sabotage a Breach.

## Community Builds → The Front

Warline is how every other preview earns its place in the war. The frame the front presents to
players:

- **Every preview is an operation.** Playing any Deadrot build is one sortie on the shared front —
  a purge, hold, contest, duel, intercept, run, or sabotage. The run reports into Warline and
  spends the same four-resource war pool every game shares.
- **Playtests become field reports, not promises.** Community results — wins, losses, feedback —
  read into the front as **provisional dispatches** that move the prototype line and the war record.
  They are never auto-promoted into locked canon; authored lore decides what holds. This keeps the
  loop honest: the front can shift without [[Timeline]] or a Location page making a claim it can't keep.
- **The line keeps the weekly release cadence.** Each release ships a fresh operation slate and a
  re-seeded front. What the community holds this week is where the next build's war opens:
  - **The Pyre** — purge and sabotage runs burn breaches down from the inside; a strong Pyre week
    thins the nests before the next drop.
  - **The Wardens** — lane holds and logistics keep holdouts connected; Warden wins bank ground the
    Choir has to retake.
  - **The Scourge** — the Choir escalates every week it runs; a quiet community week lets breaches
    root and the next front opens harder.

This frame ships as the in-game **"Why Builds Matter"** briefing on the Command Table, kept in sync
with the `STORY_FRAME` data in `@shipshitgames/warline`.

## Status

Playable prototype — use it to test whether a shared campaign map makes the whole universe
feel more alive. Do not treat it as a locked grand-strategy rulebook yet.
