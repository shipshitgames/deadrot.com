import * as THREE from "three";
import type { WeaponId } from "./constants";
import type { PlayerAvatarId } from "../net/playerAvatars";
import {
  ANIMATION_MANIFEST,
  ASSET_MANIFEST,
  animationFrameUrl,
  assetUrl,
  audioUrl,
  loadSpriteTexture,
  loadTexture,
  spriteEntry,
  spriteScale,
  textureEntry,
  type SpriteView,
} from "../assets/catalog";

type EnemySpriteKind = "melee" | "ranged" | "flying" | "boss";
type EnemySpriteView = SpriteView;
export type EnemySpriteAnimationState = "move" | "attack";

const ENEMY_SPRITE_IDS: Record<EnemySpriteKind, string> = {
  melee: "enemy-melee",
  ranged: "enemy-ranged",
  flying: "enemy-flying",
  boss: "boss",
};

const ENEMY_ANIMATION_CONFIG: Record<
  EnemySpriteKind,
  {
    entity: string;
    actions: Record<EnemySpriteAnimationState, string>;
  }
> = {
  melee: { entity: "host-grunt", actions: { move: "walk", attack: "slash" } },
  ranged: { entity: "spitter-host", actions: { move: "walk", attack: "spit" } },
  flying: { entity: "winged-host", actions: { move: "fly", attack: "attack" } },
  boss: { entity: "breach-boss", actions: { move: "lurch", attack: "barrage" } },
};

const PLAYER_SPRITE_IDS: Record<PlayerAvatarId, string> = {
  ranger: "player-ranger",
  heavy: "player-heavy",
  scout: "player-scout",
  medic: "player-medic",
};

const WEAPON_SPRITE_IDS: Record<WeaponId, string> = {
  pistol: "weapon-pistol",
  smg: "weapon-smg",
  shotgun: "weapon-shotgun",
  cannon: "weapon-cannon",
  sniper: "weapon-sniper",
};

function textureViews(id: string): Record<EnemySpriteView, THREE.Texture> {
  return {
    front: loadSpriteTexture(id, "front"),
    side: loadSpriteTexture(id, "side"),
    back: loadSpriteTexture(id, "back"),
  };
}

function scaleViews(id: string): Record<EnemySpriteView, [number, number]> {
  return {
    front: spriteScale(id, "front"),
    side: spriteScale(id, "side"),
    back: spriteScale(id, "back"),
  };
}

function loadEnemyAnimationTexture(
  entity: string,
  action: string,
  view: EnemySpriteView,
  frame: number,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(animationFrameUrl(entity, action, view, frame));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.premultiplyAlpha = false;
  return texture;
}

function animationFrameViews(entity: string, action: string): Record<EnemySpriteView, THREE.Texture[]> {
  const frames = Array.from({ length: ANIMATION_MANIFEST.framesPerAction }, (_, frame) => frame);
  return {
    front: frames.map((frame) => loadEnemyAnimationTexture(entity, action, "front", frame)),
    side: frames.map((frame) => loadEnemyAnimationTexture(entity, action, "side", frame)),
    back: frames.map((frame) => loadEnemyAnimationTexture(entity, action, "back", frame)),
  };
}

function animationStateViews(
  kind: EnemySpriteKind,
): Record<EnemySpriteAnimationState, Record<EnemySpriteView, THREE.Texture[]>> {
  const config = ENEMY_ANIMATION_CONFIG[kind];
  return {
    move: animationFrameViews(config.entity, config.actions.move),
    attack: animationFrameViews(config.entity, config.actions.attack),
  };
}

function animationStateMeta(
  kind: EnemySpriteKind,
): Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }> {
  const config = ENEMY_ANIMATION_CONFIG[kind];
  const entity = ANIMATION_MANIFEST.entities[config.entity];
  return {
    move: {
      fps: entity.actions[config.actions.move].fps,
      loop: entity.actions[config.actions.move].loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    },
    attack: {
      fps: entity.actions[config.actions.attack].fps,
      loop: entity.actions[config.actions.attack].loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    },
  };
}

export const ENEMY_SPRITE_TEXTURES: Record<EnemySpriteKind, Record<EnemySpriteView, THREE.Texture>> = {
  melee: textureViews(ENEMY_SPRITE_IDS.melee),
  ranged: textureViews(ENEMY_SPRITE_IDS.ranged),
  flying: textureViews(ENEMY_SPRITE_IDS.flying),
  boss: textureViews(ENEMY_SPRITE_IDS.boss),
};

export const ENEMY_SPRITE_ANIMATION_TEXTURES: Record<
  EnemySpriteKind,
  Record<EnemySpriteAnimationState, Record<EnemySpriteView, THREE.Texture[]>>
> = {
  melee: animationStateViews("melee"),
  ranged: animationStateViews("ranged"),
  flying: animationStateViews("flying"),
  boss: animationStateViews("boss"),
};

export const ENEMY_SPRITE_ANIMATION_META: Record<
  EnemySpriteKind,
  Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }>
> = {
  melee: animationStateMeta("melee"),
  ranged: animationStateMeta("ranged"),
  flying: animationStateMeta("flying"),
  boss: animationStateMeta("boss"),
};

export const ENEMY_SPRITE_SCALES: Record<EnemySpriteKind, Record<EnemySpriteView, [number, number]>> = {
  melee: scaleViews(ENEMY_SPRITE_IDS.melee),
  ranged: scaleViews(ENEMY_SPRITE_IDS.ranged),
  flying: scaleViews(ENEMY_SPRITE_IDS.flying),
  boss: scaleViews(ENEMY_SPRITE_IDS.boss),
};

export const WEAPON_SPRITE_TEXTURES: Record<WeaponId, THREE.Texture> = {
  pistol: loadSpriteTexture(WEAPON_SPRITE_IDS.pistol),
  smg: loadSpriteTexture(WEAPON_SPRITE_IDS.smg),
  shotgun: loadSpriteTexture(WEAPON_SPRITE_IDS.shotgun),
  cannon: loadSpriteTexture(WEAPON_SPRITE_IDS.cannon),
  sniper: loadSpriteTexture(WEAPON_SPRITE_IDS.sniper),
};

export const WEAPON_SPRITE_CONFIG: Record<
  WeaponId,
  {
    scale: [number, number];
    offset: [number, number, number];
    muzzle: [number, number, number];
    flashScale: number;
    flashRotation?: number;
  }
> = {
  pistol: weaponConfig("pistol"),
  smg: weaponConfig("smg"),
  shotgun: weaponConfig("shotgun"),
  cannon: weaponConfig("cannon"),
  sniper: weaponConfig("sniper"),
};

export const MUZZLE_FLASH_TEXTURE = loadSpriteTexture("muzzle-flash-pyre");

export const PROJECTILE_SPRITE_TEXTURES = {
  enemy: loadSpriteTexture("projectile-enemy"),
  boss: loadSpriteTexture("projectile-boss"),
} as const;

export const PICKUP_SPRITE_TEXTURES = {
  health: loadSpriteTexture("pickup-health"),
  ammo: loadSpriteTexture("pickup-ammo"),
  damage: loadSpriteTexture("pickup-damage"),
  dual: loadSpriteTexture("pickup-dual"),
} as const;

export const PICKUP_SPRITE_SCALES = {
  health: spriteScale("pickup-health"),
  ammo: spriteScale("pickup-ammo"),
  damage: spriteScale("pickup-damage"),
  dual: spriteScale("pickup-dual"),
} as const;

export const XP_BLOOD_TEXTURE = loadSpriteTexture("pickup-xp-blood");
export const XP_BLOOD_SCALE = spriteScale("pickup-xp-blood");

export const PLAYER_AVATAR_SPRITES: Record<
  PlayerAvatarId,
  { front: THREE.Texture; side: THREE.Texture; back: THREE.Texture }
> = {
  ranger: textureViews(PLAYER_SPRITE_IDS.ranger),
  heavy: textureViews(PLAYER_SPRITE_IDS.heavy),
  scout: textureViews(PLAYER_SPRITE_IDS.scout),
  medic: textureViews(PLAYER_SPRITE_IDS.medic),
};

export const PLAYER_AVATAR_SCALES: Record<PlayerAvatarId, Record<SpriteView, [number, number]>> = {
  ranger: scaleViews(PLAYER_SPRITE_IDS.ranger),
  heavy: scaleViews(PLAYER_SPRITE_IDS.heavy),
  scout: scaleViews(PLAYER_SPRITE_IDS.scout),
  medic: scaleViews(PLAYER_SPRITE_IDS.medic),
};

export const ARENA_TEXTURES = {
  floor: loadTexture("arena-floor"),
  wall: loadTexture("arena-wall"),
  column: loadTexture("arena-column"),
  block: loadTexture("arena-block"),
} as const;

export const ARENA_TEXTURE_REPEAT = {
  floor: textureEntry("arena-floor").repeat,
  wall: textureEntry("arena-wall").repeat,
  column: textureEntry("arena-column").repeat,
  block: textureEntry("arena-block").repeat,
} as const;

const ARENA_TEXTURE_CACHE = new Map<string, THREE.Texture>()

export function arenaTexture(id: string): THREE.Texture {
  let texture = ARENA_TEXTURE_CACHE.get(id)
  if (!texture) {
    texture = loadTexture(id)
    ARENA_TEXTURE_CACHE.set(id, texture)
  }
  return texture
}

export function arenaTextureRepeat(id: string): [number, number] {
  return textureEntry(id).repeat
}

export const RUNTIME_VISUAL_ASSET_URLS = Object.fromEntries([
  ...Object.entries(ASSET_MANIFEST.sprites).flatMap(([id, entry]) => {
    if (entry.views) {
      return Object.entries(entry.views).map(([view, viewEntry]) => [`${id}-${view}`, assetUrl(viewEntry.path)]);
    }
    if (!entry.path) return [];
    return [[id, assetUrl(entry.path)]];
  }),
  ...Object.entries(ASSET_MANIFEST.textures).map(([id, entry]) => [id, assetUrl(entry.path)]),
]) as Record<string, string>;

export const RUNTIME_AUDIO_ASSET_URLS = Object.fromEntries(
  Object.keys(ASSET_MANIFEST.audio).map((id) => [id, audioUrl(id)]),
) as Record<string, string>;

function weaponConfig(id: WeaponId) {
  const entry = spriteEntry(WEAPON_SPRITE_IDS[id]);
  if (!entry.scale || !entry.weapon) throw new Error(`Weapon sprite ${id} is missing weapon metadata`);
  return {
    scale: entry.scale,
    offset: entry.weapon.offset,
    muzzle: entry.weapon.muzzle,
    flashScale: entry.weapon.flashScale,
    flashRotation: entry.weapon.flashRotation,
  };
}
