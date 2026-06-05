import manifestData from "../games/scourge-survivors/assets.json" with { type: "json" };

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface LicenseRecord {
  tool: string;
  plan: string;
  date: string;
  kind: string;
  scope?: string;
}

export type SpriteView = "front" | "side" | "back";
export type SpriteFilter = "linear" | "nearest";

export interface SpriteViewEntry {
  path: string;
  dimensions: Vec2;
  scale: Vec2;
}

export interface SpriteEntry {
  type: "sprite";
  path?: string;
  dimensions?: Vec2;
  anchor?: Vec2;
  filter?: SpriteFilter;
  scale?: Vec2;
  weapon?: {
    offset: Vec3;
    muzzle: Vec3;
    flashScale: number;
    flashRotation?: number;
  };
  views?: Partial<Record<SpriteView, SpriteViewEntry>>;
  license: LicenseRecord;
}

export interface TextureEntry {
  type: "texture";
  path: string;
  dimensions: Vec2;
  colorSpace: "srgb" | "linear";
  wrap: "repeat" | "clamp";
  repeat: Vec2;
  license: LicenseRecord;
}

export interface AudioEntry {
  type: "audio";
  path: string;
  category: "sfx" | "music" | "voice";
  cue?: string;
  duration: number;
  volume: number;
  loop: boolean;
  license: LicenseRecord;
}

export interface ScourgeSurvivorsAssetManifest {
  sprites: Record<string, SpriteEntry>;
  textures: Record<string, TextureEntry>;
  audio: Record<string, AudioEntry>;
}

export const SCOURGE_SURVIVORS_ASSET_MANIFEST =
  manifestData as unknown as ScourgeSurvivorsAssetManifest;

const scourgeSurvivorsAssetModules = import.meta.glob<string>(
  [
    "../games/scourge-survivors/players/**/*.webp",
    "../games/scourge-survivors/enemies/**/*.webp",
    "../games/scourge-survivors/weapons/**/*.webp",
    "../games/scourge-survivors/pickups/**/*.webp",
    "../games/scourge-survivors/projectiles/**/*.webp",
    "../games/scourge-survivors/textures/**/*.webp",
    "../games/scourge-survivors/fx/**/*.webp",
    "../games/scourge-survivors/ui/icons/pixel/*.webp",
    "../games/scourge-survivors/ui/cards/**/*.{jpg,png}",
    "../games/scourge-survivors/ui/menu/**/*.{jpg,png}",
    "../games/scourge-survivors/audio/**/*.webm",
    "../games/scourge-survivors/fonts/*.ttf",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

export function scourgeSurvivorsAssetUrl(path: string): string {
  const key = `../${path}`;
  const url = scourgeSurvivorsAssetModules[key];
  if (!url) throw new Error(`Scourge Survivors asset manifest references missing file: ${path}`);
  return url;
}

export function scourgeSurvivorsSpriteEntry(id: string): SpriteEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.sprites[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors sprite asset id: ${id}`);
  return entry;
}

export function scourgeSurvivorsTextureEntry(id: string): TextureEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.textures[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors texture asset id: ${id}`);
  return entry;
}

export function scourgeSurvivorsAudioEntry(id: string): AudioEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.audio[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors audio asset id: ${id}`);
  return entry;
}

export function scourgeSurvivorsAudioUrl(id: string): string {
  return scourgeSurvivorsAssetUrl(scourgeSurvivorsAudioEntry(id).path);
}

export function scourgeSurvivorsSpriteUrl(id: string, view?: SpriteView): string {
  const entry = scourgeSurvivorsSpriteEntry(id);
  if (view) {
    const viewEntry = entry.views?.[view];
    if (!viewEntry) throw new Error(`Scourge Survivors sprite asset ${id} has no ${view} view`);
    return scourgeSurvivorsAssetUrl(viewEntry.path);
  }
  if (!entry.path) throw new Error(`Scourge Survivors sprite asset ${id} has no direct path`);
  return scourgeSurvivorsAssetUrl(entry.path);
}

export function scourgeSurvivorsSpriteScale(id: string, view?: SpriteView): Vec2 {
  const entry = scourgeSurvivorsSpriteEntry(id);
  if (view) {
    const viewEntry = entry.views?.[view];
    if (!viewEntry) throw new Error(`Scourge Survivors sprite asset ${id} has no ${view} view`);
    return viewEntry.scale;
  }
  if (!entry.scale) throw new Error(`Scourge Survivors sprite asset ${id} has no direct scale`);
  return entry.scale;
}

export const SCOURGE_SURVIVORS_PIXEL_ICON_IDS = [
  "link",
  "shop",
  "gold",
  "swords",
  "trophy",
  "settings",
  "gamepad",
  "target",
  "music",
  "sfx",
  "skull",
  "reroll",
  "banish",
  "lightning",
  "knife",
  "check",
  "evolution",
  "restart",
  "resume",
  "menu",
  "leave",
  "back",
  "live",
  "offline",
  "orbit",
  "bolt",
  "nova",
  "fire",
  "battery",
  "trident",
  "boot",
  "heart",
  "medic-cross",
  "armor",
  "shield",
  "spikes",
  "bloodtap",
  "bastion",
  "dodge",
  "grace",
  "magnet",
  "chart",
  "foundry",
  "bone",
  "maw",
] as const;

export type ScourgeSurvivorsPixelIconId =
  (typeof SCOURGE_SURVIVORS_PIXEL_ICON_IDS)[number];

export const SCOURGE_SURVIVORS_PIXEL_ICON_URLS = Object.fromEntries(
  SCOURGE_SURVIVORS_PIXEL_ICON_IDS.map((id) => [
    id,
    scourgeSurvivorsAssetUrl(`games/scourge-survivors/ui/icons/pixel/${id}.webp`),
  ]),
) as Record<ScourgeSurvivorsPixelIconId, string>;
