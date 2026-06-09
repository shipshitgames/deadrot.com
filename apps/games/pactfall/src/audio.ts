// Pactfall audio: the shared Deadrot engine with the zero-asset house SFX
// palette, plus the choir-whisper bed for the arena's grim ritual mood.
// Music/SFX levels and mute follow the global settings store.

import { bindAudioToGlobalSettings, createDeadrotAudio } from "@deadrot/game-kit/audio";
import choirWhisper from "@shipshitgames/assets/shared/audio/choir-whisper.ogg?url";

export const audio = createDeadrotAudio({
  musicTracks: { main: { url: choirWhisper, volume: 0.18, loop: true } },
  defaultTrack: "main",
});

bindAudioToGlobalSettings(audio);
