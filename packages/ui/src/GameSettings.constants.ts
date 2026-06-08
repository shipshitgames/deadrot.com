import type { GlobalEffectKey } from "./settings";

export const EFFECT_SLIDER_LABELS: Record<GlobalEffectKey, string> = {
  music: "Music",
  sound: "Sound FX",
  particles: "Particles / Debris",
  flash: "Flash / Glow",
  shake: "Shake / Recoil",
};

export const DEFAULT_AUDIO_SLIDER_KEYS: readonly GlobalEffectKey[] = ["music", "sound"];
