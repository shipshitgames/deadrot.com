---
version: 0.2.0
name: Deadrot
description: >-
  Deadrot's authoritative palette, type system, per-game framing, and
  production-custody rules.
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
  acidOchre: "#b9a83a"
  hazardYellow: "#d6a21f"
  bruisedViolet: "#5a3a6f"
  verdigris: "#3f6b5d"
typography:
  display:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
    fontWeight: 800
    letterSpacing: "0em"
    textTransform: uppercase
  body:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
    fontWeight: 600
    lineHeight: 1.35
  mono:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
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
gameArtDirection:
  shared:
    medium: "clean comic-book / cel-shaded ink game art"
    renderRules: "bold ink contours, flat readable value blocks, controlled grime, transparent/cutout-ready runtime sheets"
    paletteRules: "void/coal/gunmetal bodies, blood/rust grime, bone highlights, hellfire rim light; toxic-green only for Scourge parasite organs"
    enemyRules: "silhouette first; parasites must visibly infest or rewrite a host"
  scourge-survivors:
    camera: "first-person billboard sprites, front-facing full-body enemies and pickups"
    assetFraming: "enemy silhouettes readable at FPS combat distance; weapons and pickups centered and iconic"
  deadlane:
    camera: "top-down / high-angle lane-defense sprites"
    assetFraming: "units, towers, lanes, and projectiles readable from above"
  pactfall:
    camera: "isometric 3/4-view champion sprites"
    assetFraming: "heroes with readable ability silhouettes and faction crests"
  brawl:
    camera: "side-on / 3/4-view trench-fighter sprites"
    assetFraming: "fighters, impacts, and hazards readable at arena distance"
  starblight:
    camera: "side-on / top-down arcade space-shooter sprites"
    assetFraming: "ships, projectiles, and orbital threats readable at speed"
  redline:
    camera: "side-on courier-runner sprites"
    assetFraming: "profile silhouettes readable at high lane speed"
  rothulk:
    camera: "side-on platformer sprites"
    assetFraming: "clear traversal poses and readable bio-ship hazards"
  warline:
    camera: "map-first SVG/strategy interface with compact faction icons"
    assetFraming: "regions, lanes, breaches, pressure, and faction control visible at a glance"
artProduction:
  canonicalProse: Universe/Style-Bible.md
  houseMedium: "clean comic-book / cel-shaded ink"
  pixelArt: "historical runtime scaffolding only; never a target for new masters or promoted runtime sheets"
  studioTooling: "../shipshitgames/packages/assetgen; no generator implementation belongs in this repository"
  generatedOriginals: packages/assets/sources/generated
  approvedMasters: packages/assets/masters
  runtimeRasters: "packages/assets/games/**/*.webp"
  historicalReferences: "Art/style-refs/README.md"
---

# Deadrot Design Tokens and Production Boundary

This file is authoritative for the palette, typography, per-game framing, and
asset-custody paths above. It does not contain generator configuration or a
second prompt library. The canonical visual prose and active prompt skeleton
are in [[Style-Bible]].

## Active Direction

The house medium is **clean comic-book / cel-shaded ink**: bold black contours,
graphic shadow shapes, readable value blocks, controlled grime, and sharp
silhouettes. It is not pixel art, halftone, stipple, noisy speckle, smooth 3D,
or photorealism.

The Scourge is a parasite first. Every Scourge design must visibly wear or
rewrite a host through ruptured tissue, tendrils, black chitin over stolen
bone/metal, and constrained toxic-green breach organs. Toxic-green is never a
generic UI or human-faction accent.

## Production Boundary

Deadrot preserves the outputs that ship: approved originals, masters, manifests,
credits, and WebP runtime packs. The sibling `../shipshitgames` repository owns
the asset-generator product and reusable generation automation. Use that tooling
to make or transform an asset, then bring the reviewed output back through the
paths in `artProduction` with provenance recorded in [[Generation-History]].

The dated pixel recipes and references remain available only as historical
evidence. They must be explicitly labeled historical and cannot be used as an
active generation source.
