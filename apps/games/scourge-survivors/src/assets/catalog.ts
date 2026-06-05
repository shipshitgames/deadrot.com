import * as THREE from 'three'
import {
  SCOURGE_SURVIVORS_ASSET_MANIFEST,
  scourgeSurvivorsAssetUrl,
  scourgeSurvivorsAudioEntry,
  scourgeSurvivorsAudioUrl,
  scourgeSurvivorsSpriteEntry,
  scourgeSurvivorsSpriteScale,
  scourgeSurvivorsSpriteUrl,
  scourgeSurvivorsTextureEntry,
  type AudioEntry,
  type LicenseRecord,
  type ScourgeSurvivorsAssetManifest,
  type SpriteEntry,
  type SpriteFilter,
  type SpriteView,
  type SpriteViewEntry,
  type TextureEntry,
  type Vec2,
  type Vec3,
} from '@shipshitgames/assets/scourge-survivors'

export type {
  AudioEntry,
  LicenseRecord,
  ScourgeSurvivorsAssetManifest as AssetManifest,
  SpriteEntry,
  SpriteFilter,
  SpriteView,
  SpriteViewEntry,
  TextureEntry,
  Vec2,
  Vec3,
}

export const ASSET_MANIFEST = SCOURGE_SURVIVORS_ASSET_MANIFEST

export function assetUrl(path: string): string {
  return scourgeSurvivorsAssetUrl(path)
}

export function spriteEntry(id: string): SpriteEntry {
  return scourgeSurvivorsSpriteEntry(id)
}

export function textureEntry(id: string): TextureEntry {
  return scourgeSurvivorsTextureEntry(id)
}

export function audioEntry(id: string): AudioEntry {
  return scourgeSurvivorsAudioEntry(id)
}

export function audioUrl(id: string): string {
  return scourgeSurvivorsAudioUrl(id)
}

export function spriteUrl(id: string, view?: SpriteView): string {
  return scourgeSurvivorsSpriteUrl(id, view)
}

export function spriteScale(id: string, view?: SpriteView): Vec2 {
  return scourgeSurvivorsSpriteScale(id, view)
}

export function loadSpriteTexture(id: string, view?: SpriteView): THREE.Texture {
  const entry = spriteEntry(id)
  const texture = new THREE.TextureLoader().load(spriteUrl(id, view))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = entry.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter
  texture.magFilter = entry.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter
  texture.generateMipmaps = entry.filter !== 'nearest'
  texture.premultiplyAlpha = false
  return texture
}

export function loadTexture(id: string): THREE.Texture {
  const entry = textureEntry(id)
  const texture = new THREE.TextureLoader().load(assetUrl(entry.path))
  texture.colorSpace = entry.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}
