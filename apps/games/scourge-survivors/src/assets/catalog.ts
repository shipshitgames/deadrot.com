import {
  type AnimationActionEntry,
  type AnimationEntityEntry,
  type AudioEntry,
  type LicenseRecord,
  type RuntimeEnemyRef,
  type RuntimeSpriteRef,
  type RuntimeUiRef,
  type RuntimeWeaponRef,
  SCOURGE_SURVIVORS_ANIMATION_MANIFEST,
  SCOURGE_SURVIVORS_ASSET_MANIFEST,
  type ScourgeSurvivorsAnimationFrameSource,
  type ScourgeSurvivorsAnimationManifest,
  type ScourgeSurvivorsAssetManifest,
  type SpriteEntry,
  type SpriteFilter,
  type SpriteView,
  type SpriteViewEntry,
  scourgeSurvivorsAnimationFrameSource,
  scourgeSurvivorsAudioEntry,
  scourgeSurvivorsAudioUrl,
  scourgeSurvivorsBootSpriteUrl,
  scourgeSurvivorsLoadAssetUrl,
  scourgeSurvivorsSpriteEntry,
  scourgeSurvivorsSpriteScale,
  scourgeSurvivorsSpriteUrl,
  scourgeSurvivorsTextureEntry,
  scourgeSurvivorsUiEntry,
  scourgeSurvivorsUiUrl,
  type TextureEntry,
  type UiEntry,
  type Vec2,
  type Vec3,
} from "@shipshitgames/assets/scourge-survivors";
import * as THREE from "three";
import { ASSETS, type AssetId } from "../assets.generated";

export type {
  AnimationActionEntry,
  AnimationEntityEntry,
  AudioEntry,
  LicenseRecord,
  RuntimeEnemyRef,
  RuntimeSpriteRef,
  RuntimeUiRef,
  RuntimeWeaponRef,
  ScourgeSurvivorsAnimationFrameSource as AnimationFrameSource,
  ScourgeSurvivorsAnimationManifest as AnimationManifest,
  ScourgeSurvivorsAssetManifest as AssetManifest,
  SpriteEntry,
  SpriteFilter,
  SpriteView,
  SpriteViewEntry,
  TextureEntry,
  UiEntry,
  Vec2,
  Vec3,
};

export const ASSET_MANIFEST = SCOURGE_SURVIVORS_ASSET_MANIFEST;
export const ANIMATION_MANIFEST = SCOURGE_SURVIVORS_ANIMATION_MANIFEST;

const GENERATED_ASSET_ID_BY_PATH = new Map<string, AssetId>(
  (Object.keys(ASSETS) as AssetId[]).map((id) => [ASSETS[id].path, id]),
);

/**
 * Keep runtime manifest paths honest against assetgen's generated, typed index.
 * Metadata remains synchronous; URL materialization is the only async boundary.
 */
function generatedAssetId(path: string): AssetId {
  const id = GENERATED_ASSET_ID_BY_PATH.get(path);
  if (!id) throw new Error(`Scourge Survivors asset is missing from generated index: ${path}`);
  return id;
}

function spritePath(id: string, view?: SpriteView): string {
  const entry = scourgeSurvivorsSpriteEntry(id);
  if (view) {
    const viewEntry = entry.views?.[view];
    if (!viewEntry) throw new Error(`Scourge Survivors sprite asset ${id} has no ${view} view`);
    return viewEntry.path;
  }
  if (!entry.path) throw new Error(`Scourge Survivors sprite asset ${id} has no direct path`);
  return entry.path;
}

type RuntimeDomain = keyof ScourgeSurvivorsAssetManifest["runtime"];
type RuntimeSpriteDomain = Exclude<RuntimeDomain, "ui" | "bonusIcons" | "enemies" | "weapons">;

export class AssetCatalog {
  constructor(
    readonly manifest: ScourgeSurvivorsAssetManifest = SCOURGE_SURVIVORS_ASSET_MANIFEST,
    readonly animations: ScourgeSurvivorsAnimationManifest = SCOURGE_SURVIVORS_ANIMATION_MANIFEST,
  ) {}

  assetUrl(path: string): Promise<string> {
    generatedAssetId(path);
    return scourgeSurvivorsLoadAssetUrl(path);
  }

  spriteEntry(id: string): SpriteEntry {
    return scourgeSurvivorsSpriteEntry(id);
  }

  textureEntry(id: string): TextureEntry {
    return scourgeSurvivorsTextureEntry(id);
  }

  audioEntry(id: string): AudioEntry {
    return scourgeSurvivorsAudioEntry(id);
  }

  uiEntry(id: string): UiEntry {
    return scourgeSurvivorsUiEntry(id);
  }

  audioUrl(id: string): string {
    return scourgeSurvivorsAudioUrl(id);
  }

  uiUrl(id: string): string {
    generatedAssetId(this.uiEntry(id).path);
    return scourgeSurvivorsUiUrl(id);
  }

  bootSpriteUrl(id: string, view: SpriteView): string {
    generatedAssetId(spritePath(id, view));
    return scourgeSurvivorsBootSpriteUrl(id, view);
  }

  spriteUrl(id: string, view?: SpriteView): Promise<string> {
    generatedAssetId(spritePath(id, view));
    return scourgeSurvivorsSpriteUrl(id, view);
  }

  animationFrameSource(
    entity: string,
    action: string,
    view: SpriteView,
    frame: number,
  ): Promise<ScourgeSurvivorsAnimationFrameSource> {
    return scourgeSurvivorsAnimationFrameSource(entity, action, view, frame);
  }

  async animationFrameUrl(entity: string, action: string, view: SpriteView, frame: number): Promise<string> {
    return (await this.animationFrameSource(entity, action, view, frame)).url;
  }

  spriteScale(id: string, view?: SpriteView): Vec2 {
    return scourgeSurvivorsSpriteScale(id, view);
  }

  enemy(id: string): RuntimeEnemyRef {
    const ref = this.manifest.runtime.enemies[id];
    if (!ref) throw new Error(`Unknown Scourge Survivors runtime enemy id: ${id}`);
    this.spriteEntry(ref.sprite);
    return ref;
  }

  spriteRef(domain: RuntimeSpriteDomain, id: string): RuntimeSpriteRef {
    const ref = this.manifest.runtime[domain][id];
    if (!ref) throw new Error(`Unknown Scourge Survivors runtime ${domain} id: ${id}`);
    this.spriteEntry(ref.sprite);
    return ref;
  }

  player(id: string): RuntimeSpriteRef {
    return this.spriteRef("players", id);
  }

  weapon(id: string): RuntimeWeaponRef {
    const ref = this.manifest.runtime.weapons[id];
    if (!ref) throw new Error(`Unknown Scourge Survivors runtime weapons id: ${id}`);
    this.spriteEntry(ref.sprite);
    this.spriteEntry(ref.lootSprite);
    if (ref.dualSprite) this.spriteEntry(ref.dualSprite);
    return ref;
  }

  pickup(id: string): RuntimeSpriteRef {
    return this.spriteRef("pickups", id);
  }

  projectile(id: string): RuntimeSpriteRef {
    return this.spriteRef("projectiles", id);
  }

  fx(id: string): RuntimeSpriteRef {
    return this.spriteRef("fx", id);
  }

  ui(id: string): RuntimeUiRef {
    const ref = this.manifest.runtime.ui[id];
    if (!ref) throw new Error(`Unknown Scourge Survivors runtime UI id: ${id}`);
    this.uiEntry(ref.asset);
    return ref;
  }

  runtimeUiUrl(id: string): string {
    return this.uiUrl(this.ui(id).asset);
  }
}

export const ASSET_CATALOG = new AssetCatalog();

export function assetUrl(path: string): Promise<string> {
  return ASSET_CATALOG.assetUrl(path);
}

export function spriteEntry(id: string): SpriteEntry {
  return ASSET_CATALOG.spriteEntry(id);
}

export function textureEntry(id: string): TextureEntry {
  return ASSET_CATALOG.textureEntry(id);
}

export function audioEntry(id: string): AudioEntry {
  return ASSET_CATALOG.audioEntry(id);
}

export function uiEntry(id: string): UiEntry {
  return ASSET_CATALOG.uiEntry(id);
}

export function audioUrl(id: string): string {
  return ASSET_CATALOG.audioUrl(id);
}

export function uiUrl(id: string): string {
  return ASSET_CATALOG.uiUrl(id);
}

export function bootSpriteUrl(id: string, view: SpriteView): string {
  return ASSET_CATALOG.bootSpriteUrl(id, view);
}

export function spriteUrl(id: string, view?: SpriteView): Promise<string> {
  return ASSET_CATALOG.spriteUrl(id, view);
}

export function animationFrameSource(
  entity: string,
  action: string,
  view: SpriteView,
  frame: number,
): Promise<ScourgeSurvivorsAnimationFrameSource> {
  return ASSET_CATALOG.animationFrameSource(entity, action, view, frame);
}

export function animationFrameUrl(entity: string, action: string, view: SpriteView, frame: number): Promise<string> {
  return ASSET_CATALOG.animationFrameUrl(entity, action, view, frame);
}

export function spriteScale(id: string, view?: SpriteView): Vec2 {
  return ASSET_CATALOG.spriteScale(id, view);
}

const TEXTURE_PROMISES = new Map<string, Promise<THREE.Texture>>();

function cachedTexture(key: string, load: () => Promise<THREE.Texture>): Promise<THREE.Texture> {
  const cached = TEXTURE_PROMISES.get(key);
  if (cached) return cached;
  const promise = load().catch((error) => {
    TEXTURE_PROMISES.delete(key);
    throw error;
  });
  TEXTURE_PROMISES.set(key, promise);
  return promise;
}

export function loadSpriteTexture(id: string, view?: SpriteView): Promise<THREE.Texture> {
  const entry = spriteEntry(id);
  return cachedTexture(`sprite:${id}:${view ?? "direct"}`, async () => {
    const texture = await new THREE.TextureLoader().loadAsync(await spriteUrl(id, view));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
    texture.magFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
    texture.generateMipmaps = entry.filter !== "nearest";
    texture.premultiplyAlpha = false;
    return texture;
  });
}

export function loadTexture(id: string): Promise<THREE.Texture> {
  const entry = textureEntry(id);
  return cachedTexture(`texture:${id}`, async () => {
    const texture = await new THREE.TextureLoader().loadAsync(await assetUrl(entry.path));
    texture.colorSpace = entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  });
}
