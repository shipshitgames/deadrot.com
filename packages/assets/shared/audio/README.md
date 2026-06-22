# Shared Audio

Game-agnostic SFX and ambience shared across the Scourge universe.

`audio-catalog.json` is the shared audio ledger. It records what each runtime
file is, where the preserved master/source lives, whether it loops, and whether
the current file still needs an ElevenLabs replacement pass. It also lists the
procedural `DEADROT_SFX_PALETTE` fallback cues that still need authored sample
promotion.

Promoted shared runtime slots:

- `breach-collapse.webm` — a breach (Scourge nest) collapsing once its repeater
  is severed.
- `choir-whisper.webm` — the hive-mind ("the Choir") ambient whisper bed.
- `hellfire-pulse.webm` — short Pyre/hellfire pulse cue.
- `sfx/hit.webm` — shared hit-impact sample promoted over the procedural
  oscillator cue.
- `victory-breach-sealed.webm` — all-games win-screen music, currently the
  WebM/Opus runtime transcode of the user-provided Suno export
  `Verdict Thunder`.

These are referenced from `assets-catalog.json` under `shared` (`kind:
"audio"`).
