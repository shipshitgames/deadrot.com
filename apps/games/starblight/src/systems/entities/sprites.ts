import starblightAssets from "@shipshitgames/assets/games/starblight/assets.json";
import orbitalBreachCarrierUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/orbital-breach-carrier.webp";
import scourgeEliteUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/scourge-elite.webp";
import scourgeGruntUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/scourge-grunt.webp";
import scourgeSpitterUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/scourge-spitter.webp";
import scourgeSwarmlingUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/scourge-swarmling.webp";
import scourgeWeaverUrl from "@shipshitgames/assets/games/starblight/enemies/scourge/scourge-weaver.webp";
import salvageShardUrl from "@shipshitgames/assets/games/starblight/pickups/salvage/salvage-shard.webp";
import playerInterceptorUrl from "@shipshitgames/assets/games/starblight/players/pyre/player-interceptor.webp";
import * as THREE from "three";
import type { EnemyType } from "../../game/constants";

export type SpriteKey = "player" | "grunt" | "swarmling" | "weaver" | "spitter" | "elite" | "boss" | "salvage";

export type SpriteTextures = Record<SpriteKey, THREE.Texture>;

type StarblightSpriteId = keyof typeof starblightAssets.sprites;

function spriteSpec(url: string, id: StarblightSpriteId): { url: string; aspect: number } {
  const [width, height] = starblightAssets.sprites[id].dimensions;
  return { url, aspect: width / height };
}

const SPRITE_SPECS: Record<SpriteKey, { url: string; aspect: number }> = {
  player: spriteSpec(playerInterceptorUrl, "player-interceptor"),
  grunt: spriteSpec(scourgeGruntUrl, "scourge-grunt"),
  swarmling: spriteSpec(scourgeSwarmlingUrl, "scourge-swarmling"),
  weaver: spriteSpec(scourgeWeaverUrl, "scourge-weaver"),
  spitter: spriteSpec(scourgeSpitterUrl, "scourge-spitter"),
  elite: spriteSpec(scourgeEliteUrl, "scourge-elite"),
  boss: spriteSpec(orbitalBreachCarrierUrl, "orbital-breach-carrier"),
  salvage: spriteSpec(salvageShardUrl, "salvage-shard"),
};

export const ENEMY_SPRITES: Record<EnemyType, SpriteKey> = {
  grunt: "grunt",
  swarmling: "swarmling",
  weaver: "weaver",
  spitter: "spitter",
  elite: "elite",
};

function loadSpriteTexture(key: SpriteKey): THREE.Texture {
  const tex = new THREE.TextureLoader().load(SPRITE_SPECS[key].url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  return tex;
}

export function spritePlane(key: SpriteKey, height: number): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(height * SPRITE_SPECS[key].aspect, height);
}

/** Loads every sprite texture once; owner is responsible for disposal. */
export function createSpriteTextures(): SpriteTextures {
  return {
    player: loadSpriteTexture("player"),
    grunt: loadSpriteTexture("grunt"),
    swarmling: loadSpriteTexture("swarmling"),
    weaver: loadSpriteTexture("weaver"),
    spitter: loadSpriteTexture("spitter"),
    elite: loadSpriteTexture("elite"),
    boss: loadSpriteTexture("boss"),
    salvage: loadSpriteTexture("salvage"),
  };
}

export function spriteMaterial(textures: SpriteTextures, key: SpriteKey): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: textures[key],
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
