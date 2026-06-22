---
status: active
type: style-validation
feeds: DECISION shipshitgames/shipshitgames#62
---

# Style Bake-Off — validate the house look before locking it

Goal: pick the render style for the **whole universe** (one look, six cameras) by
**looking**, not reading. We render the same four subjects — **player · foes ·
gameplay scene · website** — in **three candidate styles**, holding the world
canon constant so the only variable is the render style. Then judge on
**look × animatability** (Redline + Rothulk need real 2D frame animation).

Each prompt is self-contained (codex has no shared memory between runs):
`WORLD CANON` + one `STYLE CARD` + one `SUBJECT` + an output instruction.

## World canon (identical in every image)

> The **Scourge** universe — DOOM-grade, brutal. Palette: blood `#c1121f`,
> hellfire `#ff6a00`, gunmetal, bone; **toxic-green `#8bdc1f` only** on Scourge
> bio-glow. **NO neon, no magenta/cyan.** The Scourge is a **parasite**: ruptured
> host flesh, invasive tendrils, embedded toxic-green breach cores, black chitin
> over stolen bone/metal.

## The three style cards

**STYLE A — HI-FI STYLIZED RENDER** (the current doc lock)
> Rendered 3D-sculpt / AAA dark-fantasy concept-art look; believable heavy
> materials (wet flesh, cracked bone, rusted hell-metal) dragged through painterly
> grime; exaggerated heroic silhouette; one hard hellfire rim-light from a low
> side; deep crushed near-black shadows; internal emissive glow in mouth/eyes/
> wounds; near-monochrome warm grade. Cinematic, gritty — NOT photoreal, NOT
> cartoon.
> **Animatability: HARDEST.** Best static/billboard; frame animation is expensive —
> animate via billboard bob/scale + 8-frame pre-rendered turntables only.

**STYLE B — CHUNKY RETRO PIXEL** (DOOM-1993 lineage)
> Bold low-resolution pixel-art sprite, ~96px tall, limited 16–24 color DOOM
> palette, hand-placed pixels, strong readable silhouette, dithered shading,
> gritty and grimy, clean transparent edges.
> **Animatability: EASIEST.** Small frame sheets, classic 4–8 frame cycles, tiny
> files — the most animation-friendly across all three games.

**STYLE C — STYLIZED HAND-PAINTED INK** (Darkest-Dungeon / Mignola energy)
> Bold illustrated look: thick confident inked outlines, flat-to-gradient painted
> regions, limited DOOM palette, heavy chiaroscuro with a hellfire rim,
> exaggerated grotesque shapes. Premium and graphic — not photoreal, not pixelated.
> **Animatability: MEDIUM-EASY.** Flat inked regions + separable shapes animate
> cleanly with limited frames and squash/stretch — a strong look/animation balance.

**STYLE D — HIGH-DETAIL / HD PIXEL ART** (Vincent's idea — likely the sweet spot)
> **TRUE pixel art on a visible pixel grid**, but high-detail and richly lit —
> *Blasphemous / Dead Cells* + remastered 1990s DOOM/Amiga sprite sheets. Far more
> detail and drama than chunky Style B, but **still unmistakably pixelated** —
> blocky, crunchy, made of visible pixels. NOT a smooth 3D render (that's the v1
> mistake that made it a clone of Style A), NOT painted, NOT photoreal.
> **Animatability: EASY.** The look *is* pre-rendered sprite frames — render the
> model across frames/angles exactly like the originals; the retro coarseness
> hides frame-to-frame drift that wrecks hi-fi animation. **Most of A's richness
> with most of B's animatability**, and it's the most authentic DOOM lineage.
> Rendered by `run-d.sh` (after the A/B/C batch) → `d-remaster-*.png`.

## The four subjects

**PLAYER** — the player hero, a **PYRE PURGER** (elite soldier of the Pyre, the
offense faction): heavy scorched battle-armor over a flame-cauterizer rig, visored
gas-mask helm, a big industrial energy rifle, scarred and battle-worn, grim and
heroic. Full body, centered, forward-facing ready combat stance, near-black void
background. **Built for game animation: clear separable limbs and joints, even
readable lighting, strong silhouette.**

**FOES** — a lineup of **three Scourge foes** side by side on a near-black void:
(1) a **SWARM-RIPPER**, fast lean melee host-puppet with bladed bone-claws and
ruptured flesh; (2) a **SPITTER**, bloated ranged host lobbing toxic-green bile
from a swollen breach-sac; (3) a **GRAFT-BREACHER**, hulking elite fused with
rusted hell-metal and an embedded toxic-green breach core. Clearly one parasite
army. Full body, **built for animation: clear limbs, readable silhouettes.**

**GAMEPLAY** — a first-person gameplay screenshot of a DOOM-like horde shooter:
the player's gloved hands holding an industrial energy rifle low with a muzzle
flash; a horde of Scourge host-puppets charging through a grimy blood-stained
industrial arena lit by hellfire; a HUD with health / ammo / score in heavy
uppercase; blood splatter and ember particles. **Full scene, all assets integrated.**

**WEBSITE** — a website landing-page hero mockup for **SHIP SHIT GAMES** studio
(deadrot.com): a dark brutal games gallery — big uppercase Oswald headline,
a row of game cards with cover art, a blood-red **PLAY** button with an ember glow,
gunmetal panels on a near-black page, a hero banner showing a Scourge breach.
Desktop-browser web UI mockup.

## Run it (codex, your ChatGPT sub — no API key)

`run.sh` (next to this file) renders all 12 into `style-bakeoff/`:

```bash
bash lore/Art/style-bakeoff/run.sh
```

Then open `lore/Art/style-bakeoff/` and compare. Each filename is `<style>-<subject>.png`.

## Judge, then lock

Score each style on: **(1)** does it look amazing per-asset, **(2)** does the
roster stay coherent, **(3)** can Redline/Rothulk actually animate it cheaply.
Pick one. Locking it = edit the `assetgen:` block + Style-Bible prose, then
`bun assetgen tokens` re-flows every game at once. Record the verdict on
shipshitgames/shipshitgames#62.
