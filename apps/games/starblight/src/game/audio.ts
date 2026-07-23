import {
  AudioEngine,
  type AudioSource,
  bindAudioToGlobalSettings,
  DEADROT_SFX_PALETTE,
  type DeadrotSfx,
  type SfxCue,
} from "@deadrot/game-kit/audio";
import choirWhisper from "@shipshitgames/assets/shared/audio/choir-whisper.webm?url";
import { starblightAudioEntry, starblightAudioUrl } from "@shipshitgames/assets/starblight";
import { spatialGain } from "./audioMix";

export type WeaponAudioFamily = "kinetic" | "drone" | "ordnance" | "beam" | "mine" | "wing";

export type StarblightCombatCue =
  | `weapon-${WeaponAudioFamily}`
  | "enemy-hit"
  | "enemy-kill"
  | "elite-kill"
  | "salvage-pickup"
  | "level-up"
  | "card-select"
  | "player-hit"
  | "low-integrity";

type StarblightCue = DeadrotSfx | StarblightCombatCue;
type StarblightTrack = "main";

const COMBAT_CUES: readonly StarblightCombatCue[] = [
  "weapon-kinetic",
  "weapon-drone",
  "weapon-ordnance",
  "weapon-beam",
  "weapon-mine",
  "weapon-wing",
  "enemy-hit",
  "enemy-kill",
  "elite-kill",
  "salvage-pickup",
  "level-up",
  "card-select",
  "player-hit",
  "low-integrity",
];

const FALLBACKS: Record<StarblightCombatCue, DeadrotSfx> = {
  "weapon-kinetic": "shoot",
  "weapon-drone": "shootSmg",
  "weapon-ordnance": "shootCannon",
  "weapon-beam": "laser",
  "weapon-mine": "explosion",
  "weapon-wing": "shootSmg",
  "enemy-hit": "hit",
  "enemy-kill": "kill",
  "elite-kill": "explosion",
  "salvage-pickup": "gem",
  "level-up": "levelup",
  "card-select": "uiSelect",
  "player-hit": "hurt",
  "low-integrity": "lowhealth",
};

function source(id: StarblightCombatCue): AudioSource {
  const entry = starblightAudioEntry(id);
  return {
    url: starblightAudioUrl(id),
    volume: entry.volume,
    loop: entry.loop,
    bus: entry.bus,
    pitchVariance: entry.pitchVariance,
    maxVoices: entry.maxVoices,
    minIntervalMs: entry.minIntervalMs,
  };
}

function combatSamples(): Partial<Record<StarblightCue, AudioSource>> {
  return Object.fromEntries(COMBAT_CUES.map((id) => [id, source(id)])) as Partial<Record<StarblightCue, AudioSource>>;
}

function palette(): Record<StarblightCue, SfxCue> {
  const combatFallbacks = Object.fromEntries(
    COMBAT_CUES.map((id) => [id, DEADROT_SFX_PALETTE[FALLBACKS[id]]]),
  ) as Record<StarblightCombatCue, SfxCue>;
  return { ...DEADROT_SFX_PALETTE, ...combatFallbacks };
}

class StarblightAudio extends AudioEngine<StarblightCue, StarblightTrack> {
  constructor() {
    super({
      palette: palette(),
      musicTracks: { main: { url: choirWhisper, volume: 0.18, loop: true } },
      defaultTrack: "main",
      sfxSamples: combatSamples(),
      maxVoices: { sfx: 10, ui: 3 },
    });
  }

  play(cue: StarblightCombatCue, opts: { pitch?: number; gain?: number; distance?: number } = {}) {
    const distanceGain = opts.distance === undefined ? 1 : spatialGain(opts.distance);
    this.sfx(cue, { pitch: opts.pitch, gain: (opts.gain ?? 1) * distanceGain });
  }
}

export const audio = new StarblightAudio();
bindAudioToGlobalSettings(audio);
