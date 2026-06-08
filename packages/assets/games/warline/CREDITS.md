# Warline Asset Credits

## Portal Deck Textures

- Files: `textures/portal-deck/{floor,wall,block,column,decal}.webp`
- Date: 2026-06-07
- Source: deterministic local procedural texture generation, encoded with `cwebp -lossless -z 6`
- Scope: Warline runtime lobby/front map

## Portal Deck Props

- Files: `props/portal-deck/*.webp`
- Date: 2026-06-07
- Source: generated with the built-in Codex `image_gen` tool, keyed from flat chroma backgrounds with `ffmpeg colorkey`, cropped where needed, encoded with `cwebp -lossless -exact`
- Scope: Warline runtime lobby/front map

## Lobby Music

- File: `audio/music/doom-you-got-the-chainsaw.webm`
- Title: DOOM / YOU GOT THE CHAINSAW
- Date added: 2026-06-07
- Source: user-provided local MP3 file
- Post-processing: transcoded to WebM/Opus at 64 kbps for runtime loading
- Scope: Warline runtime lobby/front map
