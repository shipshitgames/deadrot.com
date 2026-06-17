---
type: art-master-index
status: active
scope: combat wallpapers
updated: 2026-06-17
supersedes:
  - Art/Combat-Wallpapers-v04
---
# Combat Wallpapers v05

This is the active Deadrot combat-wallpaper direction: realistic gritty
warzone key art with clean readable lighting. Keep rubble, smoke, cracked
ground, embers, and weathered armor. Reject the dotted failure mode caused by
speckled Scourge glow and tiny point-light detail.

## Why v05

The grit was not the problem. The problem was the generator using tiny bright
points to fake background monster detail, rim lights, and toxic core bloom.
That makes the Scourge look dotted, like a failed lighting effect.

Follow-up: repeated Codex image-generation attempts kept reintroducing this
same dotted/stippled texture even when prompts explicitly banned it. For this
wallpaper lane, Codex generations are composition sketches only unless the
output is visibly free of speckled/dotted texture at full size. Use another
model or a paintover/post-process pass for final wallpaper masters if Codex
keeps producing the dotted look.

Wallpaper prompts should separate **environment grit** from **lighting noise**:

- keep realistic rubble, smoke, cracked ground, embers, and weathered armor;
- compose those as broad cinematic masses, not full-frame particle texture;
- render background Scourge as matte shadow silhouettes;
- use one smooth toxic-green core glow with soft bloom;
- avoid tiny green/yellow/red spark points on the monster;
- avoid firefly particles, stipple, halftone, pixel grain, and speckled bloom.

## Prompt Rule

Use phrases like:

> realistic gritty warzone key art; broad cinematic rubble; smoke as large
> soft volumes; weathered armor with readable plates; distant Scourge as matte
> black silhouette; one smooth toxic-green core glow; smooth volumetric bloom;
> no speckled point lights.

Do not use phrases that invite noise:

> sparkling embers around the monster; glowing tendril detail; many tiny lights;
> particulate bloom; detailed background monster texture; firefly particles.

## Preferred Anchor

![Gritty warzone matte boss wallpaper v05](/assets/masters/art/wallpapers/combat-v05/gritty-warzone-matte-boss-wallpaper-v05.png)

Use this as the current wallpaper anchor: the gritty warzone stays, while the
background Scourge stays mostly matte with one core glow instead of many
sparkle points.

## Alternate Smooth Core Pass

![Gritty warzone smooth core wallpaper v05](/assets/masters/art/wallpapers/combat-v05/gritty-warzone-smooth-core-wallpaper-v05.png)

Use this as a secondary pass. It keeps more red sky and ruin texture while
still avoiding the worst speckled monster-light failure.

## Asset Custody

- Master path: `packages/assets/masters/art/wallpapers/combat-v05/`
- Generated source mirror:
  `packages/assets/sources/generated/2026-06-17/lore/wallpapers/combat-v05/`
- Raw generator cache:
  `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-06-17/raw/019ed273-1c2a-7320-9b42-92655439fad6/`

Runtime promotion requires crop/export to WebP, manifest registration, and a
license/provenance record.
