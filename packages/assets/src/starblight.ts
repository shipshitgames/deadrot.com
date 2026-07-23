import manifestData from "../games/starblight/assets.json" with { type: "json" };

export type StarblightAudioBus = "sfx" | "ui";

export interface StarblightAudioEntry {
  type: "audio";
  path: string;
  category: "sfx";
  duration: number;
  volume: number;
  loop: false;
  bus: StarblightAudioBus;
  pitchVariance: number;
  maxVoices: number;
  minIntervalMs: number;
  license: {
    tool: string;
    plan: string;
    date: string;
    kind: string;
    scope: string;
  };
}

interface StarblightAssetManifest {
  audio: Record<string, StarblightAudioEntry>;
}

export const STARBLIGHT_ASSET_MANIFEST = manifestData as unknown as StarblightAssetManifest;

const starblightAudioModules = import.meta.glob<string>("../games/starblight/audio/**/*.webm", {
  eager: true,
  query: "?url",
  import: "default",
});

function moduleKey(path: string): string {
  const prefix = "games/starblight/";
  if (!path.startsWith(prefix)) throw new Error(`Starblight audio path must begin with ${prefix}: ${path}`);
  return `../games/starblight/${path.slice(prefix.length)}`;
}

export function starblightAudioEntry(id: string): StarblightAudioEntry {
  const entry = STARBLIGHT_ASSET_MANIFEST.audio[id];
  if (!entry) throw new Error(`Unknown Starblight audio asset id: ${id}`);
  return entry;
}

export function starblightAudioUrl(id: string): string {
  const entry = starblightAudioEntry(id);
  const url = starblightAudioModules[moduleKey(entry.path)];
  if (!url) throw new Error(`Starblight audio asset is missing from the runtime bundle: ${entry.path}`);
  return url;
}
