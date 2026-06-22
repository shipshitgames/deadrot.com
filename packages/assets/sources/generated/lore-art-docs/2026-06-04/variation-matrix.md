---
status: draft
type: art-direction
---
# Variation Matrix

Use this to plan generation batches. A useful batch changes one or two axes at a
time; otherwise it becomes impossible to know why a design worked.

## Batch Naming

Format:

`[faction]-[role]-[view]-v##-[variation]`

Examples:

- `pyre-ranger-front-v01-tactical`
- `pyre-ranger-front-v02-zealot`
- `scourge-ripper-side-v03-wet-chitin`

## Selection Criteria

Keep a variant only if it clears these checks:

- Role readability: the class/enemy behavior is obvious without reading a label.
- Faction readability: Pyre, Warden, or Scourge is obvious from silhouette and material.
- Game readability: works at FPS billboard distance and, where relevant, tower-defense zoom.
- Sprite usability: feet visible, clean outline, no background, no shadow, no text.
- Lore fit: supports the Pact and faction doctrines; does not turn Pyre/Warden rivalry into open war.
- Scourge parasite read: Scourge forms visibly wear, consume, or rewrite a host/medium.
- Scourge host-family read: variants show different conquered hosts while preserving one parasite grammar.

## Faction Axes

| Axis | Pyre | Wardens | Scourge |
| --- | --- | --- | --- |
| Shape | triangular, aggressive, vented | square, reinforced, modular | asymmetrical, predatory, grown |
| Material | scorched gunmetal, bone ceramic, heat cracks | worn steel, tool plates, shield nodes | chitin, raw tissue, fused scrap |
| Light | hellfire orange, blood-hot red, furnace visor | ember shield hardware, hazard amber | toxic-green breach core, sick bio-light |
| Surface | soot, burns, ash, blood spray | scratches, repairs, grease, stencils | wet gore, slime, exposed sinew |
| Pose | forward, ready to descend | planted, holding ground | lunging, warped, unstable |
| Host read | human wearer remains clear | human engineer remains clear | host/medium is being consumed |

## Human Role Axes

| Role | Silhouette | Main Prop | Risk |
| --- | --- | --- | --- |
| Ranger | medium, balanced | rifle | can become generic soldier |
| Bulwark | wide, heavy | cannon/shotgun | can become Warden if too defensive |
| Vector | slim, fast | SMG/sensors | can become too sleek/clean |
| Patch | medium-light support | cauterizer/med rig | can become clean medic |
| Field Engineer | compact utility | tower controller/tools | can become non-combat NPC |
| Lane Gunner | broad planted | heavy weapon/ammo feed | can overlap Bulwark |
| Wallwright | square heavy | shield emitter/barricade | can look like fantasy paladin |

## Scourge Axes

| Threat | Silhouette | Attack Read | Host / Medium Read | Detail Budget |
| --- | --- | --- | --- | --- |
| Ripper | hunched, claw-forward | melee claws | ruined host body split by parasite growth | low; swarm-readable |
| Spitter | thin, ranged organ visible | throat/chest/arm cannon | hollowed host torso converted into weapon organ | medium |
| Elite | larger, asymmetrical | special mutation | armor, machinery, fungus, or bone being overwritten | medium-high |
| Breach-boss | massive core body | chest core, shield organ, vents | breach anatomy using metal and flesh as a shell | high |

## Scourge Host-Family Axes

| Host Family | Silhouette | Material | Best Use | Risk |
| --- | --- | --- | --- | --- |
| Rot-infested flesh | humanoid/animal host split open | raw tissue, bone, ruined armor | default swarm | can become zombie if no chitin/core |
| Chitin warhost | carapace, mandibles, blade limbs | black shell, hooks, claws | melee variants, elites | can become generic bug |
| Mycelial spore | bulb sacs, vents, root limbs | fungal fiber, wet sacs | spitters, mines, area denial | can become fantasy mushroom |
| Machine-graft | hard machine frame, weapon limbs | rusted metal, cables, parasite tissue | ranged/siege units | can become clean robot |
| Bone titan | huge horn/rib/plate frame | bone, cartilage, heavy tissue | bosses, minibosses | can become dinosaur/dragon |
| Voidship | ship/craft silhouette | hull plates, engines, cables | Starblight enemies | can become clean sci-fi ship |

## Recommended First Batches

### Pyre Player Batch

Generate front-view variants first, then side/back only after a direction is picked.

- V01 Tactical: minimal cloth, stronger military silhouette.
- V02 Zealot: ash cloth, abstract Pyre marks, more ritual-industrial.
- V03 Perdition: scarred plates, breach burns, field repairs.

Roles:

- [[Ranger]]
- [[Bulwark]]
- [[Vector]]
- [[Patch]]

### Scourge Batch

Start with enemy behavior readability, then vary host family.

- Ripper V01: rot-infested flesh host, black chitin and claws.
- Ripper V02: chitin warhost, carapace and blade limbs.
- Spitter V01: mycelial spore host, chest sac projectile read.
- Spitter V02: machine-graft host, arm-lance projectile read.
- Breach-Boss V01: bone titan host, toxic-green chest core and shield-organ ring.
- Breach-Boss V02: machine-graft battlefield host, fused metal and projectile vents.
- Host-read check: every keeper must show parasite takeover, not only monster anatomy.

### Warden Batch

Do after Pyre so the human factions separate cleanly.

- [[Field-Engineer]] V01: tool-controller read.
- [[Lane-Gunner]] V01: attrition firepower read.
- [[Wallwright]] V01: shield/barricade read.

### Pactfall Batch

Do last. It should remix Pyre and Warden silhouettes into more heroic arena forms,
not invent a disconnected art style.

### Starblight Batch

Generate clean arcade-readable silhouettes before adding detail.

- Pyre Interceptor V01: fast triangular craft / pilot identity.
- Warden Defense Craft V01: sturdier shield-oriented craft / pilot identity.
- [[Scourge-Fighter]] V01: infected small craft, toxic core readable.
- [[Orbital-Breach-Carrier]] V01: boss shape with breach heart and spore vents.
