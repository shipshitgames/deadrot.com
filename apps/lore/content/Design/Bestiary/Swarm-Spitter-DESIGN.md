---
type: design-lock
status: runtime-derived-master-candidate
subject: Swarm-Spitter
subjectType: creature
canon: Bestiary/Swarm-Spitter
styleBible: Style-Bible
lockedDate:
---
# Swarm Spitter Design Lock

Games adapt from this file; runtime frames do not define the Spitter.

## Canon Links

- Canon page: [[Swarm-Spitter]]
- Style bible: [[Style-Bible]]
- Design tokens: [[DESIGN]]

## Visual Thesis

Thin ranged Scourge pressure unit with an unmistakable toxic-green firing read:
throat sac, chest sac, or fused arm-lance grown through a consumed host.

## Silhouette Lock

- Primary read: hunched ranged creature keeping distance.
- Proportion: thinner and more elastic than [[Swarm-Ripper]].
- Iconic shape signature: swollen bright-green toxic firing sac or
  bio-industrial arm-lance, more visibly green than melee Scourge foes.
- Forbidden shape drift: generic wizard, clean insect, sci-fi gunner, smooth
  tentacle monster without host corruption.

## Material And Color Lock

- Body materials: ochre infected flesh, black chitin, sinew, embedded rust tech.
- Accent materials: sac membrane, bone teeth/claws, ruptured armor scraps.
- Emissive color: strong chartreuse toxic glow in firing organ, throat/chest
  sac, and projectile nodes. This is the ranged-role read; keep it greener than
  [[Swarm-Ripper]].
- Forbidden colors: neon body paint, magenta/cyan, clean tech glow.

## Locked Poses

Status: runtime visual lock attached. Current Scourge Survivors sprites have
the better role read: greener, simpler, and more clearly ranged than the
generated master. Future high-res masters must match this silhouette/color lane
before they replace it.

![Swarm Spitter runtime visual lock](/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-runtime-visual-lock.png)

![Swarm Spitter master turnaround](/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-master-turnaround.png)

![Swarm Spitter runtime placeholder](/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-runtime-placeholder.webp)

- Idle front:
- Idle side:
- Idle back:
- Optional action/read pose: sac swelling or spit launch.

## Art Master Attachments

- Runtime visual lock: `/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-runtime-visual-lock.png`
- Runtime source sprites:
  `packages/assets/games/scourge-survivors/enemies/scourge/spitter-host/{front,side,back}.webp`
- Runtime-derived high-res master candidate: `/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-master-turnaround.png`
- Generated source: `packages/assets/sources/generated/2026-06-12/lore/bestiary/scourge-foes/swarm-spitter-runtime-derived-master-turnaround.png`
- Legacy runtime placeholder: `/assets/lore/art-masters/scourge/swarm-spitter/swarm-spitter-runtime-placeholder.webp`

## Cleanup Notes

- Keep the current game sprite's acid-green role read.
- Reduce the high-res candidate's gold/fantasy polish during cleanup.
- Preserve the cannon-arm silhouette and squat ranged-host posture.
- Do not add melee blade mass.

## Game Adaptations

- Scourge Survivors: ranged FPS billboard with firing organ readable at distance.
- Deadlane: lane pressure unit; projectile source must be clear from above.
- Rothulk: side-platformer hazard; sac/lance silhouette must telegraph attack.

## Validation Checklist

- [x] Runtime front/side/back visual lock attached.
- [x] Firing organ readable in silhouette.
- [x] Source poses archived in `packages/assets/sources/generated`.
- [x] High-res master regenerated from runtime visual lock.
- [ ] High-res master cleaned to match runtime palette and silhouette.
- [ ] Runtime animation frames regenerated from approved pose lock.
- [ ] No matte residue, stray pixels, or cropped limbs.
