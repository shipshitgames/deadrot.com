// Starblight audio: the shared Deadrot engine with promoted shared samples plus
// the house fallback palette for cues that are still procedural. Levels/mute
// follow the global settings store.

import { bindAudioToGlobalSettings, createDeadrotAudio } from "@deadrot/game-kit/audio";
import choirWhisper from "@shipshitgames/assets/shared/audio/choir-whisper.webm?url";
import hitImpact from "@shipshitgames/assets/shared/audio/sfx/hit.webm?url";

export const audio = createDeadrotAudio({
  musicTracks: { main: { url: choirWhisper, volume: 0.18, loop: true } },
  defaultTrack: "main",
  sfxSamples: { hit: { url: hitImpact, volume: 0.86, loop: false } },
});

bindAudioToGlobalSettings(audio);
