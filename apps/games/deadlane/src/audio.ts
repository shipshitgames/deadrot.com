// Deadlane audio: the shared Deadrot engine with the zero-asset house SFX
// palette (the `build` thunk was literally authored for this game) plus the
// shared hellfire-pulse music bed. Levels/mute follow the global settings store.

import { bindAudioToGlobalSettings, createDeadrotAudio } from "@deadrot/game-kit/audio";
import hellfirePulse from "@shipshitgames/assets/shared/audio/hellfire-pulse.ogg?url";

export const audio = createDeadrotAudio({
  musicTracks: { main: { url: hellfirePulse, volume: 0.18, loop: true } },
  defaultTrack: "main",
});

bindAudioToGlobalSettings(audio);
