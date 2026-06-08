import * as THREE from "three";
import {
  ANIMATION_MANIFEST,
  ASSET_CATALOG,
  ASSET_MANIFEST,
  animationFrameUrl,
  assetUrl,
  audioUrl,
  loadSpriteTexture,
  loadTexture,
  type SpriteView,
  spriteEntry,
  spriteScale,
  spriteUrl,
  textureEntry,
} from "../assets/catalog";
import type { PlayerAvatarId } from "../net/playerAvatars";
import type { WeaponId } from "./constants";
import { MAIN_WEAPON_VISUAL_TIERS, type MainWeaponVisualTier } from "./data/survivors";

export type EnemySpriteKind = "melee" | "ranged" | "flying" | "boss";
export type EnemySpriteView = SpriteView;
export type EnemySpriteAnimationState = "move" | "attack" | "death";

export function enemySpriteAssetId(id: EnemySpriteKind): string {
  return ASSET_CATALOG.enemy(id).sprite;
}

export function playerAvatarSpriteAssetId(id: PlayerAvatarId): string {
  return ASSET_CATALOG.player(id).sprite;
}

export function weaponSpriteAssetId(id: WeaponId): string {
  return ASSET_CATALOG.weapon(id).sprite;
}

function pickupSpriteAssetId(id: "health" | "ammo" | "damage" | "dual" | "xpBlood"): string {
  return ASSET_CATALOG.pickup(id).sprite;
}

function projectileSpriteAssetId(id: "enemy" | "boss" | "bolt" | "orb"): string {
  return ASSET_CATALOG.projectile(id).sprite;
}

function fxSpriteAssetId(id: "muzzleFlash"): string {
  return ASSET_CATALOG.fx(id).sprite;
}

function enemyAnimationEntity(kind: EnemySpriteKind): string {
  return ASSET_CATALOG.enemy(kind).animation.entity;
}

function enemyAnimationAction(kind: EnemySpriteKind, state: EnemySpriteAnimationState): string {
  const action = ASSET_CATALOG.enemy(kind).animation.actions[state];
  if (!action) throw new Error(`Scourge Survivors enemy ${kind} has no ${state} animation action`);
  return action;
}

// Per-weapon tier sprite ids. A weapon (or a missing tier) falls back to the highest
// tier it actually has, else the base sprite — so partial sets degrade gracefully.
const WEAPON_TIER_SPRITE_IDS: Partial<Record<WeaponId, Partial<Record<MainWeaponVisualTier, string>>>> = {
  // Only the pistol has reliable redrawn tier view-models. Other weapons would need
  // hand-framed art (codex draws the gun off-axis), so they tier up via the glow ramp
  // (see WeaponSystem TIER_GLOW) instead of swapping sprites.
  pistol: {
    "tier-2": "weapon-pistol-tier-2",
    "tier-3": "weapon-pistol-tier-3",
    "tier-4": "weapon-pistol-tier-4",
    evolved: "weapon-pistol-evolved",
  },
};

/** Highest tier sprite id ≤ the requested tier that this weapon has (else null = base). */
function resolveTierSpriteId(id: WeaponId, tier: MainWeaponVisualTier): string | null {
  const map = WEAPON_TIER_SPRITE_IDS[id];
  if (!map) return null;
  for (let i = MAIN_WEAPON_VISUAL_TIERS.indexOf(tier); i >= 0; i--) {
    const sid = map[MAIN_WEAPON_VISUAL_TIERS[i]];
    if (sid) return sid;
  }
  return null;
}

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
  const entity = enemyAnimationEntity(kind);
  return {
    move: animationFrameViews(entity, enemyAnimationAction(kind, "move")),
    attack: animationFrameViews(entity, enemyAnimationAction(kind, "attack")),
    death: animationFrameViews(entity, enemyAnimationAction(kind, "death")),
  };
}

function animationStateMeta(
  kind: EnemySpriteKind,
): Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }> {
  const entityId = enemyAnimationEntity(kind);
  const entity = ANIMATION_MANIFEST.entities[entityId];
  if (!entity) throw new Error(`Scourge Survivors animation manifest has no entity ${entityId}`);
  const moveAction = enemyAnimationAction(kind, "move");
  const attackAction = enemyAnimationAction(kind, "attack");
  const deathAction = enemyAnimationAction(kind, "death");
  const move = entity.actions[moveAction];
  const attack = entity.actions[attackAction];
  const death = entity.actions[deathAction];
  if (!move) throw new Error(`Scourge Survivors animation manifest has no action ${entityId}/${moveAction}`);
  if (!attack) throw new Error(`Scourge Survivors animation manifest has no action ${entityId}/${attackAction}`);
  if (!death) throw new Error(`Scourge Survivors animation manifest has no action ${entityId}/${deathAction}`);
  return {
    move: {
      fps: move.fps,
      loop: move.loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    },
    attack: {
      fps: attack.fps,
      loop: attack.loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    },
    death: {
      fps: death.fps,
      loop: death.loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    },
  };
}

export const ENEMY_SPRITE_TEXTURES: Record<EnemySpriteKind, Record<EnemySpriteView, THREE.Texture>> = {
  melee: textureViews(enemySpriteAssetId("melee")),
  ranged: textureViews(enemySpriteAssetId("ranged")),
  flying: textureViews(enemySpriteAssetId("flying")),
  boss: textureViews(enemySpriteAssetId("boss")),
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
  melee: scaleViews(enemySpriteAssetId("melee")),
  ranged: scaleViews(enemySpriteAssetId("ranged")),
  flying: scaleViews(enemySpriteAssetId("flying")),
  boss: scaleViews(enemySpriteAssetId("boss")),
};

export const WEAPON_SPRITE_TEXTURES: Record<WeaponId, THREE.Texture> = {
  pistol: loadSpriteTexture(weaponSpriteAssetId("pistol")),
  smg: loadSpriteTexture(weaponSpriteAssetId("smg")),
  shotgun: loadSpriteTexture(weaponSpriteAssetId("shotgun")),
  cannon: loadSpriteTexture(weaponSpriteAssetId("cannon")),
  sniper: loadSpriteTexture(weaponSpriteAssetId("sniper")),
};

// Textures for every per-weapon tier sprite id that exists (loaded once).
const TIER_TEXTURES: Record<string, THREE.Texture> = {};
for (const map of Object.values(WEAPON_TIER_SPRITE_IDS)) {
  for (const sid of Object.values(map ?? {})) {
    if (sid && !TIER_TEXTURES[sid]) TIER_TEXTURES[sid] = loadSpriteTexture(sid);
  }
}

/** Weapon-only floor-loot sprites (no hands). Absent weapons fall back to the view-model. */
export const WEAPON_LOOT_SPRITE_TEXTURES: Partial<Record<WeaponId, THREE.Texture>> = {
  pistol: loadSpriteTexture("weapon-pistol-loot"),
  smg: loadSpriteTexture("weapon-smg-loot"),
  shotgun: loadSpriteTexture("weapon-shotgun-loot"),
  cannon: loadSpriteTexture("weapon-cannon-loot"),
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

export function weaponSpriteTexture(id: WeaponId, tier: MainWeaponVisualTier = "base"): THREE.Texture {
  const sid = resolveTierSpriteId(id, tier);
  return sid ? TIER_TEXTURES[sid] : WEAPON_SPRITE_TEXTURES[id];
}

export function weaponSpriteConfig(id: WeaponId, tier: MainWeaponVisualTier = "base") {
  const sid = resolveTierSpriteId(id, tier);
  return sid ? weaponConfigForSpriteId(sid) : WEAPON_SPRITE_CONFIG[id];
}

export const MUZZLE_FLASH_TEXTURE = loadSpriteTexture(fxSpriteAssetId("muzzleFlash"));

export const PROJECTILE_SPRITE_TEXTURES = {
  enemy: loadSpriteTexture(projectileSpriteAssetId("enemy")),
  boss: loadSpriteTexture(projectileSpriteAssetId("boss")),
  bolt: loadSpriteTexture(projectileSpriteAssetId("bolt")),
  orb: loadSpriteTexture(projectileSpriteAssetId("orb")),
} as const;

export const PICKUP_SPRITE_TEXTURES = {
  health: loadSpriteTexture(pickupSpriteAssetId("health")),
  ammo: loadSpriteTexture(pickupSpriteAssetId("ammo")),
  damage: loadSpriteTexture(pickupSpriteAssetId("damage")),
  dual: loadSpriteTexture(pickupSpriteAssetId("dual")),
} as const;

export const PICKUP_SPRITE_SCALES = {
  health: spriteScale(pickupSpriteAssetId("health")),
  ammo: spriteScale(pickupSpriteAssetId("ammo")),
  damage: spriteScale(pickupSpriteAssetId("damage")),
  dual: spriteScale(pickupSpriteAssetId("dual")),
} as const;

export const XP_BLOOD_TEXTURE = loadSpriteTexture(pickupSpriteAssetId("xpBlood"));
export const XP_BLOOD_SCALE = spriteScale(pickupSpriteAssetId("xpBlood"));

const CORPSE_PART_SPRITE_IDS = [
  "gib-meat-chunk",
  "gib-skull-shard",
  "gib-bone-blade",
  "gib-claw-limb",
  "gib-acid-sac",
  "gib-wing-membrane",
] as const;

export type CorpsePartSpriteId = (typeof CORPSE_PART_SPRITE_IDS)[number];

export const CORPSE_PART_SPRITES = CORPSE_PART_SPRITE_IDS.map((id) => ({
  id,
  texture: loadSpriteTexture(id),
  scale: spriteScale(id),
}));

export const PLAYER_AVATAR_SPRITES: Record<
  PlayerAvatarId,
  { front: THREE.Texture; side: THREE.Texture; back: THREE.Texture }
> = {
  ranger: textureViews(playerAvatarSpriteAssetId("ranger")),
  heavy: textureViews(playerAvatarSpriteAssetId("heavy")),
  scout: textureViews(playerAvatarSpriteAssetId("scout")),
  medic: textureViews(playerAvatarSpriteAssetId("medic")),
};

export const PLAYER_AVATAR_SCALES: Record<PlayerAvatarId, Record<SpriteView, [number, number]>> = {
  ranger: scaleViews(playerAvatarSpriteAssetId("ranger")),
  heavy: scaleViews(playerAvatarSpriteAssetId("heavy")),
  scout: scaleViews(playerAvatarSpriteAssetId("scout")),
  medic: scaleViews(playerAvatarSpriteAssetId("medic")),
};

export const PLAYER_AVATAR_PREVIEW_URLS: Record<PlayerAvatarId, string> = {
  ranger: spriteUrl(playerAvatarSpriteAssetId("ranger"), "front"),
  heavy: spriteUrl(playerAvatarSpriteAssetId("heavy"), "front"),
  scout: spriteUrl(playerAvatarSpriteAssetId("scout"), "front"),
  medic: spriteUrl(playerAvatarSpriteAssetId("medic"), "front"),
};

export const MENU_HERO_URL = ASSET_CATALOG.runtimeUiUrl("menuTitle");

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

const ARENA_TEXTURE_CACHE = new Map<string, THREE.Texture>();

export function arenaTexture(id: string): THREE.Texture {
  let texture = ARENA_TEXTURE_CACHE.get(id);
  if (!texture) {
    texture = loadTexture(id);
    ARENA_TEXTURE_CACHE.set(id, texture);
  }
  return texture;
}

export function arenaTextureRepeat(id: string): [number, number] {
  return textureEntry(id).repeat;
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
  ...Object.entries(ASSET_MANIFEST.ui).map(([id, entry]) => [id, assetUrl(entry.path)]),
]) as Record<string, string>;

export const RUNTIME_AUDIO_ASSET_URLS = Object.fromEntries(
  Object.keys(ASSET_MANIFEST.audio).map((id) => [id, audioUrl(id)]),
) as Record<string, string>;

function weaponConfig(id: WeaponId) {
  return weaponConfigForSpriteId(weaponSpriteAssetId(id));
}

function weaponConfigForSpriteId(id: string) {
  const entry = spriteEntry(id);
  if (!entry.scale || !entry.weapon) throw new Error(`Weapon sprite ${id} is missing weapon metadata`);
  return {
    scale: entry.scale,
    offset: entry.weapon.offset,
    muzzle: entry.weapon.muzzle,
    flashScale: entry.weapon.flashScale,
    flashRotation: entry.weapon.flashRotation,
  };
}
