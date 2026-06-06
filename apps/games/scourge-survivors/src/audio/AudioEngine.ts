// Audio via the Web Audio API: authored music beds (Suno .webm, routed through the
// music bus so the volume/mute controls apply), plus authored/synthesised SFX. A
// single shared instance is used by the game and the React settings UI.

import { audioEntry, audioUrl } from '../assets/catalog'

type SfxName =
  | 'shoot'
  | 'shootSmg'
  | 'shootSniper'
  | 'shootShotgun'
  | 'shootCannon'
  | 'hit'
  | 'headshot'
  | 'kill'
  | 'reload'
  | 'pickup'
  | 'hurt'
  | 'switch'
  | 'wave'
  | 'boss'
  | 'victory'
  | 'defeat'
  | 'shieldhit'
  | 'levelup'
  // --- expanded palette (Scourge gaps + cross-game seeds) ---
  | 'explosion' // boss death / barrel — big descending boom + crackle
  | 'dash' // dodge/sprint whoosh
  | 'dryfire' // empty magazine click
  | 'shieldUp' // boss raises its shield — rising shimmer
  | 'gem' // Survivors XP-gem pickup (brighter than 'pickup')
  | 'combo' // Survivors combo tier up
  | 'lowhealth' // heartbeat warning pulse
  | 'breach' // a Scourge breach opens — low groan + dissonant swell (thematic)
  | 'uiSelect' // menu click (distinct from weapon 'switch')
  | 'gold' // shop / meta currency pickup — double cha-ching
  | 'jump' // platformer hop (Rothulk)
  | 'land' // landing thud (Rothulk)
  | 'build' // tower placement thunk (Deadlane)
  | 'powerup' // ascending sparkle (Starblight / pickups)
  | 'berserk' // blood-rage pickup activation
  | 'laser' // arcade pew (Starblight)

type MusicMode = 'menu' | 'campaign' | 'survivors' | 'multiplayer'

// Authored bg-music beds (generated with Suno; see @shipshitgames/assets Scourge audio credits).
const MUSIC_TRACKS = {
  'blood-circuit-ascension': 'music-blood-circuit-ascension',
  'ash-reactor': 'music-ash-reactor',
} as const
export type MusicTrack = keyof typeof MUSIC_TRACKS
const DEFAULT_TRACK: MusicTrack = 'ash-reactor' // gameplay loop; menu/boss can switch via playMusic()

// Authored weapon-SFX samples (decoded to buffers, played one-shot per trigger). Any
// SfxName not listed here stays procedural — the zero-asset fallback.
const SFX_SAMPLE_IDS: Partial<Record<SfxName, string>> = {
  shoot: 'sfx-pistol-pyre',
  shootSmg: 'sfx-smg-pyre',
  shootSniper: 'sfx-sniper',
  shootShotgun: 'sfx-shotgun',
  shootCannon: 'sfx-cannon',
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null

  private musicEnabled = true
  private sfxEnabled = true
  private musicMode: MusicMode = 'menu'

  // authored-music layer: file beds → musicBus
  private musicEl: HTMLAudioElement | null = null
  private musicSrcNode: MediaElementAudioSourceNode | null = null
  private currentTrack: MusicTrack | null = null
  private loadedTrack: MusicTrack | null = null

  // authored weapon-SFX sample buffers (decoded once; procedural synth is the fallback)
  private sampleBuffers = new Map<SfxName, AudioBuffer>()
  private samplesRequested = false

  private ensure(): boolean {
    if (this.ctx) return true
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return false
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = 0.2
      this.musicBus.connect(this.master)
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = 0.5
      this.sfxBus.connect(this.master)
      this.loadSamples()
      return true
    } catch {
      this.ctx = null
      return false
    }
  }

  /** Call from a user gesture (click) so the browser allows audio. */
  unlock() {
    if (!this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.musicEnabled) this.startMusic()
  }

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on
    if (!this.ctx) return
    if (on) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      this.startMusic()
    } else {
      this.stopMusic()
    }
  }

  setSfxEnabled(on: boolean) {
    this.sfxEnabled = on
  }

  setMusicMode(mode: MusicMode) {
    if (this.musicMode === mode) return
    this.musicMode = mode
    if (!this.musicEnabled || !this.ctx) return
    this.playMusic(this.trackForMode(mode))
  }

  get musicOn() {
    return this.musicEnabled
  }
  get sfxOn() {
    return this.sfxEnabled
  }
  /** Exposed for verification/diagnostics. */
  get contextState() {
    return this.ctx ? this.ctx.state : 'none'
  }

  // --------------------------------------------------------------- music
  //
  // Authored .webm beds play through `musicBus` so the music volume + mute apply.

  private trackForMode(mode: MusicMode): MusicTrack {
    return mode === 'survivors' || mode === 'multiplayer'
      ? 'blood-circuit-ascension'
      : 'ash-reactor'
  }

  /** Switch the authored bg track; takes effect immediately if music is enabled. */
  playMusic(track: MusicTrack) {
    this.currentTrack = track
    if (this.musicEnabled && this.ctx) this.startMusic()
  }

  /** Start the currently-selected authored music bed. */
  private startMusic() {
    if (!this.ctx) return
    this.playTrack(this.currentTrack ?? DEFAULT_TRACK)
  }

  /** Stop authored music. */
  private stopMusic() {
    this.musicEl?.pause()
  }

  /** Load + loop an authored bed through the music bus. */
  private playTrack(track: MusicTrack) {
    if (!this.ctx || !this.musicBus) return
    this.currentTrack = track
    if (!this.musicEl) {
      const el = new Audio()
      el.preload = 'auto'
      try {
        this.musicSrcNode = this.ctx.createMediaElementSource(el)
        this.musicSrcNode.connect(this.musicBus)
      } catch {
        this.handleTrackPlaybackFailure()
        return
      }
      el.addEventListener('error', () => this.handleTrackPlaybackFailure())
      el.addEventListener('ended', () => {
        if (!this.musicEnabled || !this.currentTrack) return
        el.currentTime = 0
        void el.play().catch(() => this.handleTrackPlaybackFailure())
      })
      this.musicEl = el
    }
    const manifestId = MUSIC_TRACKS[track]
    const entry = audioEntry(manifestId)
    this.musicEl.loop = entry.loop
    this.musicBus.gain.value = entry.volume
    if (this.loadedTrack !== track) {
      this.musicEl.src = audioUrl(manifestId)
      this.loadedTrack = track
    }
    void this.musicEl.play().catch(() => this.handleTrackPlaybackFailure())
  }

  private handleTrackPlaybackFailure() {
    this.loadedTrack = null
    this.musicEl?.pause()
  }

  // ----------------------------------------------------------------- sfx

  /** Decode the authored weapon-SFX samples once; failures just leave that cue procedural. */
  private loadSamples() {
    if (this.samplesRequested || !this.ctx) return
    this.samplesRequested = true
    for (const [name, id] of Object.entries(SFX_SAMPLE_IDS) as [SfxName, string][]) {
      fetch(audioUrl(id))
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx?.decodeAudioData(b))
        .then((decoded) => { if (decoded) this.sampleBuffers.set(name, decoded) })
        .catch(() => {}) // unloaded → procedural fallback for this cue
    }
  }

  /** Play an authored one-shot sample through the sfx bus; false if none is loaded. */
  private playSample(name: SfxName, pitch: number): boolean {
    const buf = this.sampleBuffers.get(name)
    if (!buf || !this.ctx || !this.sfxBus) return false
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = pitch
    src.connect(this.sfxBus)
    src.start()
    return true
  }

  sfx(name: SfxName, opts?: { pitch?: number }) {
    if (!this.sfxEnabled || !this.ensure() || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    // Authored sample if loaded (slight pitch jitter so rapid fire isn't a flat repeat); else synth.
    if (this.playSample(name, opts?.pitch ?? (0.97 + Math.random() * 0.06))) return
    const t = this.ctx.currentTime
    const p = opts?.pitch ?? 1
    switch (name) {
      case 'shoot': {
        const d = 0.94 + Math.random() * 0.12 // detune so rapid fire isn't a flat repeat
        this.zap(t, 'square', 320 * d, 90 * d, 0.09, 0.2)
        this.zap(t, 'sine', 150 * d, 50 * d, 0.07, 0.24) // sub-thump body = punch
        this.noise(t, 0.05, 0.16, 1800)
        break
      }
      case 'shootSmg': {
        const d = 0.92 + Math.random() * 0.16
        this.zap(t, 'square', 430 * d, 150 * d, 0.05, 0.15)
        this.noise(t, 0.03, 0.1, 2600)
        break
      }
      case 'shootSniper':
        this.zap(t, 'square', 260 * p, 72 * p, 0.22, 0.26)
        this.zap(t, 'sine', 92 * p, 34 * p, 0.28, 0.3)
        this.noise(t, 0.08, 0.2, 1400)
        break
      case 'shootShotgun':
        this.zap(t, 'sine', 130, 45, 0.16, 0.3) // boom body
        this.noise(t, 0.12, 0.32, 950) // spray
        this.noise(t + 0.02, 0.06, 0.18, 2400)
        break
      case 'shootCannon':
        this.zap(t, 'sawtooth', 150, 38, 0.34, 0.34) // big descending boom
        this.zap(t, 'sine', 80, 30, 0.42, 0.34) // sub
        this.noise(t, 0.18, 0.26, 600)
        break
      case 'hit':
        this.zap(t, 'triangle', 700, 520, 0.06, 0.18)
        break
      case 'headshot':
        this.zap(t, 'square', 900, 900, 0.05, 0.2)
        this.zap(t + 0.05, 'square', 1320, 1320, 0.08, 0.2)
        break
      case 'kill':
        this.zap(t, 'sawtooth', 440 * p, 110 * p, 0.16, 0.2)
        this.noise(t, 0.06, 0.13, 520) // wet splat layer
        break
      case 'levelup':
        ;[523, 698, 880, 1175].forEach((f, i) => this.zap(t + i * 0.07, 'triangle', f, f, 0.5, 0.24))
        this.zap(t, 'sine', 130, 280, 0.42, 0.18) // warm rising swell
        break
      case 'reload':
        this.noise(t, 0.04, 0.25, 2500)
        this.noise(t + 0.18, 0.05, 0.3, 1800)
        break
      case 'pickup':
        this.zap(t, 'sine', 520, 1040, 0.16, 0.28)
        break
      case 'hurt':
        this.zap(t, 'square', 160, 70, 0.16, 0.3)
        this.noise(t, 0.08, 0.22, 700)
        break
      case 'switch':
        this.zap(t, 'square', 600, 600, 0.04, 0.15)
        break
      case 'wave':
        this.zap(t, 'sawtooth', 220, 660, 0.5, 0.22)
        break
      case 'boss':
        this.zap(t, 'sawtooth', 70, 140, 0.9, 0.32)
        break
      case 'victory':
        this.chord(t, [523, 659, 784, 1047], 0.7)
        break
      case 'defeat':
        this.zap(t, 'sawtooth', 330, 70, 1.0, 0.3)
        break
      case 'shieldhit':
        this.zap(t, 'sine', 1200, 1600, 0.06, 0.12)
        break
      case 'explosion':
        this.zap(t, 'sawtooth', 90, 30, 0.5, 0.34) // descending boom
        this.zap(t, 'sine', 60, 24, 0.6, 0.3) // sub
        this.noise(t, 0.4, 0.34, 700) // body blast
        this.noise(t + 0.04, 0.25, 0.2, 1600) // crackle tail
        break
      case 'dash':
        this.noise(t, 0.18, 0.18, 1200) // whoosh body
        this.zap(t, 'sine', 600 * p, 1400 * p, 0.16, 0.1) // airy rise
        break
      case 'dryfire':
        this.zap(t, 'square', 200, 180, 0.02, 0.12) // hollow click
        this.noise(t, 0.02, 0.08, 3000)
        break
      case 'shieldUp':
        this.zap(t, 'sine', 300, 900, 0.4, 0.16) // rising shimmer
        this.zap(t + 0.04, 'triangle', 600, 1200, 0.35, 0.12)
        break
      case 'gem':
        this.zap(t, 'triangle', 880 * p, 1320 * p, 0.1, 0.22) // bright blip up
        break
      case 'combo':
        ;[523, 659, 784].forEach((f, i) => this.zap(t + i * 0.05, 'triangle', f * p, f * p, 0.18, 0.18))
        break
      case 'lowhealth':
        this.zap(t, 'sine', 180, 120, 0.12, 0.3) // heartbeat thump
        this.zap(t + 0.16, 'sine', 180, 110, 0.14, 0.26)
        break
      case 'breach':
        this.zap(t, 'sawtooth', 55, 40, 1.4, 0.3) // low groan
        this.zap(t + 0.1, 'sawtooth', 116, 232, 1.2, 0.16) // rising dissonant b2 swell
        this.noise(t, 0.8, 0.14, 500)
        break
      case 'uiSelect':
        this.zap(t, 'square', 440, 660, 0.05, 0.16)
        break
      case 'gold':
        this.zap(t, 'triangle', 784, 1175, 0.08, 0.2)
        this.zap(t + 0.06, 'triangle', 1047, 1568, 0.1, 0.18) // double cha-ching
        break
      case 'jump':
        this.zap(t, 'square', 300 * p, 720 * p, 0.14, 0.2) // rising hop
        break
      case 'land':
        this.zap(t, 'sine', 160, 60, 0.12, 0.26)
        this.noise(t, 0.06, 0.14, 800)
        break
      case 'build':
        this.zap(t, 'square', 200, 140, 0.06, 0.2) // mechanical thunk
        this.noise(t, 0.05, 0.16, 1400)
        this.zap(t + 0.05, 'sine', 120, 90, 0.1, 0.2)
        break
      case 'powerup':
        ;[440, 587, 740, 988].forEach((f, i) => this.zap(t + i * 0.06, 'triangle', f, f, 0.3, 0.2))
        break
      case 'berserk':
        this.zap(t, 'sawtooth', 90 * p, 34 * p, 0.42, 0.34)
        this.zap(t + 0.03, 'square', 220 * p, 620 * p, 0.24, 0.2)
        this.noise(t, 0.26, 0.34, 620)
        this.noise(t + 0.08, 0.18, 0.18, 1800)
        break
      case 'laser':
        this.zap(t, 'sawtooth', 1200 * p, 300 * p, 0.12, 0.18) // descending pew
        this.zap(t, 'square', 2400 * p, 600 * p, 0.08, 0.08)
        break
    }
  }

  private zap(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number) {
    if (!this.ctx || !this.sfxBus) return
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(t: number, dur: number, gain: number, filterFreq: number) {
    if (!this.ctx || !this.sfxBus) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer(dur)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(g).connect(this.sfxBus)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private chord(t: number, freqs: number[], dur: number) {
    freqs.forEach((f, i) => this.zap(t + i * 0.08, 'triangle', f, f, dur, 0.22))
  }

  private noiseBuffer(dur: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }
}

export const audio = new AudioEngine()
