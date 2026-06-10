// The Deadrot house SFX palette: procedural Web Audio cues that need zero assets.
// Ported 1:1 from the Scourge Survivors engine, whose palette was already authored
// with cross-game seeds (jump/land → Rothulk, build → Deadlane, laser/powerup →
// Starblight). Each cue is a small function over the synth primitives so games can
// extend or override entries without touching the engine.

/** Synth primitives the engine provides to cues. `t` is AudioContext time. */
export interface Synth {
  /** Oscillator sweep f0 → f1 over `dur` seconds with a fast attack envelope. */
  zap(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void;
  /** Band-pass filtered noise burst. */
  noise(t: number, dur: number, gain: number, filterFreq: number): void;
  /** Arpeggiated triangle chord (used for fanfares). */
  chord(t: number, freqs: number[], dur: number): void;
}

/** A procedural cue: play whatever the moment needs. `p` is the caller's pitch scalar. */
export type SfxCue = (s: Synth, t: number, p: number) => void;

export type DeadrotSfx =
  | "shoot"
  | "shootSmg"
  | "shootSniper"
  | "shootShotgun"
  | "shootCannon"
  | "hit"
  | "headshot"
  | "kill"
  | "reload"
  | "pickup"
  | "hurt"
  | "switch"
  | "wave"
  | "boss"
  | "victory"
  | "defeat"
  | "shieldhit"
  | "levelup"
  | "explosion"
  | "dash"
  | "dryfire"
  | "shieldUp"
  | "gem"
  | "combo"
  | "lowhealth"
  | "breach"
  | "uiSelect"
  | "gold"
  | "jump"
  | "land"
  | "build"
  | "powerup"
  | "berserk"
  | "laser";

export const DEADROT_SFX_PALETTE: Record<DeadrotSfx, SfxCue> = {
  shoot: (s, t) => {
    const d = 0.94 + Math.random() * 0.12; // detune so rapid fire isn't a flat repeat
    s.zap(t, "square", 320 * d, 90 * d, 0.09, 0.2);
    s.zap(t, "sine", 150 * d, 50 * d, 0.07, 0.24); // sub-thump body = punch
    s.noise(t, 0.05, 0.16, 1800);
  },
  shootSmg: (s, t) => {
    const d = 0.92 + Math.random() * 0.16;
    s.zap(t, "square", 430 * d, 150 * d, 0.05, 0.15);
    s.noise(t, 0.03, 0.1, 2600);
  },
  shootSniper: (s, t, p) => {
    s.zap(t, "square", 260 * p, 72 * p, 0.22, 0.26);
    s.zap(t, "sine", 92 * p, 34 * p, 0.28, 0.3);
    s.noise(t, 0.08, 0.2, 1400);
  },
  shootShotgun: (s, t) => {
    s.zap(t, "sine", 130, 45, 0.16, 0.3); // boom body
    s.noise(t, 0.12, 0.32, 950); // spray
    s.noise(t + 0.02, 0.06, 0.18, 2400);
  },
  shootCannon: (s, t) => {
    s.zap(t, "sawtooth", 150, 38, 0.34, 0.34); // big descending boom
    s.zap(t, "sine", 80, 30, 0.42, 0.34); // sub
    s.noise(t, 0.18, 0.26, 600);
  },
  hit: (s, t) => {
    s.zap(t, "triangle", 700, 520, 0.06, 0.18);
  },
  headshot: (s, t) => {
    s.zap(t, "square", 900, 900, 0.05, 0.2);
    s.zap(t + 0.05, "square", 1320, 1320, 0.08, 0.2);
  },
  kill: (s, t, p) => {
    s.zap(t, "sawtooth", 440 * p, 110 * p, 0.16, 0.2);
    s.noise(t, 0.06, 0.13, 520); // wet splat layer
  },
  levelup: (s, t) => {
    [523, 698, 880, 1175].forEach((f, i) => {
      s.zap(t + i * 0.07, "triangle", f, f, 0.5, 0.24);
    });
    s.zap(t, "sine", 130, 280, 0.42, 0.18); // warm rising swell
  },
  reload: (s, t) => {
    s.noise(t, 0.04, 0.25, 2500);
    s.noise(t + 0.18, 0.05, 0.3, 1800);
  },
  pickup: (s, t) => {
    s.zap(t, "sine", 520, 1040, 0.16, 0.28);
  },
  hurt: (s, t) => {
    s.zap(t, "square", 160, 70, 0.16, 0.3);
    s.noise(t, 0.08, 0.22, 700);
  },
  switch: (s, t) => {
    s.zap(t, "square", 600, 600, 0.04, 0.15);
  },
  wave: (s, t) => {
    s.zap(t, "sawtooth", 220, 660, 0.5, 0.22);
  },
  boss: (s, t) => {
    s.zap(t, "sawtooth", 70, 140, 0.9, 0.32);
  },
  victory: (s, t) => {
    s.chord(t, [523, 659, 784, 1047], 0.7);
  },
  defeat: (s, t) => {
    s.zap(t, "sawtooth", 330, 70, 1.0, 0.3);
  },
  shieldhit: (s, t) => {
    s.zap(t, "sine", 1200, 1600, 0.06, 0.12);
  },
  explosion: (s, t) => {
    s.zap(t, "sawtooth", 90, 30, 0.5, 0.34); // descending boom
    s.zap(t, "sine", 60, 24, 0.6, 0.3); // sub
    s.noise(t, 0.4, 0.34, 700); // body blast
    s.noise(t + 0.04, 0.25, 0.2, 1600); // crackle tail
  },
  dash: (s, t, p) => {
    s.noise(t, 0.18, 0.18, 1200); // whoosh body
    s.zap(t, "sine", 600 * p, 1400 * p, 0.16, 0.1); // airy rise
  },
  dryfire: (s, t) => {
    s.zap(t, "square", 200, 180, 0.02, 0.12); // hollow click
    s.noise(t, 0.02, 0.08, 3000);
  },
  shieldUp: (s, t) => {
    s.zap(t, "sine", 300, 900, 0.4, 0.16); // rising shimmer
    s.zap(t + 0.04, "triangle", 600, 1200, 0.35, 0.12);
  },
  gem: (s, t, p) => {
    s.zap(t, "triangle", 880 * p, 1320 * p, 0.1, 0.22); // bright blip up
  },
  combo: (s, t, p) => {
    [523, 659, 784].forEach((f, i) => {
      s.zap(t + i * 0.05, "triangle", f * p, f * p, 0.18, 0.18);
    });
  },
  lowhealth: (s, t) => {
    s.zap(t, "sine", 180, 120, 0.12, 0.3); // heartbeat thump
    s.zap(t + 0.16, "sine", 180, 110, 0.14, 0.26);
  },
  breach: (s, t) => {
    s.zap(t, "sawtooth", 55, 40, 1.4, 0.3); // low groan
    s.zap(t + 0.1, "sawtooth", 116, 232, 1.2, 0.16); // rising dissonant b2 swell
    s.noise(t, 0.8, 0.14, 500);
  },
  uiSelect: (s, t) => {
    s.zap(t, "square", 440, 660, 0.05, 0.16);
  },
  gold: (s, t) => {
    s.zap(t, "triangle", 784, 1175, 0.08, 0.2);
    s.zap(t + 0.06, "triangle", 1047, 1568, 0.1, 0.18); // double cha-ching
  },
  jump: (s, t, p) => {
    s.zap(t, "square", 300 * p, 720 * p, 0.14, 0.2); // rising hop
  },
  land: (s, t) => {
    s.zap(t, "sine", 160, 60, 0.12, 0.26);
    s.noise(t, 0.06, 0.14, 800);
  },
  build: (s, t) => {
    s.zap(t, "square", 200, 140, 0.06, 0.2); // mechanical thunk
    s.noise(t, 0.05, 0.16, 1400);
    s.zap(t + 0.05, "sine", 120, 90, 0.1, 0.2);
  },
  powerup: (s, t) => {
    [440, 587, 740, 988].forEach((f, i) => {
      s.zap(t + i * 0.06, "triangle", f, f, 0.3, 0.2);
    });
  },
  berserk: (s, t, p) => {
    s.zap(t, "sawtooth", 90 * p, 34 * p, 0.42, 0.34);
    s.zap(t + 0.03, "square", 220 * p, 620 * p, 0.24, 0.2);
    s.noise(t, 0.26, 0.34, 620);
    s.noise(t + 0.08, 0.18, 0.18, 1800);
  },
  laser: (s, t, p) => {
    s.zap(t, "sawtooth", 1200 * p, 300 * p, 0.12, 0.18); // descending pew
    s.zap(t, "square", 2400 * p, 600 * p, 0.08, 0.08);
  },
};
