---
status: active
type: asset-audit
date: 2026-06-06
feeds:
  - packages/assets
  - Art/Style-Lock-Audit-2026-06-05
---

# Character Asset Status

Visual review board for current character, player, and core enemy assets.

Source of truth stays in `packages/assets`. The images below are vault-local preview copies so Obsidian and Quartz can show them inline. When a source asset changes, refresh the matching preview in `Assets/Asset-Status/previews/`.

## Status Key

- **Good**: usable as-is for the current pass.
- **Review**: visible and useful, but still needs visual review or a final generation pass.
- **Missing**: no usable shared asset yet.
- **Locked**: generated/promoted through the current locked medium-chunky pixel style, with prompt/source recorded in [[Style-Lock-Audit-2026-06-05]] or [[Generation-History]].
- **Runtime**: actively consumed by a shipped game or runtime manifest.
- **Catalog preview**: visible package preview for the shared catalog, not necessarily a final in-game camera render.
- **Portrait only**: web/lore plate exists, but no gameplay sprite or shared catalog render exists yet.

## Character Roster

| Lore note                  | Preview                                                                                                                                    | Game/use                     | Good?  | Locked? | Current package source                                                                | Next action                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------ | ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [[Ranger]]                 | <img src="../Assets/Asset-Status/previews/characters/ranger.webp" width="72" alt="Ranger runtime sprite">                                  | [[Scourge-Survivors]] player | Review | No      | `packages/assets/games/scourge-survivors/players/pyre/ranger/{front,side,back}.webp`  | Regenerate in locked 110px-ish pixel pipeline.                  |
| [[Bulwark]]                | <img src="../Assets/Asset-Status/previews/characters/bulwark.webp" width="72" alt="Bulwark runtime sprite">                                | [[Scourge-Survivors]] player | Review | No      | `packages/assets/games/scourge-survivors/players/pyre/bulwark/{front,side,back}.webp` | Regenerate in locked 110px-ish pixel pipeline.                  |
| [[Vector]]                 | <img src="../Assets/Asset-Status/previews/characters/vector.webp" width="72" alt="Vector runtime sprite">                                  | [[Scourge-Survivors]] player | Review | No      | `packages/assets/games/scourge-survivors/players/pyre/vector/{front,side,back}.webp`  | Regenerate in locked 110px-ish pixel pipeline.                  |
| [[Patch]]                  | <img src="../Assets/Asset-Status/previews/characters/patch.webp" width="72" alt="Patch runtime sprite">                                    | [[Scourge-Survivors]] player | Review | No      | `packages/assets/games/scourge-survivors/players/pyre/patch/{front,side,back}.webp`   | Regenerate in locked 110px-ish pixel pipeline.                  |
| [[Field-Engineer]]         | <img src="../Assets/Asset-Status/previews/characters/field-engineer.webp" width="72" alt="Field Engineer catalog preview">                 | [[Deadlane]] Warden          | Review | No      | `packages/assets/entities/warden-field-engineer/deadlane.webp`                        | Replace catalog plate with final Deadlane camera render.        |
| [[Lane-Gunner]]            | <img src="../Assets/Asset-Status/previews/characters/lane-gunner.webp" width="72" alt="Lane Gunner catalog preview">                       | [[Deadlane]] Warden          | Review | No      | `packages/assets/entities/warden-lane-gunner/deadlane.webp`                           | Replace catalog plate with final Deadlane camera render.        |
| [[Wallwright]]             | <img src="../Assets/Asset-Status/previews/characters/wallwright.webp" width="72" alt="Wallwright catalog preview">                         | [[Deadlane]] Warden          | Review | No      | `packages/assets/entities/warden-wallwright/deadlane.webp`                            | Replace catalog plate with final Deadlane camera render.        |
| [[Pyre-Duelist]]           | <img src="../Assets/Asset-Status/previews/characters/pyre-duelist.webp" width="72" alt="Pyre Duelist catalog preview">                     | [[Pactfall]] Pyre            | Review | No      | `packages/assets/entities/pyre-duelist/pactfall.webp`                                 | Replace catalog plate with final Pactfall arena render.         |
| [[Pyre-Cauterizer]]        | <img src="../Assets/Asset-Status/previews/characters/pyre-cauterizer.webp" width="72" alt="Pyre Cauterizer catalog preview">               | [[Pactfall]] Pyre            | Review | No      | `packages/assets/entities/pyre-cauterizer/pactfall.webp`                              | Replace catalog plate with final Pactfall arena render.         |
| [[Warden-Bastion]]         | <img src="../Assets/Asset-Status/previews/characters/warden-bastion.webp" width="72" alt="Warden Bastion catalog preview">                 | [[Pactfall]] Warden          | Review | No      | `packages/assets/entities/warden-bastion/pactfall.webp`                               | Replace catalog plate with final Pactfall arena render.         |
| [[Warden-Artillerist]]     | <img src="../Assets/Asset-Status/previews/characters/warden-artillerist.webp" width="72" alt="Warden Artillerist catalog preview">         | [[Pactfall]] Warden          | Review | No      | `packages/assets/entities/warden-artillerist/pactfall.webp`                           | Replace catalog plate with final Pactfall arena render.         |
| [[Pyre-Interceptor-Pilot]] | <img src="../Assets/Asset-Status/previews/characters/pyre-interceptor-pilot.webp" width="72" alt="Pyre Interceptor Pilot catalog preview"> | [[Starblight]] Pyre pilot    | Review | No      | `packages/assets/entities/pyre-interceptor-pilot/starblight.webp`                     | Decide whether this is pilot portrait, cockpit sprite, or both. |
| [[Warden-Defense-Pilot]]   | <img src="../Assets/Asset-Status/previews/characters/warden-defense-pilot.webp" width="72" alt="Warden Defense Pilot catalog preview">     | [[Starblight]] Warden pilot  | Review | No      | `packages/assets/entities/warden-defense-pilot/starblight.webp`                       | Decide whether this is pilot portrait, cockpit sprite, or both. |
| [[Pyre-Courier]]           | <img src="../Assets/Asset-Status/previews/characters/pyre-courier.webp" width="72" alt="Pyre Courier portrait">                            | [[Redline]] Pyre courier     | Review | No      | `packages/assets/sites/deadrotcom/public/sprites/portrait-pyre-courier.webp`          | Add shared catalog/runtime render.                              |
| [[Warden-Courier]]         | <img src="../Assets/Asset-Status/previews/characters/warden-courier.webp" width="72" alt="Warden Courier portrait">                        | [[Redline]] Warden courier   | Review | No      | `packages/assets/sites/deadrotcom/public/sprites/portrait-warden-courier.webp`        | Add shared catalog/runtime render.                              |
| [[Pyre-Saboteur]]          | <img src="../Assets/Asset-Status/previews/characters/pyre-saboteur.webp" width="72" alt="Pyre Saboteur portrait">                          | [[Rothulk]] Pyre infiltrator | Review | No      | `packages/assets/sites/deadrotcom/public/sprites/portrait-pyre-saboteur.webp`         | Add shared catalog/runtime render.                              |

## Enemy And Boss Locks

| Lore note                        | Preview                                                                                                                                 | Game/use                           | Good?  | Locked? | Current package source                                                                        | Next action                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ | ------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [[Swarm-Ripper]] / Host Grunt    | <img src="../Assets/Asset-Status/previews/enemies/swarm-ripper-host-grunt.webp" width="72" alt="Swarm Ripper locked runtime sprite">    | [[Scourge-Survivors]] melee enemy  | Good   | Yes     | `packages/assets/games/scourge-survivors/enemies/scourge/host-grunt/{front,side,back}.webp`   | Wire animation frames into renderer.                                      |
| [[Swarm-Spitter]] / Spitter Host | <img src="../Assets/Asset-Status/previews/enemies/swarm-spitter-host.webp" width="72" alt="Swarm Spitter runtime sprite">               | [[Scourge-Survivors]] ranged enemy | Review | No      | `packages/assets/games/scourge-survivors/enemies/scourge/spitter-host/{front,side,back}.webp` | Review against locked reference, then promote/lock or regenerate.         |
| Winged Host                      | <img src="../Assets/Asset-Status/previews/enemies/winged-host.webp" width="72" alt="Winged Host runtime sprite">                        | [[Scourge-Survivors]] flying enemy | Review | No      | `packages/assets/games/scourge-survivors/enemies/scourge/winged-host/{front,side,back}.webp`  | Add lore note or map to an existing host family entry; review style lock. |
| [[Breach-Boss]]                  | <img src="../Assets/Asset-Status/previews/enemies/breach-boss.webp" width="72" alt="Breach-Boss locked runtime sprite">                 | [[Scourge-Survivors]] boss         | Good   | Yes     | `packages/assets/games/scourge-survivors/enemies/scourge/breach-boss/{front,side,back}.webp`  | Wire animation frames into renderer.                                      |
| [[Render]]                       | <img src="../Assets/Asset-Status/previews/enemies/render.webp" width="72" alt="Render catalog preview">                                 | Shared Scourge elite               | Review | No      | `packages/assets/entities/scourge-elite/deadlane.webp`                                        | Generate final per-game variants.                                         |
| [[Rot-Engine]]                   | <img src="../Assets/Asset-Status/previews/enemies/rot-engine.webp" width="72" alt="Rot Engine catalog preview">                         | [[Deadlane]] Scourge elite         | Review | No      | `packages/assets/entities/rot-engine/deadlane.webp`                                           | Generate final Deadlane camera render.                                    |
| [[Graft-Breacher]]               | <img src="../Assets/Asset-Status/previews/enemies/graft-breacher.webp" width="72" alt="Graft Breacher catalog preview">                 | Shared Scourge enemy               | Review | No      | `packages/assets/entities/graft-breacher/deadlane.webp`                                       | Generate final per-game variants.                                         |
| [[Scourge-Fighter]]              | <img src="../Assets/Asset-Status/previews/enemies/scourge-fighter.webp" width="72" alt="Scourge Fighter catalog preview">               | [[Starblight]] enemy craft         | Review | No      | `packages/assets/entities/scourge-fighter/starblight.webp`                                    | Replace with final Starblight sprite/ship render.                         |
| [[Orbital-Breach-Carrier]]       | <img src="../Assets/Asset-Status/previews/enemies/orbital-breach-carrier.webp" width="72" alt="Orbital Breach Carrier catalog preview"> | [[Starblight]] boss craft          | Review | No      | `packages/assets/entities/orbital-breach-carrier/starblight.webp`                             | Replace with final Starblight boss render.                                |
| [[Trucebreaker]]                 | <img src="../Assets/Asset-Status/previews/enemies/trucebreaker.webp" width="72" alt="Trucebreaker catalog preview">                     | [[Pactfall]] neutral boss          | Review | No      | `packages/assets/entities/trucebreaker/pactfall.webp`                                         | Replace with final Pactfall boss render.                                  |

## Gaps

- No character row is locked yet. The Scourge melee host and breach boss are the only promoted locked runtime character/boss assets in this audit pass.
- Redline and Rothulk characters currently have portrait plates only, not shared catalog or runtime sprites.
- The current catalog preview plates unblock visibility, but they are not final camera-specific renders unless marked locked above.
- When assetgen promotes a new render, refresh the preview copy here and update `Good?`, `Locked?`, and source path in the matching row.
