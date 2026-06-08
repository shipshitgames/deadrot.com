import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, SyntheticEvent } from "react";
import { useEffect, useId, useState } from "react";
import { cn } from "./cn";
import { DEFAULT_AUDIO_SLIDER_KEYS, EFFECT_SLIDER_LABELS } from "./GameSettings.constants";
import {
  clampEffectsLevel,
  type GlobalEffectKey,
  type GlobalEffectLevels,
  type GlobalGameSettings,
  loadGlobalGameSettings,
  setGlobalEffectLevel,
  setGlobalEffectsLevel,
  subscribeGlobalGameSettings,
  toggleGlobalMusicMuted,
} from "./settings";

function stopGameInput(event: SyntheticEvent<HTMLDivElement>) {
  event.stopPropagation();
}

export interface EffectLevelSliderProps extends Omit<HTMLAttributes<HTMLLabelElement>, "onChange"> {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export function EffectLevelSlider({
  className,
  label = "Sound / VFX",
  value,
  onChange,
  ariaLabel,
  ...props
}: EffectLevelSliderProps) {
  const id = useId();
  const level = clampEffectsLevel(value);
  const percent = Math.round(level * 100);

  return (
    <label className={cn("ssg-effects-slider", className)} htmlFor={id} {...props}>
      <span className="ssg-effects-slider__top">
        <span className="ssg-effects-slider__label">{label}</span>
        <span className="ssg-effects-slider__value">{percent}%</span>
      </span>
      <input
        id={id}
        className="ssg-effects-slider__input"
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        aria-label={ariaLabel ?? `${label} level`}
        onChange={(event) => onChange(Number(event.currentTarget.value) / 100)}
      />
    </label>
  );
}

export interface EffectsLevelSliderProps extends EffectLevelSliderProps {}

export function EffectsLevelSlider(props: EffectsLevelSliderProps) {
  return <EffectLevelSlider {...props} />;
}

export interface GlobalEffectSlidersProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  settings: GlobalGameSettings;
  onChange: (key: GlobalEffectKey, value: number) => void;
  keys?: readonly GlobalEffectKey[];
}

export function GlobalEffectSliders({
  className,
  settings,
  onChange,
  keys = DEFAULT_AUDIO_SLIDER_KEYS,
  ...props
}: GlobalEffectSlidersProps) {
  return (
    <div className={cn("ssg-effects-slider-stack", className)} {...props}>
      {keys.map((key) => (
        <EffectLevelSlider
          key={key}
          label={EFFECT_SLIDER_LABELS[key]}
          value={settings.effectLevels[key]}
          ariaLabel={`${EFFECT_SLIDER_LABELS[key]} level`}
          onChange={(value) => onChange(key, value)}
        />
      ))}
    </div>
  );
}

export interface GlobalMusicToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  mutedLabel?: ReactNode;
  unmutedLabel?: ReactNode;
  onChange?: (muted: boolean) => void;
}

export function GlobalMusicToggle({
  className,
  mutedLabel = "Music Off",
  unmutedLabel = "Music On",
  onChange,
  onClick,
  type,
  onPointerDown,
  ...props
}: GlobalMusicToggleProps) {
  const [settings, setSettings] = useState(() => loadGlobalGameSettings());

  useEffect(() => subscribeGlobalGameSettings(setSettings), []);

  const muted = settings.musicMuted;
  return (
    <button
      className={cn("ssg-music-toggle", muted && "ssg-music-toggle--muted", className)}
      type={type ?? "button"}
      aria-pressed={muted}
      aria-label={muted ? "Unmute music" : "Mute music"}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      onClick={(event) => {
        const next = toggleGlobalMusicMuted();
        onChange?.(next.musicMuted);
        onClick?.(event);
      }}
      {...props}
    >
      <span className="ssg-music-toggle__dot" aria-hidden="true" />
      <span>{muted ? mutedLabel : unmutedLabel}</span>
    </button>
  );
}

export interface GlobalGameSettingsPanelProps extends HTMLAttributes<HTMLDivElement> {
  inline?: boolean;
  label?: ReactNode;
  sliderKeys?: readonly GlobalEffectKey[];
}

export function GlobalGameSettingsPanel({
  className,
  inline = false,
  label,
  sliderKeys,
  onPointerDown,
  role,
  ...props
}: GlobalGameSettingsPanelProps) {
  const [settings, setSettings] = useState(() => loadGlobalGameSettings());

  useEffect(() => subscribeGlobalGameSettings(setSettings), []);

  return (
    <div
      className={cn("ssg-game-settings-panel", inline && "ssg-game-settings-panel--inline", className)}
      onPointerDown={(event) => {
        stopGameInput(event);
        onPointerDown?.(event);
      }}
      role={role ?? "group"}
      {...props}
    >
      {label ? (
        <EffectsLevelSlider
          label={label}
          value={settings.effectsLevel}
          onChange={(level) => setGlobalEffectsLevel(level)}
        />
      ) : (
        <GlobalEffectSliders
          settings={settings}
          keys={sliderKeys}
          onChange={(key, value) => setGlobalEffectLevel(key, value)}
        />
      )}
    </div>
  );
}

export type { GlobalEffectKey, GlobalEffectLevels, GlobalGameSettings };
