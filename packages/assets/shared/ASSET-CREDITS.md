# Shared Asset Credits

First-pass shared placeholders added 2026-06-05 so
`assets-catalog.json` resolves without missing shared files.

## Entity Plates

- Files: `../entities/**/<game>.webp`
- Source: 256x256 visible first-pass plates derived from the best existing
  Deadrot website/runtime sprite or portrait for each canon entity id.
- License: project-owned derived placeholders.
- Notes: these replaced 182-byte placeholder WebPs. They are not final per-game
  camera renders; regenerate them through the locked medium-chunky pixel
  pipeline.

## FX

- Files: `fx/blood-splatter.webp`, `fx/ember-burst.webp`,
  `fx/muzzle-flash.webp`, `fx/breach-glow.webp`
- Source: deterministic local pixel-art placeholders generated with `ffmpeg`
  filter graphs.
- License: project-owned placeholder output.
- Notes: replace with promoted sprite sheets when the shared FX pass lands.

## UI

- Files: `ui/icon-pyre.svg`, `ui/icon-warden.svg`, `ui/icon-scourge.svg`,
  `ui/icon-breach.svg`, `ui/icon-lane.svg`
- Source: hand-authored SVG using the `DESIGN.md` palette.
- License: project-owned.
- Notes: canonical enough for UI scaffolding; not final faction branding.

## Fonts

- Files: `fonts/oswald.woff2`, `fonts/inter.woff2`
- Source:
  - Oswald variable font from Google Fonts `ofl/oswald`.
  - Inter variable font from Google Fonts `ofl/inter`.
- License: SIL Open Font License, per Google Fonts upstream.
- Notes: subset/compressed to WOFF2 for first-pass self-hosting.

## Audio

- Files: `audio/breach-collapse.ogg`, `audio/choir-whisper.ogg`,
  `audio/hellfire-pulse.ogg`
- Source: deterministic local synthesis with `ffmpeg` oscillators/noise filters.
- License: project-owned placeholder output.
- Notes: replace with studio-licensed final SFX before public release if needed.
