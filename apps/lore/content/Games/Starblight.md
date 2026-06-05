---
genre: top-down arcade-pilot survivors (Vampire Survivors × twin-stick flight)
repo: shipshitgames/starblight
faction: Pyre / Wardens
status: playable prototype — pivoting to a momentum-flight pilot build (style lock first)
---
# Starblight

**At a glance:** top-down arcade-pilot survivors (momentum-flight pivot) · burn the Scourge out of orbit before it falls — you fly under mouse, the guns auto-fire · [[The-Pyre]] / [[The-Wardens]] pilots · the orbital front of the war: kill the infection above before [[Deadlane]] has to hold it below.

An orbital arcade shooter where pilots burn Scourge infection out of the sky before it falls
into the surface war. "Starblight" is the name for Scourge contamination in space: spores,
infected wreckage, living carrier-ships, and breach matter spreading through orbit.

## Core Loop

A top-down flyer carrying the shared [[Survivors-Loop]]: launch → fly the [[The-Skyhook|Skyhook]]
under mouse control while the Scourge swarm from all sides → auto-fire thins them → collect
salvage/XP → draft 1-of-3 upgrades → stack synergies → burn an orbital boss or get overrun.
You move; the guns aim themselves.

## Design Direction (decided 2026-06-04)

The first build was a fixed Galaga-style formation shooter; it was rebuilt into a playable
top-down mouse-flight survivors and is live as a prototype. The next move is to make Starblight
clearly its **own** game rather than the FPS ([[Scourge-Survivors]]) seen from above:

- **Fantasy = the pilot, not the foot-soldier.** Lean into a [Nova Drift]-style dogfighter:
  **momentum / inertia flight** (thrust + drift) and an **afterburner dash**, so flying well is
  the skill — not steering a cursor (the current build reads a little like agar.io-with-guns).
- **Buildcraft = flight, not generic survivors.** Retire the shared orbit/bolt/nova trio.
  Starblight's drafts are **pilot** systems: run-start hull **bodies**, weapon **families**,
  shields, escort **wingmen**, called-down **orbital strikes**, flares/chaff, ramming — combos
  that only a ship can express. This is what keeps the survivors loop from feeling repetitive
  across the roster (the loop is shared DNA; the **verbs** must differ per title).
- **Threat = bullet-heaven.** Shmup-style boss/elite patterns you thread on the wing.

**Sequencing (locked):** the **visual/design style is locked first**, then mechanics. Mechanics
work is gated behind the style lock — see the `M0 — Design & Style Lock` milestone on board #7
and the [[DESIGN]] system. The camera/perspective (keep top-down vs. tilt toward a 3D pilot
view) is resolved as part of that style lock, not improvised in code.

## Canon Role

The orbital front. [[Deadlane]] holds the ground lanes; [[Scourge-Survivors]] descends into
breaches; Starblight intercepts the infection before it reaches the ground.

## Factions

Both [[The-Pyre]] and [[The-Wardens]] can appear here:

- Pyre pilots burn breach matter aggressively before impact.
- Warden pilots defend orbital infrastructure and shield the lanes below.

## Enemy Shape

The Scourge in orbit should look like parasite conquest wearing space debris:
toxic-green breach organs, chitin over rusted hulls, raw tissue in broken engines, living
spore mines, and carrier-bosses grown around breach hearts.

## First Sprite Roster
- Human pilot identities: [[Pyre-Interceptor-Pilot]], [[Warden-Defense-Pilot]].
- Scourge craft: [[Scourge-Fighter]], [[Orbital-Breach-Carrier]].

## Status

Playable prototype (top-down mouse-flight survivors, live on Vercel). Next: lock the visual
style (M0), then execute the momentum-flight pilot pivot above. A clean, vibe-codeable arcade
pillar that expands the war beyond the surface without locking the main world to Earth.
