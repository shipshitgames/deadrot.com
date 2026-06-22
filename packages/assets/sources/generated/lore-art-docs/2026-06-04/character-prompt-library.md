---
status: superseded
superseded_by: Universe/Style-Bible.md
type: prompt-library
feeds: historical-reference
supersededBy: Universe/Style-Bible.md
---
# Character Prompt Library

> **SUPERSEDED** — the locked art canon lives in [[Style-Bible]] (§11 backgrounds, §13 prompt skeletons, §15). Do not generate from this file; it is kept for history and its faction/host prompt content is folded into the Style-Bible. In particular, the `#00ff00` chroma-key default below is wrong under the lock — default to HERO/VOID + rembg (§11).

Use this file to generate character sprite variants before replacing game assets.
Every generation should be recorded in [[Generation-History]].

## Shared Sprite Template

Replace bracketed fields before generation.

```text
Use case: stylized-concept
Asset type: 2D game billboard sprite, full-body character cutout for [GAME].
Primary request: Create the [VIEW] sprite for [CHARACTER], [ROLE].

Style: high-detail medium-chunky PIXEL ART in the locked [[Style-Bible]] house look; visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette, blood, rust, gunmetal, bone, hellfire ember light, grimy industrial surfaces, high contrast, heavy shadows, NO neon, NOT smooth 3D render, NOT photorealistic, NOT painted concept art.

Character design: [FACTION LANGUAGE]. [ROLE-SPECIFIC DETAILS]. Make the design readable at small game size.

Composition: single centered full-body standing pose, feet visible and aligned to the same ground baseline, [VIEW] orthographic game-sprite angle, generous padding around the body.

Background/removal requirements: default to the HERO/VOID track from [[Style-Bible]]: plain near-black #0a0a0a background, no scenery, no props, no floor plane, no cast shadow, no watermark, no UI, and no text. Cut out in post with rembg before pixel-grid downscale. Use a flat chroma-key source only when the deliverable explicitly requires that fallback.

Avoid: generic clean white sci-fi armor, superhero proportions, fantasy robes as the default, readable text, extra characters, background objects, cropped feet.
```

## View Language

- Front: front-facing, shoulders square enough to identify chest, weapon or tool readable.
- Side: true left-facing profile or three-quarter side profile, limbs and weapon silhouette readable; leave room for mirroring.
- Back: rear view, backpack/rig readable, helmet and shoulders matching the front design.

## Pyre Player Prompts

### Ranger / Balanced Purger

Role read: baseline Pyre operator, rifle, medium armor.

```text
Character design: Pyre human Purger, medium armor, athletic build, scorched black gunmetal plates, heat-baked bone-white ceramic panels, ember-orange and blood-hot Pyre heat lines, dim utilitarian diagnostics, sealed helmet with narrow furnace-glow visor, compact rifle held across the chest. Balanced trooper silhouette, less bulky than Bulwark and sturdier than Vector.
```

### Bulwark / Heavy Purger

Role read: tank, heavy weapon, breach-front survivor.

```text
Character design: Pyre human Purger in heavy slab armor, broad shoulders, reinforced boots, thick forearm shields, furnace-orange vents, scorched ceramic chest plates, heavy rotary shotgun or cannon held low. The silhouette must be wide, grounded, and protective without looking like Warden engineering gear.
```

### Vector / Scout Purger

Role read: speed, slim profile, breach runner.

```text
Character design: Pyre human Purger scout, slim athletic armor, long running-leg silhouette, light scorched plates over black pressure suit, ember-orange visor slit, compact SMG, sensor fins, grapnel or breach-marker gear. Fast and dangerous, minimal bulk, no cape.
```

### Patch / Support Purger

Role read: combat medic/support, still Pyre, not clean hospital medic.

```text
Character design: Pyre human Purger support operator, medium-light armor, sealed helmet, scorched medical/cauterizer rig, injector tubes, emergency heat-seal tools, bone-white shoulder plates marked by abstract non-text symbols, ember-orange medical heat glow with dim utilitarian diagnostics. Reads as field support in a breach, not a clean doctor.
```

## Scourge Enemy Prompts

Every Scourge prompt must make the parasite/host relationship visible. It can wear flesh,
bone, armor, wreckage, machinery, fungus, or ship hulls, but it should never read as a
generic standalone demon or alien.

Default Scourge grammar: toxic-green breach cores, black chitin, wet raw tissue, exposed
sinew, invasive tendrils, rupture seams, and host material being consumed. Host families
can vary across conquered worlds; the parasite signature must stay consistent.

### Host Family Blocks

Use one of these blocks inside Scourge prompts.

```text
Rot-Infested Flesh Host: humanoid or animal host body split open by parasite growth,
ruined armor or bone still visible, wet red tissue, black chitin plates, toxic-green nodes.

Chitin Warhost: conquered shell-world race, hard carapace, mandibles, hooked limbs, claw
clusters, blade growths, parasite tendrils pulling through the joints.

Mycelial Spore Host: conquered fungal colony body, bulging sacs, breathing vents,
fibrous root tendrils, wet spores implied by silhouette, toxic-green parasite nodes.

Machine-Graft Host: hijacked machine or weapon body, rusted metal shell, cables as
tendrils, parasite tissue growing through seams, engines or barrels turned into organs.

Bone Titan Host: huge alien megafauna or warrior frame, horns, rib cages, bone plates,
massive limbs, parasite tissue binding the skeleton into a war body.

Voidship Host: infected craft or orbital wreckage, hull plates as armor, engine organs,
cables as tendrils, toxic-green breach heart, silhouette readable as ship or space beast.
```

### Swarm Ripper / Melee

Role read: close-range fodder.

```text
Character design: Scourge swarm melee creature, Rot-Infested Flesh Host by default, non-human bipedal parasite wearing a ruined host body, hunched forward posture, black chitin growing through raw red muscle, blade-like forearms made from ruptured bone and parasite growth, wet gore, small toxic-green breach cores under cracked armor growth, invasive tendrils visible at the shoulders and ribs, no human helmet, no readable clothing. Fast cannon-fodder silhouette with clear claws and head.
```

### Swarm Spitter / Ranged

Role read: ranged kiter/projectile source.

```text
Character design: Scourge ranged creature, Mycelial Spore Host or Machine-Graft Host variant, thin predatory silhouette, parasite wearing and hollowing a host torso, distended glowing throat or chest sac, one arm fused into a bio-industrial projectile lance, black chitin, raw sinew, toxic-green breach light, rusted stolen tech fragments embedded in flesh, tendrils pulling broken ribs around the firing organ. Make the firing organ obvious.
```

### Breach-Boss / Perdition Core

Role read: major boss, shield, enrage, projectile barrage.

```text
Character design: Scourge breach-boss from Perdition, Bone Titan Host or machine-graft battlefield host, huge non-human war body grown by a parasite around a pulsing toxic-green breach core in the chest, corrupted host anatomy and fused battlefield metal, asymmetrical horn or mandible crown, wet chitin, massive arms, visible shield-organ ring around the core, many small projectile vents and invasive tendrils binding the body together. Monstrous breach anatomy, not a larger soldier.
```

## Warden Concept Prompts

### Field Engineer

Role read: builder, tower controller.

```text
Character design: Warden field engineer, practical armored technician, deep steel and worn industrial yellow markings, ember-lit shield diagnostics, square modular armor plates, compact tool harness, tower-control tablet or baton, cable spools and repair clamps. Defensive and methodical, not fanatical.
```

### Lane Gunner

Role read: heavy ranged defender.

```text
Character design: Warden lane gunner, reinforced gunner armor, stabilized heavy weapon, ammo feed pack, broad planted stance, ember targeting lamps, industrial yellow hazard accents, square shoulder plates and knee braces. Reads as attrition firepower for holding a lane.
```

### Wallwright

Role read: shield/barricade specialist.

```text
Character design: Warden Wallwright, heavy engineer defender, shield emitter backpack, deployable barricade anchors on the arms and belt, slab chest armor, ember-lit field nodes, worn steel, hazard stripes used sparingly. The silhouette should read as builder and protector.
```

## Pactfall Concept Prompts

These are not locked canon; use them for arena experiments.

```text
Pyre Duelist: arena-tuned Pyre fighter, lighter armor, ember blade/carbide weapon, aggressive triangular silhouette, sanctioned blood-arena gear.

Pyre Cauterizer: Pyre area-control fighter, heat tanks, short-range burner weapon, furnace mask, scorched plates, ritual-industrial markings.

Warden Bastion: Warden defender hero, shield projector, square silhouette, ember barrier hardware, reinforced lane armor.

Warden Artillerist: Warden ranged hero, shoulder targeting rig, compact artillery launcher, ember rangefinder lamps, industrial yellow markings.
```

## Starblight Concept Prompts

These are not locked canon; use them for orbital shooter experiments.

```text
Pyre Interceptor Pilot: sealed Pyre flight armor, scorched pressure suit, furnace visor, compact life-support rig, ember-red warning lamps, aggressive triangular silhouette, made for a cockpit sprite or pilot portrait.

Warden Defense Pilot: reinforced Warden flight suit, gunmetal plating, industrial yellow markings, compact shield-control harness, methodical defensive silhouette, made for a cockpit sprite or pilot portrait.

Scourge Infected Craft: parasite-corrupted small attack craft, rusted hull pieces fused with chitin and raw tissue, tendrils gripping the frame from inside, toxic-green breach organs, readable arcade silhouette, no clean sci-fi glow.

Orbital Breach Carrier: large Scourge boss craft, infected wreckage grown around a toxic-green breach heart, parasite tendrils using broken ship sections as a shell, spore vents, dangling cables, chitin plating, boss-readable silhouette for a Space Invaders / Galaga-style shooter.
```

## Negative Prompt Additions

Use these when a batch starts drifting:

- If too generic: "Avoid clean stock sci-fi soldiers; add faction-specific scorch, repair, breach, blood, rust, or engineering details."
- If too neon: "Remove magenta/cyan/cyberpunk glow; use blood red, hellfire orange, gunmetal, rust, bone, and toxic green only for the Scourge."
- If too fantasy: "Avoid medieval armor, magic robes, capes, swords as the default, and ornate royal decoration."
- If too cluttered: "Reduce tiny surface noise; preserve a clear helmet, torso, weapon/tool, and boot silhouette."
- If too human for Scourge: "Push parasite takeover: invasive tendrils, ruptured host tissue, chitin over stolen bone/metal, embedded breach cores; remove clean human armor layout."
- If too generic monster for Scourge: "Show what the parasite is wearing or consuming: host body, machinery, wreckage, fungus, or ship hull; avoid standalone demon/alien anatomy."
- If Scourge batch feels too samey: "Keep the parasite grammar consistent, but switch host family: rot-infested flesh, chitin warhost, mycelial spore host, machine-graft host, bone titan host, or voidship host."
- If too Scourge for humans: "Keep the wearer clearly human in armor; corruption should be damage, not anatomy."
