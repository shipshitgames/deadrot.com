---
version: 0.1.0
name: Ship Shit Games
description: >-
  DOOM-grade visual identity for the Ship Shit Games universe — brutal, metal,
  blood, and hellfire. Dark, heavy, high-contrast. Not neon, not clean sci-fi.
colors:
  primary: "#c1121f"
  void: "#0a0a0a"
  coal: "#121214"
  iron: "#1e1e22"
  gunmetal: "#34343c"
  blood: "#c1121f"
  bloodHot: "#ff2a18"
  hellfire: "#ff6a00"
  rust: "#8a4b2a"
  bone: "#e9e3d6"
  ash: "#9b958a"
  toxic: "#8bdc1f"
typography:
  display:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 400
    letterSpacing: "0em"
    textTransform: "uppercase"
  body:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "\"SSG Press Start\", ui-monospace, SFMono-Regular, Menlo, monospace"
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
elevation:
  flat: "none"
  ember: "0 0 0 1px rgba(255,106,0,0.35), 0 0 26px -6px rgba(193,18,31,0.65)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.hellfire}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.coal}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "24px"
  panel-raised:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "16px"
  panel-metal:
    backgroundColor: "{colors.gunmetal}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "16px"
  terminal:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ash}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "16px"
  badge-blood:
    backgroundColor: "{colors.blood}"
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-hot:
    backgroundColor: "{colors.bloodHot}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-rust:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.bone}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-toxic:
    backgroundColor: "{colors.toxic}"
    textColor: "{colors.void}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"

gameArtDirection:
  shared:
    medium: "medium-chunky high-detail pixel art"
    renderRules: "nearest-neighbor scaling, lossless hard edges, ordered dithering, no anti-aliasing"
    paletteRules: "void/coal/gunmetal bodies, blood/rust grime, bone highlights, hellfire rim light"
    enemyRules: "silhouette first; parasites must visibly infest or rewrite a host"
  scourge-survivors:
    title: "Scourge Survivors"
    camera: "first-person billboard sprites, front-facing full-body enemies and pickups"
    assetFraming: "enemy silhouettes readable at FPS combat distance; weapons and pickups centered and iconic"
    paletteBias: "blood and hellfire for combat feedback; toxic only for breach cores and Scourge weak points"
  deadlane:
    title: "Deadlane"
    camera: "top-down / high-angle lane-defense sprites"
    assetFraming: "units, towers, lanes, and projectiles readable from above"
    paletteBias: "gunmetal lane structures, blood pressure, hellfire tower heat"
  pactfall:
    title: "Pactfall"
    camera: "isometric 3/4-view champion sprites"
    assetFraming: "MOBA-scale heroes with readable ability silhouettes and faction crests"
    paletteBias: "faction identity first, then blood/hellfire combat states"
  starblight:
    title: "Starblight"
    camera: "side-on / top-down arcade space-shooter sprites"
    assetFraming: "ships, projectiles, and orbital threats readable at speed against void"
    paletteBias: "void and bone for space contrast, hellfire engines, toxic breach matter"
  redline:
    title: "Redline"
    camera: "side-on courier-runner sprites"
    assetFraming: "profile silhouettes readable at high lane speed"
    paletteBias: "blood-hot speed marks, rust infrastructure, hellfire exhaust"
  rothulk:
    title: "Rothulk"
    camera: "side-on platformer sprites"
    assetFraming: "chunky traversal poses, clear hazards, readable Scourge bio-ship parts"
    paletteBias: "coal/iron interiors, bone highlights, toxic infestation nodes"
  warline:
    title: "Warline"
    camera: "map-first SVG/strategy interface with compact faction icons"
    assetFraming: "regions, lanes, breaches, pressure, and faction control visible at a glance"
    paletteBias: "Wardens=blood, Pyre=hellfire, Scourge=toxic, neutral=gunmetal"

assetgen:
  # ── LOCKED house look (2026-06-04): MEDIUM-CHUNKY DETAILED PIXEL ART.
  # Decided by the style bake-off (shipshitgames/shipshitgames#62). Appended after
  # {prompt}. {kind}. {framing}. — see promptTemplate.order below. The AI only
  # APPROXIMATES the grid; the TRUE pixel grid + palette are enforced in post
  # (gradeParams: box-downscale to ~110px + hard palette remap + rembg cutout).
  styleSuffix: >-
    high-detail PIXEL ART game sprite on a visible chunky pixel grid (medium
    chunky, roughly a 110px-tall sprite), bold hand-placed pixels with hard crisp
    edges and NO anti-aliasing, ordered dithered shading, a clean silhouette-first
    readable shape with a subtle dark outline and a single hellfire rim-light from
    one low side (hellfire {tokens.hellfire} into blood-hot {tokens.bloodHot}) so
    it pops off a near-black background, fixed limited DOOM palette of
    {tokens.void}/{tokens.coal}/{tokens.gunmetal} body with
    {tokens.blood}/{tokens.rust} grime and {tokens.bone} highlights, premium
    modern pixel-art (Blasphemous, Dead Cells) crossed with remastered 1990s DOOM
    sprites, detailed but not noisy, NO neon, no text, no watermark, no UI, single
    subject only, near-black background, it MUST read as chunky pixel art made of
    visible square pixels, NOT a smooth 3D render, NOT photorealistic, NOT
    anti-aliased, NOT painted concept art

  # Always-on style exclusions. Dual-use (see negativeMode per provider).
  # Also emitted standalone as the top-level `negativePromptSet:` below.
  negativePrompts:
    - smooth 3D render
    - rendered 3D model
    - photorealistic
    - photographic
    - anti-aliased smooth edges
    - airbrushed
    - painted concept art
    - blurry
    - hi-fi render
    - cel-shaded cartoon
    - anime
    - cute
    - chibi
    - slender elegant graceful proportions
    - symmetrical pretty anatomy
    - clean plate-armor fantasy knight
    - medieval robes capes or swords
    - clean minimal sci-fi
    - superhero proportions
    - soft diffuse even lighting
    - bright daylight
    - pastel colors
    - rainbow saturation
    - cool blue or teal grade
    - magenta cyan or any neon glow
    - clean white background
    - background scenery or landscape
    - multiple characters
    - text watermark or logo
    - UI frames or HUD
    - cropped or close-up framing that hides the silhouette

  # Per-game camera framing. SUPERSEDES GAME_FRAMING in style.ts L8-16.
  # Game slugs + shared. Interpolated as {framing} in the template.
  perGameFraming:
    scourge-survivors: first-person game billboard sprite, front-facing, full body
    deadlane: top-down / high-angle game sprite, silhouette readable from above
    pactfall: isometric 3/4-view game sprite, champion scale
    starblight: side-on / top-down arcade space-shooter sprite, crisp readable silhouette
    redline: side-on Sonic-like runner sprite, profile silhouette readable at courier-lane speed
    rothulk: side-on Mario-like platformer sprite, profile silhouette, clear readable pose
    warline: map-first strategy icon, faction marker, readable at small scale
    shared: game asset

  # {kind} rewrite map (mirrors style.ts L30). Unlisted kinds pass through verbatim.
  kindMap:
    texture: seamless tileable texture

  # Auto-injected when /\bscourge\b/i matches {prompt}. SUPERSEDES style.ts L31-33.
  # Appended as the final clause, after styleSuffix.
  scourgeRule:
    trigger: "\\bscourge\\b"
    flags: i
    clause: >-
      Scourge subjects must read as one parasite army wearing conquered host
      races: ruptured host flesh, invasive tendrils, embedded toxic-green
      ({tokens.toxic}) breach cores, black chitin over stolen bone/metal, fused
      wreckage or machinery; vary host family among flesh, chitin, mycelial,
      machine-graft, bone-titan, or voidship; never a standalone generic demon
      or alien; if it lacks this grammar it is only a monster, not the Scourge

  # PIXEL post-pipeline — the AI only APPROXIMATES pixels; THIS enforces the real
  # grid + palette. cutout -> box-downscale to the grid -> hard palette remap.
  gradeParams:
    pixelGrid: 110                # target sprite HEIGHT in px (rank-and-file); boss ~180
    downscale: box                # box-filter downscale to the TRUE pixel grid
    nearestFilter: true           # render in-engine with NearestFilter (no smoothing)
    dither: ordered               # ordered/Bayer — NOT Floyd-Steinberg (no crawl when animated)
    antialias: false              # hard 1px edges
    hardRemap: true               # SNAP to the fixed DOOM ramp (pixel art = limited palette)
    targetPalette: doom           # the colors: map in this frontmatter
    palettePath: packages/assets/tokens/palettes/doom.gpl
    outline: subtle-dark          # 1px darker outline so sprites pop off dark backgrounds
    preserveEmissive: true        # keep hellfire/toxic emitters hot through the remap
    blackPoint: "{tokens.void}"   # #0a0a0a — true near-black floor
    encode: webp-lossless         # lossless so hard pixel edges survive
    cutout:
      tool: rembg                 # runs on the near-black render BEFORE downscale
      order: after-generate-before-downscale

  # The missing styleRef plumbing, as data. One locked image per game; codegen
  # emits these as STYLE_REF for providers to pass via image refs (downstream).
  referenceImages:
    scourge-survivors: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp
    deadlane: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/deadlane.webp
    pactfall: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/pactfall.webp
    starblight: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/starblight.webp
    redline: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/redline.webp
    rothulk: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/rothulk.webp
    shared: packages/assets/sources/generated/lore-art-style-refs/2026-06-04/scourge-survivors.webp

  # Provider settings. Defaults + per-provider overrides codegen bakes in.
  providers:
    default: openai
    size: 1024x1536               # portrait full-body; keep fixed across roster
    candidates: 4                 # generate N, eye-pick one
    openai:
      model: gpt-image-2
      quality: high
      output_format: png
      background: opaque          # WARNING: gpt-image-2 dropped `transparent`.
      # ^ do NOT request transparent here (providers.ts L28 is wrong for v2);
      #   the void render + rembg cutout produces the alpha instead.
      seed: null                  # no seed param on gpt-image-* — never pass one
      negativeMode: fold          # no negative_prompt field → fold into suffix
      styleRef: image_refs        # pass referenceImages[game] via edit/multi-image
      styleRefNote: >-
        match the rendering style, lighting and palette of the reference image;
        new creature described in the prompt
    fal:
      model: fal-ai/flux/dev      # FLUX on fal; honors real seeds
      image_size: square_hd
      guidance_scale: 3.5
      num_inference_steps: 28
      seed: 42                    # reproducible on pure text-to-image only
      negativeMode: param         # maps negativePrompts → negative_prompt
      styleRef: redux             # Redux/IP-Adapter; keep strength LOW
      image_prompt_strength: 0.18 # 0.1–0.25 = style pin, not silhouette collapse
      styleRefNote: >-
        ref controls STYLE not SHAPE; seed reproducibility breaks once an image
        ref is attached (non-deterministic vision embedding)
    codex:
      model: gpt-image-2          # same family under the hood as openai
      negativeMode: fold          # no negative field; fold into suffix
      seed: null
      background: opaque
      note: conversational/no-seed path; good for the noob loop, not batch determinism

  # The composition grammar. MUST stay in sync with buildPrompt() in style.ts.
  # buildPrompt today = `${prompt}. ${kind}. ${framing}. ${DOOM_SUFFIX}` +
  #                     `${scourgeRule ? `. ${scourgeRule}` : ""}` + ".".
  promptTemplate:
    order: [prompt, kind, framing, styleSuffix, scourgeRule]
    join: ". "                    # slot separator
    terminator: "."               # trailing period
    conditional:
      scourgeRule: scourgeRule.trigger   # only when prompt matches the regex
    kindResolve: kindMap          # {kind} runs through kindMap first
    framingResolve: perGameFraming # {framing} = perGameFraming[game] ?? .shared
    tokenSource: colors           # {tokens.*} resolve against this file's colors:
    # Equivalent emitted string:
    #   `${prompt}. ${kindMap[kind] ?? kind}. ${perGameFraming[game] ?? perGameFraming.shared}. ` +
    #   `${styleSuffix}${scourgeMatch ? `. ${scourgeRule.clause}` : ""}.`
    emits:
      file: packages/assetgen/src/style.generated.ts
      exports: [STYLE_SUFFIX, NEGATIVE_PROMPTS, GAME_FRAMING, KIND_MAP, SCOURGE_RULE, GRADE_PARAMS, STYLE_REF, PROVIDER_SETTINGS, buildPrompt]
      consumedBy: packages/assetgen/src/style.ts   # re-exports the generated consts

# ── Standalone canonical negative-prompt set (mirror of assetgen.negativePrompts;
#    provided top-level for consumers that only want the negatives).
negativePromptSet:
  - smooth 3D render
  - rendered 3D model
  - photorealistic
  - photographic
  - anti-aliased smooth edges
  - airbrushed
  - painted concept art
  - blurry
  - hi-fi render
  - cel-shaded cartoon
  - anime
  - cute
  - chibi
  - slender elegant graceful proportions
  - symmetrical pretty anatomy
  - clean plate-armor fantasy knight
  - medieval robes capes or swords
  - clean minimal sci-fi
  - superhero proportions
  - soft diffuse even lighting
  - bright daylight
  - pastel colors
  - rainbow saturation
  - cool blue or teal grade
  - magenta cyan or any neon glow
  - clean white background
  - background scenery or landscape
  - multiple characters
  - text watermark or logo
  - UI frames or HUD
  - cropped or close-up framing that hides the silhouette
---

## Overview

The single source of design truth for **everything** — the website, every game's HUD and
menus, and every AI-generated asset. The aesthetic is **DOOM**: brutal, metal, blood, and
hellfire. Dark, heavy, gritty, high-contrast. This supersedes the earlier "neon-industrial"
direction — there is **no magenta/cyan neon**. An agent that reads this file should produce
black-void surfaces, gunmetal panels, bone headlines in uppercase pixel type, and
blood-red call-to-action buttons with an ember glow. The lore [[Style-Bible]] points here.

### Game Art Direction

Use `gameArtDirection.shared` as the house style, then layer the matching game
slug on top. Each game entry defines its camera, asset framing, palette bias,
and gameplay readability rule. `assetgen.perGameFraming` is the machine prompt
hook for camera/framing; `gameArtDirection` is the richer direction map for
agents, artists, and future generators.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `primary` | `#c1121f` | machine-readable primary alias for blood |
| `void` | `#0a0a0a` | page / scene background |
| `coal` | `#121214` | panels, cards |
| `iron` | `#1e1e22` | raised surfaces |
| `gunmetal` | `#34343c` | borders, dividers, metal |
| `blood` | `#c1121f` | **primary** — danger, CTAs, kills |
| `bloodHot` | `#ff2a18` | hot / hover states |
| `hellfire` | `#ff6a00` | secondary — embers, highlights |
| `rust` | `#8a4b2a` | grime, texture, muted accent |
| `bone` | `#e9e3d6` | headings / strong text |
| `ash` | `#9b958a` | body / dim text |
| `toxic` | `#8bdc1f` | **the Scourge only** — sickly bio-glow, sparingly |

Rule: **red + fire + metal + bone.** Toxic-green is reserved for the Scourge. Never neon.

Scourge rule: the Scourge is a **parasite first**. Scourge assets should show infestation,
host takeover, invasive growth, fused wreckage, stolen bone/metal, ruptured tissue, and
embedded breach cores. Avoid generic standalone demons, clean aliens, or monsters that do
not look like they are wearing, consuming, or rewriting a host. The army can include
multiple conquered host races and ruined technologies, but all forms need the same
parasite grammar: toxic-green nodes, black chitin, wet tissue, tendrils, and rupture seams.

## Typography

- **Display** — SSG Press Start / Press Start 2P 400, UPPERCASE, zero tracking. Pixel title, menu, and HUD labels.
- **Body** — SSG Press Start / Press Start 2P 400. All player-facing UI should stay pixelized.
- **Mono** — SSG Press Start / Press Start 2P 400. Counters, ammo, timers, and HUD numerics.

## Layout

- Centered max-width containers (~`72rem` for marketing); generous vertical rhythm from the
  `spacing` scale. Card grids: 1 col → 2 → 3 at `md`/`lg`.
- In-game: HUD hugs the screen edges; heavy corners; numerics in mono.

## Elevation & Depth

- **No soft neon glow.** Depth comes from value contrast, hard 1–2px borders, and inset
  shadows. The only glow is **ember** (`elevation.ember`) — orange→red — used sparingly on
  hot/active elements (Play buttons, alarms, breach FX).

## Shapes

- Near-square. `rounded.sm` (2px) is the default; `rounded.none` for HUD/industrial chrome.
- Hard edges, riveted/stencilled metal, warning-stripe motifs. No pill/`rounded-2xl` softness.

## Components

- **button-primary** — `primary` bg, `bone` text, `rounded.sm`. Main CTA.
- **button-secondary** — `hellfire` bg, `void` text, `rounded.sm`. Secondary hot action.
- **card** — `coal` bg, `bone` text, `rounded.sm`; border in implementation should use `gunmetal`.
- **panel-raised / panel-metal** — `iron` or `gunmetal` surfaces for HUD and chrome.
- **terminal** — `void` bg, `ash` mono text, `rounded.sm`.
- **badge** — `blood`, `bloodHot`, `rust`, and `toxic` variants for status and faction tags.

## Do's and Don'ts

**Do:** lead with red + fire + metal + bone; UPPERCASE pixel headers; reserve toxic-green
for the Scourge; make Scourge forms read as parasitic infestation; use ember glow sparingly;
keep edges hard and high-contrast.

**Don't:** magenta/cyan or any neon; soft/large glows; pastel or low-contrast text;
heavy rounding; clean/minimal sci-fi. If it doesn't feel like blood on gunmetal, it's wrong.
