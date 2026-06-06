# 2026-06-03 Gallery Thumbnails and Menu UI

## Scope

- Six 16:9 gallery thumbnails for `deadrot.com`.
- Four Doom-inspired menu UI concept drafts for future in-game integration.

## Shared Art Rules

- Dark sci-fi action key art, high contrast, sharp silhouettes.
- Blood red, hellfire orange, rust, gunmetal, coal black, bone text.
- Toxic green is reserved for Scourge infection, breach cores, or parasite-host nodes.
- No embedded logos, no watermark, no UI text in gallery thumbnails.
- Menu drafts are reference art only; final game UI must be real DOM/React controls.

## Gallery Thumbnail Results

| Game | Source Output | Workspace Asset | Notes |
| --- | --- | --- | --- |
| Scourge Survivors | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a1e4cc008191b1c35c52eba5a21d.png` | `shipshitgames/apps/web/public/images/games/scourge-survivors.jpg` | FPS horde arena with Scourge parasite-host pressure. |
| Deadlane | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a26923548191a03d1f85128b2e69.png` | `shipshitgames/apps/web/public/images/games/deadlane.jpg` | Elevated tower-defense lane with Warden fortification read. |
| Pactfall | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a2a591748191af940b408d75de70.png` | `shipshitgames/apps/web/public/images/games/pactfall.jpg` | Pyre/Warden standoff around neutral Scourge objective. |
| Starblight | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a321169c8191ae1d2dcf6410351d.png` | `shipshitgames/apps/web/public/images/games/starblight.jpg` | Arcade fighter against voidship parasite craft. |
| Redline | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a36af3908191880877bb0987ac00.png` | `shipshitgames/apps/web/public/images/games/redline.jpg` | Courier route chased by Scourge infection. |
| Rothulk | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a3a4451881918dab1321e5271666.png` | `shipshitgames/apps/web/public/images/games/rothulk.jpg` | Side-view infiltration through a living Scourge bio-ship. |

## Menu UI Draft Results

| Draft | Source Output | Workspace Draft | Integration Notes |
| --- | --- | --- | --- |
| Main menu | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a40d9ad081918b94522df5523e76.png` | `lore/Art/UI-Drafts/2026-06-03-doom-menu-concepts/main-menu.png` | Reference for title screens and primary action hierarchy. |
| Deployment/loadout | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a4542a008191aeaa6b5ab33d85cc.png` | `lore/Art/UI-Drafts/2026-06-03-doom-menu-concepts/deployment-loadout.png` | Reference for mode select, character choice, and loadout panels. |
| Upgrade choice | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a4fffc2c8191a04ec39eeec323b4.png` | `lore/Art/UI-Drafts/2026-06-03-doom-menu-concepts/upgrade-choice.png` | Reference for survivors-loop upgrade picks across games. |
| Pause/settings | `/Users/decod3rslabs/.codex/generated_images/019e8d78-c835-7241-82b7-8c7318721b14/ig_04c7196def12859c016a20a5ab16a08191af2e349a20f5c842.png` | `lore/Art/UI-Drafts/2026-06-03-doom-menu-concepts/pause-settings.png` | Reference for pause overlays, settings rows, toggles, sliders, and keybind chips. |

## Integration Rule

Do not use the UI concept PNGs as clickable menu screens. Use them as art direction for:

- React components in `scourge-survivors` and the web gallery.
- Plain DOM/CSS overlays in `deadlane`, `pactfall`, `starblight`, `redline`, and `rothulk`.
- Optional generated background plates/icons only, behind real accessible controls.
