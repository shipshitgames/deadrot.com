import * as THREE from "three";
import orbitalBreachCarrierUrl from "../../assets/sprites/runtime/orbital-breach-carrier.webp";
import playerInterceptorUrl from "../../assets/sprites/runtime/player-interceptor.webp";
import salvageShardUrl from "../../assets/sprites/runtime/salvage-shard.webp";
import scourgeEliteUrl from "../../assets/sprites/runtime/scourge-elite.webp";
import scourgeGruntUrl from "../../assets/sprites/runtime/scourge-grunt.webp";
import scourgeSpitterUrl from "../../assets/sprites/runtime/scourge-spitter.webp";
import scourgeSwarmlingUrl from "../../assets/sprites/runtime/scourge-swarmling.webp";
import scourgeWeaverUrl from "../../assets/sprites/runtime/scourge-weaver.webp";
import type { EnemyType } from "../../game/constants";

export type SpriteKey = "player" | "grunt" | "swarmling" | "weaver" | "spitter" | "elite" | "boss" | "salvage";

export type SpriteTextures = Record<SpriteKey, THREE.Texture>;

const SPRITE_SPECS: Record<SpriteKey, { url: string; aspect: number }> = {
  player: { url: playerInterceptorUrl, aspect: 116 / 132 },
  grunt: { url: scourgeGruntUrl, aspect: 75 / 114 },
  swarmling: { url: scourgeSwarmlingUrl, aspect: 40 / 94 },
  weaver: { url: scourgeWeaverUrl, aspect: 125 / 108 },
  spitter: { url: scourgeSpitterUrl, aspect: 96 / 114 },
  elite: { url: scourgeEliteUrl, aspect: 109 / 148 },
  boss: { url: orbitalBreachCarrierUrl, aspect: 114 / 196 },
  salvage: { url: salvageShardUrl, aspect: 38 / 60 },
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
