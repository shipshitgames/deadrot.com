import animationManifestData from "../games/scourge-survivors/animations/scourge/animation-pack.json" with {
  type: "json",
};
import animationAtlasData from "../games/scourge-survivors/animations/scourge/scourge.atlas.json" with { type: "json" };
import comicAnimationManifestData from "../games/scourge-survivors/animations/scourge-comic/animation-pack.json" with {
  type: "json",
};
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

export interface RuntimeAnimationRef {
  entity: string;
  actions: Record<string, string>;
}

export interface RuntimeSpriteRef {
  sprite: string;
}

export interface RuntimeWeaponRef extends RuntimeSpriteRef {
  lootSprite: string;
}

export interface RuntimeEnemyRef extends RuntimeSpriteRef {
  animation: RuntimeAnimationRef;
}

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
}

export interface ScourgeSurvivorsAssetManifest {
  sprites: Record<string, SpriteEntry>;
  textures: Record<string, TextureEntry>;
  audio: Record<string, AudioEntry>;
  ui: Record<string, UiEntry>;
  runtime: ScourgeSurvivorsRuntimeManifest;
}

export interface AnimationActionEntry {
  loop: boolean;
  fps: number;
  pathTemplate: string;
}

export interface AnimationEntityEntry {
  frameDimensions: Vec2;
  colorLane: string;
  physicsLane: string;
  actions: Record<string, AnimationActionEntry>;
}

export interface AnimationAtlasPageEntry {
  path: string;
  width: number;
  height: number;
}

export interface AnimationRuntimeAtlasEntry {
  tool: string;
  mapPath: string;
  padding: number;
  frameCount: number;
  note: string;
  license: string;
  pages: AnimationAtlasPageEntry[];
}

export interface ScourgeSurvivorsAnimationManifest {
  version: string;
  status: string;
  tool: string;
  model: string;
  promptHistory: string;
  framesPerAction: number;
  views: SpriteView[];
  runtimeAtlas?: AnimationRuntimeAtlasEntry;
  entities: Record<string, AnimationEntityEntry>;
}

interface GeneratedAnimationAtlasPage {
  image: string;
  width: number;
  height: number;
}

interface GeneratedAnimationAtlasFrame {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GeneratedAnimationAtlas {
  version: number;
  padding: number;
  frameCount: number;
  pages: GeneratedAnimationAtlasPage[];
  frames: GeneratedAnimationAtlasFrame[];
}

export interface ScourgeSurvivorsAnimationFrameSource {
  url: string;
  atlas?: {
    pageWidth: number;
    pageHeight: number;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export const SCOURGE_SURVIVORS_ASSET_MANIFEST = manifestData as unknown as ScourgeSurvivorsAssetManifest;

export const SCOURGE_SURVIVORS_ANIMATION_MANIFEST =
  animationManifestData as unknown as ScourgeSurvivorsAnimationManifest;

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

/**
 * Combat media is represented by lazy URL modules. The authored default split
 * frames are deliberately absent: default animation playback uses the generated
 * atlas page, while the opt-in comic pack remains split and lazy.
 */
const scourgeSurvivorsLazyAssetModules = import.meta.glob<string>(
  [
    "../games/scourge-survivors/animations/scourge/scourge.atlas*.webp",
    "../games/scourge-survivors/animations/scourge-comic/**/*.webp",
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
const generatedAnimationAtlas = animationAtlasData as unknown as GeneratedAnimationAtlas;
const generatedAnimationAtlasFrames = new Map(
  generatedAnimationAtlas.frames.map((frame) => [frame.id, frame] as const),
);

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

const DEFAULT_ANIMATION_ROOT = "animations/scourge/";
const COMIC_ANIMATION_ROOT = "animations/scourge-comic/";

// Entities that actually ship comic animation frames. The comic pack is a
// SUBSET of the default pack (e.g. wound-hound has no comic frames), so the
// path-root rewrite below must be scoped to these — a blanket swap would point a
// comic-less entity at a non-existent path and throw at module load, crashing
// the whole game in comic mode rather than just falling back for that entity.
const COMIC_ANIMATION_ENTITIES = new Set(
  Object.keys((comicAnimationManifestData as { entities?: Record<string, unknown> }).entities ?? {}),
);

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

export async function scourgeSurvivorsAnimationFrameSource(
  entity: string,
  action: string,
  view: SpriteView,
  frame: number,
): Promise<ScourgeSurvivorsAnimationFrameSource> {
  const entityEntry = SCOURGE_SURVIVORS_ANIMATION_MANIFEST.entities[entity];
  if (!entityEntry) throw new Error(`Unknown Scourge Survivors animation entity: ${entity}`);
  const actionEntry = entityEntry.actions[action];
  if (!actionEntry) throw new Error(`Unknown Scourge Survivors animation action: ${entity}/${action}`);
  if (!Number.isInteger(frame) || frame < 0 || frame >= SCOURGE_SURVIVORS_ANIMATION_MANIFEST.framesPerAction) {
    throw new Error(
      `Scourge Survivors animation frame is out of range: ${entity}/${action}/${view}/${frame} (expected 0-${SCOURGE_SURVIVORS_ANIMATION_MANIFEST.framesPerAction - 1})`,
    );
  }

  const frameId = String(frame).padStart(2, "0");
  const defaultPath = actionEntry.pathTemplate.replace("{view}", view).replace("{frame}", frameId);

  // Comic selection is atomic per entity. The four comic entities use their
  // split frames; wound-hound and any future comic-less entity stay on the
  // default atlas rather than mixing styles or resolving a missing file.
  if (comicAssetsEnabled() && COMIC_ANIMATION_ENTITIES.has(entity)) {
    const comicPath = defaultPath.replace(DEFAULT_ANIMATION_ROOT, COMIC_ANIMATION_ROOT);
    const url = await scourgeSurvivorsLoadAssetUrl(`games/scourge-survivors/${comicPath}`);
    return { url };
  }

  if (!defaultPath.startsWith(DEFAULT_ANIMATION_ROOT)) {
    throw new Error(
      `Scourge Survivors default animation path leaves ${DEFAULT_ANIMATION_ROOT}: ${entity}/${action} -> ${defaultPath}`,
    );
  }
  const atlasFrameId = defaultPath.slice(DEFAULT_ANIMATION_ROOT.length);
  const atlasFrame = generatedAnimationAtlasFrames.get(atlasFrameId);
  if (!atlasFrame) {
    throw new Error(`Scourge Survivors animation atlas is missing frame: ${entity}/${action}/${view}/${frameId}`);
  }

  const runtimeAtlas = SCOURGE_SURVIVORS_ANIMATION_MANIFEST.runtimeAtlas;
  if (!runtimeAtlas) throw new Error("Scourge Survivors default animation manifest is missing runtimeAtlas metadata");
  const generatedPage = generatedAnimationAtlas.pages[atlasFrame.page];
  const manifestPage = runtimeAtlas.pages[atlasFrame.page];
  if (!generatedPage || !manifestPage) {
    throw new Error(
      `Scourge Survivors animation atlas frame ${atlasFrameId} references missing page ${atlasFrame.page}`,
    );
  }
  if (manifestPage.width !== generatedPage.width || manifestPage.height !== generatedPage.height) {
    throw new Error(
      `Scourge Survivors animation atlas page metadata drift: manifest ${manifestPage.width}x${manifestPage.height}, generated ${generatedPage.width}x${generatedPage.height}`,
    );
  }

  return {
    url: await scourgeSurvivorsLoadAssetUrl(manifestPage.path),
    atlas: {
      pageWidth: manifestPage.width,
      pageHeight: manifestPage.height,
      x: atlasFrame.x,
      y: atlasFrame.y,
      w: atlasFrame.w,
      h: atlasFrame.h,
    },
  };
}

export async function scourgeSurvivorsAnimationFrameUrl(
  entity: string,
  action: string,
  view: SpriteView,
  frame: number,
): Promise<string> {
  return (await scourgeSurvivorsAnimationFrameSource(entity, action, view, frame)).url;
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

export type ScourgeSurvivorsPixelIconId = (typeof SCOURGE_SURVIVORS_PIXEL_ICON_IDS)[number];

export const SCOURGE_SURVIVORS_PIXEL_ICON_URLS = Object.fromEntries(
  SCOURGE_SURVIVORS_PIXEL_ICON_IDS.map((id) => [
    id,
    scourgeSurvivorsAssetUrl(`games/scourge-survivors/ui/icons/pixel/${id}.webp`),
  ]),
) as Record<ScourgeSurvivorsPixelIconId, string>;
