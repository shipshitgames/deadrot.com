---
status: locked
type: art-bible
supersedes:
  - Universe/Style-Bible.md (this file — prior draft)
  - Art/Character-Sprite-Direction.md
  - Art/Character-Prompt-Library.md
inherits:
  - DESIGN.md (palette + type tokens — authoritative, do not relitigate)
  - assetgen DESIGN.md `assetgen:` block (machine twin of this prose)
---

# The Scourge Style Bible

**At a glance:** the locked art bible · the one render look every creature/operator/machine wears · feeds [[DESIGN]] tokens + the `assetgen:` block · governs all 6 games.

> **Status: LOCKED. House medium = medium-chunky DETAILED PIXEL ART** — decided 2026-06-04 via the style bake-off (shipshitgames/shipshitgames#62), NOT hi-fi render. This is the most-read art doc in the studio and it is the law. The render look, the lighting rig, the color discipline, the faction grammar, the Scourge parasite rule, and the per-asset recipes below are decided. Build on them — do not relitigate them. Palette and type tokens live in [[DESIGN]] (authoritative); this bible is their visual conscience. The machine-readable twin of everything here ships as the `assetgen:` block in [[DESIGN]]'s frontmatter, which the generator compiles into `style.generated.ts`. **Edit the bible, the generator changes.** One source of truth, no drift.

---

## 1. Philosophy — what we are making

One parasite, many games, sixty-plus creatures, and a single world that has to read as one world from a billboard ten feet from a player's face down to a tower-defense unit the size of a thumbnail. We do not get coherence by hand-tuning each asset. We get it with two cheap, brutal levers — **one locked style-reference image per game** and **one DOOM color grade baked in post** — and a prompt skeleton frozen so hard that a noob with no taste can swap one line and get something amazing.

That is the whole bet: **amazing by default from a single prompt, forgiving of variance across the roster, reproducible at scale across providers.** The void, the rim-light, and the grade homogenize everything else. Optimize for that. Resist the urge to fiddle.

The tone is [[Scourge]]-canon: brutal, fast, gallows-humor, streamable. The naming is hard and short — DEADLANE, lanes, breaches, the Rot, Purgers, Perdition. The look matches: blood on gunmetal, lit by furnace fire. If an asset doesn't feel like that, burn it and reshoot.

---

## 2. The house look (locked)

**Medium-chunky DETAILED PIXEL ART.** True pixel art on a visible chunky pixel grid (rank-and-file ~110px tall; bosses ~180px) — bold hand-placed pixels with hard crisp edges, no anti-aliasing, ordered dithering, a fixed limited DOOM palette. High-detail and richly lit, like premium modern pixel-art (*Blasphemous*, *Dead Cells*) crossed with remastered 1990s DOOM sprites — but it reads **unmistakably as pixels**, never a smooth render. A single full-body subject, centered on a **near-black background**, with a **subtle dark outline** and one **hellfire rim-light** from a low side so it pops.

It **is** chunky pixel art. It is **not** a smooth 3D render, **not** photorealistic, **not** anti-aliased, **not** painted concept art. The AI generator only *approximates* the grid — the **true pixel grid and palette are enforced in post** (box-downscale to the grid → hard palette remap → rembg cutout → lossless `.webp`), and sprites render in-engine with **NearestFilter**. If it looks airbrushed or like a rendered model, it's wrong. *(The chunkiness ladder settled this: finer reads as noise, bolder disintegrates — medium ~110px is the grid.)*

Silhouette-first is the law of this medium: at ~110px in a charging horde the **shape** carries the read, not the texture. Keep rank-and-file bold and simple; reserve fine detail for hero and boss. Coherence across the roster is pinned by the **fixed per-game style-reference image + the one fixed DOOM palette every sprite quantizes to** — not by per-asset fiddling.

### What DOOM actually means here

DOOM is not "dark fantasy with a red filter." The founding brief was *Evil Dead II crossed with Aliens* — realistic, dirty, more dirty than pretty, nothing beautiful — then shoved through a **heavy-metal-album-cover, comic-book lens**: exaggerated, hero-scaled proportions wearing believable, weathered surface. That tension is the entire look. You must hit **both at once, never one without the other** — believable grime and anatomy wrapped in an exaggerated heroic silhouette.

- **Silhouette first.** The shape must read aggressive and legible in pure black before a single detail lands. Build the power triangle. Give each creature **one iconic shape-signature** and exaggerate that; let realistic grime do the rest.
- **Anatomy as gore.** Bake a mid-damage state into the base design — torn skin, wet muscle, glimpsed bone, lipless maw. Gore is **structural and anatomical, never random splatter.**
- **Three materials, always juxtaposed.** Charred veined flesh; cracked ivory bone worn as armor; rusted hell-metal grafted into living flesh at raw seared seams. The flesh-meets-cold-machine seam is the single most DOOM detail you can add.

---

## 3. Silhouette & proportion

The **first read** is the shape in pure black, before any detail. It must be legible and aggressive as a flat silhouette.

- **Build a top-heavy power triangle:** massive slab shoulders, chest, and arms; narrow waist; hunched, forward-leaning, *coiled-to-charge* posture.
- **Backward-jointed digitigrade legs** ending in cloven hooves or splayed claws (for non-human subjects).
- **One iconic shape-signature per subject** — a single exaggerated silhouette cue (a bloated bomb-ball, a skeletal rig, a single dominant maw) — then let the rest read as a clean action-figure frame.
- Keep it **readable at FPS billboard distance and tower-defense zoom:** bold heads, clear attack limbs, obvious weak-points.

**Never:** slender / elegant / graceful proportions, symmetrical-pretty anatomy, thin limbs, a static neutral standing pose, or a busy unreadable silhouette.

---

## 4. Anatomy & gore — the destructible-demon system, baked in

Gore here is **anatomical and structural, never random splatter.** Bake a *mid-damage* state into the base design:

- Torn skin peels in layers — **striated red muscle → white sinew/tendon → cracked yellowed bone.** Exposed skull, jaw, ribcage, knuckles.
- Skeletal subjects wear **bone on the outside as armor** (horns, plates, spurs, claws).
- Faces are mostly **mouth:** oversized lipless maws, too many teeth, multiple deep-set or sunken glowing eyes.
- Wounds and the maw read **emissive** (see Lighting).

---

## 5. Material language — three materials, always juxtaposed

Every subject puts weathered, heavy materials against each other:

1. **Flesh** — wet, veined, blistered, charred-black at the edges; ashen grey-green or bruised oxblood; scarred and leathery.
2. **Bone** (`bone #e9e3d6`) — yellowed, cracked ivory; used as horns, plates, spurs, claws.
3. **Metal / hell-tech** — heavy slabs of dark `gunmetal`, `rusted iron`, brass pistons and barrels, **grafted directly into living flesh at raw, seared, stitched seams.**

Add slag, soot, dried blood, sinew bundles, cooling-lava cracks. Materials must look **heavy and weathered** — no clean, polished, or shiny-new surfaces; no jewels, filigree, or ornate decoration. **The flesh-meets-cold-machine seam is the single most on-brand detail you can add.**

---

## 6. Lighting — the void + the hellfire rim

This is the lighting rig, and it does not change. Two ingredients, both always on for hero renders.

- **Background:** flat `void` `#0a0a0a`. Empty. No scenery, no floor plane, no props, no second character.
- **Key:** one **hard rim-light from a low side angle**, roughly 35–45° off frontal, on **one side only.** It runs `hellfire #ff6a00` at the hot edge falling to `bloodHot #ff2a18` as it wraps toward the body.
- **Shadow side:** crushed to near-black, bleeding into the void. **No fill.** Depth is built from value contrast, not soft ambient bounce.
- **Internal emissive — non-negotiable, this is the DOOM signature:** hot orange-red hellfire glowing from *inside* — the maw, throat, eyes, open wounds, cracks in charred skin, any sigil on the chest — plus subsurface glow lighting the muscle from within. A newly-summoned demon should look like it's lit from the inside by a furnace. (Toxic-green is the Scourge-only variant of this — see §9.)

**Never:** soft diffuse light, bright daylight, cool blue/teal hero grade, glossy beauty render, clean white background.

---

## 7. Color discipline

The one rule: **red + fire + metal + bone.** Near-monochrome **warm** grade. Bodies are desaturated — ash, charcoal, oxblood — so the **only saturated color in the frame is the emissive hellfire** (the heavy-metal-album-cover read). The sole exception is **the Scourge**, and only its breach cores: `toxic #8bdc1f`, as glow, never as body paint.

| Token | Hex | Use |
|-------|-----|-----|
| `void` | `#0a0a0a` | background, deepest shadow |
| `coal` | `#121214` | near-black surfaces |
| `iron` | `#1e1e22` | raised dark surfaces |
| `gunmetal` | `#34343c` | metal, plates, borders |
| `blood` | `#c1121f` | danger, blood, kill-reads |
| `bloodHot` | `#ff2a18` | hot heat lines, rim falloff |
| `hellfire` | `#ff6a00` | embers, vents, rim key |
| `rust` | `#8a4b2a` | grime, weathered metal, muted accent |
| `bone` | `#e9e3d6` | bone, ceramic, stencils, strong reads |
| `ash` | `#9b958a` | dust, faded markings, dim detail |
| `toxic` | `#8bdc1f` | **the Scourge ONLY** — breach-core / node glow, sparingly |

**Forbidden everywhere:** neon, magenta, cyan, cyberpunk glow, cool blue/teal grades, pastels, rainbow saturation. *If it doesn't feel like blood on gunmetal, it's wrong.*

### Lock the palette in post, not in the model

Models will not hit the DOOM palette reliably on their own, so **the palette is locked in post.** This is the cheapest coherence win after the style-ref. Apply one shared DOOM grade as the **last step on every asset**, identically across the whole roster:

- **Soft cinematic (default):** one shared `.cube` DOOM LUT, batch-applied last. Targets value/temperature toward the palette while preserving sculpt detail and emissive hotspots.
- **Hard exact lock (when you need an exact snap):** `magick in.png -dither None -remap doom_palette.png out.png`.

That single deterministic step erases most inter-asset color variance for free.

---

## 8. Faction looks

Three readable visual signatures, pinned on six axes — **Shape · Material · Light · Surface · Pose · Gear-read** — so a unit is identifiable in silhouette alone.

### The Pyre — offense

> Zealot order that broke from the Wardens; they descend *into* breaches to cauterize the Scourge at its source. Expendable by choice. The only cure is fire. See [[The-Pyre]].

| Axis | Read |
|------|------|
| **Shape** | triangular, blade-like, flame-split, **forward-leaning** and aggressive |
| **Material** | scorched black `gunmetal` plates + heat-baked `bone`-white ceramic panels |
| **Light** | `hellfire`-orange + `bloodHot` heat lines, furnace-glow visor slit, **dim utilitarian (non-neon) diagnostics** |
| **Surface** | breach burns, soot, scorch, dried blood; sealed against the Scourge |
| **Pose** | coiled, charging, descending — a body spent on purpose |
| **Gear-read** | sealed helmet, air filters, ammo rigs, cauterizer tanks — **suicide-run breach kit** |

Cloth or ash tabards and bone-white sigils appear on the **Zealot** variant but are never mandatory. The Pyre must read as a **fanatic operator built to die close to the source** — *not* a clean military trooper and *not* Warden engineering gear.

**Variation lanes:** **Tactical** (cleaner operator, minimal ritual cloth) · **Zealot** (sigils, ash cloth, bone-white plates, burn marks) · **Perdition** (late-game scarred armor, breach corruption, emergency repairs).

### The Wardens — defense

> Remnant military and engineering corps — the closest thing humanity has to a state. They *outlast* the Scourge: towers, walls, attrition. Every wall held is a generation bought. See [[The-Wardens]].

| Axis | Read |
|------|------|
| **Shape** | square / hexagonal, buttressed, modular, reinforced, **planted** |
| **Material** | worn steel + `gunmetal` slab armor, `bone`/off-white stencils |
| **Light** | ember-lit shield and tool hardware; **`industrial-yellow` hazard markings used sparingly** |
| **Surface** | wear, repair-welds, attrition damage, hazard stripes — kept alive, not new |
| **Pose** | grounded, braced, defensive — holding a line |
| **Gear-read** | tool arms, power packs, welders, rangefinders, deployable wall anchors — **building & holding** |

The Warden read is **an engineer keeping broken infrastructure alive** — methodical, disciplined, *less fanatical than the Pyre.* Not a paladin, not a knight, not a clean white sci-fi soldier.

**Variation lanes:** **Field Engineer** (compact tool rig, tower controller, light armor) · **Lane Gunner** (heavier armor, stabilized weapon platform, ammo feed) · **Wallwright** (shield emitter, barricade anchors, reinforced silhouette).

The third faction, [[The-Listeners]], reads visually as battered Warden/Pyre salvage with improvised antennae and breach-listening rigs — no clean signature of its own; lean on the two grammars above and degrade them.

---

## 9. The Scourge — the parasite

> One parasite wearing many conquered worlds. It has **no native form**; it wears what it infects. Closest analogue: the Zerg — a swarming, adapting hive-thing with **no single general.** See [[Scourge]] and [[Scourge-Host-Families]].

**The Scourge is a PARASITE FIRST.** Every Scourge design must show a host or medium being **worn and consumed** — flesh, armor, machinery, ship hull, fungal colony, or battlefield wreckage. The default parasite grammar, present across the whole army:

- **ruptured host flesh** and rupture seams; wet raw tissue, exposed sinew
- **invasive tendrils** pulling through joints, ribs, and seams
- **embedded `toxic-green #8bdc1f` breach cores / nodes** (the only place toxic-green appears in the universe)
- **black chitin growing over stolen bone and metal**
- **fused wreckage or machinery** — host material overwritten, not clean tech
- weapons **grown out of host anatomy:** claws, bone blades, throat sacs, arm-lances, spore vents, projectile organs, shield organs

> **The rule:** if a design lacks this grammar, it is **not Scourge yet — it is only a monster.** Avoid standalone generic demons or clean aliens with no host-corruption read.

**Light & color:** breach energy reads as **toxic-green + sick hellfire** at the core; **never magenta or cyan.** Silhouettes must feel **non-human even when roughly bipedal** — asymmetrical, grown, lunging.

**Readability by tier:** swarm units stay simple and bold (parasite anchors must survive zoom); elites add asymmetry, weapon growths, and armor mutations; **bosses read as breach anatomy made into a war body, not just a bigger soldier** — the chest/head core obvious during movement.

### Host families (variety without breaking cohesion)

Same parasite grammar, different host underneath. Pick a host family per batch; the same threat role can ship as several hosts across games.

| Host family | Visual read | Typical use |
|-------------|-------------|-------------|
| **Rot-flesh** | the default first-read: humanoid/animal body split open by parasite growth, ruined armor or bone still visible, wet red tissue, black chitin, toxic-green nodes | base swarm, early Scourge-Survivors enemies, common Deadlane waves |
| **Chitin warhost** | conquered shell-world race: hard carapace, mandibles, hooked/blade limbs, claw clusters, tendrils through the joints | fast melee, elite chargers, armored swarm |
| **Mycelial spore host** | fungal colony body: bulging sacs, breathing vents, fibrous root tendrils, spores implied by silhouette, toxic-green nodes | spitters, area denial, Starblight mines, breach growth |
| **Machine-graft host** | hijacked machine/weapon/drone: rusted metal shell, cables as tendrils, parasite tissue through the seams, barrels and engines turned into organs | ranged units, tower-breakers, Deadlane siege, infected weapons |
| **Bone-titan host** | huge alien megafauna/warrior frame: horns, rib cages, bone plates, massive limbs bound into a war body by parasite tissue | bosses, minibosses, Pactfall neutral objectives, heavy waves |
| **Voidship host** | infected craft / orbital wreckage: hull plates as armor, engines as organs, cables as tendrils, toxic-green breach heart | Starblight, Scourge-Fighter, Orbital-Breach-Carrier, orbital bosses |

For every Scourge batch, record both the **threat role** (Ripper, Spitter, elite, boss, craft, carrier…) and the **host family** so the army stays varied but coherent.

---

## 10. One look, many cameras — identity never changes

The style-ref pins the **rendering style and grade;** per-game **camera framing** changes around it. Same sculpt, same materials, same rim, same DOOM grade — re-shot from the game's angle. These framing strings are the canon `GAME_FRAMING` map (mirrored in the `assetgen:` block):

| Game | Camera framing |
|---|---|
| [[Scourge-Survivors]] | first-person billboard sprite, front-facing, full body |
| [[Deadlane]] | top-down / high-angle, silhouette readable from above |
| [[Pactfall]] | isometric 3/4 champion scale |
| [[Brawl]] | side-on / 3/4 trench-fighter scale, readable from Duel and arena distance |
| [[Starblight]] | side-on / top-down arcade, crisp readable silhouette |
| [[Redline]] | side-on Sonic-like runner profile |
| [[Rothulk]] | side-on Mario-like platformer profile |

**Framing is allowed to change; the creature's identity — its silhouette signature, its materials, its color — is not.** The per-game style-ref *is* the per-game camera convention made concrete.

---

## 11. Two-track background — pick one, never mix

A subject is rendered for one of two jobs. **Never request a rim-lit void and a chroma-key in the same prompt** — they're incompatible jobs.

| Track | Background | When |
|---|---|---|
| **HERO / VOID** (the locked look, default) | `void #0a0a0a` + hellfire rim-light | bestiary plates, marketing, the style-ref source, anything seen by a human. Cut out in post with **rembg** (anime/object model) — never chroma-key, because the subject's own dark shadows live against near-black. |
| **GAME-CUTOUT** | flat solid `#00ff00` chroma-key, no shadow / gradient / reflection / floor | **only** when a clean billboard alpha is the explicit deliverable and rembg-on-void won't do, and only on a native-alpha path (gpt-image-1). Never put `#00ff00` anywhere in the subject. |

**Default to HERO/VOID + rembg.** gpt-image-2 cannot output transparency anyway; do not chase native alpha. The `transparent background` notion refers to the *final delivered cutout*, produced in post — not to the generated frame.

**No separate "hi-fi" or website track.** Key art, marketing plates, and website character/bestiary portraits are the *same* locked pixel medium (§1–2) on the HERO/VOID background — not concept renders. Any prompt asking for "hi-fi render" or "not pixel art" is off-canon. The pre-lock 2026-06-04 placeholder batches that used hi-fi render are superseded; their assets are slated for regeneration in the locked pixel style.

---

## 12. The negative-prompt set

Always-on style exclusions. On **FLUX/fal** these map to the real `negative_prompt` param; on **gpt-image-2 / codex** there is no negative field, so fold them into the positive suffix as `only / single / plain` constraints. The canonical set (machine twin: `DESIGN.md` → `assetgen.negativePrompts` — keep the two in sync, and **never** list `pixel art` here: it is the locked house medium, §1–2, not an exclusion):

```text
photorealistic, photographic skin, shallow depth of field, lens bokeh, smooth 3D render,
rendered 3D model, anti-aliased smooth edges, airbrushed, hi-fi render,
flat 2D vector illustration, cel-shaded cartoon, anime, cute, chibi, slender elegant
graceful proportions, symmetrical pretty anatomy, humanoid fantasy knight in clean
plate armor, medieval robes capes or swords, clean minimal sci-fi, superhero
proportions, soft diffuse even lighting, bright daylight, high-key flat lighting,
glossy beauty render, pastel colors, rainbow saturation, cool blue or teal grade,
magenta cyan or any neon glow, clean white background, background scenery or
landscape, floor plane or ground shadow, multiple characters, text watermark or
logo, UI frames or HUD, cropped or close-up framing that hides the silhouette
```

### Drift corrections (apply the matching exclusion when a batch slips)

- **Too generic** → add faction-specific scorch / repair / breach / blood / rust.
- **Too neon** → strip magenta / cyan / cyberpunk glow.
- **Too fantasy** → strip medieval armor / robes / capes / swords.
- **Too human-for-Scourge** → push parasite takeover (tendrils, ruptured tissue, chitin over bone/metal, breach cores).
- **Too-generic-monster Scourge** → show *what host* it is wearing/consuming.
- **Too-samey Scourge** → keep the grammar, switch host family.

---

## 13. Per-asset-type direction + prompt skeletons

Every recipe below inherits the same spine — the house look (§2) and the DOOM grade (§7) — and changes only the **camera, scale/anchor, and background track.** Build each prompt from five frozen blocks plus one variable block; freeze everything except `{...}` fields:

```text
[HOUSE LOOK]   high-detail medium-chunky PIXEL ART game sprite, visible square pixel grid,
               hard crisp edges, ordered dithering, exaggerated readable silhouette
[SUBJECT]      {the variable block — the only thing you rewrite per asset}
[FRAMING]      the GAME_FRAMING string for the target game / asset type
[LIGHTING]     one hard hellfire rim-light, orange→red, deep falloff into crushed shadow,
               internal emissive glow from maw / eyes / wounds / breach cores
[BACKGROUND]   one of the two tracks (§11) — never both in one prompt
[GRADE TAIL]   the DOOM grade tail (below) — in the prompt AND re-locked in post via LUT
```

**The grade tail (paste verbatim on every creature/render recipe):**

```text
high-detail medium-chunky PIXEL ART, visible square pixel grid, hard crisp edges,
ordered dithered shading, fixed limited DOOM palette, blood and rust and gunmetal,
hellfire ember light, grimy industrial, high contrast, heavy shadows, NO neon, no
text, centered, NOT smooth 3D render, NOT photorealistic, NOT painted concept art.
```

**The HERO/VOID background clause (the default, paste in `[BACKGROUND]`):**

```text
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures,
no floor plane, no cast shadow on a ground, no text, no watermark, no logo.
```

### 13.1 FPS billboard — `scourge-survivors` (multi-view: front / side / back)

- **Framing:** *first-person game billboard sprite, front-facing, full body.* Subject faces camera dead-on (front); side and back views share the identical design so the engine can mirror the side in code.
- **Scale / anchor:** single centered full-body figure, **feet on one baseline,** no cropped boots, generous even padding. Pixel-grid targets after post: **rank-and-file ≈ 110 px tall; bosses ≈ 180 px tall.** Source renders may be larger, but the production target is the locked pixel grid, not hi-fi cutout height.
- **Look notes:** this is the **hero of the hero track** — seen nose-to-nose. Push the strongest internal emissive. Keep the silhouette legible in pure black at FPS distance. Side view = true profile (mirrorable); back view = rig / backpack / host-rupture readable. All three views are the *same design* — generate as a set or restate invariants between calls.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, fixed limited DOOM palette, exaggerated readable silhouette. {SUBJECT —
for Scourge use one host family + parasite grammar; for Pyre/Warden use the faction read}. This is
the {front-facing / true-side profile / rear} view — keep the design identical across all views.
First-person game billboard sprite, front-facing, full body, single centered subject, feet
anchored to one baseline, no cropped boots, generous padding.
Lit by one hard hellfire rim-light, orange-to-red from a low side angle, deep falloff into
crushed near-black shadow, internal emissive hellfire glow from the maw / eyes / open wounds
{and toxic-green breach cores if Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.2 Top-down — `deadlane`

- **Framing:** *top-down / high-angle game sprite, silhouette readable from above.* High oblique looking down on the crown, shoulders, and weapon footprint.
- **Scale / anchor:** centered, full body, baseline at the feet / base footprint. Blockier silhouette than the FPS avatar — units are seen small.
- **Look notes:** the head/shoulder mass and the weapon-or-tool footprint are the entire read at TD zoom. **Bias the hellfire rim toward the top edges** (crown, shoulders, pauldrons). Avoid thin limbs that vanish at scale; thicken silhouette-defining features.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, exaggerated readable silhouette, bold blocky mass that survives shrinking.
{SUBJECT}.
Seen from a high angle looking down on the crown of the head and shoulders.
Top-down / high-angle game sprite, silhouette readable from above, single centered subject,
full body within frame, ground contact at one baseline.
Lit by one hard hellfire rim-light, orange-to-red, biased toward the top edges (crown,
shoulders), deep crushed shadow, internal emissive glow {and toxic-green breach cores if
Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.3 Isometric 3/4 — `pactfall`

- **Framing:** *isometric 3/4-view game sprite, champion scale.* Classic MOBA three-quarter down-angle (~30–45°), body turned slightly so depth and the weapon-side read.
- **Scale / anchor:** centered full body, **feet on one baseline,** champion-hero proportions — more heroic than the PvE games.
- **Look notes:** the **most stylized, most heroic** lane. Exaggerate the power-triangle and the team-read shape so opposing teams are told apart at iso distance. Neutral Scourge units must **interrupt both human palettes** with toxic-green breach corruption, host takeover, and wet bio-gore. Keep the champion grounded — clear contact baseline, no floating.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, exaggerated heroic champion silhouette. {SUBJECT — push the arena-readable shape;
neutral Scourge must interrupt the human palettes with toxic-green breach corruption and wet
bio-gore}. Body turned slightly into a three-quarter hero pose.
Isometric 3/4-view game sprite, champion scale, single centered subject, full body, feet
anchored to one baseline, generous padding.
Lit by one hard hellfire rim-light, orange-to-red raking across the three-quarter turn to model
volume, deep crushed shadow, internal emissive glow {and toxic-green breach cores if Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.4 Side-on arcade — `starblight`

- **Framing:** *side-on / top-down arcade space-shooter sprite, crisp readable silhouette.* Pure profile or flat top-down for ships — pick the cleanest arcade read.
- **Scale / anchor:** centered, full subject, anchored on its **long axis** (a ship's hull line, a pilot's vertical). Tight, crisp silhouette.
- **Look notes:** silhouette-first, detail-second. Infected craft / carriers: parasite grammar wraps the hull (chitin over plates, tendrils gripping from inside, a toxic-green breach heart), **never** clean sci-fi glow. Pilots: cockpit-sprite / portrait framing with faction visor read. Hard side-rake rim; emissive thruster/breach light is the only saturated color besides the rim.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, crisp readable arcade silhouette. {SUBJECT — for infected craft wrap the hull in
parasite grammar (chitin over plates, tendrils from inside, toxic-green breach heart), no clean
sci-fi glow; for pilots use cockpit-sprite framing + faction visor read}. Seen in clean profile.
Side-on / top-down arcade space-shooter sprite, crisp readable silhouette, single centered
subject, anchored on its long axis.
Lit by one hard hellfire rim-light, orange-to-red as a hard side-rake, deep crushed shadow,
internal emissive thruster / breach glow {toxic-green if Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.5 Runner — `redline`

- **Framing:** *side-on Sonic-like runner sprite, profile silhouette readable at courier-lane speed.* Strict left/right profile, running / motion pose, mirrorable in code.
- **Scale / anchor:** centered, full body, **feet on one baseline,** forward-leaning run posture (lead and trailing leg both readable).
- **Look notes:** **motion silhouette over surface detail.** Coiled, forward-driving stance with clear limb extension; the outline must parse in a blur, so simplify fussy noise to one bold shape signature. Profile only. Rim rakes from the rear/side to imply forward thrust; keep emissive marks on the leading edge so they streak readably.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, exaggerated motion silhouette readable in a blur. {SUBJECT — keep
surface noise low, one bold shape signature}. Strict side profile in a forward-leaning,
mid-stride running pose, lead
and trailing legs both readable.
Side-on Sonic-like runner sprite, profile silhouette readable at courier-lane speed, single
centered subject, feet anchored to one baseline.
Lit by one hard hellfire rim-light, orange-to-red raking from the rear/side to imply forward
thrust, deep crushed shadow, internal emissive glow on the leading edge {toxic-green if Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.6 Platformer — `rothulk`

- **Framing:** *side-on Mario-like platformer sprite, profile silhouette, clear readable pose.* Side profile, neutral/idle or a clear action pose that reads at small scale, mirrorable.
- **Scale / anchor:** centered, full body, **feet on one baseline,** slightly more compact and chunky than the runner — stable, grounded, instantly-parsed shape at small size. Generous padding for jump/attack frames if the asset is a sheet base.
- **Look notes:** **clarity and chunkiness at small scale.** Keep the pose unambiguous, thicken silhouette-defining features, avoid spindly limbs. Still DOOM-graded — grimy, hellfire-lit, **never cute or toy-like** despite the genre.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, chunky readable silhouette legible at small platformer scale. {SUBJECT — thicken
silhouette-defining features, no thin spindly limbs, keep it grimy and DOOM-graded, never cute}.
Strict side profile in a clear, unambiguous platformer pose.
Side-on Mario-like platformer sprite, profile silhouette, clear readable pose, single centered
subject, feet anchored to one baseline, generous padding.
Lit by one hard hellfire rim-light, orange-to-red from the side, deep crushed shadow, internal
emissive glow {toxic-green if Scourge}.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.7 Boss

- **Framing:** **use the host game's framing string** — a `scourge-survivors` boss is a front-facing FPS billboard; a `starblight` Orbital-Breach-Carrier is a side-on arcade silhouette. The boss recipe is a *modifier* on the game skeleton, not a separate camera.
- **Scale / anchor:** centered, full body, baseline at feet/footprint. Bigger final pixel-grid target (**bosses ≈ 180 px tall**) and a more complex, asymmetrical silhouette than any base unit — but the **chest/head core stays readable during movement.**
- **Look notes:** a boss is **breach anatomy made into a war body, not a bigger soldier.** One dominant shape signature (horn/mandible crown, shield-organ ring, fused battlefield wreckage) built around a pulsing toxic-green breach core in the chest. The **breach core is the gameplay weak-point** — the brightest emissive element, obvious from play distance. Push internal emissive harder than on fodder.

```text
high-detail medium-chunky PIXEL ART game sprite on a visible square pixel grid, hard crisp edges,
ordered dithered shading, monstrous asymmetrical boss silhouette — breach anatomy made into a war body, not a
larger soldier. {SUBJECT — one dominant shape signature (horn/mandible crown, shield-organ ring,
fused battlefield wreckage) built around a pulsing toxic-green breach core in the chest as the
obvious weak-point}.
{paste the host game's framing string}, single centered subject, full body, feet/footprint on
one baseline.
Lit by one hard hellfire rim-light modeling the bulk, deep crushed shadow, strong internal
emissive hellfire glow, and the brightest emissive element is the toxic-green chest breach core
(the weak-point), readable during movement.
plain near-black void background (#0a0a0a), no scenery, no props, no other creatures, no floor
plane, no cast shadow, no text, no watermark, no logo.
high-detail medium-chunky PIXEL ART, blood and rust and gunmetal, hellfire ember light, grimy
industrial, high contrast, heavy shadows, NO neon, no text, centered, NOT smooth 3D render.
```

### 13.8 Tiling texture

- **Framing:** flat, orthographic, **straight-on — no perspective, no rim-light, no single subject.** The one asset type that breaks the creature-render framing. The generator already swaps `kind` to *seamless tileable texture;* let that drive framing — do **not** add the hero/void or chroma clauses.
- **Scale / anchor:** edge-to-edge **seamless tile,** no focal subject, no vignette, even flat lighting so it tiles without seams or hotspots. Square, power-of-two friendly.
- **Look notes:** material-first, palette-locked. The DOOM material set — blackened/scorched gunmetal, rusted iron, battered alloy, riveted/stencilled plate, cracked basalt, soot, dried blood; **Scourge** textures add chitin, wet rupture seams, tendril mesh, and toxic-green node specks (the only place toxic-green appears outside a Scourge subject). No hellfire rim, no internal glow, no centered subject — those are creature-only. Grade to the DOOM palette in post like everything else.

```text
seamless tileable texture, flat orthographic straight-on view, edge-to-edge repeating material,
no subject, no focal point, no vignette, even flat lighting so it tiles cleanly with no visible
seam or hotspot. {SUBJECT — material, e.g. scorched riveted gunmetal plate / rusted battered
alloy / cracked basalt with cooling-lava cracks / Scourge chitin with wet rupture seams and
toxic-green node specks}. Weathered, heavy, grimy: soot, dried blood, scraped edges, chipped paint.
DOOM palette only — void / coal / iron / gunmetal / rust / bone, blood-red grime, hellfire embers
sparingly; toxic-green only on Scourge growth; NO neon, no text, no watermark, no logo.
dark, gritty, DOOM-like, high contrast.
```

### 13.9 UI icon

- **Framing:** flat, centered, **single graphic glyph** — not a 3D render. Front-on, no perspective, no rim-light, no environment. Reads as a sigil/marker, not a creature.
- **Scale / anchor:** centered in a square frame with even padding; must **read at small HUD size** (~24–32 px). Hard near-square edges, `rounded.sm` (2px) feel — consistent with [[DESIGN]]'s shape language. Ship flat SVG/vector where possible.
- **Look notes:** one clear silhouette per icon, palette-locked, **ember glow only and sparingly.** **Pyre** = triangular aggressive flame sigil (blood-red + hellfire); **Warden** = square shield/tower sigil (gunmetal + bone); **Scourge** = asymmetrical predatory form with a toxic-green breach node; **Breach** = circular rift with a sickly-green corona; **Lane** = directional corridor marker. No readable letters, no fine gradients that die small, no soft/large glow.

```text
flat centered UI glyph icon, single bold graphic sigil, front-on, no perspective, no 3D render,
no environment, no character. {SUBJECT — icon concept, e.g. Pyre triangular flame sigil / Warden
square shield-tower sigil / Scourge asymmetrical predatory form with toxic breach node / circular
breach rift / directional lane marker}. Hard near-square edges, one clear silhouette, readable at
small HUD size (~24–32 px), even padding in a square frame.
DOOM palette only — {ICON COLORS, e.g. blood-red + hellfire orange for Pyre / gunmetal + bone for
Warden / toxic-green node for Scourge}; sparse ember glow only, no soft large glow, no neon. No
readable text or letters, no watermark, no logo. Flat solid background for clean vectorization.
```

### 13.10 FX — blood / ember / muzzle / breach

- **Framing:** flat, centered **VFX burst on a plain near-black field,** front-on, no subject. Built as a particle/impact sprite (one cell or a sheet).
- **Scale / anchor:** centered radial or directional burst with **falloff to transparent at the edges,** built to composite additively over the void scene. Square frame, generous bleed room. Final delivery on transparent alpha.
- **Look notes:** palette discipline is the whole job — colors are **locked: blood splatter** = `#c1121f` gore burst on dark; **ember burst** = `#ff6a00` with fading spark trails; **muzzle flash** = blood-hot red into hellfire orange; **breach glow** = `#8bdc1f` radiant pulse (Scourge cores — the only FX that uses toxic-green). High contrast against near-black, hard ember light, no neon, no soft pastel haze.

```text
centered VFX burst sprite on a plain near-black field, front-on, no subject, no character, no
scenery. {SUBJECT — effect, e.g. gore blood-splatter impact burst / hellfire ember projectile
burst with fading spark trails / weapon muzzle flash / toxic-green Scourge breach pulse}. Radial
{or directional} burst with crisp hot core and falloff to dark/transparent at the edges, generous
bleed room, designed to composite additively.
DOOM palette only — {FX COLOR: blood-red #c1121f / hellfire orange #ff6a00 / blood-hot red into
hellfire orange / toxic-green #8bdc1f for Scourge breach only}; high contrast against near-black,
hard ember light, NO neon, no soft pastel haze, no text, no watermark.
```

---

## 14. Consistency at scale — the workflow

Coherence comes from **conditioning, not seeds.** Seeds are a weak, provider-specific tiebreaker that break the moment an image input is added — never promise reproducibility on a style-ref path. Pin the look with two levers and a discipline.

### The style-reference strategy

**One locked style-reference image per game** — six total — generated on the hero track, hand-approved, and version-pinned. Every generation for that game is passed that ref with the instruction to *match the rendering style, lighting, and palette; new subject described below.* That is how a new asset inherits the look:

> **frozen prompt skeleton + swapped `{SUBJECT}` line + the game's pinned style-ref.**

The reference-image paths are canon in the `assetgen:` block (`referenceImages.<game>` → `packages/assets/sources/generated/lore-art-style-refs/2026-06-04/<game>.webp`). The catalog/provider plumbing to pass them is downstream work, but the **paths are now law** so providers can wire `image_urls` later without another bible edit. Until the plumbing ships, generate against the ref manually in the noob loop.

### Per provider

- **gpt-image-2** (default — best amazing-from-one-prompt + prompt adherence): pass the ref via the edit/multi-image endpoint (up to 16 refs). **No seed exists — do not pass one. No transparent background — `opaque`/`auto` only,** so generate on void and cut out in post. No negative-prompt field — fold every exclusion into positive `only/single/plain` phrasing. Fix size across the roster (1024×1536 portrait full-body), quality `high`, format `png`.
- **FLUX / fal** (reproducible scriptable workhorse): anchor with **Redux or IP-Adapter at LOW `image_prompt_strength` (0.10–0.25)** so the ref pins *style, not silhouette* — push higher and every creature collapses toward the ref's shape. Real seeds and real `negative_prompt` here (`seed:42`, `guidance_scale ~3.5`, `num_inference_steps ~28`). For per-creature consistency edits use **FLUX Kontext** and restate the invariants. Seed reproducibility breaks once an image ref is attached — treat it as a tiebreaker, not a guarantee.
- **codex / ChatGPT image path:** same gpt-image family underneath — a no-seed, conversational gpt-image-2. Good for the noob loop, not for deterministic batch.

### The noob loop (per asset, fully scriptable)

1. frozen skeleton + swapped `{SUBJECT}` line + the pinned per-game style-ref
2. generate 4 candidates
3. eye-pick the best — do **not** tune parameters between picks
4. **rembg** cutout (anime/object model variant for stylized subjects)
5. apply the shared DOOM LUT / remap, last, identically

### Batch discipline — change one axis at a time

Freeze the style-ref image, the prompt skeleton, the provider, the model version, the size, and (on FLUX) the seed — these are **immutable across the roster.** When an asset misses, alter exactly **one** of `{subject line | style-ref | one parameter}`, regenerate, and **log what you changed** in [[Generation-History]] (the provenance ledger). Vary the host family or faction read; never rewrite the whole prompt.

---

## 15. Pointers — where the rest lives

- **Tokens (authoritative):** [[DESIGN]] — the 11-color palette, type, UI, shape, and component tokens. Never relitigate them here.
- **Machine twin:** the `assetgen:` block in [[DESIGN]]'s frontmatter compiles to `style.generated.ts` and drives `buildPrompt`. This bible is its prose conscience; they must agree.
- **Provenance:** [[Generation-History]] — the per-batch ledger; every generation logs prompt, provider, params, and what one axis changed.
- **Canon to honor:** [[Scourge]], [[Scourge-Host-Families]], the Bestiary tier entries, and [[The-Pyre]] / [[The-Wardens]] / [[The-Listeners]].
- **World & tone:** [[Premise]] and the per-game pages.

This bible supersedes the old `Character-Sprite-Direction.md` and `Character-Prompt-Library.md` — their useful content (faction blocks, host-family blocks, the drift menu, the per-game framing) is folded in above. Point at this file; do not maintain parallel prompt copies.
