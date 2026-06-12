---
status: active
type: prompt-batch
style: locked medium-chunky detailed pixel art
feeds:
  - packages/assets/sources/generated/lore-art-previs/2026-06-04
  - Generation-History
---

# 2026-06-04 Game Pre-Viz

Purpose: create one cover/key-art pre-viz direction per game in the locked [[Style-Bible]]
house style, with an extra [[Scourge-Survivors]] variant for comparison.

## Style Lock Used

- Medium-chunky detailed PIXEL ART.
- Visible square pixel grid, hard crisp edges, ordered dithering.
- Fixed limited DOOM palette: void, coal, gunmetal, blood, rust, bone, hellfire.
- Toxic green appears only on [[Scourge]] breach cores, nodes, and parasite glow.
- No smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges,
  magenta/cyan neon, cool blue grade, readable text, logos, watermarks, or UI frames.

## Outputs

| Game | Workspace Draft | Source Output | Notes |
| --- | --- | --- | --- |
| [[Scourge-Survivors]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/scourge-survivors-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a252076c81919f7e6dbcdc777114.png` | First FPS cover pass. Good style and title-space read. |
| [[Deadlane]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/deadlane-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a33e45a48191b7e8ebb689164226.png` | Strong tower-defense lane read. |
| [[Pactfall]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/pactfall-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a395e8948191aeb2090f1b739d40.png` | Corrects live asset's fantasy-knight drift toward Pyre/Warden arena language. Watch for sword-read in future iterations. |
| [[Starblight]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/starblight-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a3fbd9dc8191ae2e312f577a8beb.png` | Strongest game-specific camera read. |
| [[Redline]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/redline-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a45d3ed08191b26fbc5d67ba6757.png` | Good runner motion direction. Iterate toward cleaner side-on silhouette if needed. |
| [[Rothulk]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/rothulk-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a4b6984081919e68f86d57f80a5d.png` | Clear side-on platform path inside the bio-hulk. |
| [[Zero-Day]] v01 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/zero-day-v01.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a5217a408191bdbd9b523127c1ae.png` | Fills the currently missing live cover slot conceptually. |
| [[Scourge-Survivors]] v02 | `packages/assets/sources/generated/lore-art-previs/2026-06-04/scourge-survivors-v02.png` | `~/.codex/generated_images/019e9356-ec1a-7ab1-9cd1-bf183f811698/ig_02707971619c5bf8016a21a5868c708191983ade141c8e130a.png` | More explicit three-tier FPS enemy fantasy. Compare against v01. |

## Prompts

### Scourge Survivors v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Scourge Survivors pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: a first-person breach arena choked with Scourge host-puppets, ruined industrial stone and gunmetal, hellfire vents, blood-wet lane floor, near-black upper shadows.
Subject: player's brutal industrial energy weapon in the foreground firing hellfire-orange muzzle flash into a dense charging swarm; Scourge bodies show ruptured host flesh, invasive tendrils, black chitin over stolen bone/metal, and sparse toxic-green breach nodes.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Strong silhouette readability, brutal DOOM-grade grime, heavy-metal album-cover drama expressed as pixels.
Composition: portrait cover plate, centered action corridor, readable foreground weapon and multiple swarm tiers, generous dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, anime, cute, clean sci-fi, fantasy knights, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Deadlane v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Deadlane pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: a fortified lane through a ruined industrial city, high-angle tower-defense view, Warden walls and modular gun towers braced on both sides, burning skyline and crushed black smoke.
Subject: a packed Scourge horde pouring down the central lane toward the towers; Warden defenses fire hellfire-orange tracers and explosions into the mass. Scourge host bodies show ruptured flesh, black chitin, tendrils, stolen bone and metal, sparse toxic-green breach cores. The lane geography must read clearly from above.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Strong readable silhouettes at tower-defense zoom, brutal grime, no smooth rendering.
Composition: portrait cover plate, high oblique top-down camera, central vanishing lane, towers framing the sides, swarm density visible, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, anime, cute, clean sci-fi, fantasy knights, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Pactfall v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Pactfall pre-viz key art in the locked Ship Shit Games house style, correcting the live asset's fantasy-knight drift.
Scene/backdrop: Ashgate arena district, cracked industrial MOBA lane with two faction bases, Warden barricades and Pyre breach-burn marks, Scourge neutral objective rupturing at the center.
Subject: one Pyre duelist and one Warden bastion facing each other across the lane, clearly human tactical operators rather than medieval knights. Pyre reads triangular, scorched, forward-leaning, hellfire visor and cauterizer blade/rifle; Warden reads square, planted, gunmetal slab armor, shield hardware, engineering rig. Behind them, a Trucebreaker-like Scourge neutral boss rises with toxic-green breach core and parasite tendrils.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Arena-readable champion silhouettes, brutal industrial grime, no smooth rendering.
Composition: portrait cover plate, isometric 3/4 MOBA camera, two opposing human silhouettes in the lower third, Scourge objective looming center/top, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, medieval knights, fantasy robes, paladin armor, swords-and-shields fantasy, anime, cute, clean sci-fi, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Starblight v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Starblight pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: orbital ring over a burning world, broken station struts, debris fields, red-orange atmospheric glow, black void sky.
Subject: a Pyre interceptor pilot craft banking hard through Scourge voidship hosts and infected carrier spores. Enemy craft are not clean aliens: they are conquered hull plates, bone-like voidship shells, red parasite tendrils, black chitin, engine organs, and sparse toxic-green breach hearts. The player craft reads as fast human war-machine, gunmetal and blood-red panels, hellfire thrusters.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Side-on/top-down arcade shooter readability, crisp silhouettes, brutal grime.
Composition: portrait cover plate, diagonal dogfight composition, player craft lower center, infected carrier looming upper right, orbital ring curve below, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, clean sci-fi glow, Star Wars-like ships, anime, cute, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Redline v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Redline pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: a high-speed courier lane cut through a burning industrial city, collapsed bridges, rail gantries, Warden/Pyre relay markers, Scourge tendrils breaking through the asphalt behind.
Subject: a Pyre courier sprinting side-on at dangerous speed with a sealed helmet, compact runner armor, courier pack, ember visor, and hellfire exhaust streaks; a Warden courier silhouette or checkpoint structure ahead; the Scourge swarm and toxic-green Choir nodes chasing from behind. Must read as a side-on runner/platformer fantasy, not a generic poster.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Motion silhouette over surface noise, brutal grime, no smooth rendering.
Composition: portrait cover plate, strong left-to-right side profile motion, diagonal lane perspective, courier in lower center/left, pursuing Scourge pressure behind, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, clean sci-fi, superhero suit, fantasy robes, anime, cute, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Rothulk v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Rothulk pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: inside The Rothulk, a living Scourge bio-hulk mixed with rusted ship machinery, ribbed flesh tunnels, bone platforms, hanging cables as tendrils, hellfire-lit depths, toxic-green breach heart far above.
Subject: a Pyre saboteur in side-on platformer profile crossing a bone-and-gunmetal platform, carrying a compact bomb/cauterizer charge, while Scourge growth surrounds the route. The environment itself is the enemy: host flesh, black chitin, stolen metal, toxic-green nodes, wet rupture seams.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Platformer readability, chunky silhouettes, brutal grime, no smooth rendering.
Composition: portrait cover plate, strict side-on platformer readability, saboteur small but clear on lower-left platform, vertical climb path and massive breach organ above, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, cute platformer tone, clean sci-fi, fantasy dungeon, anime, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Zero-Day v01

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Zero-Day pre-viz key art in the locked Ship Shit Games house style.
Scene/backdrop: the first-contact night humanity lost the sky: orbital defense line over a city/colony world, burning atmosphere, falling debris, anti-orbital guns, emergency beacons, ash-black clouds.
Subject: the first Scourge breach carrier punching through from space, not a clean alien ship but a conquered voidship host: broken hull plates, bone-like shell, red parasite tendrils, black chitin, toxic-green breach heart, engine organs. Human defense craft and flak trails are tiny and overwhelmed. The image should feel like a doomed last stand, not victory.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Brutal DOOM-grade grime, readable silhouettes, no smooth rendering.
Composition: portrait cover plate, colossal infected carrier descending from upper center, human city/orbital guns in lower third, orange atmospheric fires and green breach core contrast, dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, clean sci-fi, sleek alien saucer, fantasy, anime, cute, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

### Scourge Survivors v02

```text
Use case: stylized-concept
Asset type: game pre-viz key-art plate, portrait 2:3 cover candidate
Primary request: Generate a fresh Scourge Survivors pre-viz key art variant in the locked Ship Shit Games house style.
Scene/backdrop: Ashgate breach arena, close-quarters industrial kill corridor, broken walls, hanging cables, gore-black floor, hellfire cracks, near-black upper shadows.
Subject: first-person Pyre Purger viewpoint with two gloved arms and a heavy cauterizer weapon blasting a cone of hellfire into three readable Scourge tiers: a Swarm Ripper in front, a Spitter behind, and a larger breach-boss silhouette in the distance. Scourge must show host takeover: ruptured flesh, black chitin, tendrils, stolen bone/metal, sparse toxic-green breach nodes.
Style constraints: high-detail medium-chunky PIXEL ART on a visible square pixel grid, hard crisp edges, ordered dithering, fixed limited DOOM palette of void black, coal, gunmetal, blood red, rust, bone, hellfire orange, and toxic green only on Scourge cores. Brutal DOOM-grade grime, readable silhouettes, no smooth rendering.
Composition: portrait cover plate, first-person weapon lower right, charging Scourge centered, clear dark top area for future title overlay but no text.
Avoid: smooth 3D render, photorealism, painted concept art, anti-aliased smooth edges, airbrushed look, clean sci-fi, fantasy knights, anime, cute, magenta/cyan neon, cool blue grade, readable text, logos, watermarks, UI frames.
```

## Iteration Notes

- Current live gallery assets are broadly on-style, but `zero-day.webp` is missing on production and the live Pactfall cover leans too fantasy-knight.
- For Pactfall v02, tighten the Pyre duelist away from sword fantasy: more cauterizer rifle / breach tool, less blade.
- For Redline v02, push a cleaner side-on runner silhouette and reduce poster-depth if the goal is gameplay readability over cover drama.
- For Scourge Survivors, compare v01 title-space composition against v02 enemy-tier clarity before promotion.
