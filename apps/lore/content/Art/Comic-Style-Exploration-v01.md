---
type: art-style-exploration
status: historical-exploration
scope: comic/cel-shaded game art and UI
updated: 2026-06-17
---
# Comic Style Exploration v01

This was a Deadrot exploration lane for comic/cel-shaded game art and UI. Its
results informed the 2026-06-17 comic-ink lock in [[Style-Bible]]. It is kept as
evidence, not an alternate active art direction or generation brief.

## XIII Research Notes

Useful reference: *XIII* works because it treats the whole FPS presentation as
comic language, not just toon-shaded characters. The transferable ideas are:

- cel-shaded characters and weapons with bold contour reads;
- comic-book sound words and captions as diegetic feedback;
- top-screen insets for headshots, clues, and tips;
- pause/menu screens that feel like comic pages instead of generic overlays;
- off-white paper panels, black ink borders, red highlights, and readable icon
  blocks.

Do not copy XIII's exact assets, characters, menus, or screen layouts. Use the
grammar for Deadrot: breach dossiers, kill panels, parasite notes, lane-status
strips, war-map panels, and loadout cards.

Sources:

- [XIII (2003 video game) - Wikipedia](https://en.wikipedia.org/wiki/XIII_(2003_video_game))
- [Style of XIII (2003) - XIII Wiki](https://xiii.fandom.com/wiki/Style_of_XIII_(2003))
- [XIII screenshots - MobyGames](https://www.mobygames.com/game/153167/xiii/screenshots/)
- [Art Perspective: XIII - WhatCulture](https://whatculture.com/gaming/art-perspective-xiii)

## Generated Exploration Assets

Master path: `packages/assets/masters/art/style-tests/comic-v01/`

### Comic Splash

![Cartoon combat splash v01](/assets/masters/art/style-tests/comic-v01/cartoon-combat-splash-v01.png)

### Combat Illustrations

![Pyre assault comic illustration v01](/assets/masters/art/style-tests/comic-v01/pyre-assault-comic-illustration-v01.png)

![Warden defense comic illustration v01](/assets/masters/art/style-tests/comic-v01/warden-defense-comic-illustration-v01.png)

### Master-Style Lineups

![Human character master lineup comic v01](/assets/masters/art/style-tests/comic-v01/human-character-master-lineup-comic-v01.png)

![Scourge foe master lineup comic v01](/assets/masters/art/style-tests/comic-v01/scourge-foe-master-lineup-comic-v01.png)

Scourge note: the comic style reads cleanly, but the parasite language needs a
stronger next pass. The current monsters still read too much like demon/alien
creatures. Next pass should show stolen host bodies, consumed armor plates,
infected machinery, rupture seams, and parasite tendrils visibly controlling a
host.

### UI Exploration

![Comic HUD v01](/assets/masters/art/style-tests/comic-v01/ui-hud-comic-v01.png)

![Comic pause menu v01](/assets/masters/art/style-tests/comic-v01/ui-pause-menu-comic-v01.png)

![Comic loadout codex v01](/assets/masters/art/style-tests/comic-v01/ui-loadout-codex-comic-v01.png)

## Scourge Survivors Runtime Trial

Playable override path: `packages/assets/games/scourge-survivors/`

Enable locally:

```bash
VITE_DEADROT_COMIC_ASSETS=1 bun run dev
```

This is not a final promotion. It preserves the current runtime dimensions,
enemy animation manifest, and arena texture ids so the style can be tested
directly inside Scourge Survivors without replacing the historical pixel runtime
scaffolding.

Enemy override status: disabled. The rejected first pass filtered the existing
small runtime sprites, then the game scaled them into large billboards. The
result was low-quality pixel smear, not cel shading. The rejected second pass
used procedural/vector placeholders, not image generation. Proper comic foes
need image-model generated high-resolution front/side/back sheets and matching
animation-frame folders.

Weapon-view rule: a player-facing Scourge Survivors weapon master is an FPS
view-model, not an isolated object. It must show Pyre armored hands/gloves,
wrists, and forearms holding the weapon with clear trigger/support contact.
No-hands weapons are only valid for loot icons, codex/object sheets, inventory
cards, or package art.

Weapon override status: disabled for this runtime trial. The magenta-background
held-gun lineup is rejected because it is not a proper per-weapon FPS view-model
export: it lacks usable camera framing, grip consistency, bottom-screen crop,
and a clean game import contract.

Arena material override status: disabled for this runtime trial. Cropping combat
or key art into wall/floor/block/column textures is rejected. Proper arena
materials need generated or authored surface-specific texture sheets.

## Deadrot UI Grammar

- HUD: keep gameplay center clear; use comic panels in corners for health,
  ammo, objective, and kill confirms.
- Pause: treat pause as a comic-page spread with one large frozen-action panel,
  one menu column, and a bottom strip for objective/loadout/lane state.
- Loadout/Codex: use dossier panels; left hero portrait, center gear cards,
  right enemy or faction notes.
- Feedback: use short brutal captions and sound words sparingly: `BREACH`,
  `SEAL`, `CUT`, `HOLD`, `BURN`, `SPLAT`.
- Shapes: thick black borders, off-white panel fills, red selected state,
  orange Pyre heat, hazard-yellow Warden marks, toxic-green Scourge notes.

## Shared Asset Integration

This exploration should ride the current shared packages rather than create
one-off game UI:

- `packages/assets/assets-catalog.json` remains the asset source of truth.
  Canonical entities keep stable ids, with per-game variants resolved through
  `@shipshitgames/assets`.
- `packages/assets/shared/ui/*` is where shared comic UI marks/chrome should
  live once promoted beyond exploration.
- `packages/assets/shared/fonts/*` already provides shared font custody; any
  comic-lettering font must be added there and referenced through the catalog.
- `@shipshitgames/assets/lore` should feed codex/loadout panels from the same
  lore JSON used by the games and web hub.
- `packages/ui` already owns `GamePauseMenu`, `PauseMenu`, `GameMenuShell`, and
  `CodexScreen`; a comic pause screen should be a shared skin or component
  variant there, not duplicated in each game.
- Games should pass their `slug`, run state, loadout, objective, and resolved
  asset ids into the shared component. The component should choose the comic
  layout/chrome; the game should not hardcode panel art paths.

## Three.js Feasibility

Three.js can support this style. The renderer is not the hard part; the asset
discipline is.

Useful runtime techniques:

- cel/toon shading for 3D meshes or billboard sprites;
- duplicated/backface outline meshes or postprocess outline passes;
- flat color ramps and nearest/linear texture choices per asset;
- comic HUD and pause screens as React/HTML overlays from `packages/ui`;
- shared WebP sprite sheets or panel/chrome assets from `packages/assets`;
- optional SVG/HTML panel borders for menus, with game state injected as data.

Expected work:

- **Low-medium:** comic pause/codex/loadout overlay using current React UI
  components and shared assets.
- **Medium:** comic HUD skin across games, because each game exposes different
  combat state.
- **Medium-high:** replacing runtime enemies/players with comic-style sprites
  across all camera angles and games.
- **High:** full toon-shaded 3D characters/enemies with outlines, animations,
  and performance tuning.

The safest next step is a shared `comic` UI skin for `GamePauseMenu` and
`CodexScreen`, then one game HUD prototype, before touching runtime sprites.

## Prompt Recipe

Use:

> flat cel-shaded graphic novel game UI, thick clean black ink outlines, smooth
> solid color fills, off-white comic panels, dark red background, bold readable
> comic lettering, Deadrot black/gunmetal/bone/red/orange/toxic palette.

Avoid:

> copied XIII layout, exact XIII title treatment, halftone dots, stipple,
> speckles, pixel art, photoreal texture, tiny particles, unreadable text,
> generic clean sci-fi UI.
