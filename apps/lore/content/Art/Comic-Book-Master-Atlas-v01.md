---
status: locked-direction
type: art-master-atlas
medium: comic-book
date: 2026-06-17
---
# Comic Book Master Atlas v01

**At a glance:** locked comic-book direction layer - covers the missing lore illustration families with shared boards - supersedes pixel art as the target style while existing pixel runtime remains temporary scaffolding.

This is the first repo-attached comic-book pass for lore review: clean ink, bold outlines, readable silhouettes, controlled flat shadows, no halftone dots, no stipple, no noisy speckle lighting. Treat it as the active visual target for the "playable comic page" direction before it becomes per-game runtime production.

## Ground Rules

- Use the comic boards as **master references**, not automatic runtime sprites.
- Pixel art is now temporary scaffolding only. New masters target clean comic/cel ink.
- Keep Scourge parasite grammar visible: host body being worn and consumed, rupture seams, tendrils, black chitin over stolen bone/metal, toxic-green cores only as parasite organs.
- Keep humans readable by faction: Pyre = aggressive scorched breach kit; Wardens = square planted engineering armor.
- Avoid the rejected dotted/stippled look. No halftone dots, no bokeh speckles, no noisy particle glitter pretending to be detail.
- Runtime promotion still needs per-game camera sheets, alpha/cutout cleanup, WebP encoding, manifest entries, and in-game scale validation.

## 10/10 Comic Pass Criteria

- Every foe, hero, weapon, pickup, arena, and UI state has a master sheet before runtime promotion.
- Character and foe masters include front, true side, back, an action pose, scale reference, silhouette read, and color accents.
- FPS weapon masters show the player hands and forearms correctly gripping the weapon, with barrels pointing away from the player.
- Runtime sprites are generated from deliberate transparent/cutout sheets, never cropped from wallpapers or broad illustrations.
- Animation sheets include idle/move, attack/fire, hit, death, and special beats when the unit has a special role.
- UI uses comic-panel geometry, speech-bubble/caption-card shapes, chunky hand-lettered display type, and onomatopoeia for combat feedback.
- Scourge designs visibly show parasite takeover. If the host is not being worn or consumed, it is not Scourge yet.

## Production Prompt Locks

### FPS Enemy Runtime Sheet

```text
DEADROT production-ready FPS enemy sprite sheet, NOT concept art, NOT a wallpaper, NOT a crowded lineup.
One single enemy only: {enemy name and role}. Clean comic-book cel-shaded ink style, bold black outline,
flat readable shadows, no pixel art. STRICT 3 CELL TURNAROUND: left cell FRONT VIEW, middle cell TRUE SIDE
PROFILE, right cell BACK VIEW. Each cell contains the exact same creature design at the same scale. Full body
visible, feet on one shared baseline, no cropped limbs, no overlapping cells, very large empty gutters between
cells, centered inside each cell, transparent-cutout friendly flat solid magenta background. No labels, no text,
no cast shadow, no floor, no scenery, no extra creatures, no perspective grid, no halftone dots, no stipple,
no dotted lights, no noisy speckles, no blur, no painterly texture. This must be easy to crop into three
rectangular sprites.
```

### FPS Weapon Runtime Sheet

```text
DEADROT production-ready FPS weapon sprite sheet, NOT concept art, NOT a wallpaper, NOT a crowded lineup.
One single weapon only: {weapon name} first-person viewmodel. Clean comic-book cel-shaded ink style, bold black
outline, flat readable shadows, no pixel art. Show exactly ONE weapon held by TWO visible armored player hands
and forearms. Default hipfire view uses a modern off-center 3/4 side/top viewmodel: the receiver and hands sit in
the lower-right or lower-center screen area, the player sees enough of the side/top silhouette to identify the
weapon, and the barrel line converges toward the screen-center crosshair as it points away into the game world.
Avoid the old centered Doom slab pose except for ADS, inspection, or a deliberate super-shotgun hero moment.
Camera geometry lock: the player is behind the weapon, looking over the receiver/top side. Never show big black
muzzle/barrel holes facing the viewer/player. The muzzle is the far end, not the near end; it may be a small
distant cap or mostly hidden by perspective. Never use a pure side-profile or product-render angle. Hands grip
correctly: right hand on trigger grip, left hand under the barrel/fore-end or support point. Full weapon visible with generous
padding on all sides, no cropped barrel, no cropped hands, no overlapping duplicates,
transparent-cutout friendly flat solid magenta background. No labels, no text, no scenery, no extra weapons,
no cast shadow, no floor, no halftone dots, no stipple, no dotted lights, no noisy speckles, no blur. Easy to
cut as one rectangular FPS weapon sprite.
```

### Rejection Rule

If an output is a cool lineup, wallpaper, or overlapping reference board, it is not a runtime sprite. If it is too
crowded to cut without manual repainting, reject it and reprompt as a single-asset production sheet.

### UI Card Rule

Cards should read like comic speech bubbles, caption boxes, or torn ink panels: thick black contour border,
slightly irregular corner radii, hard offset ink shadow, optional speech-tail/notch, and high-contrast lettering.
Avoid generic rounded SaaS rectangles unless the element is purely invisible layout scaffolding.

## Master Boards

### Scourge Bestiary

![Scourge comic master lineup](/assets/sources/generated/2026-06-17/lore/comic-v01/scourge-master-lineup-comic-v01.png)

- Master custody: `packages/assets/masters/art/lore-comic-v01/scourge-master-lineup-comic-v01.png`
- Published source: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/scourge-master-lineup-comic-v01.png`
- Coverage: [[Swarm-Ripper]], [[Swarm-Spitter]], [[Wound-Hound]], [[Breach-Boss]], plus parasite material grammar for [[Render]], [[Sower]], [[Rot-Engine]], [[Graft-Breacher]], [[Cairn]], and [[Trucebreaker]].
- Note: Wound-Hound was cropped from this board for the first Scourge Survivors fast-animal runtime cut.

### Human Characters

![Human comic master lineup](/assets/sources/generated/2026-06-17/lore/comic-v01/human-master-lineup-comic-v01.png)

- Master custody: `packages/assets/masters/art/lore-comic-v01/human-master-lineup-comic-v01.png`
- Published source: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/human-master-lineup-comic-v01.png`
- Coverage: [[Bulwark]], [[Ranger]], [[Patch]], [[Vector]], [[Pyre-Cauterizer]], [[Pyre-Saboteur]], [[Pyre-Duelist]], [[Warden-Bastion]], [[Lane-Gunner]], [[Field-Engineer]], [[Wallwright]], and [[Warden-Artillerist]].

### UI / Codex Page

![Comic codex/loadout master](/assets/sources/generated/2026-06-17/lore/comic-v01/ui-codex-master-comic-v01.png)

- Master custody: `packages/assets/masters/art/lore-comic-v01/ui-codex-master-comic-v01.png`
- Published source: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/ui-codex-master-comic-v01.png`
- Coverage: loadout, codex, enemy dossier pages, weapon cards, stat rows, and menu typography direction.

### Pause Screen

![Comic pause master](/assets/sources/generated/2026-06-17/lore/comic-v01/ui-pause-master-comic-v01.png)

- Master custody: `packages/assets/masters/art/lore-comic-v01/ui-pause-master-comic-v01.png`
- Published source: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/ui-pause-master-comic-v01.png`
- Coverage: pause overlay, comic-page menu panels, high-contrast selected row, readable status chips.

### Combat Wallpaper / Arena Mood

![Comic combat wallpaper master](/assets/sources/generated/2026-06-17/lore/comic-v01/combat-wallpaper-master-comic-v01.png)

- Master custody: `packages/assets/masters/art/lore-comic-v01/combat-wallpaper-master-comic-v01.png`
- Published source: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/combat-wallpaper-master-comic-v01.png`
- Coverage: [[Scourge-Survivors]], [[Deadlane]], [[Pactfall]], breach-standoff wallpaper mood, and shared human-vs-Scourge combat composition.

## Coverage Matrix

| Lore family | v01 coverage | Still needs dedicated production sheets |
| --- | --- | --- |
| Bestiary | Shared Scourge roster board | Per-entry front/side/back, attacks, death states, game camera variants |
| Characters | Shared Pyre/Warden roster board | Per-character turnarounds, weapon silhouettes, avatar cutouts |
| Games / arenas | Combat wallpaper board | Dedicated key art per game and tileable arena texture masters |
| UI / menus | Codex + pause masters | Real DOM implementation and icon set, not screenshot-painted UI |
| Tech / weapons | Codex/loadout panels | Individual prop masters for [[Dead-Air-Beacon]], [[Blackout-Nail]], [[Tuning-Fork]], and Pyre weapons |
