#!/usr/bin/env bash
# Style D — "AI-remastered 1990s DOOM" — added after the A/B/C batch (Vincent's idea).
# Run this AFTER run.sh finishes (avoid two concurrent codex sessions on one sub).
# Output: d-remaster-<subject>.png next to this script.
set -u
OUT="$(cd "$(dirname "$0")" && pwd)"

WORLD="World canon (identical in every image): the Scourge universe, DOOM-grade and brutal. Palette: blood #c1121f, hellfire #ff6a00, gunmetal, bone; toxic-green #8bdc1f ONLY on Scourge bio-glow; NO neon, no magenta/cyan. The Scourge is a PARASITE: ruptured host flesh, invasive tendrils, embedded toxic-green breach cores, black chitin over stolen bone/metal."

STYLE_D="STYLE: HIGH-DETAIL PIXEL ART (HD game sprite). TRUE pixel art on a visible square-pixel grid: hand-placed pixels, crisp hard blocky pixel edges, dithered shading, a limited DOOM palette. In the lineage of premium modern pixel-art games (Blasphemous, Dead Cells) and remastered 1990s DOOM / Amiga sprite sheets, with FAR more detail and richer dramatic lighting than chunky retro pixels, but it MUST read unmistakably as PIXEL ART: clearly pixelated, blocky, sprite-like, crunchy, made of visible pixels. ABSOLUTELY NOT a smooth 3D render, NOT photorealistic, NOT anti-aliased or airbrushed, NOT painted concept art. If it looks like a rendered 3D model or a smooth illustration it is WRONG; it must look like a high-resolution detailed GAME SPRITE built from visible pixels."

declare -A SUBJECT
SUBJECT[player]="Subject: the player hero, a PYRE PURGER (elite soldier of the Pyre, the offense faction): heavy scorched battle-armor over a flame-cauterizer rig, visored gas-mask helm, a big industrial energy rifle, scarred and battle-worn, grim and heroic. Full body, centered, forward-facing ready combat stance, near-black void background. Built for game animation: clear separable limbs and joints, even readable lighting, strong silhouette."
SUBJECT[foes]="Subject: a lineup of THREE Scourge foes side by side on a near-black void: (1) a SWARM-RIPPER, fast lean melee host-puppet with bladed bone-claws and ruptured flesh; (2) a SPITTER, bloated ranged host lobbing toxic-green bile from a swollen breach-sac; (3) a GRAFT-BREACHER, hulking elite fused with rusted hell-metal and an embedded toxic-green breach core. Clearly one parasite army. Full body, built for animation: clear limbs, readable silhouettes."
SUBJECT[game]="Subject: a first-person GAMEPLAY screenshot of a DOOM-like horde shooter: the player's gloved hands holding an industrial energy rifle low with a muzzle flash; a horde of Scourge host-puppets charging through a grimy blood-stained industrial arena lit by hellfire; a HUD with health, ammo and score in heavy uppercase; blood splatter and ember particles. Full scene, all assets integrated."
SUBJECT[web]="Subject: a website landing-page HERO MOCKUP for SHIP SHIT GAMES studio (games.shipshit.dev): a dark brutal games gallery with a big uppercase Oswald headline, a row of game cards with cover art, a blood-red PLAY button with an ember glow, gunmetal panels on a near-black page, and a hero banner showing a Scourge breach. Desktop-browser web UI mockup."

for sub in player foes game web; do
  OUTFILE="$OUT/d-remaster-$sub.png"
  if [ -s "$OUTFILE" ]; then echo "skip (exists): d-remaster-$sub"; continue; fi
  PROMPT="${STYLE_D} ${WORLD} ${SUBJECT[$sub]} Render one single high-quality image."
  echo ">>> d-remaster-$sub  ->  $OUTFILE"
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$OUT" \
    "Generate a single high-quality PNG image and save it to $OUTFILE. Use any image-generation capability you have. The image: $PROMPT"
done
echo "Done. Compare d-remaster-*.png in $OUT"
