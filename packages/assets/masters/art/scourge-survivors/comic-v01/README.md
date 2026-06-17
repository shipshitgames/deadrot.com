# Scourge Survivors Comic Style v01

Generated/curated: 2026-06-17

Purpose: comic/cel-shaded exploration for Scourge Survivors foes, weapons, arena materials, and combat UI direction.

Enemy override status: enabled as an opt-in runtime test pack through
`VITE_DEADROT_COMIC_ASSETS=1`. The current `scourge-comic` enemy files are
playable exploration assets for silhouette, color-lane, and readability testing;
they are not the final production master pass.

Weapon override status: disabled. Keep the current playable weapon assets until
the comic pack has real FPS view-model masters.

Arena material override status: disabled. Cropping combat/key art into wall,
floor, block, or column textures is rejected. Arena materials need image-model
generated material sheets or authored texture masters for the specific runtime
surface role.

Weapon master rule:

- First-person/player-view weapon masters must include the player's armored
  hands, gloves, wrists, and forearms. Trigger hand and support hand must make
  believable contact with the weapon.
- No-hands weapon sheets are only object masters for codex cards, loot pickups,
  inventory icons, or isolated package art.
- A visible barrel-only cannon or floating gun object is not a playable FPS
  view-model master.
- A magenta-background lineup of held guns is also not a playable FPS master.
  It fails if the camera framing, grip contact, bottom-screen crop, and per-weapon
  export contract are not usable directly by the game.

Enable in-game with:

```bash
VITE_DEADROT_COMIC_ASSETS=1 bun run dev
```

Notes:

- The concept masters are the art target.
- Enemy runtime override uses the current `scourge-comic` test pack so the game
  can validate the direction now. Still generate new high-resolution
  image-model turnarounds before locking production foe masters.
- Weapon runtime override is intentionally disabled until a better master pass exists.
- Arena runtime override is intentionally disabled until real material sheets
  exist. Do not treat cropped illustrations as wall/floor textures.
