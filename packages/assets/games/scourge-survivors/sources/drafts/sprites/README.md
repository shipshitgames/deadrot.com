# Sprite Drafts

This folder holds generated sprite probes that are not wired into the game.

Final game assets still live one level up in `src/assets/sprites/` and are imported
by `src/game/spriteAssets.ts`. Promote a draft only after the art direction and
generation history in `lore/Art/` agree that it is final.

Current draft:

- `player-ranger-front-pyre-v01-source.png`: original chroma-key source from built-in `image_gen`.
- `player-ranger-front-pyre-v01-cutout.png`: draft alpha cutout made with `ffmpeg`; not final.
- `2026-06-04-pyre-weapon-runtime/`: promoted Pyre sniper, shotgun, and cannon source/cutout PNGs; final encoded WebPs live in `src/assets/sprites/`.
- `2026-06-05-pyre-sidearm-runtime/`: promoted Pyre pistol source/cutout PNGs; final encoded WebP lives in `src/assets/sprites/weapon-pistol.webp`.
- `2026-06-05-scourge-enemy-runtime/`: promoted `gpt-image-2` Scourge melee, ranged, flying, and boss source sheets/cutouts. The high-resolution cutouts are source masters only; `*-pixel-v02.png` files are the low-resolution pixel-art runtime intermediates, and final encoded WebPs live in `src/assets/sprites/`.
- `2026-06-05-gpt-image-2-redo/`: promoted fresh `gpt-image-2` melee, ranged, and pickup source sheets plus sliced/chroma-keyed runtime PNG intermediates; final encoded WebPs live in `src/assets/sprites/`.
- `2026-06-05-locked-runtime-refresh/`: promoted locked-style melee body-blade and padded boss source sheets plus sliced/cutout/runtime PNG intermediates; final encoded WebPs live under `games/scourge-survivors/enemies/scourge/`.
