---
type: game-design-doc
game: Pactfall
mode: bloodlane
status: draft
genre: one-lane MOBA
---

# Bloodlane

**At a glance:** [[Pactfall]] v1 design doc · one-lane Pyre-vs-Warden MOBA format · center [[Scourge]] jungle can force a Pact truce · staged in [[Ashgate]]'s arena district and the [[The-Hollow-Lanes|Hollow Lanes]] doctrine frame.

Bloodlane is the first real [[Pactfall]] ruleset, not a separate public title yet. It is the
sanctioned arena where [[The-Pyre]] and [[The-Wardens]] spend the feud that [[The-Pact]]
forbids them from spending in the field. The match is violent, personal, and political, but
it is still bounded by one law: if the [[Scourge]] surge becomes the live threat, the human
argument stops until the local Choir pressure is cut back.

## Problem

Pactfall needs a small v1 target that explains what the prototype is proving. A full MOBA is
too large for the first ship target, and generic hero combat would miss the canon point. The
game has to make the human rivalry playable while preserving the locked truth that Pyre and
Wardens are rivals, not field enemies.

## Goal

Ship a one-lane MOBA slice where two human doctrines fight over tempo, pressure, and pride,
then get interrupted by the same Scourge rule that governs the wider war: isolate the Choir
or be overrun together.

## V1 Format

- **Map:** one central lane with a Pyre base at one end, a Warden base at the other, and a
  contaminated neutral trench in the middle.
- **Teams:** one Pyre champion versus one Warden champion for v1. Bot control is acceptable
  until the PvP contract is proven.
- **Wave:** both bases spawn minions on a steady cadence. Minions carry siege pressure and
  give the lane a moving front.
- **Camera:** isometric 3/4 [[Pactfall]] framing. Champion silhouettes must stay readable at
  MOBA scale.
- **Session length:** short arcade matches, tuned for a decisive win or loss before the
  Scourge pressure loop becomes repetitive.

## Win Condition

Destroy the opposing base seal after pushing the lane across midfield. Champion kills matter
because they buy tempo, not because they end the match. A player wins by converting lane
pressure into base damage while deciding when to spend time on the center Scourge objective.

Loss is symmetrical: your base seal breaks, or you fail to answer a Scourge surge long
enough that the center overruns the lane and hands the match to the side that adapted first.

## Scourge Jungle

The v1 "jungle" is not a sprawling side map. It is a contaminated center trench with enough
space for risk, reward, and interruption.

- **Neutral objective:** [[Trucebreaker]] or a smaller Trucebreaker larva anchors the trench.
- **Pressure meter:** ignored Scourge growth raises Choir pressure. It should be visible,
  legible, and tied to the toxic-green breach core language from [[CANON]] and
  [[Style-Bible]].
- **Reward:** clearing the center grants a temporary push buff, draft choice, or lane-control
  advantage.
- **Cost:** fighting the center exposes a champion to the opposing side and pulls attention
  away from the lane.
- **Canon read:** the center is dangerous because the Choir is locally reconnecting through a
  physical node, not because a neutral monster "chooses" a side.

## Forced-Truce Loop

The forced truce is the mechanic that makes the [[The-Pact|Pact]] playable.

1. Both teams fight normally while Choir pressure is low.
2. Ignored center growth triggers a Pact alarm: the Scourge surge starts damaging or
   disabling both lane fronts.
3. During the surge, direct Pyre-vs-Warden aggression should become inefficient or temporarily
   constrained, while damage to the Scourge objective becomes the best action for both sides.
4. The team that pivots cleanly earns the post-surge advantage: a faster wave, a temporary
   damage buff, a shielded minion, or a draft pick.
5. Once the surge is cut back, the feud resumes immediately.

This is not peace. It is a temporary breach override under arena rules.

## Champion Read

The first roster should stay small and faction-legible:

- [[Pyre-Duelist]] - forward-leaning kill pressure and breach-burn aggression.
- [[Pyre-Cauterizer]] - area denial, flame control, and risky source-burn tools.
- [[Warden-Bastion]] - planted mitigation, shields, and front-line stabilization.
- [[Warden-Artillerist]] - ranged siege pressure and lane-control punishment.

V1 can ship with one Pyre champion and one Warden champion if their silhouettes and roles are
clear enough to teach the matchup.

## Match Loop

1. Choose a champion or use the default Pyre-vs-Warden matchup.
2. Push the lane with minions and basic champion pressure.
3. Watch the center Scourge pressure rise.
4. Decide whether to contest the enemy, clear the center, or trade base damage.
5. Survive a forced-truce surge if the center is ignored.
6. Convert the post-surge or post-kill tempo into base seal damage.
7. Win, lose, and restart fast.

## Deferred

- Three-lane map, full jungle routes, wards, fog of war, and deep macro rotations.
- Server-authoritative multiplayer, matchmaking, ranked, spectators, and reconnect flow.
- Full item shop, large hero roster, bans, talent trees, and esports tuning.
- Permanent canon consequences for arena deaths. Pactfall is sanctioned pressure relief, not
  humans breaking the field compact.
- [[War-for-the-Lanes]] map consequences beyond prototype hooks.
- Listener faction play. [[The-Listeners]] can complicate future stories, but v1 stays Pyre,
  Warden, and Scourge.

## Implementation Read

The current prototype already maps to the spine: a Pyre champion, a Warden opponent, minion
waves, a center Scourge blob, and base destruction. Bloodlane's next implementation passes
should make those pieces more explicit:

- rename the center objective in UI/copy when it graduates from blob to Trucebreaker;
- add visible Choir pressure and a surge state;
- make the surge affect both teams;
- keep the primary win condition as base-seal destruction;
- make restart immediate enough for arcade iteration.

## Canon Guardrails

- The Scourge remains host-dependent and survival-driven. It is not a villain choosing sides.
- The Choir is the connection; the center objective must read as a physical repeater or growth
  node that can be cut back.
- Pyre and Wardens can hate each other in the arena, but the Pact cannot break in the field.
- The arena is sanctioned pressure relief around [[Ashgate]], not an open human civil war.
- Faction visuals follow [[Style-Bible]]: Pyre triangular and hellfire-forward, Wardens square
  and planted, Scourge toxic-green only at breach cores.

## See Also

- [[Pactfall]]
- [[The-Pact]]
- [[The-Pyre]]
- [[The-Wardens]]
- [[Scourge]]
- [[Trucebreaker]]
- [[Ashgate]]
- [[The-Hollow-Lanes]]
- [[Survivors-Loop]]
- [[War-for-the-Lanes]]
