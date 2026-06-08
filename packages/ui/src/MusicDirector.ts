import { loadGlobalGameSettings, subscribeGlobalGameSettings } from "./settings";

/**
 * A single authored music bed. `url` is a bundler-resolved asset URL (import the
 * .webm/.ogg and pass it through). `gain` trims per-track loudness so beds sit at
 * a consistent level. `intensity` is reserved for the adaptive layer (see the
 * Adaptive Music epic) and is ignored by the current track-swapping backbone.
 */
export interface MusicTrackDef {
  id: string;
  url: string;
  /** Per-track loudness trim, 0..1. Default 1. */
  gain?: number;
  /** Reserved for adaptive scoring — calm/tense/combat bucket. */
  intensity?: "calm" | "tense" | "combat";
}

/**
 * A named musical context — a menu loop, a gameplay bed, a shuffle playlist.
 * Switching scenes crossfades; re-`play()`ing the same scene id is a no-op.
 */
export interface MusicSceneDef {
  id: string;
  tracks: MusicTrackDef[];
  /** Shuffle playlist order (no immediate repeats). Defaults to true when >1 track. */
  shuffle?: boolean;
  /** Crossfade duration between scenes/tracks, ms. Default 1200. */
  crossfadeMs?: number;
  /** Loop a single-track scene seamlessly. Default true. Ignored for playlists (they advance). */
  loop?: boolean;
}

interface Voice {
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  gain: GainNode;
}

const DEFAULT_CROSSFADE_MS = 1200;

/**
 * Framework-agnostic music conductor shared by every Deadrot game.
 *
 * - Routes all music through one master gain that tracks the global music
 *   volume + mute ([[settings]]), so the in-game sliders and the corner mute
 *   button control every game's music for free.
 * - Crossfades between scenes and playlist tracks via a two-voice A/B bus.
 * - SSR-safe and autoplay-safe: the AudioContext is created lazily and only
 *   starts after {@link resume} is called from a user gesture.
 *
 * The current backbone does horizontal track-swapping + shuffle playlists.
 * Vertical (layered) adaptive scoring is a planned extension that will add
 * parallel gain-controlled voices keyed off {@link setIntensity}.
 */
export class MusicDirector {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: [Voice | null, Voice | null] = [null, null];
  private activeVoice = 0;
  private scene: MusicSceneDef | null = null;
  private order: number[] = [];
  private orderPos = 0;
  private intensity = 0;
  private unsubscribe: (() => void) | null = null;
  private readonly baseGain: number;

  constructor(opts?: { baseGain?: number }) {
    // baseGain is the bed level before the global 0..1 music slider is applied.
    this.baseGain = opts?.baseGain ?? 0.5;
  }

  /** Resume the AudioContext from a user gesture (first click/keydown). Safe to call repeatedly. */
  resume(): void {
    this.ensureContext();
    if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  /** Start or switch to a scene, crossfading from whatever is playing. */
  play(scene: MusicSceneDef): void {
    if (typeof window === "undefined" || scene.tracks.length === 0) return;
    this.ensureContext();
    if (this.scene?.id === scene.id) return; // already on this scene
    this.scene = scene;
    this.order = this.buildOrder(scene);
    this.orderPos = 0;
    const first = scene.tracks[this.order[0] ?? 0];
    if (first) this.startTrack(first, scene, true);
  }

  /** Fade out and stop all music. */
  stop(fadeMs = 600): void {
    this.scene = null;
    for (const voice of this.voices) {
      if (voice) this.fade(voice, 0, fadeMs, () => voice.el.pause());
    }
  }

  /**
   * Set the current action intensity, 0 (calm) .. 1 (peak). Stored now and used
   * by the adaptive layer to mix combat stems in/out. No audible effect yet.
   */
  setIntensity(value01: number): void {
    this.intensity = Math.max(0, Math.min(1, value01));
  }

  /** Current action intensity, 0..1 — consumed by the adaptive layer (see issue #260). */
  get currentIntensity(): number {
    return this.intensity;
  }

  /** Tear down audio nodes and the settings subscription. */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const voice of this.voices) {
      if (!voice) continue;
      voice.el.pause();
      voice.el.src = "";
      try {
        voice.src.disconnect();
        voice.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.voices = [null, null];
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.scene = null;
  }

  // --- internals -----------------------------------------------------------

  private ensureContext(): void {
    if (this.ctx || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume(loadGlobalGameSettings());
    // Live-track the global music slider + mute for every game at once.
    this.unsubscribe = subscribeGlobalGameSettings((settings) => this.applyVolume(settings));
  }

  private applyVolume(settings: { effectLevels: { music: number }; musicMuted: boolean }): void {
    if (!this.master || !this.ctx) return;
    const level = settings.musicMuted ? 0 : Math.max(0, Math.min(1, settings.effectLevels.music));
    this.master.gain.setTargetAtTime(this.baseGain * level, this.ctx.currentTime, 0.05);
  }

  private buildOrder(scene: MusicSceneDef): number[] {
    const indices = scene.tracks.map((_, i) => i);
    const shuffle = scene.shuffle ?? scene.tracks.length > 1;
    if (!shuffle) return indices;
    // Vary the seed by track count + a rotating cursor so successive scenes differ
    // without Math.random (unavailable in some runtimes). Fisher-Yates with a
    // cheap LCG seeded off the scene id.
    let seed = 0;
    for (const ch of scene.id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const result: number[] = [];
    while (indices.length > 0) {
      const [picked] = indices.splice(Math.floor(rand() * indices.length), 1);
      if (picked !== undefined) result.push(picked);
    }
    return result;
  }

  private acquireVoice(slot: number): Voice {
    const existing = this.voices[slot];
    if (existing) return existing;
    const ctx = this.ctx as AudioContext;
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(this.master as GainNode);
    const voice: Voice = { el, src, gain };
    this.voices[slot] = voice;
    return voice;
  }

  private startTrack(track: MusicTrackDef, scene: MusicSceneDef, crossfade: boolean): void {
    if (!this.ctx) return;
    const nextSlot = crossfade ? this.activeVoice ^ 1 : this.activeVoice;
    const prev = this.voices[this.activeVoice];
    const voice = this.acquireVoice(nextSlot);
    const single = scene.tracks.length === 1;
    voice.el.loop = single && (scene.loop ?? true);
    voice.el.onended = single ? null : () => this.advance();
    voice.el.src = track.url;
    voice.el.currentTime = 0;
    const target = track.gain ?? 1;
    void voice.el.play().catch(() => {
      // Autoplay blocked until a user gesture calls resume(); the element will
      // start on the next play attempt.
    });
    const ms = scene.crossfadeMs ?? DEFAULT_CROSSFADE_MS;
    this.fade(voice, target, crossfade ? ms : 0);
    if (prev && prev !== voice) this.fade(prev, 0, ms, () => prev.el.pause());
    this.activeVoice = nextSlot;
  }

  private advance(): void {
    if (!this.scene) return;
    this.orderPos = (this.orderPos + 1) % this.order.length;
    const track = this.scene.tracks[this.order[this.orderPos] ?? 0];
    if (track) this.startTrack(track, this.scene, true);
  }

  private fade(voice: Voice, to: number, ms: number, onDone?: () => void): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const g = voice.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (ms <= 0) g.setValueAtTime(to, now);
    else g.linearRampToValueAtTime(to, now + ms / 1000);
    if (onDone) window.setTimeout(onDone, ms + 30);
  }
}
