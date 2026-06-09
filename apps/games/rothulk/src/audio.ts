// Rothulk audio: the shared Deadrot engine with the zero-asset house SFX
// palette (the jump/land cues were literally authored for this game) plus the
// shared breach-collapse music bed. Levels/mute follow the global settings store.

import { bindAudioToGlobalSettings, createDeadrotAudio } from "@deadrot/game-kit/audio";
import breachCollapse from "@shipshitgames/assets/shared/audio/breach-collapse.ogg?url";

export const audio = createDeadrotAudio({
  musicTracks: { main: { url: breachCollapse, volume: 0.18, loop: true } },
  defaultTrack: "main",
});

bindAudioToGlobalSettings(audio);
