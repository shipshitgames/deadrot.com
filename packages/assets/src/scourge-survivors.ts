import animationManifestData from "../games/scourge-survivors/animations/scourge/animation-pack.json" with {
  type: "json",
};
import comicAnimationManifestData from "../games/scourge-survivors/animations/scourge-comic/animation-pack.json" with {
  type: "json",
};
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

export interface RuntimeEnemyRef extends RuntimeSpriteRef {
  animation: RuntimeAnimationRef;
}

export interface RuntimeUiRef {
  asset: string;
}

export interface ScourgeSurvivorsRuntimeManifest {
  enemies: Record<string, RuntimeEnemyRef>;
  players: Record<string, RuntimeSpriteRef>;
  weapons: Record<string, RuntimeSpriteRef>;
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

export interface ScourgeSurvivorsAnimationManifest {
  version: string;
  status: string;
  tool: string;
  model: string;
  promptHistory: string;
  framesPerAction: number;
  views: SpriteView[];
  entities: Record<string, AnimationEntityEntry>;
}

export const SCOURGE_SURVIVORS_ASSET_MANIFEST = manifestData as unknown as ScourgeSurvivorsAssetManifest;

export const SCOURGE_SURVIVORS_ANIMATION_MANIFEST =
  animationManifestData as unknown as ScourgeSurvivorsAnimationManifest;

const scourgeSurvivorsAssetModules = import.meta.glob<string>(
  [
    "../games/scourge-survivors/animations/**/*.webp",
    "../games/scourge-survivors/players/**/*.webp",
    "../games/scourge-survivors/enemies/**/*.webp",
    "../games/scourge-survivors/weapons/**/*.webp",
    "../games/scourge-survivors/pickups/**/*.webp",
    "../games/scourge-survivors/projectiles/**/*.webp",
    "../games/scourge-survivors/textures/**/*.webp",
    "../games/scourge-survivors/fx/**/*.webp",
    "../games/scourge-survivors/ui/icons/pixel/*.webp",
    "../games/scourge-survivors/ui/cards/**/*.webp",
    "../games/scourge-survivors/ui/cover/**/*.webp",
    "../games/scourge-survivors/ui/menu/**/*.webp",
    "../games/scourge-survivors/audio/**/*.webm",
    "../games/scourge-survivors/fonts/*.ttf",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
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

export function scourgeSurvivorsAssetUrl(path: string): string {
  const key = `../${path}`;
  const url = scourgeSurvivorsAssetModules[key];
  if (!url) throw new Error(`Scourge Survivors asset manifest references missing file: ${path}`);
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

export function scourgeSurvivorsAnimationFrameUrl(
  entity: string,
  action: string,
  view: SpriteView,
  frame: number,
): string {
  const entityEntry = SCOURGE_SURVIVORS_ANIMATION_MANIFEST.entities[entity];
  if (!entityEntry) throw new Error(`Unknown Scourge Survivors animation entity: ${entity}`);
  const actionEntry = entityEntry.actions[action];
  if (!actionEntry) throw new Error(`Unknown Scourge Survivors animation action: ${entity}/${action}`);
  const frameId = String(frame).padStart(2, "0");
  // Only rewrite to the comic pack for entities that have comic frames; others
  // (e.g. wound-hound) keep the default pack so comic mode can't crash on a
  // missing-file lookup.
  const pathTemplate =
    comicAssetsEnabled() && COMIC_ANIMATION_ENTITIES.has(entity)
      ? actionEntry.pathTemplate.replace("animations/scourge/", COMIC_ANIMATION_ROOT)
      : actionEntry.pathTemplate;
  const path = `games/scourge-survivors/${pathTemplate.replace("{view}", view).replace("{frame}", frameId)}`;
  return scourgeSurvivorsAssetUrl(path);
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
