---
status: approved-design-master
type: prompt-batch
game: starblight
issue: shipshitgames/deadrot.com#160
feeds:
  - packages/assets/sources/generated/2026-07-22/games/starblight/hull-silhouettes
  - packages/assets/masters/sprites/starblight/hull-language-v01
---

# 2026-07-22 Starblight Hull Silhouettes

Purpose: lock four player hull bodies at Starblight's true top-down camera read
before body mechanics or final runtime assets are produced.

## Canon and design inputs

- `CANON.md`, `DESIGN.md`, and `Universe/Style-Bible.md`
- `Games/Starblight.md`
- `Factions/Pyre.md` and `Factions/Wardens.md`
- `Characters/Pyre-Pilot.md` and `Characters/Warden-Pilot.md`
- Runtime lock: player height `2.6`, orthographic view height `48`

## Prompt

```text
Create a clean four-column orthographic TOP-DOWN spacecraft design sheet. Every
craft points upward and stays centered in an equal column. Left to right: Pyre
Razor, a narrow spearhead interceptor; Pyre Furnace, a split-prong forward-heavy
gunship; Warden Bastion, a broad square defense frame; Warden Shepherd, a long
escort/carrier with protective outriggers.

The top row shows detailed hulls at equal scale on #0a0a0a void. The bottom row
repeats the exact outlines as pure solid-black silhouettes, approximately 64 px
tall on separate #e9e3d6 bone test chips. Preserve generous gutters.

Use locked Deadrot clean comic-book/cel-shaded ink: bold black contours, crisp
flat shadows, controlled grime, and readable value blocks. Pyre uses scorched
gunmetal, bone, blood, and hellfire. Wardens use gunmetal, bone, sparse hazard
yellow, and ember. Player glow is compact hard-edged engine hardware.

No toxic green, cyan, blue, magenta, neon bloom, text, UI, scenery, pixel art,
dithering, halftone, stipple, noisy speckles, painterly rendering, photorealism,
smooth 3D, perspective views, cropped ships, or repeated hull shapes.
```

## Output and decision

- Source: `~/.codex/generated_images/019f88e6-8adb-7a72-8fd2-422f7f9281aa/exec-533f65f9-dbbf-4f44-ae99-ba8abac2136d.png`
- Curated source:
  `packages/assets/sources/generated/2026-07-22/games/starblight/hull-silhouettes/hull-silhouette-sheet-v01.png`
- Approved master:
  `packages/assets/masters/sprites/starblight/hull-language-v01/hull-silhouette-sheet-v01.png`

The first result was selected. All four outlines remain distinct in black; the
palette keeps toxic green absent from human ships. The image is a design master
only and is not wired into the runtime asset manifest.
