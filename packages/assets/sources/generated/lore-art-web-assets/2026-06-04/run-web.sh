#!/usr/bin/env bash
# Pixel website key-art in the LOCKED house style (#62): hero + 6 game covers.
# Output: <name>.png next to this script. Wire into apps/web after review.
set -u
OUT="$(cd "$(dirname "$0")" && pwd)"

RECIPE="STYLE: detailed PIXEL ART key art / game cover on a medium-chunky visible pixel grid — bold hand-placed pixels, hard crisp edges, NO anti-aliasing, ordered dithering, rich dramatic lighting. Fixed DOOM palette: gunmetal, blood red #c1121f, hellfire orange #ff6a00, rust, bone, near-black; toxic-green #8bdc1f ONLY for Scourge bio-glow; NO neon. Premium modern pixel art (Blasphemous, Dead Cells) crossed with remastered 1990s DOOM. ABSOLUTELY NOT a smooth 3D render, NOT photorealistic, NOT anti-aliased — it MUST read as chunky pixel art made of visible pixels."

declare -A SUBJECT
SUBJECT[hero]="Subject: a WIDE hero banner splash for the SHIP SHIT GAMES studio — a towering Scourge breach erupting tendrils and toxic-green light over a ruined hellfire-lit industrial battlefield, a lone Pyre soldier silhouetted small against it. Epic wide cinematic key-art, no text."
SUBJECT[cover-scourge-survivors]="Subject: a vertical GAME COVER for a first-person horde shooter — a Pyre Purger blasting an incinerator-rifle into a charging swarm of Scourge host-puppets in a bloody hellfire arena. Dynamic, no text."
SUBJECT[cover-deadlane]="Subject: a vertical GAME COVER for a tower-defense game — Warden gun-towers and walls holding a narrow lane against a flood of Scourge creeps, dramatic high angle. No text."
SUBJECT[cover-pactfall]="Subject: a vertical GAME COVER for a MOBA — a Pyre champion and a Warden champion back-to-back against a neutral Scourge threat in an arena. No text."
SUBJECT[cover-starblight]="Subject: a vertical GAME COVER for an arcade space shooter — a lone starfighter weaving through a swarm of Scourge spores and an infected voidship in orbit over a dying world. No text."
SUBJECT[cover-redline]="Subject: a vertical GAME COVER for a high-speed runner — a courier in light armor sprinting down a collapsing industrial corridor, a wall of Scourge rot surging behind, strong sense of speed. No text."
SUBJECT[cover-rothulk]="Subject: a vertical GAME COVER for a platformer — a lone infiltrator leaping between fleshy chitin platforms inside a living Scourge bio-ship toward a glowing toxic-green core. No text."

for name in hero cover-scourge-survivors cover-deadlane cover-pactfall cover-starblight cover-redline cover-rothulk; do
  OUTFILE="$OUT/$name.png"
  if [ -s "$OUTFILE" ]; then echo "skip (exists): $name"; continue; fi
  echo ">>> $name  ->  $OUTFILE"
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$OUT" \
    "Generate a single high-quality PNG image and save it to $OUTFILE. Use any image-generation capability you have. The image: ${RECIPE} ${SUBJECT[$name]} Render one single high-quality image."
done
echo "Done. Pixel web art in $OUT"
