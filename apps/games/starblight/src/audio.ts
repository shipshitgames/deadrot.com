// Starblight audio: the shared Deadrot engine with the zero-asset house SFX
// palette (laser/gem/levelup/boss/etc are all procedural cues) plus the shared
// choir-whisper music bed. Levels/mute follow the global settings store.

import { bindAudioToGlobalSettings, createDeadrotAudio } from "@deadrot/game-kit/audio";
import choirWhisper from "@shipshitgames/assets/shared/audio/choir-whisper.ogg?url";

export const audio = createDeadrotAudio({
  musicTracks: { main: { url: choirWhisper, volume: 0.18, loop: true } },
  defaultTrack: "main",
});

bindAudioToGlobalSettings(audio);
