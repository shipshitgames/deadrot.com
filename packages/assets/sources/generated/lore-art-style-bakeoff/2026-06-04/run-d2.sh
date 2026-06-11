#!/usr/bin/env bash
# Style D refinement pass — chunkier + silhouette-first + outlined detailed pixel.
# A chunkiness ladder (ripper fine/medium/bold) + more examples in that direction.
# Output: d2-<name>.png. Run after picking the detailed-pixel direction.
set -u
OUT="$(cd "$(dirname "$0")" && pwd)"

RECIPE="STYLE: HIGH-DETAIL PIXEL ART game sprite tuned for GAMEPLAY readability. TRUE pixel art on a visible chunky pixel grid: bold hand-placed pixels, hard crisp pixel edges, NO anti-aliasing, ordered dithered shading. SILHOUETTE-FIRST — a clean, instantly readable shape — with a subtle dark outline and a single hellfire rim-light from one low side so it pops off a dark background; consistent lighting direction across the set. Detailed but NOT noisy. Premium modern pixel-art (Blasphemous, Dead Cells) crossed with remastered 1990s DOOM sprites. ABSOLUTELY NOT a smooth 3D render, NOT photorealistic, NOT anti-aliased, NOT painted concept art — it MUST read as chunky pixel art made of visible square pixels."

WORLD="World canon and FIXED palette (use ONLY these colors): gunmetal grey, blood red #c1121f, hellfire orange #ff6a00, rust brown, bone #e9e3d6, near-black #0a0a0a; toxic-green #8bdc1f ONLY on Scourge bio-glow; NO neon, no blue or teal. The Scourge is a PARASITE: ruptured host flesh, invasive tendrils, embedded toxic-green breach cores, black chitin over stolen bone and metal."

# chunkiness levels
FINE="Fine pixel grid, roughly a 160px-tall sprite — many small pixels but still clearly pixelated."
MED="Medium-chunky pixel grid, roughly a 110px-tall sprite — clearly blocky visible pixels."
BOLD="Bold chunky pixel grid, roughly an 80px-tall sprite — large readable classic-sprite pixels."

RIPPER="Subject: a SWARM-RIPPER — a fast lean Scourge melee host-puppet with bladed bone-claws, ruptured flesh, a skull-like head and a toxic-green node. Full body, centered, aggressive lunging stance, near-black background, clear readable silhouette built for animation."
PURGER="Subject: the player hero, a PYRE PURGER — a lean AGILE human soldier of the Pyre (NOT a bulky space-marine): a flame-cauterizer backpack rig with hoses and a pilot-light, a stripped-down armored bodysuit (not heavy plate), a visored mask, a compact incinerator-rifle, scarred and grim. Distinctive lean silhouette. Full body, centered, ready stance, near-black background, built for animation."
SWARM="Subject: a horizontal lineup of FIVE varied Scourge rank-and-file foes (rippers, spitters, shambling husks) at the same scale on a near-black background — bold, simple, readable silhouettes that read instantly even in a crowd, clearly one parasite army."
HORDE="Subject: a first-person gameplay scene of a DOOM-like horde shooter — gloved hands and a compact incinerator-rifle held low with a muzzle flash, a SWARM of Scourge host-puppets charging through a grimy hellfire-lit industrial arena, a chunky pixel HUD with health/ammo/score, blood and embers. Stays readable with many enemies on screen."
BREACHER="Subject: a GRAFT-BREACHER — a hulking Scourge elite fused with rusted hell-metal plates and an embedded glowing toxic-green breach core in its chest, bone spurs, heavy armored arms. Full body, centered, imposing, near-black background, built for animation."
BOSS="Subject: a BREACH-HEART boss — a huge living nest of the Scourge: a pulsing toxic-green core wrapped in chitin, bone, fused metal and writhing tendrils, anchored to the ground. Imposing boss scale, centered, near-black background."

declare -A PROMPT
PROMPT[ripper-fine]="$RECIPE $FINE $WORLD $RIPPER"
PROMPT[ripper-medium]="$RECIPE $MED $WORLD $RIPPER"
PROMPT[ripper-bold]="$RECIPE $BOLD $WORLD $RIPPER"
PROMPT[purger]="$RECIPE $MED $WORLD $PURGER"
PROMPT[swarm-lineup]="$RECIPE $MED $WORLD $SWARM"
PROMPT[horde-scene]="$RECIPE $MED $WORLD $HORDE"
PROMPT[breacher-elite]="$RECIPE $MED $WORLD $BREACHER"
PROMPT[boss-breachheart]="$RECIPE $BOLD $WORLD $BOSS"

for name in ripper-fine ripper-medium ripper-bold purger swarm-lineup horde-scene breacher-elite boss-breachheart; do
  OUTFILE="$OUT/d2-$name.png"
  if [ -s "$OUTFILE" ]; then echo "skip (exists): d2-$name"; continue; fi
  echo ">>> d2-$name  ->  $OUTFILE"
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$OUT" \
    "Generate a single high-quality PNG image and save it to $OUTFILE. Use any image-generation capability you have. The image: ${PROMPT[$name]} Render one single high-quality image."
done
echo "Done. Compare d2-*.png in $OUT"
