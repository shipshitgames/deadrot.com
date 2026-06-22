---
status: active
type: buildable-ui-previs
game: Scourge-Survivors
sourceArt: ../../Previs/2026-06-04-game-previs/scourge-survivors-v02.png
---

# Scourge Survivors FPS HUD Previs

Buildable DOM prototype for the [[Scourge-Survivors]] runtime UI.

## What Exists

- `index.html` — static HTML/CSS/JS prototype with switchable states:
  - live gameplay HUD
  - upgrade choice overlay
  - deployment/loadout overlay
  - pause/settings overlay
- `screenshot-hud-desktop-doom-pixel.png`, `screenshot-upgrade-desktop-doom-pixel.png`, and
  `screenshot-hud-mobile-doom-pixel.png` — current review screenshots.
- Background plate: `../../Previs/2026-06-04-game-previs/scourge-survivors-v02.png`.
- All HUD chrome is real markup and CSS, not baked into the image.

## Direction

The FPS gameplay HUD should feel like **Doom-flavored restrained pixel UI**: blood-red health
and ammo, bone labels, dark metal plates, compact weapon slots, a small status face, hard pixel
shadows, a minimal map/objective atom, and a low-right weapon/ammo readout. Keep it readable and
edge-mounted; do not return to the full bottom status hub.

Runtime HUD chrome should be authored like sprite/canvas game UI, not styled React dashboard
components.

Keep toxic green reserved for Scourge signal, threat, Choir, and relic language. Do not use
green as generic player progress.

## Build Notes

- Use [[DESIGN]] tokens for palette and type.
- Keep the gameplay viewport readable; do not box every HUD atom.
- Health, armor, Scourge threat, ammo, keycards, compact weapon slots, minimap, status face, objective atom, and reticle are core HUD atoms.
- Upgrade/loadout/pause are overlays over the live viewport, not separate illustrated screens.
- Avoid generated-text UI art for production; use generated art only as backgrounds, portraits,
  icons, or reference.
- Avoid smooth glass, thin sci-fi strokes, rainbow palettes, cute RPG colors, tiny novelty text,
  and generic web-app panels. This should read as a Doom-leaning pixel HUD asset sheet.

## Iteration Targets

- Add actual sprite/canvas icon assets for health, armor, keycards, inventory items, ammo, and minimap markers.
- Test in the real Scourge Survivors viewport with enemy density and muzzle flash.
- Tune pixel panel opacity only if enemy silhouettes become unreadable.
- Promote this into the game repo as sprite/canvas overlay components after review.
