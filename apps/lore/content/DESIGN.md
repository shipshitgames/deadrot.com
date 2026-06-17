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
  acidOchre: "#b9a83a"
  hazardYellow: "#d6a21f"
  bruisedViolet: "#5a3a6f"
  verdigris: "#3f6b5d"
typography:
  display:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
    fontWeight: 800
    letterSpacing: "0em"
    textTransform: "uppercase"
  body:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
    fontWeight: 600
    lineHeight: 1.35
  mono:
    fontFamily: "\"SSG Comic Condensed\", \"Arial Black\", Impact, sans-serif"
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
    rounded: "comic-bubble"
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
    medium: "clean comic-book / cel-shaded ink game art"
    renderRules: "bold ink contours, flat readable value blocks, controlled grime, transparent/cutout-ready runtime sheets"
    paletteRules: "void/coal/gunmetal bodies, blood/rust grime, bone highlights, hellfire rim light; toxic-green only for Scourge parasite organs"
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
  brawl:
    title: "Brawl"
    camera: "side-on / 3/4-view trench-fighter sprites"
    assetFraming: "fighters, impacts, trench hazards, and ring-out silhouettes readable in Duel and 2-4 fighter arena distance"
    paletteBias: "mud, gunmetal, bone-white trench marks, blood-hot impact reads, toxic only for Scourge pressure"
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
  # ── LOCKED house look (2026-06-17): CLEAN COMIC-BOOK / CEL-SHADED INK.
  # Supersedes the 2026-06-04 medium-chunky pixel target. Existing pixel runtime
  # assets may remain as scaffolding, but new masters and promoted runtime sheets
  # should move toward comic ink: bold contour, flat readable value blocks,
  # transparent/cutout-ready framing, no halftone/stipple/dotted noise.
  styleSuffix: >-
    clean comic-book / cel-shaded ink game asset, bold black contour lines,
    graphic flat shadow shapes, readable silhouette-first design, controlled
    grime, crisp transparent-cutout-friendly edges, one hard hellfire rim-light
    from a low side (hellfire {tokens.hellfire} into blood-hot
    {tokens.bloodHot}), DOOM x grim graphic-novel mood, palette of
    {tokens.void}/{tokens.coal}/{tokens.gunmetal} body with
    {tokens.blood}/{tokens.rust} grime and {tokens.bone} highlights, no text,
    no watermark, single subject unless explicitly requested, it MUST read as
    clean comic/cel ink for a game, NOT pixel art, NOT halftone, NOT stippled,
    NOT noisy, NOT a smooth photoreal render

  # Always-on style exclusions. Dual-use (see negativeMode per provider).
  # Also emitted standalone as the top-level `negativePromptSet:` below.
  negativePrompts:
    - smooth 3D render
    - rendered 3D model
    - photorealistic
    - photographic
    - pixel art
    - visible square pixel grid
    - ordered dithering
    - halftone dots
    - stipple
    - dotted light artifacts
    - noisy speckles
    - airbrushed
    - blurry
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
    brawl: side-on / 3/4-view trench-fighter sprite, readable in Duel and 2-4 fighter arena distance
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
      machine-graft, bone-titan, or voidship, and use muted host color lanes
      under the same warm grade so roles remain readable; never a standalone
      generic demon or alien; if it lacks this grammar it is only a monster, not
      the Scourge

  # Legacy pixel post-pipeline kept for old scaffolding assets only. New comic
  # runtime sheets should use cutout cleanup, WebP encoding, and manifest records
  # without forcing a pixel grid or dither pass.
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
  - pixel art
  - visible square pixel grid
  - ordered dithering
  - halftone dots
  - stipple
  - dotted light artifacts
  - noisy speckles
  - airbrushed
  - blurry
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
black-void surfaces, gunmetal panels, bone headlines in uppercase comic display type, and
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
| `acidOchre` | `#b9a83a` | muted spore sacs, bile membranes, ranged hazard reads |
| `hazardYellow` | `#d6a21f` | Warden hazard marks, worn stencils, industrial warnings |
| `bruisedViolet` | `#5a3a6f` | muted wing membranes / voidship shadow tissue, never neon |
| `verdigris` | `#3f6b5d` | oxidized old metal and voidship corrosion, desaturated only |

Rule: **red + fire + metal + bone** as the grade, with muted lane colors for readability.
Toxic-green is reserved for the Scourge. Never neon.

Scourge rule: the Scourge is a **parasite first**. Scourge assets should show infestation,
host takeover, invasive growth, fused wreckage, stolen bone/metal, ruptured tissue, and
embedded breach cores. Avoid generic standalone demons, clean aliens, or monsters that do
not look like they are wearing, consuming, or rewriting a host. The army can include
multiple conquered host races and ruined technologies, but all forms need the same
parasite grammar: toxic-green nodes, black chitin, wet tissue, tendrils, and rupture seams.
Use role lanes to keep foes identifiable at speed: blood-red heavy melee, acid-ochre /
toxic ranged sacs, bruised-violet membranes for light flyers, rust / verdigris machine
corrosion, and bone / ash for titans and exposed armor. All lanes pass through the same
dirty warm DOOM grade; none become clean body paint.

## Typography

- **Display** — SSG Comic Condensed / heavy condensed comic display, UPPERCASE, zero tracking. Title, menu, HUD labels, pause panels, and comic impact words.
- **Body** — SSG Comic Condensed / condensed sans. Player-facing UI should read like comic lettering, not retro pixel type.
- **Mono** — SSG Comic Condensed with tabular numerics where possible. Counters, ammo, timers, and HUD numerics keep clear figure alignment.

## Layout

- Centered max-width containers (~`72rem` for marketing); generous vertical rhythm from the
  `spacing` scale. Card grids: 1 col → 2 → 3 at `md`/`lg`.
- In-game: HUD hugs the screen edges; heavy corners; numerics in mono.

## Elevation & Depth

- **No soft neon glow.** Depth comes from value contrast, hard 1–2px borders, and inset
  shadows. The only glow is **ember** (`elevation.ember`) — orange→red — used sparingly on
  hot/active elements (Play buttons, alarms, breach FX).

## Shapes

- Cards should read as comic speech bubbles, caption boxes, or torn ink panels: thick black contour,
  slightly irregular corners, hard offset shadow, and an optional tail/notch.
- `rounded.sm` (2px) remains the default for small controls; `rounded.none` for HUD/industrial chrome.
- Hard edges, riveted/stencilled metal, warning-stripe motifs. No generic SaaS card softness.

## Components

- **button-primary** — `primary` bg, `bone` text, `rounded.sm`. Main CTA.
- **button-secondary** — `hellfire` bg, `void` text, `rounded.sm`. Secondary hot action.
- **card** — comic bubble/caption panel with thick black ink border, hard offset shadow, and optional tail/notch.
- **panel-raised / panel-metal** — `iron` or `gunmetal` surfaces for HUD and chrome.
- **terminal** — `void` bg, `ash` mono text, `rounded.sm`.
- **badge** — `blood`, `bloodHot`, `rust`, and `toxic` variants for status and faction tags.

## Do's and Don'ts

**Do:** lead with red + fire + metal + bone; UPPERCASE comic headers; reserve toxic-green
for the Scourge; make Scourge forms read as parasitic infestation; use ember glow sparingly;
keep edges hard and high-contrast.

**Don't:** magenta/cyan or any neon; soft/large glows; pastel or low-contrast text;
heavy rounding; clean/minimal sci-fi. If it doesn't feel like blood on gunmetal, it's wrong.
