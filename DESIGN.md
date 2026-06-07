---
version: "0.1.0"
name: "DEADROT"
description: >-
  Player-facing visual identity for deadrot.com and the DEADROT game universe:
  blood-soaked dark fantasy sci-fi, hard industrial UI, Scourge infestation, and
  medium-chunky DOOM-grade pixel art.
colors:
  primary: "#c1121f"
  onPrimary: "#f4efe6"
  secondary: "#ff6a00"
  onSecondary: "#0a0a0a"
  tertiary: "#8bdc1f"
  neutral: "#0a0a0a"
  void: "#0a0a0a"
  coal: "#121214"
  iron: "#1e1e22"
  gunmetal: "#34343c"
  blood: "#c1121f"
  bloodHot: "#ff2a18"
  hellfire: "#ff6a00"
  rust: "#a35a33"
  bone: "#e9e3d6"
  ash: "#9b958a"
  toxic: "#8bdc1f"
typography:
  display:
    fontFamily: "Oswald, 'Arial Narrow', 'Helvetica Neue', sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "Oswald, 'Arial Narrow', 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0em"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
elevation:
  flat: "none"
  ember: "0 0 0 1px rgba(255,106,0,0.35), 0 0 26px -6px rgba(193,18,31,0.65)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.onSecondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  status-scourge:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  game-card:
    backgroundColor: "{colors.coal}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "24px"
  panel-raised:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "16px"
  panel-metal:
    backgroundColor: "{colors.gunmetal}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "16px"
  hud-panel:
    backgroundColor: "{colors.void}"
    textColor: "{colors.bone}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "12px"
  body-copy:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ash}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0px"
  badge-blood:
    backgroundColor: "{colors.blood}"
    textColor: "{colors.bone}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-hot:
    backgroundColor: "{colors.bloodHot}"
    textColor: "{colors.neutral}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-hellfire:
    backgroundColor: "{colors.hellfire}"
    textColor: "{colors.onSecondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-rust:
    backgroundColor: "{colors.rust}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-toxic:
    backgroundColor: "{colors.toxic}"
    textColor: "{colors.neutral}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
pixelArt:
  medium: "high-detail medium-chunky pixel art"
  gridHeight: "110px for rank-and-file sprites; larger bosses may go higher"
  rendering: "visible square pixels, hard crisp edges, no anti-aliasing"
  shading: "ordered dithering, subtle dark outline, hellfire-to-blood rim light"
  palette: "void, coal, gunmetal, blood, rust, bone, hellfire; toxic only for Scourge breach cores"
  references: "Blasphemous, Dead Cells, remastered 1990s DOOM sprites"
gameArtDirection:
  shared:
    medium: "medium-chunky high-detail pixel art"
    renderRules: "nearest-neighbor scaling, lossless hard edges, ordered dithering, no anti-aliasing"
    paletteRules: "void/coal/gunmetal bodies, blood/rust grime, bone highlights, hellfire rim light"
    enemyRules: "silhouette first; parasites must visibly infest or rewrite a host"
  scourge-survivors:
    title: "Scourge Survivors"
    camera: "first-person billboard sprites, front-facing full-body enemies and pickups"
    assetFraming: "enemy silhouettes readable at FPS combat distance; weapons and pickups centered and iconic"
    paletteBias: "blood and hellfire for combat feedback; toxic only for breach cores and Scourge weak points"
  deadlane:
    title: "Deadlane"
    camera: "top-down / high-angle lane-defense sprites"
    assetFraming: "units, towers, lanes, and projectiles readable from above"
    paletteBias: "gunmetal lane structures, blood pressure, hellfire tower heat"
  pactfall:
    title: "Pactfall"
    camera: "isometric 3/4-view champion sprites"
    assetFraming: "MOBA-scale heroes with readable ability silhouettes and faction crests"
    paletteBias: "faction identity first, then blood/hellfire combat states"
  starblight:
    title: "Starblight"
    camera: "side-on / top-down arcade space-shooter sprites"
    assetFraming: "ships, projectiles, and orbital threats readable at speed against void"
    paletteBias: "void and bone for space contrast, hellfire engines, toxic breach matter"
  redline:
    title: "Redline"
    camera: "side-on courier-runner sprites"
    assetFraming: "profile silhouettes readable at high lane speed"
    paletteBias: "blood-hot speed marks, rust infrastructure, hellfire exhaust"
  rothulk:
    title: "Rothulk"
    camera: "side-on platformer sprites"
    assetFraming: "chunky traversal poses, clear hazards, readable Scourge bio-ship parts"
    paletteBias: "coal/iron interiors, bone highlights, toxic infestation nodes"
  warline:
    title: "Warline"
    camera: "map-first SVG/strategy interface with compact faction icons"
    assetFraming: "regions, lanes, breaches, pressure, and faction control visible at a glance"
    paletteBias: "Wardens=blood, Pyre=hellfire, Scourge=toxic, neutral=gunmetal"
references:
  assetgenDesign: "apps/lore/content/DESIGN.md"
  styleBible: "apps/lore/content/Universe/Style-Bible.md"
---

## Overview

DEADROT is the player-facing game universe: ruined skies, burning resistance,
Scourge infestation, Pyre fire, Warden metal, and playable browser games. The
interface should feel like blood on gunmetal: brutal, readable, high contrast,
and built for play rather than brand polish.

This top-level file is the quick agent-readable design contract for deadrot.com.
The longer asset-generation contract lives in `apps/lore/content/DESIGN.md`,
which carries the locked pixel-art prompt suffix, negative prompt set, per-game
framing, and sprite post-processing rules.

### Pixel Art Style

Use high-detail medium-chunky pixel art for game sprites, portraits, item icons,
enemy silhouettes, and key art crops. The sprite should read at gameplay scale:
visible square pixels, strong silhouette first, hard non-antialiased edges,
ordered dithered shading, subtle dark outline, and a single low hellfire rim
light running into blood-hot red. It should look like premium modern pixel art
crossed with remastered 1990s DOOM, not a smooth render pretending to be retro.

Scourge assets must read as parasitic infestation: ruptured host flesh, invasive
tendrils, toxic-green breach cores, black chitin over stolen bone or metal, and
fused wreckage or machinery. Toxic-green belongs to Scourge biology and breach
energy; do not use it as a generic CTA or decoration.

### Game Art Direction

Define all game-specific art direction in the `gameArtDirection` front matter.
The `shared` key is the house style; each game slug defines camera, asset
framing, palette bias, and the readability rule for that game. Generation tools
should apply `shared` first, then layer the matching game slug on top.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `primary` / `blood` | `#c1121f` | danger, damage, CTAs, faction violence |
| `secondary` / `hellfire` | `#ff6a00` | Pyre fire, active highlights, ember focus |
| `tertiary` / `toxic` | `#8bdc1f` | Scourge cores, breach energy, infestation only |
| `void` | `#0a0a0a` | page and scene background |
| `coal` | `#121214` | panels, cards, dark UI plates |
| `iron` | `#1e1e22` | raised surfaces and HUD backing |
| `gunmetal` | `#34343c` | borders, dividers, industrial chrome |
| `rust` | `#a35a33` | grime, weathering, old metal |
| `bone` | `#e9e3d6` | headings, strong labels, readable foreground |
| `ash` | `#9b958a` | body copy, captions, secondary metadata |

Rule: red, fire, metal, bone. The palette should feel hot and violent, not neon.

## Typography

- **Display:** Oswald 700, uppercase. Use for game titles, faction labels,
  section headers, HUD labels, and button labels.
- **Body:** Inter 400/500/600. Use for lore summaries, marketing copy, forms,
  cards, and readable player-facing UI.
- **Mono:** system monospace. Use for HUD counters, ammo, wave timers, map
  coordinates, seed/build IDs, and telemetry-style readouts.

## Layout

- deadrot.com should lead with game-world imagery, playable proof, faction
  surfaces, and strong first-viewport identity.
- In-game HUDs hug the screen edges, stay compact, and use hard industrial
  framing. Numerics and counters belong in mono.
- Game cards and lore modules should be dark, bordered, and scannable. Use
  stable frames for pixel art so images do not resize the layout.

## Elevation & Depth

Avoid soft neon glow. Depth comes from hard value contrast, metal borders,
inset shadows, grain, vignette, particles, and ember light. Use `ember` for
hot/active elements such as Play, selected game cards, breach warnings, and
combat-state feedback.

## Shapes

Use near-square industrial geometry. `rounded.sm` is the default for website
controls; `rounded.none` is correct for HUD panels, sprite frames, map chrome,
and game overlays. Avoid pill buttons, plush cards, and clean glassmorphism.

## Components

- **button-primary:** blood background, bone text, uppercase Oswald, hard 2px radius.
- **button-secondary:** coal background, hellfire text, hard 2px radius.
- **game-card:** coal surface, bone title, ash body, gunmetal border, pixelated art.
- **hud-panel:** void or iron plate, mono readouts, hard edges, no rounded softness.
- **faction-badge:** blood for Wardens, hellfire for Pyre, toxic only for Scourge.

## Do's and Don'ts

**Do:** make it brutal and readable; use Oswald + Inter; preserve visible pixel
grids; reserve toxic-green for Scourge; keep UI edges hard; let blood, hellfire,
gunmetal, and bone carry the identity.

**Don't:** use neon cyan/magenta, pastel palettes, soft pills, cute sprites,
smooth 3D renders, photorealism, clean minimal sci-fi, or generic demons that
do not show Scourge parasite grammar.
