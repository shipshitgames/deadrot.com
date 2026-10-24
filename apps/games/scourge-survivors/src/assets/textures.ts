import * as THREE from "three";
import { assetUrl, type SpriteView, spriteEntry, spriteUrl, textureEntry } from "./catalog";

/**
 * GPU texture loading, kept out of `./catalog`.
 *
 * The catalog is pure manifest lookup and URL materialization, which the audio
 * engine and the menus need at boot. These two loaders are the only part of it
 * that touches Three.js, so they live here — that keeps the renderer out of the
 * boot chunk and leaves it to load with the combat runtime that actually uses it.
 */
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
