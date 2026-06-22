// Audio via the Web Audio API: authored music beds routed through the music bus
// (so the volume/mute controls apply), plus authored one-shot samples with a
// procedural-synth fallback for every cue. Generalized from the Scourge Survivors
// engine — games supply their own tracks, samples, and cue palette; the unlock,
// preload, and decode logic is preserved verbatim from the proven implementation.

import { DEADROT_SFX_PALETTE, type DeadrotSfx, type SfxCue, type Synth } from "./sfxPalette";

/** A playable asset reference: URL plus the authored gain/loop from its manifest. */
export interface AudioSource {
  url: string;
  /** Authored base gain — music beds default to 0.2, samples to 1. */
  volume?: number;
  /** Music beds default to looping. */
  loop?: boolean;
}

export interface AudioEngineConfig<Sfx extends string, Track extends string> {
  /** Procedural cue table — the zero-asset fallback (and default) for every SFX name. */
  palette: Record<Sfx, SfxCue>;
  /** Authored looping music beds. Omit for SFX-only games. */
  musicTracks?: Record<Track, AudioSource>;
  defaultTrack?: Track;
  /** Authored one-shot samples (decoded once); unlisted cues stay procedural. */
  sfxSamples?: Partial<Record<Sfx, AudioSource>>;
}

const MUSIC_BASE_GAIN = 0.2;
const SFX_BUS_BASE_GAIN = 0.5;

export class AudioEngine<Sfx extends string = DeadrotSfx, Track extends string = string> {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private musicEnabled = true;
  private sfxEnabled = true;

  // Global-settings scalars (0..1) layered on top of the authored base gains.
  private musicLevel = 1;
  private sfxLevel = 1;
  private musicMuted = false;
  // Base gain of the currently-playing authored bed (from its manifest entry).
  private musicBaseGain = MUSIC_BASE_GAIN;

  // authored-music layer: file beds → musicBus
  private musicEl: HTMLAudioElement | null = null;
  private musicSrcNode: MediaElementAudioSourceNode | null = null;
  private currentTrack: Track | null = null;
  private loadedTrack: Track | null = null;
  private autoUnlockArmed = false;

  // authored SFX sample buffers (decoded once; procedural synth is the fallback)
  private sampleBuffers = new Map<Sfx, AudioBuffer>();
  // Per-cue gain from each sample's manifest `volume` — lets us balance loudness
  // in the manifest without re-rendering audio.
  private sampleVolumes = new Map<Sfx, number>();
  private samplesRequested = false;

  private readonly synth: Synth = {
    zap: (t, type, f0, f1, dur, gain) => this.zap(t, type, f0, f1, dur, gain),
    noise: (t, dur, gain, filterFreq) => this.noise(t, dur, gain, filterFreq),
    chord: (t, freqs, dur) => this.chord(t, freqs, dur),
  };

  constructor(private readonly config: AudioEngineConfig<Sfx, Track>) {
    if (typeof window !== "undefined") {
      if (this.trackSource(config.defaultTrack)) this.preloadMusic(config.defaultTrack);
      this.armAutoUnlock();
    }
  }

  private trackSource(track: Track | null | undefined): AudioSource | null {
    if (!track) return null;
    return this.config.musicTracks?.[track] ?? null;
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicBaseGain * this.musicGainScalar();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = SFX_BUS_BASE_GAIN * this.sfxLevel;
      this.sfxBus.connect(this.master);
      if (!this.connectMusicElement()) return false;
      this.loadSamples();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /** Call from a user gesture (click) so the browser allows audio. */
  unlock() {
    if (!this.ensure() || !this.ctx) return;
    const start = () => {
      if (this.musicEnabled) this.startMusic();
    };
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().then(start, start);
    } else {
      start();
    }
  }

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (!this.ctx) {
      if (on) {
        this.preloadMusic(this.currentTrack ?? this.config.defaultTrack);
        this.armAutoUnlock();
      }
      return;
    }
    if (on) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  setSfxEnabled(on: boolean) {
    this.sfxEnabled = on;
  }

  // ---------------------------------------------- global-settings levels
  //
  // The global settings store feeds 0..1 scalars + a mute flag through these.
  // They multiply the authored base gains (musicBus 0.2 base, sfxBus 0.5 base),
  // so the existing mix is preserved at level 1 and unmuted.

  /** Music multiplier 0..1, layered on the authored bed volume. */
  setMusicLevel(level: number) {
    this.musicLevel = Math.max(0, Math.min(1, level));
    this.applyMusicGain();
  }

  /** SFX multiplier 0..1, layered on the 0.5 sfx-bus base. */
  setSfxLevel(level: number) {
    this.sfxLevel = Math.max(0, Math.min(1, level));
    if (this.sfxBus) this.sfxBus.gain.value = SFX_BUS_BASE_GAIN * this.sfxLevel;
  }

  /** Honor the global music-mute flag — forces the music bus to silence. */
  setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    this.applyMusicGain();
  }

  /** Combined music scalar: muted (or level 0) → 0, else the level. */
  private musicGainScalar(): number {
    return this.musicMuted ? 0 : this.musicLevel;
  }

  /** Push the current base × scalar onto the live music bus. */
  private applyMusicGain() {
    if (this.musicBus) this.musicBus.gain.value = this.musicBaseGain * this.musicGainScalar();
  }

  get musicOn() {
    return this.musicEnabled;
  }
  get sfxOn() {
    return this.sfxEnabled;
  }
  /** Exposed for verification/diagnostics. */
  get contextState() {
    return this.ctx ? this.ctx.state : "none";
  }

  // --------------------------------------------------------------- music
  //
  // Authored beds play through `musicBus` so the music volume + mute apply.

  /** Switch the authored bg track; takes effect immediately if music is enabled. */
  playMusic(track: Track) {
    this.currentTrack = track;
    if (!this.musicEnabled) return;
    if (!this.ctx) {
      this.preloadMusic(track);
      this.armAutoUnlock();
      return;
    }
    this.startMusic();
  }

  /** Start the currently-selected authored music bed. */
  private startMusic() {
    if (!this.ctx) return;
    const track = this.currentTrack ?? this.config.defaultTrack;
    if (!track) return;
    this.playTrack(track);
  }

  /** Stop authored music. */
  private stopMusic() {
    this.musicEl?.pause();
  }

  /** Load + loop an authored bed through the music bus. */
  private playTrack(track: Track) {
    if (!this.ctx || !this.musicBus) return;
    const entry = this.trackSource(track);
    if (!entry) return;
    this.currentTrack = track;
    this.preloadMusic(track);
    if (!this.connectMusicElement()) return;
    const el = this.ensureMusicElement();
    el.loop = entry.loop ?? true;
    this.musicBaseGain = entry.volume ?? MUSIC_BASE_GAIN;
    this.applyMusicGain();
    void el.play().catch(() => this.handleTrackPlaybackFailure());
  }

  private handleTrackPlaybackFailure() {
    this.loadedTrack = null;
    this.musicEl?.pause();
  }

  /** Preload the authored bed even before Web Audio is unlocked. */
  preloadMusic(track: Track | null | undefined = this.currentTrack ?? this.config.defaultTrack) {
    const entry = this.trackSource(track);
    if (!track || !entry) return;
    const el = this.ensureMusicElement();
    el.loop = entry.loop ?? true;
    if (this.loadedTrack !== track) {
      el.src = entry.url;
      this.loadedTrack = track;
      el.load();
    }
  }

  private ensureMusicElement(): HTMLAudioElement {
    if (this.musicEl) return this.musicEl;
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.addEventListener("error", () => this.handleTrackPlaybackFailure());
    el.addEventListener("ended", () => {
      if (!this.musicEnabled || !this.currentTrack || !el.loop) return;
      el.currentTime = 0;
      void el.play().catch(() => this.handleTrackPlaybackFailure());
    });
    this.musicEl = el;
    return el;
  }

  private connectMusicElement(): boolean {
    if (!this.ctx || !this.musicBus) return true;
    const el = this.ensureMusicElement();
    if (this.musicSrcNode) return true;
    try {
      this.musicSrcNode = this.ctx.createMediaElementSource(el);
      this.musicSrcNode.connect(this.musicBus);
      return true;
    } catch {
      this.handleTrackPlaybackFailure();
      return false;
    }
  }

  private armAutoUnlock() {
    if (this.autoUnlockArmed || typeof window === "undefined") return;
    this.autoUnlockArmed = true;
    const unlockOnce = () => {
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
      window.removeEventListener("touchstart", unlockOnce);
      this.autoUnlockArmed = false;
      this.unlock();
    };
    window.addEventListener("pointerdown", unlockOnce, { once: true, passive: true });
    window.addEventListener("keydown", unlockOnce, { once: true });
    window.addEventListener("touchstart", unlockOnce, { once: true, passive: true });
  }

  // ----------------------------------------------------------------- sfx

  /** Decode the authored samples once; failures just leave that cue procedural. */
  private loadSamples() {
    if (this.samplesRequested || !this.ctx) return;
    this.samplesRequested = true;
    const samples = this.config.sfxSamples;
    if (!samples) return;
    for (const [name, entry] of Object.entries(samples) as [Sfx, AudioSource | undefined][]) {
      if (!entry) continue;
      this.sampleVolumes.set(name, entry.volume ?? 1);
      fetch(entry.url)
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx?.decodeAudioData(b))
        .then((decoded) => {
          if (decoded) this.sampleBuffers.set(name, decoded);
        })
        .catch(() => {}); // unloaded → procedural fallback for this cue
    }
  }

  /** Play an authored one-shot sample through the sfx bus; false if none is loaded. */
  private playSample(name: Sfx, pitch: number): boolean {
    const buf = this.sampleBuffers.get(name);
    if (!buf || !this.ctx || !this.sfxBus) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const vol = this.sampleVolumes.get(name) ?? 1;
    if (vol !== 1) {
      // Per-cue level from the manifest (config-only loudness balance).
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.sfxBus);
    } else {
      src.connect(this.sfxBus);
    }
    src.start();
    return true;
  }

  sfx(name: Sfx, opts?: { pitch?: number }) {
    if (!this.sfxEnabled || !this.ensure() || !this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    // Authored sample if loaded (slight pitch jitter so rapid fire isn't a flat repeat); else synth.
    if (this.playSample(name, opts?.pitch ?? 0.97 + Math.random() * 0.06)) return;
    const cue = this.config.palette[name];
    if (!cue) return;
    cue(this.synth, this.ctx.currentTime, opts?.pitch ?? 1);
  }

  private zap(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number) {
    if (!this.ctx || !this.sfxBus) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, gain: number, filterFreq: number) {
    if (!this.ctx || !this.sfxBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private chord(t: number, freqs: number[], dur: number) {
    freqs.forEach((f, i) => {
      this.zap(t + i * 0.08, "triangle", f, f, dur, 0.22);
    });
  }

  private noiseBuffer(dur: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

/**
 * The batteries-included engine for Deadrot games: full house SFX palette with
 * optional authored tracks/samples layered on top. Games with zero authored
 * audio get 35+ procedural cues for free.
 */
export function createDeadrotAudio<Track extends string = string>(
  config: Omit<Partial<AudioEngineConfig<DeadrotSfx, Track>>, "palette"> & {
    palette?: Partial<Record<DeadrotSfx, SfxCue>>;
  } = {},
): AudioEngine<DeadrotSfx, Track> {
  const { palette, ...rest } = config;
  return new AudioEngine<DeadrotSfx, Track>({
    ...rest,
    palette: { ...DEADROT_SFX_PALETTE, ...palette },
  });
}
