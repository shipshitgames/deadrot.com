#!/usr/bin/env bash
# Style bake-off — render player/foes/gameplay/website in 3 styles via codex.
# Output: <style>-<subject>.png next to this script. ~12 runs, ~1-2 min each.
# See ../Style-Bakeoff.md for the rationale. Decision: shipshitgames/shipshitgames#62
set -u
OUT="$(cd "$(dirname "$0")" && pwd)"

WORLD="World canon (identical in every image): the Scourge universe, DOOM-grade and brutal. Palette: blood #c1121f, hellfire #ff6a00, gunmetal, bone; toxic-green #8bdc1f ONLY on Scourge bio-glow; NO neon, no magenta/cyan. The Scourge is a PARASITE: ruptured host flesh, invasive tendrils, embedded toxic-green breach cores, black chitin over stolen bone/metal."

declare -A STYLE
STYLE[a-hifi]="STYLE: hi-fi STYLIZED RENDER. A rendered 3D-sculpt / AAA dark-fantasy concept-art look; believable heavy materials (wet flesh, cracked bone, rusted hell-metal) dragged through painterly grime; exaggerated heroic silhouette; one hard hellfire rim-light from a low side; deep crushed near-black shadows; internal emissive glow in mouth, eyes and wounds; near-monochrome warm grade. Cinematic and gritty, NOT photorealistic, NOT cartoon."
STYLE[b-pixel]="STYLE: CHUNKY RETRO PIXEL ART in the DOOM-1993 tradition. Bold low-resolution pixel-art sprite, roughly 96px tall, limited 16-24 color DOOM palette, hand-placed pixels, strong readable silhouette, dithered shading, gritty and grimy, clean transparent edges. Real pixel art, not a smooth image downscaled."
STYLE[c-ink]="STYLE: STYLIZED HAND-PAINTED INK (Darkest-Dungeon / Mike Mignola energy). Thick confident inked outlines, flat-to-gradient painted regions, limited DOOM palette, heavy chiaroscuro with a hellfire rim, exaggerated grotesque shapes. Premium and graphic, NOT photorealistic, NOT pixelated."

declare -A SUBJECT
SUBJECT[player]="Subject: the player hero, a PYRE PURGER (elite soldier of the Pyre, the offense faction): heavy scorched battle-armor over a flame-cauterizer rig, visored gas-mask helm, a big industrial energy rifle, scarred and battle-worn, grim and heroic. Full body, centered, forward-facing ready combat stance, near-black void background. Built for game animation: clear separable limbs and joints, even readable lighting, strong silhouette."
SUBJECT[foes]="Subject: a lineup of THREE Scourge foes side by side on a near-black void: (1) a SWARM-RIPPER, fast lean melee host-puppet with bladed bone-claws and ruptured flesh; (2) a SPITTER, bloated ranged host lobbing toxic-green bile from a swollen breach-sac; (3) a GRAFT-BREACHER, hulking elite fused with rusted hell-metal and an embedded toxic-green breach core. Clearly one parasite army. Full body, built for animation: clear limbs, readable silhouettes."
SUBJECT[game]="Subject: a first-person GAMEPLAY screenshot of a DOOM-like horde shooter: the player's gloved hands holding an industrial energy rifle low with a muzzle flash; a horde of Scourge host-puppets charging through a grimy blood-stained industrial arena lit by hellfire; a HUD with health, ammo and score in heavy uppercase; blood splatter and ember particles. Full scene, all assets integrated."
SUBJECT[web]="Subject: a website landing-page HERO MOCKUP for SHIP SHIT GAMES studio (deadrot.com): a dark brutal games gallery with a big uppercase Oswald headline, a row of game cards with cover art, a blood-red PLAY button with an ember glow, gunmetal panels on a near-black page, and a hero banner showing a Scourge breach. Desktop-browser web UI mockup."

for s in a-hifi b-pixel c-ink; do
  for sub in player foes game web; do
    OUTFILE="$OUT/$s-$sub.png"
    if [ -s "$OUTFILE" ]; then echo "skip (exists): $s-$sub"; continue; fi
    PROMPT="${STYLE[$s]} ${WORLD} ${SUBJECT[$sub]} Render one single high-quality image."
    echo ">>> $s-$sub  ->  $OUTFILE"
    codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$OUT" \
      "Generate a single high-quality PNG image and save it to $OUTFILE. Use any image-generation capability you have. The image: $PROMPT"
  done
done
echo "Done. Compare the images in $OUT"
