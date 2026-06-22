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

- Files: `fonts/oswald.woff2`, `fonts/inter.woff2`, `fonts/press-start-2p.ttf`
- Source:
  - Oswald variable font from Google Fonts `ofl/oswald`.
  - Inter variable font from Google Fonts `ofl/inter`.
  - Press Start 2P from Google Fonts `ofl/pressstart2p`, already used by
    Scourge Survivors and promoted here for shared title/menu chrome.
- License: SIL Open Font License, per Google Fonts upstream.
- Notes: subset/compressed to WOFF2 for first-pass self-hosting.

## Audio

- Files: `audio/breach-collapse.webm`, `audio/choir-whisper.webm`,
  `audio/hellfire-pulse.webm`, `audio/sfx/hit.webm`
- Source: ElevenLabs Sound Effects API (`eleven_text_to_sound_v2`), generated
  from prompts tracked in `audio/audio-catalog.json`.
- Source archive:
  `sources/generated/2026-06-12/shared/audio/elevenlabs-examples/`
- License: per ElevenLabs account terms at generation time.
- Notes: promoted over the previous deterministic local-synthesis/procedural
  placeholders.

### Victory Music

- Runtime file: `audio/victory-breach-sealed.webm`
- Title: `Verdict Thunder`
- Source: user-provided Suno MP3 export, transcoded to WebM/Opus.
- Source archive:
  `sources/generated/2026-06-12/shared/audio/verdict-thunder.mp3`
- Metadata: `created=2026-06-11T22:10:18.930345Z`,
  `id=c01be85a-797a-4804-879b-bec79f76bae3`.
- License note: confirm the Suno account was Pro/Premier at generation time
  before treating this as shippable commercial in-game music.
