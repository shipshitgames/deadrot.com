import manifestData from "../games/scourge-survivors/assets.json" with { type: "json" };
import { ScourgeSurvivorsAssetUrlCache } from "./scourge-survivors-url-cache";

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
    muzzles?: {
      left: Vec3;
      right: Vec3;
    };
    flashScale: number;
    flashRotation?: number;
  };
  adsSprite?: {
    path: string;
    dimensions: Vec2;
    scale?: Vec2;
    offset?: Vec3;
    muzzle?: Vec3;
    flashScale?: number;
    flashRotation?: number;
  };
  /**
   * Horizontal tier sheet: one weapon view-model drawn at N escalating visual tiers,
   * left to right. The runtime UV-samples one equal-width cell per tier, so `path`
   * is the whole sheet and `scale` is the on-screen size of a SINGLE cell.
   */
  tierSheet?: {
    /** Number of equal-width cells in the row. */
    columns: number;
    /** Visual-tier id per cell, left to right (e.g. ["base","tier-2","tier-3","tier-4","evolved"]). */
    tiers: string[];
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

export interface UiEntry {
  type: "ui";
  path: string;
  role: string;
  dimensions?: Vec2;
  license: LicenseRecord;
}

export interface RuntimeSpriteRef {
  sprite: string;
}

export interface RuntimeWeaponRef extends RuntimeSpriteRef {
  lootSprite: string;
  dualSprite?: string;
}

export type RuntimeEnemyRef = RuntimeSpriteRef;

export interface RuntimeUiRef {
  asset: string;
}

export interface ScourgeSurvivorsRuntimeManifest {
  enemies: Record<string, RuntimeEnemyRef>;
  players: Record<string, RuntimeSpriteRef>;
  weapons: Record<string, RuntimeWeaponRef>;
  pickups: Record<string, RuntimeSpriteRef>;
  projectiles: Record<string, RuntimeSpriteRef>;
  fx: Record<string, RuntimeSpriteRef>;
  ui: Record<string, RuntimeUiRef>;
  bonusIcons: Record<string, RuntimeUiRef>;
}

export interface ScourgeSurvivorsAssetManifest {
  sprites: Record<string, SpriteEntry>;
  textures: Record<string, TextureEntry>;
  audio: Record<string, AudioEntry>;
  ui: Record<string, UiEntry>;
  runtime: ScourgeSurvivorsRuntimeManifest;
}

export const SCOURGE_SURVIVORS_ASSET_MANIFEST = manifestData as unknown as ScourgeSurvivorsAssetManifest;

/**
 * Boot URLs stay synchronous for the title/menu shell. Importing URL modules
 * only exposes their built URLs; browsers fetch the underlying media when a
 * consumer assigns the URL to an image/audio/font request.
 */
const scourgeSurvivorsBootAssetModules = import.meta.glob<string>(
  [
    "../games/scourge-survivors/players/**/front.webp",
    "../games/scourge-survivors/ui/**/*.webp",
    "../games/scourge-survivors/audio/**/*.webm",
    "../games/scourge-survivors/fonts/*.ttf",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

/** Combat media is represented by lazy URL modules. */
const scourgeSurvivorsLazyAssetModules = import.meta.glob<string>(
  [
    "../games/scourge-survivors/players/**/side.webp",
    "../games/scourge-survivors/players/**/back.webp",
    "../games/scourge-survivors/enemies/**/*.webp",
    "../games/scourge-survivors/weapons/**/*.webp",
    "../games/scourge-survivors/pickups/**/*.webp",
    "../games/scourge-survivors/projectiles/**/*.webp",
    "../games/scourge-survivors/textures/**/*.webp",
    "../games/scourge-survivors/fx/**/*.webp",
  ],
  {
    eager: false,
    query: "?url",
    import: "default",
  },
);

const scourgeSurvivorsAssetUrlCache = new ScourgeSurvivorsAssetUrlCache();

const COMIC_STYLE_ENV_KEY = "VITE_DEADROT_COMIC_ASSETS";

function comicAssetsEnabled(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env;
  const value = env?.[COMIC_STYLE_ENV_KEY];
  return value === true || value === "1" || value === "true";
}

// Opt-in comic foe exploration. These files are runtime-scale exploratory
// cutouts, not the final production master pass, but they let the game test the
// comic silhouette/color direction without touching the default pack.
const COMIC_ENEMY_VIEW_PATHS: Partial<Record<string, Record<SpriteView, string>>> = {
  "enemy-melee": {
    front: "games/scourge-survivors/enemies/scourge-comic/host-grunt/front.webp",
    side: "games/scourge-survivors/enemies/scourge-comic/host-grunt/side.webp",
    back: "games/scourge-survivors/enemies/scourge-comic/host-grunt/back.webp",
  },
  "enemy-ranged": {
    front: "games/scourge-survivors/enemies/scourge-comic/spitter-host/front.webp",
    side: "games/scourge-survivors/enemies/scourge-comic/spitter-host/side.webp",
    back: "games/scourge-survivors/enemies/scourge-comic/spitter-host/back.webp",
  },
  "enemy-flying": {
    front: "games/scourge-survivors/enemies/scourge-comic/winged-host/front.webp",
    side: "games/scourge-survivors/enemies/scourge-comic/winged-host/side.webp",
    back: "games/scourge-survivors/enemies/scourge-comic/winged-host/back.webp",
  },
  boss: {
    front: "games/scourge-survivors/enemies/scourge-comic/breach-boss/front.webp",
    side: "games/scourge-survivors/enemies/scourge-comic/breach-boss/side.webp",
    back: "games/scourge-survivors/enemies/scourge-comic/breach-boss/back.webp",
  },
};

// Disabled until the comic pack has true per-weapon FPS view-model masters.
// Object/codex sheets and magenta lineups are not valid player-facing weapons.
const COMIC_WEAPON_PATHS: Partial<Record<string, string>> = {};

// Disabled until image-model generated material sheets are promoted. Cropping
// combat/key art into wall/floor textures is not a valid material asset.
const COMIC_TEXTURE_PATHS: Partial<Record<string, string>> = {};

function comicArenaTexturePath(id: string): string | undefined {
  const direct = COMIC_TEXTURE_PATHS[id];
  if (direct) return direct;
  return undefined;
}

function comicSpriteEntry(id: string, entry: SpriteEntry): SpriteEntry {
  if (!comicAssetsEnabled()) return entry;
  const viewPaths = COMIC_ENEMY_VIEW_PATHS[id];
  if (viewPaths && entry.views) {
    return {
      ...entry,
      filter: "linear",
      views: Object.fromEntries(
        Object.entries(entry.views).map(([view, viewEntry]) => [
          view,
          {
            ...viewEntry,
            path: viewPaths[view as SpriteView] ?? viewEntry.path,
          },
        ]),
      ) as Partial<Record<SpriteView, SpriteViewEntry>>,
    };
  }
  const weaponPath = COMIC_WEAPON_PATHS[id];
  if (weaponPath && entry.path) {
    return {
      ...entry,
      path: weaponPath,
      filter: "linear",
      adsSprite:
        id === "weapon-sniper" && entry.adsSprite
          ? {
              ...entry.adsSprite,
              path: "games/scourge-survivors/weapons/pyre-comic/sniper-ads-tiers.webp",
            }
          : entry.adsSprite,
    };
  }
  return entry;
}

function comicTextureEntry(id: string, entry: TextureEntry): TextureEntry {
  if (!comicAssetsEnabled()) return entry;
  const path = comicArenaTexturePath(id);
  return path ? { ...entry, path } : entry;
}

function scourgeSurvivorsAssetModuleKey(path: string): string {
  return `../${path}`;
}

function assetLoadFailure(path: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to load Scourge Survivors asset URL for ${path}: ${detail}`);
}

/** Resolve a boot-eager URL synchronously. Combat callers must use the async loader. */
export function scourgeSurvivorsAssetUrl(path: string): string {
  const key = scourgeSurvivorsAssetModuleKey(path);
  const url = scourgeSurvivorsBootAssetModules[key];
  if (url) return url;
  if (scourgeSurvivorsLazyAssetModules[key]) {
    throw new Error(
      `Scourge Survivors asset is lazy and cannot be resolved synchronously: ${path}; use scourgeSurvivorsLoadAssetUrl`,
    );
  }
  throw new Error(`Scourge Survivors asset manifest references missing file: ${path}`);
}

/**
 * Resolve either a boot or combat URL. Lazy module promises are cached by path,
 * so concurrent texture requests share one dynamic import. Failed imports are
 * evicted to allow a later retry while preserving a descriptive rejection.
 */
export function scourgeSurvivorsLoadAssetUrl(path: string): Promise<string> {
  const key = scourgeSurvivorsAssetModuleKey(path);
  const bootUrl = scourgeSurvivorsBootAssetModules[key];
  if (bootUrl) {
    return scourgeSurvivorsAssetUrlCache.load(key, () => Promise.resolve(bootUrl));
  }

  const load = scourgeSurvivorsLazyAssetModules[key];
  if (!load) {
    return Promise.reject(new Error(`Scourge Survivors asset manifest references missing file: ${path}`));
  }

  return scourgeSurvivorsAssetUrlCache.load(key, load, (error) => assetLoadFailure(path, error));
}

/** Synchronous front-view URL reserved for title-menu operator previews. */
export function scourgeSurvivorsBootSpriteUrl(id: string, view: SpriteView = "front"): string {
  if (view !== "front") {
    throw new Error(`Scourge Survivors boot sprite URLs only support the front view: ${id}/${view}`);
  }
  const entry = scourgeSurvivorsSpriteEntry(id);
  const front = entry.views?.[view];
  if (!front) throw new Error(`Scourge Survivors boot sprite asset ${id} has no ${view} view`);
  const url = scourgeSurvivorsBootAssetModules[scourgeSurvivorsAssetModuleKey(front.path)];
  if (!url) {
    throw new Error(`Scourge Survivors boot sprite asset ${id} is not in the eager front-preview set: ${front.path}`);
  }
  return url;
}

export function scourgeSurvivorsSpriteEntry(id: string): SpriteEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.sprites[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors sprite asset id: ${id}`);
  return comicSpriteEntry(id, entry);
}

export function scourgeSurvivorsTextureEntry(id: string): TextureEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.textures[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors texture asset id: ${id}`);
  return comicTextureEntry(id, entry);
}

export function scourgeSurvivorsAudioEntry(id: string): AudioEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.audio[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors audio asset id: ${id}`);
  return entry;
}

export function scourgeSurvivorsUiEntry(id: string): UiEntry {
  const entry = SCOURGE_SURVIVORS_ASSET_MANIFEST.ui[id];
  if (!entry) throw new Error(`Unknown Scourge Survivors UI asset id: ${id}`);
  return entry;
}

export function scourgeSurvivorsAudioUrl(id: string): string {
  return scourgeSurvivorsAssetUrl(scourgeSurvivorsAudioEntry(id).path);
}

export function scourgeSurvivorsUiUrl(id: string): string {
  return scourgeSurvivorsAssetUrl(scourgeSurvivorsUiEntry(id).path);
}

export async function scourgeSurvivorsSpriteUrl(id: string, view?: SpriteView): Promise<string> {
  const entry = scourgeSurvivorsSpriteEntry(id);
  if (view) {
    const viewEntry = entry.views?.[view];
    if (!viewEntry) throw new Error(`Scourge Survivors sprite asset ${id} has no ${view} view`);
    return scourgeSurvivorsLoadAssetUrl(viewEntry.path);
  }
  if (!entry.path) throw new Error(`Scourge Survivors sprite asset ${id} has no direct path`);
  return scourgeSurvivorsLoadAssetUrl(entry.path);
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

export const SCOURGE_SURVIVORS_BONUS_ICON_IDS = Object.keys(manifestData.runtime.bonusIcons) as Array<
  keyof typeof manifestData.runtime.bonusIcons
>;

export type ScourgeSurvivorsBonusIconId = (typeof SCOURGE_SURVIVORS_BONUS_ICON_IDS)[number];

export function scourgeSurvivorsBonusIconUrl(id: ScourgeSurvivorsBonusIconId): string {
  const ref = SCOURGE_SURVIVORS_ASSET_MANIFEST.runtime.bonusIcons[id];
  if (!ref) throw new Error(`Unknown Scourge Survivors bonus icon: ${id}`);
  return scourgeSurvivorsUiUrl(ref.asset);
}

export const SCOURGE_SURVIVORS_BONUS_ICON_URLS = Object.fromEntries(
  SCOURGE_SURVIVORS_BONUS_ICON_IDS.map((id) => [id, scourgeSurvivorsBonusIconUrl(id)]),
) as Record<ScourgeSurvivorsBonusIconId, string>;

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

export type ScourgeSurvivorsPixelIconId = (typeof SCOURGE_SURVIVORS_PIXEL_ICON_IDS)[number];

export const SCOURGE_SURVIVORS_PIXEL_ICON_URLS = Object.fromEntries(
  SCOURGE_SURVIVORS_PIXEL_ICON_IDS.map((id) => [
    id,
    scourgeSurvivorsAssetUrl(`games/scourge-survivors/ui/icons/pixel/${id}.webp`),
  ]),
) as Record<ScourgeSurvivorsPixelIconId, string>;
