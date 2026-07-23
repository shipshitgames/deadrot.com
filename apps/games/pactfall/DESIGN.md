---
version: "0.1.0"
name: "Pactfall"
description: >-
  Game-local application of Deadrot's comic-ink visual contract to the
  isometric lane-MOBA slice.
colors:
  primary: "#c1121f"
  void: "#0a0a0a"
  coal: "#121214"
  iron: "#1e1e22"
  gunmetal: "#34343c"
  blood: "#c1121f"
  bloodHot: "#ff2a18"
  hellfire: "#ff6a00"
  rust: "#8a4b2a"
  bone: "#e9e3d6"
  ash: "#9b958a"
  toxic: "#8bdc1f"
  hazardYellow: "#d6a21f"
factions:
  pyre:
    shape: "triangular, blade-like, forward-leaning"
    materials: "scorched gunmetal, bone ceramic, hellfire heat seams"
    light: "hellfire and blood-hot furnace glow"
  warden:
    shape: "square, buttressed, planted"
    materials: "worn steel, gunmetal slabs, bone stencils"
    light: "ember hardware and sparse hazard-yellow markings"
  scourge:
    shape: "asymmetric host-corruption with an exposed parasite core"
    materials: "ruptured host matter, black chitin, stolen bone and metal"
    light: "toxic-green breach organs; never human equipment"
gameArtDirection:
  medium: "clean comic-book / cel-shaded ink"
  camera: "isometric three-quarter champion scale, looking along the active lane"
  composition: "one readable mid-lane combat ribbon with dormant top and bot corridors preserved"
  hierarchy: "base > tower > champion > minion; neutral Scourge objective interrupts the lane center"
  paletteBias: "Pyre heat, Warden steel, and toxic only for Scourge contamination"
  parasiteRule: "Scourge forms must visibly wear or rewrite a host"
  runtimeBaseline: "Three.js primitives preserve role, scale, palette, and silhouette invariants"
assets:
  runtimeRoot: "packages/assets/games/pactfall"
  champions: "packages/assets/games/pactfall/champions/{faction}/{champion-id}"
  minions: "packages/assets/games/pactfall/minions/{faction}/{role}"
  structures: "packages/assets/games/pactfall/structures/{faction}/{structure}"
  objectives: "packages/assets/games/pactfall/objectives/scourge/{objective-id}"
  interface: "packages/assets/games/pactfall/ui/{surface}"
---

# Pactfall Visual Contract

Pactfall inherits the locked visual language in
`apps/lore/content/DESIGN.md` and
`apps/lore/content/Universe/Style-Bible.md`. This file narrows that shared
contract to the lane-MOBA camera and its combat reads. It does not replace
canon, activate additional lanes, or promise final production art.

## First Viewport

The camera is an **isometric three-quarter view at champion scale**, angled
along the lane so forward pressure is obvious. The first viewport must show a
complete combat sentence without camera movement:

1. the player's champion and nearby friendly minions;
2. the opposing wave or champion farther up-lane;
3. one structure or the neutral objective establishing the next decision; and
4. enough lane edge to read movement bounds without mistaking scenery for a
   second route.

Keep the active mid lane as one strong diagonal ribbon. The data model already
describes dormant top and bot lanes, so compositions and future environment
art must reserve their lateral corridors. Do not imply that those corridors
are playable until their `active` flags and supporting systems ship.

## Battlefield Grammar

The battlefield reads in this order:

| Layer | Visual job | Required read |
| --- | --- | --- |
| Base | Match objective | Largest, heaviest structure; unmistakable lane endpoint |
| Tower | Push gate | Fortified vertical landmark; smaller than a base, larger than a champion |
| Champion | Player agency | Unique crest and role silhouette visible inside a wave |
| Minion | Lane direction | Small, repeatable faction mass moving toward the enemy base |
| Scourge objective | Optional risk | Asymmetric interruption at center, visibly foreign to both human teams |

The shipped slice uses simple Three.js geometry. Those primitives are
**readability scaffolding**, not the final art target. Preserve their tested
role, scale, palette, and silhouette distinctions when production models,
sprites, effects, or environment kits replace them.

## Faction Reads

### Pyre — pressure and sacrifice

- **Shape:** triangles, blade wedges, split-flame crests, forward lean.
- **Material:** scorched gunmetal, heat-baked bone ceramic, cauterizer tanks.
- **Light:** hellfire orange and blood-hot furnace seams.
- **Motion:** charging, descending, committing into the lane.
- **Structures:** aggressive fins and heat vents; never Warden buttresses.

Pyre assets must read as offense before detail is visible. Their heat is
controlled and practical, never a generic neon-orange glow.

### Wardens — mass and endurance

- **Shape:** squares, hexagons, slab armor, braces, planted feet.
- **Material:** repaired steel, gunmetal, bone stencils, weld scars.
- **Light:** ember tool hardware with sparse industrial hazard marks.
- **Motion:** braced, measured, holding ground.
- **Structures:** modular supports and load-bearing silhouettes; never Pyre
  blades or ritual flame shapes.

Wardens are defensive engineers, not paladins or clean sci-fi soldiers. Their
silhouette must remain distinct from the Pyre even when both are reduced to a
single dark shape.

### Scourge — contamination, not a third team

- **Shape:** asymmetric host-corruption, ruptures, tendrils, and one exposed
  parasite core.
- **Material:** host flesh or machinery overwritten by black chitin and stolen
  bone or metal.
- **Light:** `toxic #8bdc1f` in breach organs and cores, used sparingly.
- **Motion:** invasive, lunging, or pulsing; never disciplined human formation.

**Toxic green belongs only to Scourge contamination.** Pyre and Warden units,
structures, equipment, navigation, and ordinary combat feedback must not use
it. A neutral objective without visible host-corruption is only a generic
monster and fails this contract.

## Silhouette Rules

- Keep the scale ladder `base > tower > champion > minion` intact from the
  game camera.
- Give every champion one role-defining shape beyond the faction base grammar.
  Current Pyre crests are triangular; current Warden crests are square.
- Keep minion silhouettes simpler than champions. Production minions should
  exaggerate forward Pyre wedges versus planted Warden blocks without adding
  champion-level detail.
- Structure silhouettes communicate gameplay state before material detail:
  a base is a destination, a tower is a gate, and the Scourge is an optional
  interruption.
- Reserve the busiest asymmetry and visible anatomy for the Scourge. Human
  faction clarity comes from deliberate construction, posture, and equipment.

## Production Asset Contract

Generated sources and masters follow the shared custody rules in
`apps/lore/content/DESIGN.md`. Approved runtime raster ships as WebP beneath
`packages/assets`; generation tooling stays in the sibling studio repository.

Use semantic runtime paths so a primitive can be replaced without changing
gameplay code or inventing a second asset taxonomy:

```text
packages/assets/games/pactfall/
  champions/pyre/<champion-id>/
  champions/warden/<champion-id>/
  minions/pyre/<role>/
  minions/warden/<role>/
  structures/pyre/{tower,base}/
  structures/warden/{tower,base}/
  objectives/scourge/<objective-id>/
  ui/{hud,minimap}/
```

Every promoted asset keeps its manifest/provenance record and the relevant
faction, role, and camera metadata. Do not commit provider caches, temporary
exports, or generator configuration into this game directory.

## Do / Do Not

**Do:** compose one readable lane; preserve future lane corridors; separate
Pyre triangles from Warden blocks; make the Scourge visibly parasitic; keep
objectives and scale hierarchy legible at gameplay zoom; replace primitives
through semantic shared-asset paths.

**Do not:** use pixel art, halftone, stipple, smooth photoreal rendering, cyan
or magenta neon, clean white sci-fi, generic fantasy armor, toxic-green human
equipment, or detailed scenery that obscures the lane.
