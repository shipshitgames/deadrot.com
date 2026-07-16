# Scourge Comic Runtime Animations

Parallel animation pack for `animations/scourge`.

The asset catalog routes animation frame URLs here when `VITE_DEADROT_COMIC_ASSETS=1`, preserving the existing animation manifest and frame timing.

Status: opt-in runtime test pack with a production Breach-Boss static pose. It
follows the same frame counts, actions, and view names as the default
`animations/scourge` pack so the game can swap it without gameplay code
changes. The Breach-Boss action slots deliberately repeat its production pose
until authored comic action sheets replace them.

Next required pass: regenerate true comic/cel-shaded source animation sheets
from new high-resolution foe masters, then split and promote them through the
normal WebP runtime pipeline.
