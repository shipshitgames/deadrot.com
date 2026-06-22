---
status: superseded
superseded_by: Universe/Style-Bible.md
type: art-direction
feeds: historical-reference
supersededBy: Universe/Style-Bible.md
---
# Character Sprite Direction

> **SUPERSEDED** — see [[Style-Bible]] §2 for the locked pixel-art medium (the ~110px pixel grid is the production size, **not** the 640–704px cutout figures below) and §13 for the current prompt skeletons. Kept for history; the faction/host-family language here is folded into the Style-Bible.

This is the shared visual direction for character sprites across Ship Shit Games.
It turns the current lore into practical generation rules before final assets are
made for any one title.

## Read First

- [[Premise]]: Pyre offense, Warden defense, Scourge as the true enemy.
- [[Style-Bible]] and [[DESIGN]]: DOOM-like metal, blood, rust, bone, hellfire,
  toxic Scourge glow, heavy shadows, no neon.
- [[Scourge-Survivors]]: first-person horde-survivors shooter, Pyre Purgers in breaches.
- [[Deadlane]]: 3D tower defense, Wardens holding lanes with towers and walls.
- [[Pactfall]]: sanctioned Pyre vs Warden arenas, with the Scourge as a neutral threat.
- [[Starblight]]: orbital pilot war against Scourge spores and infected ships.
- [[Scourge]]: swarm, elites, breach-bosses.
- [[Scourge-Host-Families]]: default parasite grammar + conquered-world host variety.

## Production Target

Character sprites are full-body 2D billboard cutouts for 3D games.

- Use separate front, side, and back views.
- Keep feet anchored to one baseline; no cropped boots.
- Use a centered, readable, orthographic-ish pose.
- Use transparent final PNG/WebP cutouts; default to HERO/VOID + rembg before pixel-grid downscale.
- Avoid text, logos with readable words, UI frames, background scenes, cast shadows, and floor planes.
- Preserve strong silhouettes so units remain readable at FPS distance and tower-defense zoom.

For the locked pixel pipeline:

- Rank-and-file sprites target roughly 110 px tall after post.
- Boss sprites target roughly 180 px tall after post.
- Source renders may be larger, but production assets should preserve the locked pixel grid.
- Side views can be mirrored in code, so one side view is enough unless a future game needs asymmetric animation.

## Global Look

The world should feel like a ruined industrial war machine lit by fire, blood,
and toxic Scourge growth.

- Base materials: blackened gunmetal, scorched ceramic, oily rubber, battered alloy.
- Shared light language: blood red, hellfire orange, warning amber, bone-white heat, and sparse toxic green for the Scourge only.
- Surface treatment: chipped plates, soot, dried blood, wet gore on Scourge, scraped edges.
- Readability: high contrast panels and emissive marks should clarify class and faction.
- Avoid: neon/cyberpunk glow, clean generic white sci-fi armor, smooth superhero suits, fantasy robes as the default, soft toy proportions, cute monster faces.

## Faction Language

### The Pyre

Doctrine: offense, burn the source, descend into breaches.

Visual rules:

- Aggressive forward-leaning armor, heat vents, furnace visors, scorched plating.
- Ember orange and blood-hot red are the faction read; diagnostics should stay dim, utilitarian, and non-neon.
- Shapes trend triangular, blade-like, flame-split, and ritual-industrial.
- Cloth or tabards can appear as a "zealot" variant, but should not become mandatory.
- Gear should imply suicide-run utility: sealed helmets, air filters, ammo rigs, cauterizer tanks, breach burns.

Variation lanes:

- Tactical Pyre: cleaner military operator, minimal ritual cloth.
- Zealot Pyre: more sigils, ash cloth, bone-white plates, burn marks.
- Perdition Pyre: late-game scarred armor, breach corruption, emergency repairs.

### The Wardens

Doctrine: defense, hold the line, engineer survival.

Visual rules:

- Practical engineers and gunners, slab armor, tower-control rigs, repair harnesses.
- Colors favor deep steel, gunmetal, industrial yellow markings, bone/off-white stencils, and ember-lit shield hardware.
- Shapes trend square, hexagonal, buttressed, reinforced, and modular.
- Gear should imply building and attrition: tool arms, power packs, welders, rangefinders, deployable wall anchors.
- Wardens should look less fanatical than Pyre and more like people who keep broken infrastructure alive.

Variation lanes:

- Field Engineer: compact tool rig, tower controller, light armor.
- Lane Gunner: heavier armor, stabilized weapon platform, ammo feed.
- Wallwright: shield emitter, barricade anchors, reinforced silhouette.

### The Scourge

Doctrine: parasitic conquest; spreading intelligence, swarm, mutation, host takeover.

Canon nature:

- Bio-industrial parasite: wet flesh, chitin, exposed nerve-light, scavenged metal fused into growth.
- The Scourge has conquered multiple worlds. Its army can include many host races, but
  all of them must share the same parasite grammar.
- Every Scourge design must imply a host or medium being consumed: flesh, armor, machinery,
  ship hull, fungal colony, breach anatomy, or battlefield wreckage.
- Visible infestation anchors: invasive tendrils, ruptured host surfaces, embedded parasite
  cores, chitin plates growing over stolen bone/metal, and organs repurposed as weapons.
- Breach energy reads as toxic green and sick hellfire at the core; never magenta/cyan neon.
- Silhouettes must feel non-human even when roughly bipedal.
- Swarm units should be simple and readable; elites can add asymmetry, weapon growths, and armor mutations.
- Bosses should feel like breach anatomy made into a war body, not just a larger soldier.
- Avoid generic demons/aliens with no host-corruption read.

Variation lanes:

- Swarm Ripper: fast melee fodder, claws, forward hunched posture.
- Swarm Spitter: ranged unit, distended chest/throat cannon or arm-lance.
- Breach-Boss: heavy core, horn/mandible structure, shieldable chest organ, ranged barrage anatomy.

Host-family lanes:

- Rot-infested flesh host: default humanoid/animal body split by parasite growth.
- Chitin warhost: conquered shell-world race; carapace, mandibles, blade limbs.
- Mycelial spore host: fungal colony body; sacs, vents, root tendrils.
- Machine-graft host: hijacked machines, weapons, drones, or vehicles.
- Bone titan host: huge alien megafauna/warrior frame rebuilt with parasite tissue.
- Voidship host: infected craft, wreckage, orbital bodies, hull plates, cables, engines.

## Game-Specific Direction

### Scourge Survivors

Primary camera: first-person. Other players and enemies are billboard sprites.

- Pyre player avatars must read instantly by role: Ranger, Bulwark, Vector, Patch.
- Scourge enemies need high-contrast heads, attack limbs, weak-point readability, and clear parasite anatomy.
- Bosses can be more detailed, but the chest/head core must be obvious during movement.

### Deadlane

Primary camera: 3D tower-defense, zoomed out.

- Warden units and tower crews need stronger silhouette blocks than FPS avatars.
- Scourge swarm sprites should still work at small scale; parasite anchors must be bold enough to survive zoom.
- Human support units should read as engineers, not front-line knights.

### Pactfall

Primary camera: MOBA/lane PvP concept.

- Pyre and Wardens need arena-readable team silhouettes without making them true enemies in canon.
- Designs can be more heroic and exaggerated than the PvE games.
- Scourge neutral units should visually interrupt both human palettes with toxic-green breach corruption, host takeover, and wet bio-gore.

## Current Canon Roster

From `scourge-survivors` and current lore:

- Pyre / Scourge Survivors: [[Ranger]], [[Bulwark]], [[Vector]], [[Patch]].
- Scourge shared enemies: [[Swarm-Ripper]], [[Swarm-Spitter]], [[Breach-Boss]].
- Scourge host families: [[Scourge-Host-Families]].
- Warden / Deadlane concepts: [[Field-Engineer]], [[Lane-Gunner]], [[Wallwright]].
- Pactfall concepts: [[Pyre-Duelist]], [[Pyre-Cauterizer]], [[Warden-Bastion]], [[Warden-Artillerist]], [[Trucebreaker]].
- Starblight concepts: [[Pyre-Interceptor-Pilot]], [[Warden-Defense-Pilot]], [[Scourge-Fighter]], [[Orbital-Breach-Carrier]].

The Warden, Pactfall, and Starblight roles are prompt-ready placeholders, not locked character canon.
