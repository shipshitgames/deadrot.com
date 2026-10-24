---
status: active
type: generation-ledger
---
# Generation History

Record every generated asset or serious variation here. Drafts count. This is
the provenance trail before assets are promoted into a game manifest.

## Path Note - 2026-06-11

Entries before the asset package cleanup may mention historical app-local paths
such as `apps/web/public/*` or `games/scourge-survivors/src/assets/*`. Current
runtime art lives under `packages/assets`, and source-like generated material is
reviewed outside runtime paths under `packages/assets/_archive/`.

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

## 2026-07-20 - starblight-reference-moodboard - v01

- Status: approved visual-direction reference; not a runtime asset.
- Game: [[Starblight]].
- Faction: [[The-Pyre]], [[The-Wardens]], and [[Scourge]].
- Character/role: momentum flight, bullet-heaven readability, and player hull
  identity.
- View: three-panel top-down / slight-oblique arcade reference board.
- Tool: built-in `image_gen` / `gpt-image-2`.
- Plan: Codex built-in.
- Kind: AI-generated clean comic/cel-ink visual-development triptych.
- Source output:
  `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-07-20/raw/019f812b-f202-7060-ae41-f33dd4556e01/exec-9c5f98ed-295b-49c0-9715-c2cd65718969.png`.
- Workspace draft:
  `packages/assets/sources/generated/2026-07-20/starblight/moodboard/starblight-reference-triptych-source.png`.
- Final asset: `packages/assets/masters/art/starblight/moodboard-v01/`.
- Prompt source: [[CANON]], [[DESIGN]], [[Universe/Style-Bible]],
  [[Games/Starblight]], the current Starblight title art/runtime contact sheet,
  and the locked comic master.
- Post-processing: cropped the three panels with FFmpeg; the hull panel removes
  the inter-panel seam and pads the crop back to 724x724. No color edits.
- Notes: the named Nova Drift, Geometry Wars, and Brotato touchstones supplied
  interaction/readability goals only. The image is original Deadrot reference
  art and copies no characters, UI, assets, or exact compositions.
- Decision: use as the M0 reference board for momentum, hull identity, swarm
  readability, and bullet-heaven legibility; keep out of runtime manifests.

## 2026-07-17 - breach-boss-comic-runtime - v01

- Status: promoted into the Scourge Survivors runtime pack.
- Game: [[Scourge-Survivors]].
- Faction: [[Scourge]].
- Character/role: Breach-Boss, region-holding breach engine / artillery altar.
- View: front / true side / back FPS billboard turnaround.
- Tool: built-in `image_gen` / `gpt-image-2`.
- Plan: Codex built-in.
- Kind: AI-generated clean comic/cel-ink three-view runtime sprite sheet.
- Source output: `~/.codex/generated_images/019f6d37-6091-7b10-bee9-e73808d06dd9/exec-e67e84c7-331f-4797-bd72-98eca1efd933.png`.
- Preserved raw output: `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-07-16/raw/019f6d37-6091-7b10-bee9-e73808d06dd9/exec-e67e84c7-331f-4797-bd72-98eca1efd933.png` (generated July 16, promoted July 17).
- Workspace source: `packages/assets/sources/generated/2026-07-17/scourge-survivors/enemies/breach-boss-comic-turnaround-source.png` plus the three keyed cutouts beside it.
- Final asset: `packages/assets/games/scourge-survivors/enemies/scourge/breach-boss/{front,side,back}.webp`, mirrored into the comic lane, the shared `entities/breach-boss/scourge-survivors.webp` variant, and the boss animation slots.
- Prompt source: [[Design/Bestiary/Breach-Boss-DESIGN]], [[Bestiary/Bosses/Breach-Boss]], [[Universe/Style-Bible]], [[DESIGN]], and `CANON.md`.
- Post-processing: split three equal source panels; flood-keyed only border-connected green pixels so internal toxic organs remain opaque; trimmed and padded each view into a `128x180` lossless WebP plate; patched the existing runtime atlas cells without changing authored frame identities.
- Notes: Replaces the tall humanoid melee-boss silhouette with the locked low-wide breach engine: planted anchor limbs, bone-caged toxic heart, barrage vents, black chitin, wet crimson tissue, and rusted machine grafts. The current action slots repeat the production static pose to prevent a style/silhouette morph until authored comic action sheets land.
- Decision: promote as the production static runtime read; keep true lurch/barrage/death animation as a follow-up art pass.

## 2026-07-17 - scourge-survivors-comic-bonus-icons - v01

- Status: promoted into runtime.
- Game: [[Scourge-Survivors]].
- Faction: [[The-Pyre]].
- Character/role: level-up bonuses, permanent shop upgrades, and the Cautery
  Ring blade choice.
- View: transparent 128x128 comic/cel UI glyphs.
- Tool: `gpt-image-2` via Codex built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-2d-comic-ui-icon-atlas.
- Source output:
  `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-07-17/raw/019f6da4-55d3-7d63-aa0b-e4d5c76d0385/exec-aedb1ce0-7a1f-460f-914b-ea126bf2ae4c.png`.
- Workspace draft:
  `packages/assets/sources/generated/2026-07-17/scourge-survivors/ui/bonus-icons-comic-atlas-source.png`.
- Final asset: `packages/assets/games/scourge-survivors/ui/icons/comic/*.webp`.
- Prompt source: [[CANON]], [[DESIGN]], [[Universe/Style-Bible]],
  [[Games/Scourge-Survivors]], the locked comic HUD master, and the legacy
  icon atlas as a semantic-reference-only ordering guide.
- Post-processing: sampled green chroma removal and despill with Sharp; split
  the exact 7x3 atlas; removed disconnected matte fragments; alpha-trimmed,
  padded, and encoded each glyph as lossless WebP.
- Notes: exact semantic order is orbit, bolt, nova, fire, battery, lightning,
  trident, target, boot, heart, medic-cross, armor, shield, spikes, bloodtap,
  bastion, dodge, grace, magnet, chart, gold. The runtime manifest owns this
  list so the HUD draft and permanent shop cannot drift onto different art.
- Decision: promoted as the canonical bonus icon family; retain the legacy
  pixel atlas only for non-bonus shell controls.

## 2026-06-17 - comic-book-master-atlas - v01

- Status: exploratory masters attached to lore.
- Game: shared Deadrot lore + [[Scourge-Survivors]] runtime probe.
- Faction: Pyre, Wardens, Scourge.
- Character/role: bestiary roster, human roster, UI/codex, pause screen, combat wallpaper mood.
- View: comic-book master boards.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-2d-comic-master-reference.
- Source output: selected files under `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-06-17/raw/019ed273-1c2a-7320-9b42-92655439fad6/`.
- Workspace draft: `packages/assets/sources/generated/2026-06-17/lore/comic-v01/`.
- Final asset: `packages/assets/masters/art/lore-comic-v01/`.
- Prompt source: [[Art/Comic-Book-Master-Atlas-v01]] and the user-directed comic-book exploration pass.
- Post-processing: copied selected generated PNG masters; cropped [[Wound-Hound]] into 256x128 WebP runtime views with `ffmpeg` + `cwebp`.
- Notes: This is not the final production sprite pass. It establishes a comic master language and a playable fast-animal foe lane without promoting the rejected dotted/stippled look.
- Decision: keep for review; generate dedicated Wound-Hound turnaround and per-entry comic masters next.

## 2026-06-03 - pyre-ranger-front - v01

- Status: draft, not wired into the game.
- Game: [[Scourge-Survivors]] / `scourge-survivors` probe.
- Faction: [[The-Pyre]].
- Character/role: Ranger, balanced Purger trooper.
- View: front.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-2d-sprite draft.
- Source output: `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_083e7076ef973bc7016a201ff67d2c8191a040bb517242be70.png`
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
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206d57a5d081919655c60e5aa09dbd.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206d9362648191be73b29957be93f7.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206dd147c48191a9d64af6432721dc.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e0ce03481918c2bc26ec30a021d.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e4af11881918846f6548351bdab.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206e8a5bc481918cc55029bfd942cf.png`
  - `~/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_0956ca1eaea30e16016a206ecc078c819193401c2b9899b2d9.png`
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
- Workspace draft: `packages/assets/sources/generated/lore-art-ui-drafts/2026-06-03/`.
- Final asset: promoted to package-native game title art under
  `packages/assets/games/<slug>/ui/menu/title.webp`.
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
  - `packages/assets/concepts/zero-day/ui/social/og.png`
  - `packages/assets/universe/hero.webp`
- Prompt source: `lore/Universe/Style-Bible.md` and `lore/Art/Prompt-Batches/2026-06-04-key-art-placeholders.md`.
- Post-processing: resized/cropped outputs with ffmpeg to 1280x720 for Zero Day and 1920x1080 for the homepage hero.
- Notes: draft placeholders follow the locked void/rim-light/DOOM-grade art bible. Homepage and game-detail/card slots now render generated key art instead of sprite-only or CSS placeholders. **Medium mismatch (updated 2026-06-17):** the batch used a *hi-fi concept render*, and the later pixel target has also been superseded by the locked comic-book/cel-ink direction. These are off-canon placeholders pending regeneration in the locked comic style.
- Decision: use as review placeholders; character, bestiary, and faction image slots still need their own generation pass.

## 2026-06-04 - website-portrait-placeholders - v01

- Status: draft assets plus website integration.
- Game: `deadrot.com` website.
- Faction: Pyre, Wardens, Scourge.
- Character/role: all missing character and bestiary card placeholders.
- View: square website portrait plate.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-website-portrait draft.
- Source output: generated under `~/.codex/generated_images/019e8fbd-2348-77b1-ac5c-ea661293fe4b/` and `~/.codex/generated_images/019e8ff4-3cec-7d93-8b15-1880632dab7b/`.
- Workspace draft: none.
- Final asset: promoted to package-native catalog/entity previews under
  `packages/assets/entities/**/<game>.webp`.
- Prompt source: `lore/Universe/Style-Bible.md`, `lore/Art/Character-Prompt-Library.md`, and `lore/Art/Prompt-Batches/2026-06-04-website-portrait-placeholders.md`.
- Post-processing: resized/padded to `768x768` PNG intermediates with ffmpeg, then converted to WebP with `cwebp`; project-local PNG intermediates removed after conversion.
- Notes: Existing Scourge Survivors runtime sprites remain in place. These draft plates fill website card and dossier placeholders only.
- Decision: wired for review; replace with promoted asset-pipeline outputs later when final portrait/style-lock assets exist. **Off-canon (updated 2026-06-17):** prompts were hi-fi render, and the later pixel target has also been superseded by the locked comic-book/cel-ink direction; regenerate in the locked comic style.

## 2026-06-04 - game-previs - v01

- Status: draft pre-viz assets, not wired into the website or games.
- Game: [[Scourge-Survivors]], [[Deadlane]], [[Pactfall]], [[Starblight]], [[Redline]], [[Rothulk]], [[Zero-Day]].
- Faction: shared Scourge universe; Pyre, Wardens, Scourge.
- Character/role: game cover/key-art direction plates.
- View: portrait 2:3 pre-viz key art; game-specific cameras where relevant.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: ai-key-art pre-viz draft.
- Source output: `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/`.
- Workspace draft: `packages/assets/sources/generated/lore-art-previs/2026-06-04/`.
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
- View: browser-rendered DOM/CSS prototype over `packages/assets/sources/generated/lore-art-previs/2026-06-04/scourge-survivors-v02.png`.
- Tool: hand-authored HTML/CSS/JS, verified with Playwright screenshots.
- Workspace draft: `packages/assets/sources/generated/lore-art-ui-drafts/2026-06-04/`.
- Final asset: none.
- Prompt source: none; this is buildable UI pre-viz, not generated image UI.
- Post-processing: captured `screenshot-hud-desktop-doom-pixel.png`, `screenshot-upgrade-desktop-doom-pixel.png`, and `screenshot-hud-mobile-doom-pixel.png`.
- Notes: Pushed the restrained pixel pass back toward Doom after review. The current direction uses blood-red health/ammo, bone labels, black metal plates, compact weapon slots, Scourge-only toxic green, a small status face, minimal minimap/objective atom, center reticle, and low-right weapon/ammo card.
- Decision: use this as the FPS HUD direction candidate for review before promotion into runtime components.

## 2026-06-05 - game-og-cards - v01

- Status: final website social assets.
- Game: [[Scourge-Survivors]], [[Deadlane]], [[Pactfall]], [[Starblight]], [[Redline]], [[Rothulk]], [[Zero-Day]].
- Faction: shared Scourge universe.
- Character/role: game Open Graph cards.
- View: 1200x630 social preview card.
- Tool: existing built-in `image_gen` / `gpt-image-2` source art, composed with Sharp.
- Plan: Codex built-in source art plus deterministic text overlay.
- Kind: ai-key-art-derived social card.
- Source output: shipped package title art from
  `packages/assets/games/<slug>/ui/menu/title.webp` and
  `packages/assets/sources/generated/lore-art-previs/2026-06-04/zero-day-v01.png`.
- Final asset:
  - `packages/assets/games/scourge-survivors/ui/social/og.jpg`
  - `packages/assets/games/deadlane/ui/social/og.jpg`
  - `packages/assets/games/pactfall/ui/social/og.jpg`
  - `packages/assets/games/starblight/ui/social/og.jpg`
  - `packages/assets/games/redline/ui/social/og.jpg`
  - `packages/assets/games/rothulk/ui/social/og.jpg`
  - `packages/assets/concepts/zero-day/ui/social/og.png`
- Prompt source: `Art/Prompt-Batches/2026-06-03-gallery-thumbnails-and-menu-ui.md`, `Art/Prompt-Batches/2026-06-04-game-previs.md`, and `Art/Prompt-Batches/2026-06-05-game-og-cards.md`.
- Post-processing: generated a blurred/dimmed art backing, a right-side crisp art crop, and exact Deadrot/title/tagline/URL SVG text overlay at 1200x630.
- Notes: `Zero Day` uses the package concept image until it has a shipped game
  runtime pack.
- Decision: wired into `/games/[slug]` metadata as Open Graph and Twitter `summary_large_image` cards.

## 2026-06-05 - locked-scourge-melee-and-boss-runtime-refresh - v01

- Status: promoted into runtime.
- Game: [[Scourge-Survivors]].
- Faction: [[Scourge]].
- Character/role: Swarm Ripper / Host Grunt melee foe and Breach-Boss.
- View: front / side / back runtime billboard sprites.
- Tool: built-in `image_gen` / `gpt-image-2`.
- Plan: Codex built-in.
- Kind: ai-2d-sprite runtime refresh.
- Source output:
  - `~/.codex/generated_images/019e9847-b3ba-7de1-996b-bc342ffdd61a/ig_0470aa91021088af016a22ed9b2b6c819197f8d4b4b0ac3443.png`
  - `~/.codex/generated_images/019e9847-b3ba-7de1-996b-bc342ffdd61a/ig_0470aa91021088af016a22ee1ffd2c8191bc6029fcddaa27ad.png`
- Workspace draft: `packages/assets/games/scourge-survivors/sources/drafts/sprites/2026-06-05-locked-runtime-refresh/`.
- Final asset:
  - `packages/assets/games/scourge-survivors/enemies/scourge/host-grunt/{front,side,back}.webp`
  - `packages/assets/games/scourge-survivors/enemies/scourge/breach-boss/{front,side,back}.webp`
- Prompt source: the now-archived pre-lock bake-off recipe,
  `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp`,
  and direct review that melee foes need body-grown swords and the boss was
  being cut in-game. Historical provenance only.
- Post-processing: copied source sheets into the asset package; sliced three equal cells; removed sampled magenta key with ffmpeg `colorkey`; nearest-neighbor downscaled; padded with alpha; encoded lossless WebP.
- Notes: Melee now has sword-like bone blades grown from the forearms, not separate held weapons. Boss sprites have extra texture padding and reduced manifest sprite height so they stop filling/cutting the camera.
- Decision: promoted to runtime and mirrored to website/public sprite copies plus shared entity preview plates.

## 2026-06-05 - scourge-animation-pack - v01

- Status: generated, not yet wired into runtime.
- Game: [[Scourge-Survivors]].
- Faction: [[Scourge]].
- Character/role: Host Grunt, Spitter Host, Winged Host, Breach-Boss.
- View: front / side / back animation frames.
- Tool: built-in `image_gen` / `gpt-image-2`.
- Plan: Codex built-in.
- Kind: ai-2d-animation-sprite-sheet.
- Workspace final: retired on 2026-07-26 after enemies moved to articulated 3D
  rigs; the promoted static spitter and winged-host plates remain.
- Prompt source: `Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`.
- Post-processing: generated 3x6 action sheets; archived originals outside the
  runtime package; split into six frames per view; removed `#ff00ff` chroma key;
  nearest-neighbor downscaled; alpha padded; encoded lossless WebP.
- Notes: The pack establishes enemy readability lanes: blood-red heavy melee, chartreuse acid ranged, purple-wing lightweight flyer, and deep crimson-black massive boss.
- Decision: the 2D animation pack was later retired without a runtime consumer.
  First spitter walk frames and first winged fly frames remain promoted into the
  current runtime static sprites so the color lanes are still visible in-game.

## 2026-07-17 - scourge-dual-held-weapons - v01

- Status: promoted into runtime.
- Game: [[Scourge-Survivors]].
- Faction: [[Pyre]].
- Character/role: purpose-built akimbo pistol, SMG, shotgun, and sniper
  first-person view models.
- View: five-cell horizontal tier sheets, base through evolved.
- Tool: `gpt-image-2` via Codex built-in `image_gen`, followed by deterministic
  local alpha cleanup and WebP promotion.
- Source output:
  `~/.codex/generated_images/019f6f5c-bac3-7ac0-8881-c7cb86fe01e7/`
  (`call_azOfo1vi9G5CGlbYrWuqyOEu.png`,
  `call_KmHRV7ExZz71dOLC1x3inS1a.png`,
  `call_P08gr2NAJsBZbe2EcrjtoZpB.png`, and
  `call_t0OguipFMmAzui2qGGFamph6.png`).
- Workspace masters:
  `packages/assets/_archive/raw-generator-cache/codex-generated-images/2026-07-17/raw/019f6f5c-bac3-7ac0-8881-c7cb86fe01e7/`.
- Final asset:
  `packages/assets/games/scourge-survivors/weapons/pyre/dual/{pistol,smg,shotgun,sniper}-dual-tiers.webp`.
- Post-processing: flood-cleared the baked neutral checkerboard, normalized each
  sheet to five exact 435px tier cells, and encoded high-quality WebP with exact
  full-quality alpha.
- Notes: every cell is a new uncrossed one-weapon-per-hand pose preserving the
  approved Pyre gunmetal, bone, blood-hot, and hellfire tier progression. The
  cannon remains single-held by design.
- Decision: promoted as the only dual-bonus held-weapon art; the runtime no
  longer duplicates and mirrors the centered two-handed primary sprite.

## 2026-07-22 - starblight-hull-silhouettes - v01

- Status: approved design master; not wired into runtime.
- Game: [[Starblight]].
- Faction: [[Pyre]] and [[Wardens]].
- Character/role: four starter player hull bodies — Razor, Furnace, Bastion,
  and Shepherd.
- View: strict top-down orthographic material row plus pure-black silhouette
  proof row.
- Tool: built-in `image_gen` / `gpt-image-2`.
- Plan: Codex built-in.
- Kind: ai-2d-sprite concept and silhouette lock.
- Source output:
  `~/.codex/generated_images/019f88e6-8adb-7a72-8fd2-422f7f9281aa/exec-533f65f9-dbbf-4f44-ae99-ba8abac2136d.png`.
- Workspace source:
  `packages/assets/sources/generated/2026-07-22/games/starblight/hull-silhouettes/hull-silhouette-sheet-v01.png`.
- Approved master:
  `packages/assets/masters/sprites/starblight/hull-language-v01/hull-silhouette-sheet-v01.png`.
- Prompt source:
  `Art/Prompt-Batches/2026-07-22-starblight-hull-silhouettes.md`.
- Post-processing: source and full-sheet master are byte-identical. A 1920×1080
  gameplay-scale proof was deterministically cropped and reduced from the
  pure-black row with FFmpeg, targeting the locked `2.6 / 48 × 1080 ≈ 58 px`
  player height.
- Notes: The lower row proves four distinct pure-black reads. Human emission is
  blood/hellfire or hazard-yellow/ember; toxic green remains Scourge-only.
- Decision: lock the visual grammar and primitive-first production approach in
  `apps/games/starblight/DESIGN.md`; defer runtime body mechanics and WebP
  promotion to a separately scoped implementation.
