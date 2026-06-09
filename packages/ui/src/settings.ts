export interface GlobalGameSettings {
  effectLevels: GlobalEffectLevels;
  musicMuted: boolean;
}

export type GlobalGameSettingsListener = (settings: GlobalGameSettings) => void;
export type GlobalEffectKey = "music" | "sound" | "particles" | "flash" | "shake";
export type GlobalEffectLevels = Record<GlobalEffectKey, number>;
export type GlobalGameSettingsPatch = Partial<Omit<GlobalGameSettings, "effectLevels">> & {
  effectLevels?: Partial<GlobalEffectLevels>;
};

export const GLOBAL_GAME_SETTINGS_KEY = "shipshitgames.gameSettings.v1";
export const GLOBAL_GAME_SETTINGS_EVENT = "shipshitgames:game-settings";
export const DEFAULT_EFFECTS_LEVEL = 1;
export const GLOBAL_EFFECT_KEYS = ["music", "sound", "particles", "flash", "shake"] as const;
export const DEFAULT_GLOBAL_EFFECT_LEVELS: GlobalEffectLevels = {
  music: DEFAULT_EFFECTS_LEVEL,
  sound: DEFAULT_EFFECTS_LEVEL,
  particles: DEFAULT_EFFECTS_LEVEL,
  flash: DEFAULT_EFFECTS_LEVEL,
  shake: DEFAULT_EFFECTS_LEVEL,
};
export const DEFAULT_GLOBAL_GAME_SETTINGS: GlobalGameSettings = {
  effectLevels: DEFAULT_GLOBAL_EFFECT_LEVELS,
  musicMuted: false,
};

export function clampEffectsLevel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_EFFECTS_LEVEL;
  return Math.max(0, Math.min(1, n));
}

export function normalizeGlobalEffectLevels(
  value: Partial<GlobalEffectLevels> | null | undefined,
  fallback = DEFAULT_EFFECTS_LEVEL,
): GlobalEffectLevels {
  const fallbackLevel = clampEffectsLevel(fallback);
  return {
    music: clampEffectsLevel(value?.music ?? fallbackLevel),
    sound: clampEffectsLevel(value?.sound ?? fallbackLevel),
    particles: clampEffectsLevel(value?.particles ?? fallbackLevel),
    flash: clampEffectsLevel(value?.flash ?? fallbackLevel),
    shake: clampEffectsLevel(value?.shake ?? fallbackLevel),
  };
}

function normalizeGlobalGameSettings(value: Partial<GlobalGameSettings> | null | undefined): GlobalGameSettings {
  return {
    effectLevels: normalizeGlobalEffectLevels(value?.effectLevels),
    musicMuted: value?.musicMuted === true,
  };
}

export function loadGlobalGameSettings(): GlobalGameSettings {
  if (typeof window === "undefined") return DEFAULT_GLOBAL_GAME_SETTINGS;

  try {
    const raw = window.localStorage.getItem(GLOBAL_GAME_SETTINGS_KEY);
    if (!raw) return DEFAULT_GLOBAL_GAME_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GlobalGameSettings> | null;
    return normalizeGlobalGameSettings(parsed);
  } catch {
    return DEFAULT_GLOBAL_GAME_SETTINGS;
  }
}

export function saveGlobalGameSettings(settings: GlobalGameSettingsPatch): GlobalGameSettings {
  const current = loadGlobalGameSettings();
  const nextEffectLevels = normalizeGlobalEffectLevels({ ...current.effectLevels, ...settings.effectLevels });
  const next = normalizeGlobalGameSettings({
    ...current,
    ...settings,
    effectLevels: nextEffectLevels,
  });

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(GLOBAL_GAME_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private-mode errors */
    }
    window.dispatchEvent(new CustomEvent<GlobalGameSettings>(GLOBAL_GAME_SETTINGS_EVENT, { detail: next }));
  }

  return next;
}

export function getGlobalEffectLevel(key: GlobalEffectKey): number {
  return loadGlobalGameSettings().effectLevels[key];
}

export function setGlobalEffectLevel(key: GlobalEffectKey, value: number): GlobalGameSettings {
  return saveGlobalGameSettings({ effectLevels: { [key]: value } as Partial<GlobalEffectLevels> });
}

export function setGlobalEffectLevels(effectLevels: Partial<GlobalEffectLevels>): GlobalGameSettings {
  return saveGlobalGameSettings({ effectLevels });
}

export function setGlobalMusicMuted(musicMuted: boolean): GlobalGameSettings {
  return saveGlobalGameSettings({ musicMuted });
}

export function toggleGlobalMusicMuted(): GlobalGameSettings {
  const settings = loadGlobalGameSettings();
  return setGlobalMusicMuted(!settings.musicMuted);
}

export function subscribeGlobalGameSettings(listener: GlobalGameSettingsListener): () => void {
  if (typeof window === "undefined") return () => {};

  listener(loadGlobalGameSettings());

  const onCustom = (event: Event) => {
    listener((event as CustomEvent<GlobalGameSettings>).detail ?? loadGlobalGameSettings());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === GLOBAL_GAME_SETTINGS_KEY) listener(loadGlobalGameSettings());
  };

  window.addEventListener(GLOBAL_GAME_SETTINGS_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GLOBAL_GAME_SETTINGS_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
