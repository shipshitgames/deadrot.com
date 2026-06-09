# @deadrot/game-kit

Deadrot-local shared game runtime modules. Private workspace package — games
consume it with `"@deadrot/game-kit": "workspace:*"`; the TS source is imported
directly (no build step), same as `@shipshitgames/ui`.

## Modules

- `@deadrot/game-kit/audio` — `AudioEngine` (generalized from Scourge
  Survivors): authored music beds through a music bus, authored one-shot
  samples with procedural-synth fallback, autoplay unlock handling.
  `DEADROT_SFX_PALETTE` ships 35+ zero-asset procedural cues (`kill`, `jump`,
  `build`, `laser`, …) so silent games get a full SFX set with no new assets.
  `bindAudioToGlobalSettings(engine)` wires the shared settings store
  (music/sound levels + mute) from `@shipshitgames/ui`.
- `@deadrot/game-kit/juice` — `ScreenShake` (redline's kick/decay/dual-sine
  model), `ParticleBursts` (pooled one-shot `THREE.Points`), `DamageNumbers`
  (pooled DOM numbers projected through a camera), `FlashOverlay`
  (hit-flash/vignette DOM overlays). All scale by the per-channel effect
  levels (`shake`/`particles`/`flash`) from the shared settings store.
- `@deadrot/game-kit/core` — `createFixedLoop` (1/120 fixed-step accumulator),
  `createRng` (seeded mulberry32), `createLocalStore` (versioned typed
  localStorage), `createPool` (object pool), `InputLatch` (held/edge-latched
  input intents).

## Boundary notes

Per `.agents/memory/repo-boundary.md` this package is Deadrot-owned and
workspace-only (never published). **Upstream candidates** for the org-level
`@shipshitgames/engine` (sibling repo) once APIs settle: `createFixedLoop`,
`createRng`, `createPool`, `InputLatch`, `ScreenShake`. Do not fork engine
code here; generic pieces graduate by being upstreamed and published, then
deleted from this package.
