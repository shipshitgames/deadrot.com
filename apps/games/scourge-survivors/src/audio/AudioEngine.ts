// Scourge Survivors audio: the shared Deadrot engine (@deadrot/game-kit/audio,
// extracted from this game's original implementation) configured with our authored
// Suno music beds, weapon samples, and promoted shared samples. Any remaining
// unlisted cue stays procedural via the house palette. A single shared instance is
// used by the game and the settings UI.

import { AudioEngine, type AudioSource, DEADROT_SFX_PALETTE, type DeadrotSfx } from "@deadrot/game-kit/audio";
import hitImpactUrl from "@shipshitgames/assets/shared/audio/sfx/hit.webm?url";
import victoryBreachSealedUrl from "@shipshitgames/assets/shared/audio/victory-breach-sealed.webm?url";

import { audioEntry, audioUrl } from "../assets/catalog";

type MusicMode = "menu" | "campaign" | "survivors" | "multiplayer" | "victory";

// Authored bg-music beds (generated with Suno; see @shipshitgames/assets Scourge audio credits).
const MUSIC_TRACK_IDS = {
  "blood-circuit-ascension": "music-blood-circuit-ascension",
  "ash-reactor": "music-ash-reactor",
} as const;
export type MusicTrack = keyof typeof MUSIC_TRACK_IDS | "victory-breach-sealed";
const DEFAULT_TRACK: MusicTrack = "ash-reactor"; // gameplay loop; menu/boss can switch via playMusic()

const MUSIC_MODE_TRACKS: Record<MusicMode, MusicTrack> = {
  menu: "ash-reactor",
  campaign: "ash-reactor",
  survivors: "blood-circuit-ascension",
  multiplayer: "blood-circuit-ascension",
  victory: "victory-breach-sealed",
};

// Authored weapon-SFX samples (decoded to buffers, played one-shot per trigger). Any
// cue not listed here stays procedural — the zero-asset fallback.
const SFX_SAMPLE_IDS: Partial<Record<DeadrotSfx, string>> = {
  shoot: "sfx-pistol-pyre",
  shootSmg: "sfx-smg",
  shootSniper: "sfx-sniper",
  shootShotgun: "sfx-shotgun",
  shootCannon: "sfx-cannon",
};

const SHARED_SFX_SAMPLES: Partial<Record<DeadrotSfx, AudioSource>> = {
  hit: { url: hitImpactUrl, volume: 0.86, loop: false },
};

/** Manifest id → playable source (URL + authored gain/loop from assets.json). */
function source(id: string): AudioSource {
  const entry = audioEntry(id);
  return { url: audioUrl(id), volume: entry.volume, loop: entry.loop };
}

function sampleSources(ids: Partial<Record<DeadrotSfx, string>>): Partial<Record<DeadrotSfx, AudioSource>> {
  const out: Partial<Record<DeadrotSfx, AudioSource>> = {};
  for (const [name, id] of Object.entries(ids) as [DeadrotSfx, string][]) {
    out[name] = source(id);
  }
  return out;
}

class ScourgeAudioEngine extends AudioEngine<DeadrotSfx, MusicTrack> {
  private musicMode: MusicMode = "menu";

  constructor() {
    super({
      palette: DEADROT_SFX_PALETTE,
      musicTracks: {
        "blood-circuit-ascension": source(MUSIC_TRACK_IDS["blood-circuit-ascension"]),
        "ash-reactor": source(MUSIC_TRACK_IDS["ash-reactor"]),
        "victory-breach-sealed": {
          url: victoryBreachSealedUrl,
          volume: 0.72,
          loop: false,
        },
      },
      defaultTrack: DEFAULT_TRACK,
      sfxSamples: { ...sampleSources(SFX_SAMPLE_IDS), ...SHARED_SFX_SAMPLES },
    });
  }

  setMusicMode(mode: MusicMode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.playMusic(MUSIC_MODE_TRACKS[mode]);
  }
}

export const audio = new ScourgeAudioEngine();
