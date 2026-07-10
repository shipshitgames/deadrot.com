import { AudioEngine, type AudioSettingsTarget, bindAudioToGlobalSettings, type SfxCue } from "@deadrot/game-kit/audio";
import hellfirePulse from "@shipshitgames/assets/shared/audio/hellfire-pulse.webm?url";
import hitImpact from "@shipshitgames/assets/shared/audio/sfx/hit.webm?url";
import type { BrawlAudioPort } from "../runtime";

type BrawlSfx = "bell" | "jump" | "impact" | "guard" | "miss" | "ringout" | "victory" | "defeat";
type BrawlTrack = "arena";

const BRAWL_PALETTE: Record<BrawlSfx, SfxCue> = {
  bell: (s, t, pitch) => s.zap(t, "sawtooth", 180 * pitch, 180 * pitch, 0.08, 0.08),
  jump: (s, t) => s.zap(t, "triangle", 270, 270, 0.05, 0.08),
  impact: (s, t, pitch) => s.zap(t, "square", 200 * pitch, 90 * pitch, 0.07, 0.1),
  guard: (s, t) => s.zap(t, "square", 160, 160, 0.04, 0.07),
  miss: (s, t) => s.zap(t, "triangle", 90, 90, 0.03, 0.05),
  ringout: (s, t) => {
    s.zap(t, "square", 90, 45, 0.16, 0.16);
    s.noise(t, 0.12, 0.12, 700);
  },
  victory: (s, t) => s.chord(t, [380, 570, 760], 0.18),
  defeat: (s, t) => s.zap(t, "square", 90, 50, 0.18, 0.14),
};

export interface BrawlAudioBackend extends AudioSettingsTarget {
  unlock(): void;
  sfx(name: BrawlSfx, options?: { pitch?: number }): void;
  dispose(): void;
  readonly contextState: AudioContextState | "none";
}

function createBackend(): BrawlAudioBackend {
  return new AudioEngine<BrawlSfx, BrawlTrack>({
    palette: BRAWL_PALETTE,
    musicTracks: { arena: { url: hellfirePulse, volume: 0.16, loop: true } },
    defaultTrack: "arena",
    sfxSamples: { impact: { url: hitImpact, volume: 0.86, loop: false } },
  });
}

/** Brawl semantic cues layered over the shared settings-aware audio runtime. */
export class AudioSystem implements BrawlAudioPort {
  private readonly unsubscribeSettings: () => void;
  private disposed = false;

  constructor(private readonly backend: BrawlAudioBackend = createBackend()) {
    this.unsubscribeSettings = bindAudioToGlobalSettings(backend);
  }

  get contextState() {
    return this.backend.contextState;
  }

  unlock() {
    this.backend.unlock();
  }

  roundStart(mode: "duel" | "arena") {
    this.backend.sfx("bell", { pitch: mode === "arena" ? 170 / 180 : 1 });
  }

  jump() {
    this.backend.sfx("jump");
  }

  impact(blocked: boolean, damage: number) {
    if (blocked) this.backend.sfx("guard");
    else this.backend.sfx("impact", { pitch: Math.max(0.72, Math.min(1.5, (90 + damage * 10) / 200)) });
  }

  miss() {
    this.backend.sfx("miss");
  }

  ringOut() {
    this.backend.sfx("ringout");
  }

  roundEnd(outcome: "victory" | "defeat") {
    this.backend.sfx(outcome);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeSettings();
    this.backend.dispose();
  }
}
