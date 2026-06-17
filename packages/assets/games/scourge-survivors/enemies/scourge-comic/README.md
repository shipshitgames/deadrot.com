# Scourge Comic Runtime Foes

First playable comic-style exploration pack for Scourge Survivors.

These WebPs preserve the existing enemy sprite dimensions/views and are selected through `VITE_DEADROT_COMIC_ASSETS=1`.
They are derived from the current transparent runtime sprites with ink-outline, posterized color, and stronger toxic green readability.

Status: opt-in runtime test pack, not production master output.

Coverage:

- `host-grunt`: melee / basic foe.
- `spitter-host`: ranged acid foe.
- `winged-host`: flying foe.
- `breach-boss`: boss test silhouette.

Next required pass: new image-model comic/cel-shaded master turnarounds at
higher source resolution, then a fresh front/side/back runtime extraction. This
folder exists so the game can test readability and color lanes now.
