#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 48_000;
const root = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const outputDir = join(root, "games/starblight/audio/sfx");

let seed = 0x1875f0;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
}

function envelope(t, start, duration, attack = 0.006) {
  if (t < start || t >= start + duration) return 0;
  const local = t - start;
  return Math.min(1, local / attack) * Math.pow(1 - local / duration, 2);
}

function oscillator(wave, phase) {
  if (wave === "square") return Math.sin(phase) >= 0 ? 1 : -1;
  if (wave === "saw") return 2 * (phase / (Math.PI * 2) - Math.floor(phase / (Math.PI * 2) + 0.5));
  if (wave === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

function tone({ start = 0, duration, f0, f1 = f0, gain, wave = "sine", attack }) {
  return (t) => {
    const env = envelope(t, start, duration, attack);
    if (env === 0) return 0;
    const local = t - start;
    const sweep = (f1 - f0) / duration;
    const phase = Math.PI * 2 * (f0 * local + 0.5 * sweep * local * local);
    return oscillator(wave, phase) * gain * env;
  };
}

function noise({ start = 0, duration, gain, attack = 0.002, grit = 1 }) {
  let held = 0;
  let counter = 0;
  return (t) => {
    const env = envelope(t, start, duration, attack);
    if (env === 0) return 0;
    if (counter++ % grit === 0) held = random() * 2 - 1;
    return held * gain * env;
  };
}

const cues = {
  "weapon-kinetic": {
    duration: 0.16,
    voices: [
      tone({ duration: 0.13, f0: 310, f1: 78, gain: 0.46, wave: "square" }),
      tone({ duration: 0.14, f0: 130, f1: 42, gain: 0.38 }),
      noise({ duration: 0.055, gain: 0.25, grit: 2 }),
    ],
  },
  "weapon-drone": {
    duration: 0.2,
    voices: [
      tone({ duration: 0.16, f0: 520, f1: 180, gain: 0.4, wave: "triangle" }),
      tone({ start: 0.025, duration: 0.12, f0: 190, f1: 90, gain: 0.32, wave: "square" }),
      noise({ duration: 0.04, gain: 0.18 }),
    ],
  },
  "weapon-ordnance": {
    duration: 0.48,
    voices: [
      tone({ duration: 0.42, f0: 145, f1: 34, gain: 0.5, wave: "saw" }),
      tone({ duration: 0.46, f0: 72, f1: 26, gain: 0.52 }),
      noise({ duration: 0.24, gain: 0.34, grit: 4 }),
    ],
  },
  "weapon-beam": {
    duration: 0.34,
    voices: [
      tone({ duration: 0.3, f0: 185, f1: 620, gain: 0.32, wave: "saw" }),
      tone({ duration: 0.3, f0: 370, f1: 1240, gain: 0.18, wave: "triangle" }),
      noise({ duration: 0.3, gain: 0.12, grit: 5 }),
    ],
  },
  "weapon-mine": {
    duration: 0.42,
    voices: [
      tone({ duration: 0.38, f0: 115, f1: 28, gain: 0.5, wave: "square" }),
      tone({ start: 0.02, duration: 0.32, f0: 760, f1: 210, gain: 0.18, wave: "triangle" }),
      noise({ duration: 0.2, gain: 0.36, grit: 3 }),
    ],
  },
  "weapon-wing": {
    duration: 0.24,
    voices: [
      tone({ duration: 0.09, f0: 410, f1: 105, gain: 0.38, wave: "square" }),
      tone({ start: 0.075, duration: 0.11, f0: 460, f1: 120, gain: 0.34, wave: "square" }),
      noise({ duration: 0.035, gain: 0.18 }),
      noise({ start: 0.075, duration: 0.035, gain: 0.16 }),
    ],
  },
  "enemy-hit": {
    duration: 0.15,
    voices: [
      tone({ duration: 0.12, f0: 230, f1: 95, gain: 0.28, wave: "triangle" }),
      noise({ duration: 0.12, gain: 0.36, grit: 7 }),
    ],
  },
  "enemy-kill": {
    duration: 0.27,
    voices: [
      tone({ duration: 0.23, f0: 360, f1: 72, gain: 0.34, wave: "saw" }),
      tone({ duration: 0.25, f0: 92, f1: 44, gain: 0.3 }),
      noise({ duration: 0.18, gain: 0.38, grit: 9 }),
    ],
  },
  "elite-kill": {
    duration: 0.58,
    voices: [
      tone({ duration: 0.52, f0: 155, f1: 26, gain: 0.52, wave: "saw" }),
      tone({ duration: 0.56, f0: 68, f1: 24, gain: 0.52 }),
      tone({ start: 0.04, duration: 0.42, f0: 620, f1: 120, gain: 0.16, wave: "triangle" }),
      noise({ duration: 0.34, gain: 0.42, grit: 6 }),
    ],
  },
  "salvage-pickup": {
    duration: 0.2,
    voices: [
      tone({ duration: 0.16, f0: 510, f1: 980, gain: 0.34 }),
      tone({ start: 0.035, duration: 0.15, f0: 760, f1: 1320, gain: 0.22, wave: "triangle" }),
    ],
  },
  "level-up": {
    duration: 0.72,
    voices: [0, 1, 2, 3].flatMap((step) => [
      tone({ start: step * 0.1, duration: 0.38, f0: [262, 349, 440, 698][step], gain: 0.24, wave: "triangle" }),
      tone({ start: step * 0.1, duration: 0.28, f0: [131, 175, 220, 349][step], gain: 0.16 }),
    ]),
  },
  "card-select": {
    duration: 0.25,
    voices: [
      noise({ duration: 0.028, gain: 0.3 }),
      tone({ start: 0.018, duration: 0.18, f0: 420, f1: 630, gain: 0.3, wave: "triangle" }),
      tone({ start: 0.055, duration: 0.16, f0: 630, gain: 0.2 }),
    ],
  },
  "player-hit": {
    duration: 0.36,
    voices: [
      tone({ duration: 0.32, f0: 170, f1: 48, gain: 0.5, wave: "square" }),
      tone({ duration: 0.34, f0: 82, f1: 31, gain: 0.4 }),
      noise({ duration: 0.18, gain: 0.34, grit: 3 }),
    ],
  },
  "low-integrity": {
    duration: 0.62,
    voices: [0, 0.25].flatMap((start) => [
      tone({ start, duration: 0.17, f0: 180, f1: 120, gain: 0.38, wave: "square" }),
      tone({ start, duration: 0.19, f0: 90, f1: 60, gain: 0.28 }),
    ]),
  },
};

function wavBuffer(duration, voices) {
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  const samples = new Float64Array(sampleCount);
  let peak = 0;
  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    for (const voice of voices) sample += voice(t);
    samples[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const scale = peak > 0 ? 0.9 / peak : 1;
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);
  for (let i = 0; i < sampleCount; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * scale)) * 32767), 44 + i * 2);
  }
  return buffer;
}

mkdirSync(outputDir, { recursive: true });
for (const [name, cue] of Object.entries(cues)) {
  const wav = join(tmpdir(), `deadrot-starblight-${name}.wav`);
  writeFileSync(wav, wavBuffer(cue.duration, cue.voices));
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", wav, "-map_metadata", "-1", "-c:a", "libopus", "-b:a", "96k", join(outputDir, `${name}.webm`)],
    { stdio: "inherit" },
  );
  rmSync(wav, { force: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Generated ${Object.keys(cues).length} Starblight SFX in ${outputDir}`);
