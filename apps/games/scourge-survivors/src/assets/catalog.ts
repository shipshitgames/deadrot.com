import {
  type AnimationActionEntry,
  type AnimationEntityEntry,
  type AudioEntry,
  type LicenseRecord,
  type RuntimeEnemyRef,
  type RuntimeSpriteRef,
  type RuntimeUiRef,
  SCOURGE_SURVIVORS_ANIMATION_MANIFEST,
  SCOURGE_SURVIVORS_ASSET_MANIFEST,
  type ScourgeSurvivorsAnimationManifest,
  type ScourgeSurvivorsAssetManifest,
  type SpriteEntry,
  type SpriteFilter,
  type SpriteView,
  type SpriteViewEntry,
  scourgeSurvivorsAnimationFrameUrl,
  scourgeSurvivorsAssetUrl,
  scourgeSurvivorsAudioEntry,
  scourgeSurvivorsAudioUrl,
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

export type {
  AnimationActionEntry,
  AnimationEntityEntry,
  AudioEntry,
  LicenseRecord,
  RuntimeEnemyRef,
  RuntimeSpriteRef,
  RuntimeUiRef,
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

type RuntimeDomain = keyof ScourgeSurvivorsAssetManifest["runtime"];
type RuntimeSpriteDomain = Exclude<RuntimeDomain, "ui" | "enemies">;

export class AssetCatalog {
  constructor(
    readonly manifest: ScourgeSurvivorsAssetManifest = SCOURGE_SURVIVORS_ASSET_MANIFEST,
    readonly animations: ScourgeSurvivorsAnimationManifest = SCOURGE_SURVIVORS_ANIMATION_MANIFEST,
  ) {}

  assetUrl(path: string): string {
    return scourgeSurvivorsAssetUrl(path);
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
    return scourgeSurvivorsUiUrl(id);
  }

  spriteUrl(id: string, view?: SpriteView): string {
    return scourgeSurvivorsSpriteUrl(id, view);
  }

  animationFrameUrl(entity: string, action: string, view: SpriteView, frame: number): string {
    return scourgeSurvivorsAnimationFrameUrl(entity, action, view, frame);
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

  weapon(id: string): RuntimeSpriteRef {
    return this.spriteRef("weapons", id);
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

export function assetUrl(path: string): string {
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

export function spriteUrl(id: string, view?: SpriteView): string {
  return ASSET_CATALOG.spriteUrl(id, view);
}

export function animationFrameUrl(entity: string, action: string, view: SpriteView, frame: number): string {
  return ASSET_CATALOG.animationFrameUrl(entity, action, view, frame);
}

export function spriteScale(id: string, view?: SpriteView): Vec2 {
  return ASSET_CATALOG.spriteScale(id, view);
}

export function loadSpriteTexture(id: string, view?: SpriteView): THREE.Texture {
  const entry = spriteEntry(id);
  const texture = new THREE.TextureLoader().load(spriteUrl(id, view));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
  texture.magFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = entry.filter !== "nearest";
  texture.premultiplyAlpha = false;
  return texture;
}

export function loadTexture(id: string): THREE.Texture {
  const entry = textureEntry(id);
  const texture = new THREE.TextureLoader().load(assetUrl(entry.path));
  texture.colorSpace = entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
