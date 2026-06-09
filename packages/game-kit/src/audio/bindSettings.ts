// Glue between an AudioEngine and the shared cross-game settings store. Every
// game wrote this subscription by hand; now it's one call in the app shell.

import { subscribeGlobalGameSettings } from "@shipshitgames/ui";

export interface AudioSettingsTarget {
  setMusicLevel(level: number): void;
  setSfxLevel(level: number): void;
  setMusicMuted(muted: boolean): void;
}

/**
 * Subscribe the engine to the global settings store (music/sound channel levels
 * + music mute). Fires immediately with the persisted values. Returns the
 * unsubscribe function.
 */
export function bindAudioToGlobalSettings(audio: AudioSettingsTarget): () => void {
  return subscribeGlobalGameSettings((s) => {
    audio.setMusicLevel(s.effectLevels.music);
    audio.setSfxLevel(s.effectLevels.sound);
    audio.setMusicMuted(s.musicMuted);
  });
}
