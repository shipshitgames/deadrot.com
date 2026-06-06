# 2026-06-05 - Scourge Animation Pack

Purpose: first-pass animation sprite sheets for Scourge Survivors foes using the locked medium-chunky pixel-art direction and existing runtime front / side / back sprites as visual references.

Tool path: built-in `image_gen`, `gpt-image-2`.

CLI note: `OPENAI_API_KEY` was not present in the local environment, so the direct CLI/API edit path could not be used. Existing runtime sprites were loaded as visual references before built-in generation.

Shared constraints for every prompt:

- Use the visible reference sheet as the identity/model sheet.
- Preserve the exact creature identity, silhouette family, palette, and pixel-art rendering style.
- Locked style: medium-chunky detailed pixel art, visible pixel grid, DOOM-like dark horror palette, bone/off-white skull plates, wet red flesh, blackened sinew/armor, toxic green glow, tiny hellfire orange rim accents.
- Foe readability lanes:
  - Host Grunt: blood-red flesh, black sinew, bone sword blades, small toxic green core. Physics: heavy grounded lurch, blade-weight drag, big shoulder sway.
  - Spitter Host: sickly chartreuse / acid yellow-green sacs and throat glow, ochre infected flesh, darker limbs. Physics: twitchy ranged scuttle, elastic throat/sac swelling, recoil after spit.
  - Winged Host: bruised violet / purple wing membranes, red-black body, bone tips, small toxic green organs. Physics: lightweight hover bob, fast wing-beat arcs, diving snap.
  - Breach Boss: deep crimson-black mass, large bone skull plates, bright toxic green cores, orange hell-rim accents. Physics: massive slow inertia, tendril lag, heavy torso compression.
- Keep shading physics consistent across all foes: same top-left/key light, same dark undersides, same crisp pixel outline, same material response for wet flesh, bone, black sinew, and toxic glow.
- Output a clean animation sprite sheet: 3 rows by 6 columns, exactly 18 cells.
- Row 1 is front view, row 2 is side view, row 3 is back view.
- Columns are sequential animation frames from left to right.
- One creature per cell, centered, same approximate size and foot/hover anchor per row.
- Perfect flat solid `#ff00ff` chroma-key background in every cell.
- Do not use `#ff00ff` in the creature. No shadows, no floor plane, no text, no labels, no UI, no watermark.
- No camera movement, no perspective scene, no extra creatures, no props unless the action explicitly emits an attack effect.

## Host Grunt - Walk

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge host grunt. The action is a lurching heavy walk cycle. Keep the forearm-grown bone sword blades attached to the arms in every frame, never held as separate weapons. Show weight shift, hunched shoulders, dragging tendrils, and clawed feet stepping. Loopable cycle; frame 6 should lead naturally back to frame 1.

Color and physics lane: blood-red melee brute, black sinew, bone blades, tiny toxic green core; heavy grounded lurch with blade-weight drag.

## Host Grunt - Slash

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge host grunt. The action is a melee slash attack using body-grown forearm bone sword blades. Frames: windup, torso twist, blade extension, slash impact, follow-through, recovery. The blades must grow from the arms, not be handheld swords. Add only subtle orange/bone slash energy that stays inside the cell.

Color and physics lane: blood-red melee brute, black sinew, bone blades, tiny toxic green core; broad heavy shoulder-driven slash with blade-weight follow-through.

## Host Grunt - Death

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge host grunt. The action is a death collapse. Frames: hit shock, chest glow rupture, knees buckling, body tearing open, collapse, inert remains. Keep the same silhouette and palette while the body breaks down into flesh, bone fragments, black sinew, and fading toxic green glow.

Color and physics lane: blood-red melee brute, black sinew, bone blades, tiny toxic green core; heavy body mass collapses downward rather than popping apart.

## Spitter Host - Walk

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge spitter host. The action is a hunched ranged-creature scuttle/walk cycle. Preserve the acid sac, toxic green core, thin sinewy limbs, and infected host anatomy. It should feel cautious and ranged: backward-leaning, side-stepping, twitchy, and ready to spit. Loopable cycle.

Color and physics lane: sickly chartreuse / acid yellow-green sacs and throat glow, ochre infected flesh, darker limbs; twitchy ranged scuttle with elastic sac jiggle.

## Spitter Host - Spit

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge spitter host. The action is a ranged acid-spit attack. Frames: throat/torso sac swelling, head pulling back, green core charging, mouth/vent opening, toxic projectile leaving the body, recoil/recovery. The projectile can appear only in the attack frames and must stay inside the cell.

Color and physics lane: sickly chartreuse / acid yellow-green sacs and throat glow, ochre infected flesh, darker limbs; elastic sac swelling and visible recoil after spit.

## Spitter Host - Death

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge spitter host. The action is a toxic rupture death. Frames: hit shock, acid sac swelling, green split, torso bursting, limbs folding, inert dissolved corpse. Use toxic green glow and small flesh/bone fragments, no large explosion.

Color and physics lane: sickly chartreuse / acid yellow-green sacs and throat glow, ochre infected flesh, darker limbs; internal pressure ruptures the acid organs, then the body folds in.

## Winged Host - Fly

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge winged host. The action is a hovering fly/flap loop. Preserve infected organic wings, host body, bone/flesh palette, and toxic glow. The body bobs slightly while wings beat through a readable loop. No spaceship, aircraft, drone, or mechanical silhouette.

Color and physics lane: bruised violet / purple wing membranes, red-black body, bone tips, small toxic green organs; lightweight hover bob and fast wing-beat arcs.

## Winged Host - Attack

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge winged host. The action is a diving claw/acid attack. Frames: hover windup, wings pull tight, forward dive, claw/spit strike, recoil, return to hover. Keep it organic and infected, never ship-like.

Color and physics lane: bruised violet / purple wing membranes, red-black body, bone tips, small toxic green organs; quick diving snap with wing recoil.

## Winged Host - Death

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge winged host. The action is a wing-torn fall death. Frames: hit shock, wing tear, body twist, toxic glow leaking, fall/crumple, inert remains. Keep the body compact inside each cell.

Color and physics lane: bruised violet / purple wing membranes, red-black body, bone tips, small toxic green organs; light body tumbles as torn wings lose lift.

## Breach Boss - Lurch

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge breach boss. The action is a slow boss lurch/idle movement cycle. Preserve the boss silhouette, skull/bone crown, wet red tendrils, black sinew, toxic green core/eye glows, and large mass. Add subtle breathing, shoulder rise, tendril sway, and one heavy step. Loopable cycle.

Color and physics lane: deep crimson-black boss mass, large bone skull plates, bright toxic green cores, orange hell-rim accents; massive slow inertia with tendril lag.

## Breach Boss - Barrage

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge breach boss. The action is a boss ranged barrage attack. Frames: tendrils tense, green cores charging, torso opening, projectiles/acid sacs launching, recoil, recovery. Projectiles may appear only in the active frames and must stay within each cell.

Color and physics lane: deep crimson-black boss mass, large bone skull plates, bright toxic green cores, orange hell-rim accents; huge body compression before barrage and slow recoil after release.

## Breach Boss - Death

Create a 3-row by 6-column animation sprite sheet for the referenced Scourge breach boss. The action is a large boss death. Frames: stagger, core overload, skull/bone plates cracking, tendrils tearing loose, body collapsing inward, inert broken mass. Keep the full body inside every cell with generous padding.

Color and physics lane: deep crimson-black boss mass, large bone skull plates, bright toxic green cores, orange hell-rim accents; massive structure fails in stages with delayed tendril drag.
