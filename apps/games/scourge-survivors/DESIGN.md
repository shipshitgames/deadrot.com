---
version: "0.1.0"
name: "Scourge Survivors"
description: >-
  Game-local visual identity for the DEADROT FPS survivor slice: first-person
  billboard sprites, hard HUD chrome, blood/hellfire combat feedback, and
  Scourge parasite infestation.
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
typography:
  display:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 400
    letterSpacing: "0em"
    textTransform: "uppercase"
  body:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
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
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.hellfire}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  card:
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
  terminal:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ash}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "16px"
  badge-blood:
    backgroundColor: "{colors.blood}"
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-hot:
    backgroundColor: "{colors.bloodHot}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-rust:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-toxic:
    backgroundColor: "{colors.toxic}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
pixelArt:
  medium: "high-detail medium-chunky pixel art"
  gridHeight: "110px for rank-and-file enemies; bosses may go larger"
  rendering: "visible square pixels, hard crisp edges, no anti-aliasing"
  shading: "ordered dithering, subtle dark outline, hellfire-to-blood rim light"
  palette: "void, coal, gunmetal, blood, rust, bone, hellfire; toxic only for Scourge breach cores"
gameArtDirection:
  camera: "first-person billboard sprites, front-facing full-body enemies and pickups"
  assetFraming: "enemy silhouettes readable at FPS combat distance; weapons and pickups centered and iconic"
  paletteBias: "blood and hellfire for combat feedback; toxic only for breach cores and Scourge weak points"
  parasiteRule: "Scourge enemies must look like infestation wearing or rewriting a host"
---

## Overview

The local design override for **Scourge Survivors**, the first-person DEADROT
survivor slice. The shared DEADROT identity still applies: brutal metal, blood,
hellfire, hard HUD edges, and no neon. This file narrows the art direction to
FPS billboard sprites, readable combat silhouettes, and Scourge parasite
infestation.

### Game Art Direction

Use first-person billboard sprites: front-facing full-body enemies, readable at
combat distance, with pickups and weapons centered and iconic. The Scourge must
read as infestation wearing or rewriting a host, not as generic demons or clean
aliens.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `primary` | `#c1121f` | machine-readable primary alias for blood |
| `void` | `#0a0a0a` | page / scene background |
| `coal` | `#121214` | panels, cards |
| `iron` | `#1e1e22` | raised surfaces |
| `gunmetal` | `#34343c` | borders, dividers, metal |
| `blood` | `#c1121f` | **primary** — danger, CTAs, kills |
| `bloodHot` | `#ff2a18` | hot / hover states |
| `hellfire` | `#ff6a00` | secondary — embers, highlights |
| `rust` | `#8a4b2a` | grime, texture, muted accent |
| `bone` | `#e9e3d6` | headings / strong text |
| `ash` | `#9b958a` | body / dim text |
| `toxic` | `#8bdc1f` | **the Scourge only** — sickly bio-glow, sparingly |

Rule: **red + fire + metal + bone.** Toxic-green is reserved for the Scourge. Never neon.

## Typography

- **Display** — SSG Press Start / Press Start 2P 400, UPPERCASE, zero tracking. Pixel title, menu, and HUD labels.
- **Body** — SSG Press Start / Press Start 2P 400. All player-facing UI should stay pixelized.
- **Mono** — SSG Press Start / Press Start 2P 400. Counters, ammo, timers, and HUD numerics.

## Layout

- Centered max-width containers (~`72rem` for marketing); generous vertical rhythm from the
  `spacing` scale. Card grids: 1 col → 2 → 3 at `md`/`lg`.
- In-game: HUD hugs the screen edges; heavy corners; numerics in mono.

## Elevation & Depth

- **No soft neon glow.** Depth comes from value contrast, hard 1–2px borders, and inset
  shadows. The only glow is **ember** (`elevation.ember`) — orange→red — used sparingly on
  hot/active elements (Play buttons, alarms, breach FX).

## Shapes

- Near-square. `rounded.sm` (2px) is the default; `rounded.none` for HUD/industrial chrome.
- Hard edges, riveted/stencilled metal, warning-stripe motifs. No pill/`rounded-2xl` softness.

## Components

- **button-primary** — `primary` bg, `bone` text, `rounded.sm`. Main CTA.
- **button-secondary** — `hellfire` bg, `void` text, `rounded.sm`. Secondary hot action.
- **card** — `coal` bg, `bone` text, `rounded.sm`; border in implementation should use `gunmetal`.
- **panel-raised / panel-metal** — `iron` or `gunmetal` surfaces for HUD and chrome.
- **terminal** — `void` bg, `ash` mono text, `rounded.sm`.
- **badge** — `blood`, `bloodHot`, `rust`, and `toxic` variants for status and faction tags.

## Do's and Don'ts

**Do:** lead with red + fire + metal + bone; UPPERCASE pixel headers; reserve toxic-green
for the Scourge; use ember glow sparingly; keep edges hard and high-contrast.

**Don't:** magenta/cyan or any neon; soft/large glows; pastel or low-contrast text;
heavy rounding; clean/minimal sci-fi. If it doesn't feel like blood on gunmetal, it's wrong.
