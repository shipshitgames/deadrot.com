---
status: active
type: generation-ledger
---
# Generation History

Record every generated asset or serious variation here. Drafts count. This is
the provenance trail before assets are promoted into a game manifest.

## Ledger Template

```markdown
## YYYY-MM-DD - [asset-id] - v##

- Status:
- Game:
- Faction:
- Character/role:
- View:
- Tool:
- Plan:
- Kind:
- Source output:
- Workspace draft:
- Final asset:
- Prompt source:
- Post-processing:
- Notes:
- Decision:
```

## 2026-06-03 - pyre-ranger-front - v01

- Status: draft, not wired into the game.
- Game: [[Scourge-Survivors]] / `scourge-survivors` probe.
- Faction: [[The-Pyre]].
- Character/role: Ranger, balanced Purger trooper.
- View: front.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-2d-sprite draft.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_083e7076ef973bc7016a201ff67d2c8191a040bb517242be70.png`
- Workspace draft source: `games/scourge-survivors/src/assets/sprites/drafts/player-ranger-front-pyre-v01-source.png`
- Workspace draft cutout: `games/scourge-survivors/src/assets/sprites/drafts/player-ranger-front-pyre-v01-cutout.png`
- Final asset: none.
- Prompt source: first-pass Ranger prompt, now normalized in [[Character-Prompt-Library]].
- Post-processing: copied source into workspace; Pillow helper was unavailable, so a draft alpha PNG was produced with `ffmpeg chromakey=0x00ff00:0.10:0.03,format=rgba`.
- Notes: Good Pyre read: blackened armor, bone-white scorched plates, ember visor, dim diagnostics. Watch the tattered center cloth: useful for a zealot variant, but not necessarily the baseline Ranger.
- Decision: keep as direction probe only; generate Tactical/Zealot/Perdition variants before replacing `player-ranger-front.webp`.

## 2026-06-03 - scourge-host-family-concepts - v01

- Status: draft batch, not wired into the game.
- Game: [[Scourge-Survivors]] and cross-game Scourge bestiary direction.
- Faction: [[Scourge]].
- Character/role: Ripper, Spitter, Breach-Boss, Scourge Fighter.
- View: single three-quarter concept angle per target.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-2d-sprite concept batch.
- Source output:
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206d57a5d081919655c60e5aa09dbd.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206d9362648191be73b29957be93f7.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206dd147c48191a9d64af6432721dc.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e0ce03481918c2bc26ec30a021d.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e4af11881918846f6548351bdab.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e8a5bc481918cc55029bfd942cf.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206ecc078c819193401c2b9899b2d9.png`
- Workspace draft: `games/scourge-survivors/src/assets/sprites/drafts/2026-06-03-scourge-host-family-concepts/`.
- Final asset: none.
- Prompt source: [[Scourge-Host-Families]], [[Character-Prompt-Library]], and `lore/Art/Prompt-Batches/2026-06-03-scourge-host-family-concepts.md`.
- Post-processing: copied sources into workspace; created alpha PNG drafts with `skills/skills/sprite-asset-promotion/scripts/chroma_cutout.sh`; built opaque review contact sheet with ffmpeg.
- Notes: Batch explores one parasite army wearing multiple conquered host races. Machine-graft Spitter reads heavier than a common enemy and may work better as an elite/artillery unit. Green edge fringe remains on draft cutouts.
- Decision: await Vincent review before generating view turnarounds or replacing runtime assets.

## 2026-06-03 - gallery-thumbnails-and-menu-ui - v01

- Status: draft assets plus gallery integration.
- Game: Ship Shit Games gallery and cross-game menu/UI direction.
- Faction: shared Scourge universe.
- Character/role: game key art and Doom-inspired menu systems.
- View: 16:9 gallery thumbnails and 16:9 UI mockups.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-key-art and ai-ui-reference draft.
- Source output: see `lore/Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`.
- Workspace draft: `lore/Art/UI-Drafts/2026-06-03-doom-menu-concepts/`.
- Final asset: `shipshitgames/apps/web/public/images/games/*.jpg`.
- Prompt source: `lore/Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`.
- Post-processing: resized/cropped gallery thumbnails to 1280x720 JPG with ffmpeg.
- Notes: UI drafts are references only. Final menus should be real React/DOM controls with generated art used only as backgrounds, thumbnails, or icons.
- Decision: gallery thumbnails are wired for review; menu UI direction awaits implementation pass.

## 2026-06-04 - key-art-placeholders - v01

- Status: draft placeholder assets plus web integration.
- Game: Ship Shit Games homepage and Zero Day.
- Faction: shared Scourge universe.
- Character/role: homepage breach-boss key art and first-contact orbital last stand.
- View: 16:9 website hero/game key art.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-key-art draft.
- Source output: see `lore/Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`.
- Final asset:
  - `shipshitgames/apps/web/public/images/games/zero-day.jpg`
  - `shipshitgames/apps/web/public/images/home/shipshit-hero.jpg`
- Prompt source: `lore/Universe/Style-Bible.md` and `lore/Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`.
- Post-processing: resized/cropped outputs with ffmpeg to 1280x720 for Zero Day and 1920x1080 for the homepage hero.
- Notes: draft placeholders follow the locked void/rim-light/DOOM-grade art bible. Homepage and game-detail/card slots now render generated key art instead of sprite-only or CSS placeholders. **Medium mismatch (flagged 2026-06-04 audit):** the batch used a *hi-fi concept render*, which contradicts the locked house medium (medium-chunky pixel art, [[Style-Bible]] §1–2). These are off-canon placeholders pending regeneration in the locked pixel style.
- Decision: use as review placeholders; character, bestiary, and faction image slots still need their own generation pass.

## 2026-06-04 - website-portrait-placeholders - v01

- Status: draft assets plus website integration.
- Game: `games.shipshit.dev` website.
- Faction: Pyre, Wardens, Scourge.
- Character/role: all missing character and bestiary card placeholders.
- View: square website portrait plate.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-website-portrait draft.
- Source output: generated under `/Users/decod3rslabs/.codex/generated_images/019e8fbd-2348-77b1-ac5c-ea661293fe4b/` and `/Users/decod3rslabs/.codex/generated_images/019e8ff4-3cec-7d93-8b15-1880632dab7b/`.
- Workspace draft: none.
- Final asset: `shipshitgames/apps/web/public/sprites/portrait-*.webp`.
- Prompt source: `lore/Universe/Style-Bible.md`, `lore/Art/Character-Prompt-Library.md`, and `lore/Art/Prompt-Batches/2026-06-04-website-portrait-placeholders.md`.
- Post-processing: resized/padded to `768x768` PNG intermediates with ffmpeg, then converted to WebP with `cwebp`; project-local PNG intermediates removed after conversion.
- Notes: Existing Scourge Survivors runtime sprites remain in place. These draft plates fill website card and dossier placeholders only.
- Decision: wired for review; replace with promoted asset-pipeline outputs later when final portrait/style-lock assets exist. **Off-canon (flagged 2026-06-04 audit):** prompts were hi-fi render, not the locked pixel medium ([[Style-Bible]] §1–2); regenerate in the locked pixel style.

## 2026-06-04 - game-previs - v01

- Status: draft pre-viz assets, not wired into the website or games.
- Game: [[Scourge-Survivors]], [[Deadlane]], [[Pactfall]], [[Starblight]], [[Redline]], [[Rothulk]], [[Zero-Day]].
- Faction: shared Scourge universe; Pyre, Wardens, Scourge.
- Character/role: game cover/key-art direction plates.
- View: portrait 2:3 pre-viz key art; game-specific cameras where relevant.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-key-art pre-viz draft.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/`.
- Workspace draft: `Art/Previs/2026-06-04-game-previs/`.
- Final asset: none.
- Prompt source: `Art/Prompt-Batches/2026-06-04-game-previs.md`.
- Post-processing: copied generated PNGs into the lore workspace with stable game/version filenames; no crop, grade, pixelize, or WebP conversion yet.
- Notes: Created seven game pre-viz directions plus a second [[Scourge-Survivors]] variant. Live production asset audit found current covers broadly on-style, with `Zero-Day` missing on production and Pactfall drifting too fantasy-knight.
- Decision: keep as iteration set; compare variants before promoting any cover or generating per-game style refs.

## 2026-06-04 - fps-hud-previs - doom-pixel-hud-v06

- Status: active buildable UI pre-viz.
- Game: [[Scourge-Survivors]].
- Faction: Pyre player HUD with Scourge-only toxic signal.
- Character/role: first-person survival HUD, upgrade overlay, loadout overlay, pause overlay.
- View: browser-rendered DOM/CSS prototype over `Art/Previs/2026-06-04-game-previs/scourge-survivors-v02.png`.
- Tool: hand-authored HTML/CSS/JS, verified with Playwright screenshots.
- Workspace draft: `Art/UI-Drafts/2026-06-04-fps-hud-previs/`.
- Final asset: none.
- Prompt source: none; this is buildable UI pre-viz, not generated image UI.
- Post-processing: captured `screenshot-hud-desktop-doom-pixel.png`, `screenshot-upgrade-desktop-doom-pixel.png`, and `screenshot-hud-mobile-doom-pixel.png`.
- Notes: Pushed the restrained pixel pass back toward Doom after review. The current direction uses blood-red health/ammo, bone labels, black metal plates, compact weapon slots, Scourge-only toxic green, a small status face, minimal minimap/objective atom, center reticle, and low-right weapon/ammo card.
- Decision: use this as the FPS HUD direction candidate for review before promotion into runtime components.
