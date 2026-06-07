# Asset Credits

## 2026-06-07 - built-in imagegen arena prop sprite refresh

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Role: high-detail map-specific world prop sprites for Ashgate, the Hollow Lanes, the Maw, and Perdition.
- Tool: built-in `image_gen`.
- Plan: Codex generated map prop sprite refresh.
- Kind: generated 2D arena prop sprite textures on magenta chroma-key source backgrounds.
- Source outputs: `/Users/decod3rslabs/.codex/generated_images/019ea18a-f008-73e0-9699-b9fac6df8a02/`.
- Final assets: `textures/arenas/{ashgate,hollowlanes,maw,perdition}/prop.webp`.
- Post-processing: keyed `#ff00ff` backgrounds to alpha, trimmed/padded to square, downscaled to 512x512, removed edge key fringe, and encoded lossless WebP.
- Notes: Replaces the procedural prop placeholder sprites that read as UI icon plates in-world.

## 2026-06-07 - Pyre weapon pickup sprite refresh

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Role: floor/world weapon pickup sprites for pistol, SMG, shotgun, cannon, and sniper.
- Tool: built-in `image_gen`.
- Plan: Codex generated weapon pickup sprite refresh.
- Kind: generated 2D Pyre weapon world pickup sprites on magenta chroma-key source backgrounds.
- Source outputs: `/Users/decod3rslabs/.codex/generated_images/019ea18a-f008-73e0-9699-b9fac6df8a02/`.
- Final assets: `weapons/pyre/pickups/{pistol,smg,shotgun,cannon,sniper}.webp`.
- Post-processing: keyed `#ff00ff` backgrounds to alpha, trimmed/padded to square, downscaled to 512x512, removed edge key fringe, and encoded lossless WebP.
- Runtime note: floor weapon pickups now use hand-free world sprites; first-person equipped weapons continue to use `weapons/pyre/{pistol,smg,shotgun,cannon,sniper}.webp`.

## 2026-06-06 - authored breach-arena texture sets

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Role: map-specific floor, wall, block, column, decal, and prop sprite textures for Ashgate, the Hollow Lanes, the Maw, and Perdition.
- Tool: deterministic local procedural texture generator plus `cwebp`.
- Plan: Codex local generation.
- Kind: generated seamless-ish 512x512 WebP tiling textures, floor decal plates, and transparent arena prop sprite plates.
- Source note: generated from the material palettes and pattern recipe documented under `textures/arenas/README.md`.
- Final assets:
  - `textures/arenas/ashgate/{floor,wall,block,column,decal,prop}.webp`
  - `textures/arenas/hollowlanes/{floor,wall,block,column,decal,prop}.webp`
  - `textures/arenas/maw/{floor,wall,block,column,decal,prop}.webp`
  - `textures/arenas/perdition/{floor,wall,block,column,decal,prop}.webp`
- Notes: Replaces the tint-only map read with authored material lanes while keeping the current v1 arena collision footprint unchanged.

## 2026-06-04 - Press Start 2P font

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Role: pixel title/menu display font.
- Creator: CodeMan38.
- Source: Google Fonts, Press Start 2P.
- License: SIL Open Font License 1.1.
- Final asset: `src/assets/fonts/press-start-2p.ttf`.

## 2026-06-04 - Pyre first-person weapon set

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: The Pyre, sniper / shotgun / cannon weapon sprites.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D first-person weapon sprites.
- Source outputs: `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/`.
- Workspace draft folder: `src/assets/sprites/drafts/2026-06-04-pyre-weapon-runtime/`.
- Final assets: `src/assets/sprites/weapon-sniper.webp`, `src/assets/sprites/weapon-shotgun.webp`, `src/assets/sprites/weapon-cannon.webp`.
- Prompt source: sibling `lore` repo `DESIGN.md`, `Games/Scourge-Survivors.md`, and Pyre palette/canon rules.
- Post-processing: generated on magenta chroma-key background, removed with the bundled imagegen chroma-key helper, then encoded to lossless WebP with `cwebp -lossless -exact`.
- Notes: Replaces legacy cyan/pink cyber-gun sprites with Pyre-compatible blackened gunmetal, bone, blood red, and hellfire orange weapon art. Sniper and cannon were revised to `v02` on 2026-06-05 so the sniper reads as a long marksman weapon and the cannon muzzle clearly points forward.

## 2026-06-05 - weapon-pistol-pyre-v01

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: The Pyre, default sidearm / pistol weapon sprite.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D first-person weapon sprite.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_07e0e3d430cc82a3016a227f11523c8191807cdb3830854dfa.png`.
- Workspace draft folder: `src/assets/sprites/drafts/2026-06-05-pyre-sidearm-runtime/`.
- Final asset: `src/assets/sprites/weapon-pistol.webp`.
- Prompt source: user direction for a Pyre sidearm default plus Pyre palette/canon rules.
- Post-processing: generated on magenta chroma-key background, removed with the bundled imagegen chroma-key helper, then encoded to lossless WebP with `cwebp -lossless -exact`.
- Notes: Establishes the pistol as the base/default weapon so the long marksman sprite can stay a scoped sniper instead of pretending to be the default gun.

## 2026-06-05 - Scourge enemy sprite refresh

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: Scourge melee host, ranged spitter, flying host, and boss billboard sprites.
- Tool: `gpt-image-2` via built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D enemy sprite sheets.
- Source outputs: `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_0fa54e31be871759016a228f47e27c8191b82af19d7dc11c73.png`, `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_0fa54e31be871759016a22901e29a081918cd60c25b3ce340a.png`, `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_019e874c3e306b3d016a22a851c3c88198b6058191c709624b.png`, `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_019e874c3e306b3d016a22a800be588198940edec6f5168db2.png`.
- Workspace draft folders: `src/assets/sprites/drafts/2026-06-05-scourge-enemy-runtime/`, `src/assets/sprites/drafts/2026-06-05-gpt-image-2-redo/`.
- Final assets: `src/assets/sprites/enemy-melee.webp`, `src/assets/sprites/enemy-melee-side.webp`, `src/assets/sprites/enemy-melee-back.webp`, `src/assets/sprites/enemy-ranged.webp`, `src/assets/sprites/enemy-ranged-side.webp`, `src/assets/sprites/enemy-ranged-back.webp`, `src/assets/sprites/enemy-flying.webp`, `src/assets/sprites/enemy-flying-side.webp`, `src/assets/sprites/enemy-flying-back.webp`, `src/assets/sprites/boss.webp`, `src/assets/sprites/boss-side.webp`, `src/assets/sprites/boss-back.webp`.
- Prompt source: user direction that current enemy sprites are outdated plus Scourge canon rules from this repo and sibling lore.
- Post-processing: generated on magenta chroma-key background, split into front/side/back columns, removed with the bundled imagegen chroma-key helper, and trimmed into high-resolution source cutouts. Runtime WebPs were then downscaled into low-resolution pixel-art sprites, palette-reduced, hard-alpha padded, given a one-pixel readability outline, and encoded lossless with `cwebp -lossless -exact`.
- Runtime note: the high-resolution sheets and cutouts stay in the draft folder as source masters; `assets.json` marks the enemy families with `filter: "nearest"` so the game displays the low-resolution textures without smoothing.
- Notes: Replaces clean armored/mech enemies with Scourge host-takeover art and adds the flying enemy sprite family. The flying enemy explicitly avoids Starblight ship/craft silhouettes. Melee and ranged were regenerated with fresh `gpt-image-2` source sheets on 2026-06-05 so melee reads as a broad claw brute and ranged reads as a hunched toxic acid-spitter.

## 2026-06-05 - locked Scourge melee and boss runtime refresh

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: Scourge melee host and breach boss billboard sprites.
- Tool: `gpt-image-2` via built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D enemy sprite sheets in the locked medium-chunky pixel style.
- Source outputs:
  - `/Users/decod3rslabs/.codex/generated_images/019e9847-b3ba-7de1-996b-bc342ffdd61a/ig_0470aa91021088af016a22ed9b2b6c819197f8d4b4b0ac3443.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e9847-b3ba-7de1-996b-bc342ffdd61a/ig_0470aa91021088af016a22ee1ffd2c8191bc6029fcddaa27ad.png`
- Workspace draft folder: `sources/drafts/sprites/2026-06-05-locked-runtime-refresh/`.
- Final assets: `enemies/scourge/host-grunt/{front,side,back}.webp`, `enemies/scourge/breach-boss/{front,side,back}.webp`.
- Prompt source: `apps/lore/content/Art/style-bakeoff/run-d2.sh`, `apps/lore/content/Art/style-refs/scourge-survivors.webp`, and user direction that melee foes need body-grown swords and the boss is getting cut in-game.
- Post-processing: generated as three-view sheets on sampled magenta chroma-key, split into front/side/back cells, keyed with ffmpeg `colorkey`, nearest-neighbor downscaled, padded with alpha, and encoded lossless with `cwebp -lossless -exact`.
- Runtime note: melee host sprites are now 128x128 with clear forearm-grown bone sword blades. Boss sprites are now padded 128x180 plates with corrected in-world sprite scale in `assets.json`, preventing the boss art from filling/cutting against the camera while keeping boss mass.
- Notes: Website sprite mirrors and the shared entity preview plates for `scourge-swarm` and `breach-boss` were refreshed from these runtime sprites.

## 2026-06-05 - Scourge enemy animation pack v01

- Status: generated and wired into runtime.
- Game: Scourge Survivors.
- Faction / role: Scourge host-grunt, spitter-host, winged-host, and breach-boss animation frames.
- Tool: `gpt-image-2` via built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D animation sprite sheets and extracted WebP frames.
- Prompt source: `apps/lore/content/Art/Prompt-Batches/2026-06-05-scourge-animation-pack.md`.
- Workspace assets: `animations/scourge/`.
- Actions:
  - `host-grunt`: `walk`, `slash`, `death`.
  - `spitter-host`: `walk`, `spit`, `death`.
  - `winged-host`: `fly`, `attack`, `death`.
  - `breach-boss`: `lurch`, `barrage`, `death`.
- Readability lanes: melee stays blood-red and heavy, spitter is acid chartreuse and twitchy, flyer has bruised purple membranes and hover physics, boss is deep crimson-black with heavy inertia.
- Post-processing: generated 3x6 sheets, copied source sheets into each action folder, split into front/side/back six-frame strips, removed `#ff00ff` chroma key, nearest-neighbor downscaled, alpha padded, and encoded lossless with `cwebp -lossless -exact`.
- Runtime note: non-boss frames are 128x128; boss frames are 128x180 to keep the boss crop/padding fix.
- Promotion note: the first spitter walk frames and first winged fly frames were also promoted into the current runtime `spitter-host` and `winged-host` static sprites so the color lanes are visible in-game before the animation renderer is wired.

## 2026-06-06 - Winged host green-key regeneration

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: Scourge winged-host static and animation frames.
- Tool: `gpt-image-2` via built-in `image_gen`.
- Kind: regenerated 2D animation sprite sheets on flat `#00ff00` chroma-key backgrounds.
- Source outputs:
  - `/Users/decod3rslabs/.codex/generated_images/019e9c96-23f7-7883-a5d9-fa73fe4ca167/ig_0b32ccf368593783016a2408866ae08191b69a47a9f1b4a2b3.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e9c96-23f7-7883-a5d9-fa73fe4ca167/ig_0b32ccf368593783016a2409e1f880819180319ad68be9d57a.png`
  - `/Users/decod3rslabs/.codex/generated_images/019e9c96-23f7-7883-a5d9-fa73fe4ca167/ig_0b32ccf368593783016a240a39531881919a7bca0fb13e96ec.png`
- Workspace source sheets: `animations/scourge/winged-host/{fly,attack,death}/source/sheet.png`.
- Final assets: `enemies/scourge/winged-host/{front,side,back}.webp`, `animations/scourge/winged-host/**/frame-*.webp`.
- Post-processing: split 3x6 sheets, square-padded each cell, keyed only the green background, hardened alpha, removed visible green key pixels, filled transparent RGB from neighboring foreground pixels, and encoded lossless WebP with `cwebp -lossless -exact`.
- Runtime note: winged-host frames stay as 128x128 transparent square plates so animation anchors, billboard scale, and wing-motion negative space remain stable. Bruised purple is retained as the flyer wing readability lane; purple, white, and green are not retained as rectangular matte/borders.

## 2026-06-05 - Scourge blood pickup sprite set

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Role: health, ammo, damage bonus, dual weapon, and XP/ichor pickup sprites.
- Tool: `gpt-image-2` via built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D pixel sprite sheet.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e9483-c89c-7be0-a448-32cfa1e7738c/ig_019e874c3e306b3d016a22a88aadcc8198bd356dd1d31fb189.png`.
- Workspace draft folder: `src/assets/sprites/drafts/2026-06-05-gpt-image-2-redo/`.
- Final assets: `src/assets/sprites/pickup-health.webp`, `src/assets/sprites/pickup-ammo.webp`, `src/assets/sprites/pickup-damage.webp`, `src/assets/sprites/pickup-dual.webp`, `src/assets/sprites/pickup-xp-blood.webp`.
- Post-processing: generated on magenta chroma-key background, split into five item cells, chroma-keyed, downscaled into 64x64 runtime pixel sprites, hard-alpha padded, and encoded lossless with `cwebp -lossless -exact`.
- Notes: Replaces generic pickup art/mesh gems with blood vial, bone ammo, blood-rage bonus, dual blood-energy core, and Scourge ichor XP shard pickups.

## 2026-06-04 - weapon-smg-pyre-firstperson-v04

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: The Pyre, SMG weapon sprite.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D pixel-art sprite.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e9397-d391-7fa1-8dda-cb63905e6288/ig_0f5b7488d608cdb8016a21b89606288191ba1b6b09c8184dea.png`.
- Workspace draft source: `src/assets/sprites/drafts/2026-06-04-pixel-runtime-candidates/weapon-smg-pyre-firstperson-v04-source.png`.
- Workspace draft cutout: `src/assets/sprites/drafts/2026-06-04-pixel-runtime-candidates/weapon-smg-pyre-firstperson-v04-cutout.png`.
- Final asset: `src/assets/sprites/weapon-smg.webp`.
- Prompt source: sibling `lore` repo `DESIGN.md`, `Games/Scourge-Survivors.md`, and Pyre palette/canon rules.
- Post-processing: generated on chroma-key background, removed with the bundled imagegen chroma-key helper, then encoded to lossless WebP with `cwebp -lossless -exact`.
- Notes: This replaces the previous clean neon/cyberpunk SMG with a Pyre-compatible first-person hand-and-weapon sprite using blackened gunmetal, bone, blood, and hellfire.

## 2026-06-04 - muzzle-flash-pyre-v01

- Status: promoted into runtime.
- Game: Scourge Survivors.
- Faction / role: The Pyre, weapon muzzle flash effect.
- Tool: built-in `image_gen`.
- Plan: Codex built-in.
- Kind: generated 2D pixel-art VFX sprite.
- Source output: `/Users/decod3rslabs/.codex/generated_images/019e9397-d391-7fa1-8dda-cb63905e6288/ig_0f5b7488d608cdb8016a21bbd71d8c8191aa78e7ff16a306a0.png`.
- Workspace draft source: `src/assets/sprites/drafts/2026-06-04-pixel-runtime-candidates/muzzle-flash-pyre-v01-source.png`.
- Workspace draft cutout: `src/assets/sprites/drafts/2026-06-04-pixel-runtime-candidates/muzzle-flash-pyre-v01-cutout.png`.
- Final asset: `src/assets/sprites/muzzle-flash-pyre.webp`.
- Prompt source: Pyre palette/canon rules from the sibling `lore` repo `DESIGN.md`.
- Post-processing: generated on chroma-key background, removed with the bundled imagegen chroma-key helper, scaled to 256x256, then encoded to lossless WebP with `cwebp -lossless -exact`.
- Notes: Replaces the prior flat square muzzle flash with a directional bone-white, blood-hot, and hellfire pixel-art burst.
