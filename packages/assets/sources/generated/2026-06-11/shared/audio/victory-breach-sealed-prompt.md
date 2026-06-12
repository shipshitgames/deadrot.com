# Victory: Breach Sealed Audio Prompt

Date: 2026-06-11
Target runtime asset: `packages/assets/shared/audio/victory-breach-sealed.webm`
Recommended tools: Soundraw or Beatoven for final music; ElevenLabs SFX or OptimizerAI for a layered one-shot variant.

## Prompt

Create a short, legally distinct victory stinger for a dark retro shooter / survivors game. The cue should feel like a breach has been sealed after a brutal run: one heavy low-frequency metallic implosion, then a triumphant but grim four-to-eight-second fanfare with distorted industrial percussion, low brass-like synths, choral-pad texture without intelligible words, and a final bright hellfire chord.

Mood: earned, violent, relieved, arcade-readable, not cheerful. Palette: blood-red metal, hellfire orange, bone-white sparks, toxic-green breach energy fading out. Tempo can be around 92-110 BPM, but the piece should work as a one-shot win screen cue, not a full loop. Leave a clean tail for UI ambience.

Avoid direct imitation of any named game, movie, or composer. Do not quote recognizable melodies, leitmotifs, sound logos, or sample libraries. It can borrow broad genre energy from 1990s arena-shooter intermission stingers and console-RPG victory fanfares, but the melody, harmony, rhythm, and sound design must be original.

## Runtime Notes

- Export final as WebM/Opus.
- Target duration: 6-10 seconds.
- Target loudness: balanced below weapon SFX, with strong initial transient.
- Use `loop: false` in game music configs.
- Preserve the final tool, plan, date, and license scope in `shared/ASSET-CREDITS.md` or the consuming game manifest.
