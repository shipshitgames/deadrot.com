import * as THREE from "three";
import {
  ANIMATION_MANIFEST,
  ASSET_CATALOG,
  ASSET_MANIFEST,
  animationFrameSource,
  assetUrl,
  audioUrl,
  bootSpriteUrl,
  loadSpriteTexture,
  loadTexture,
  type SpriteView,
  spriteEntry,
  spriteScale,
  textureEntry,
  uiUrl,
} from "../assets/catalog";
import type { PlayerAvatarId } from "../net/playerAvatars";
import type { WeaponId } from "./constants";
import { MAIN_WEAPON_VISUAL_TIERS, type MainWeaponVisualTier } from "./data/survivors";

export type EnemySpriteKind = "melee" | "ranged" | "flying" | "hound" | "boss";
export type EnemySpriteView = SpriteView;
export type EnemySpriteAnimationState = "move" | "attack" | "death";

const ENEMY_SPRITE_KINDS = ["melee", "ranged", "flying", "hound", "boss"] as const;
const ENEMY_SPRITE_VIEWS = ["front", "side", "back"] as const;
const ENEMY_ANIMATION_STATES = ["move", "attack", "death"] as const;
const WEAPON_IDS = ["pistol", "smg", "shotgun", "cannon", "sniper"] as const satisfies readonly WeaponId[];

type EnemyTextureRecord = Record<EnemySpriteKind, Record<EnemySpriteView, THREE.Texture>>;
type EnemyAnimationTextureRecord = Record<
  EnemySpriteKind,
  Record<EnemySpriteAnimationState, Record<EnemySpriteView, THREE.Texture[]>>
>;

interface CombatAssetSnapshot {
  enemyTextures: EnemyTextureRecord;
  enemyAnimations: EnemyAnimationTextureRecord;
  weaponTextures: Record<WeaponId, THREE.Texture>;
  weaponAdsTextures: Partial<Record<WeaponId, THREE.Texture>>;
  weaponLootTextures: Record<WeaponId, THREE.Texture>;
  muzzleFlashTexture: THREE.Texture;
  projectileTextures: Record<"enemy" | "boss" | "bolt" | "orb", THREE.Texture>;
  pickupTextures: Record<"health" | "ammo" | "damage" | "dual", THREE.Texture>;
  xpBloodTexture: THREE.Texture;
  corpsePartTextures: Record<CorpsePartSpriteId, THREE.Texture>;
  playerAvatarTextures: Record<PlayerAvatarId, Record<EnemySpriteView, THREE.Texture>>;
  arenaTextures: Record<string, THREE.Texture>;
}

let combatAssetSnapshot: CombatAssetSnapshot | undefined;
let combatAssetPreloadPromise: Promise<void> | undefined;

export function enemySpriteAssetId(id: EnemySpriteKind): string {
  return ASSET_CATALOG.enemy(id).sprite;
}

export function playerAvatarSpriteAssetId(id: PlayerAvatarId): string {
  return ASSET_CATALOG.player(id).sprite;
}

export function weaponSpriteAssetId(id: WeaponId): string {
  return ASSET_CATALOG.weapon(id).sprite;
}

function weaponLootSpriteAssetId(id: WeaponId): string {
  return ASSET_CATALOG.weapon(id).lootSprite;
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

// Each weapon ships one horizontal tier sheet. The runtime UV-samples a cell;
// loading and wrapping the sheet happens once during combat preload.
export function weaponSheetColumns(id: WeaponId): number {
  return spriteEntry(weaponSpriteAssetId(id)).tierSheet?.columns ?? 1;
}

export function weaponTierCellIndex(id: WeaponId, tier: MainWeaponVisualTier): number {
  const tiers = spriteEntry(weaponSpriteAssetId(id)).tierSheet?.tiers;
  if (!tiers || tiers.length === 0) return 0;
  for (let i = MAIN_WEAPON_VISUAL_TIERS.indexOf(tier); i >= 0; i--) {
    const cell = tiers.indexOf(MAIN_WEAPON_VISUAL_TIERS[i]);
    if (cell >= 0) return cell;
  }
  return 0;
}

function scaleViews(id: string): Record<EnemySpriteView, [number, number]> {
  return {
    front: spriteScale(id, "front"),
    side: spriteScale(id, "side"),
    back: spriteScale(id, "back"),
  };
}

function animationStateMeta(
  kind: EnemySpriteKind,
): Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }> {
  const entityId = enemyAnimationEntity(kind);
  const entity = ANIMATION_MANIFEST.entities[entityId];
  if (!entity) throw new Error(`Scourge Survivors animation manifest has no entity ${entityId}`);
  const meta = {} as Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }>;
  for (const state of ENEMY_ANIMATION_STATES) {
    const actionId = enemyAnimationAction(kind, state);
    const action = entity.actions[actionId];
    if (!action) throw new Error(`Scourge Survivors animation manifest has no action ${entityId}/${actionId}`);
    meta[state] = {
      fps: action.fps,
      loop: action.loop,
      frameCount: ANIMATION_MANIFEST.framesPerAction,
    };
  }
  return meta;
}

async function asyncRecord<K extends string, V>(
  keys: readonly K[],
  load: (key: K) => Promise<V>,
): Promise<Record<K, V>> {
  const entries = await Promise.all(keys.map(async (key) => [key, await load(key)] as const));
  return Object.fromEntries(entries) as Record<K, V>;
}

function requireCombatAssets(): CombatAssetSnapshot {
  if (!combatAssetSnapshot) {
    throw new Error("Scourge Survivors combat assets were accessed before preloadCombatAssets() completed");
  }
  return combatAssetSnapshot;
}

function liveRecord<K extends string, V>(keys: readonly K[], read: (key: K) => V): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const key of keys) {
    Object.defineProperty(record, key, {
      enumerable: true,
      get: () => read(key),
    });
  }
  return record;
}

const ANIMATION_BASE_TEXTURE_PROMISES = new Map<string, Promise<THREE.Texture>>();

function animationBaseTexture(url: string, filter: THREE.MagnificationTextureFilter): Promise<THREE.Texture> {
  const cached = ANIMATION_BASE_TEXTURE_PROMISES.get(url);
  if (cached) return cached;
  const promise = new THREE.TextureLoader()
    .loadAsync(url)
    .then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = filter;
      texture.magFilter = filter;
      texture.generateMipmaps = false;
      texture.premultiplyAlpha = false;
      return texture;
    })
    .catch((error) => {
      ANIMATION_BASE_TEXTURE_PROMISES.delete(url);
      throw error;
    });
  ANIMATION_BASE_TEXTURE_PROMISES.set(url, promise);
  return promise;
}

async function loadEnemyAnimationTexture(
  entity: string,
  action: string,
  view: EnemySpriteView,
  frame: number,
): Promise<THREE.Texture> {
  const frameSource = await animationFrameSource(entity, action, view, frame);
  const sourceKind = frameSource.atlas ? "atlas" : "frame";
  const base = await animationBaseTexture(
    frameSource.url,
    frameSource.atlas ? THREE.NearestFilter : THREE.LinearFilter,
  );
  const texture = base.clone();
  texture.userData.scourgeAnimation = { entity, action, view, frame, source: sourceKind };
  texture.name = `scourge-animation:${entity}/${action}/${view}/${frame}`;

  if (frameSource.atlas) {
    const { pageWidth, pageHeight, x, y, w, h } = frameSource.atlas;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(w / pageWidth, h / pageHeight);
    // Atlas metadata uses top-left pixel coordinates; THREE's texture offset is bottom-left.
    texture.offset.set(x / pageWidth, 1 - (y + h) / pageHeight);
    texture.matrixAutoUpdate = true;
    texture.updateMatrix();
  }

  texture.needsUpdate = true;
  return texture;
}

async function loadEnemyAnimations(): Promise<EnemyAnimationTextureRecord> {
  return asyncRecord(ENEMY_SPRITE_KINDS, async (kind) => {
    const entity = enemyAnimationEntity(kind);
    return asyncRecord(ENEMY_ANIMATION_STATES, async (state) => {
      const action = enemyAnimationAction(kind, state);
      return asyncRecord(ENEMY_SPRITE_VIEWS, (view) =>
        Promise.all(
          Array.from({ length: ANIMATION_MANIFEST.framesPerAction }, (_, frame) =>
            loadEnemyAnimationTexture(entity, action, view, frame),
          ),
        ),
      );
    });
  });
}

async function loadAdsSpriteTexture(id: WeaponId): Promise<THREE.Texture> {
  const entry = spriteEntry(weaponSpriteAssetId(id));
  if (!entry.adsSprite) throw new Error(`Weapon sprite ${id} is missing scoped ADS metadata`);
  const texture = await new THREE.TextureLoader().loadAsync(await assetUrl(entry.adsSprite.path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
  texture.magFilter = entry.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = entry.filter !== "nearest";
  texture.premultiplyAlpha = false;
  return texture;
}

async function loadWeaponTexture(id: WeaponId): Promise<THREE.Texture> {
  const texture = await loadSpriteTexture(weaponSpriteAssetId(id));
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

async function buildCombatAssetSnapshot(): Promise<CombatAssetSnapshot> {
  const [
    enemyTextures,
    enemyAnimations,
    weaponTextures,
    weaponLootTextures,
    muzzleFlashTexture,
    projectileTextures,
    pickupTextures,
    xpBloodTexture,
    corpsePartTextures,
    playerAvatarTextures,
    arenaTextures,
    sniperAdsTexture,
  ] = await Promise.all([
    asyncRecord(ENEMY_SPRITE_KINDS, (kind) =>
      asyncRecord(ENEMY_SPRITE_VIEWS, (view) => loadSpriteTexture(enemySpriteAssetId(kind), view)),
    ),
    loadEnemyAnimations(),
    asyncRecord(WEAPON_IDS, loadWeaponTexture),
    asyncRecord(WEAPON_IDS, (id) => loadSpriteTexture(weaponLootSpriteAssetId(id))),
    loadSpriteTexture(fxSpriteAssetId("muzzleFlash")),
    asyncRecord(["enemy", "boss", "bolt", "orb"] as const, (id) => loadSpriteTexture(projectileSpriteAssetId(id))),
    asyncRecord(["health", "ammo", "damage", "dual"] as const, (id) => loadSpriteTexture(pickupSpriteAssetId(id))),
    loadSpriteTexture(pickupSpriteAssetId("xpBlood")),
    asyncRecord(CORPSE_PART_SPRITE_IDS, (id) => loadSpriteTexture(id)),
    asyncRecord(["ranger", "heavy", "scout", "medic"] as const, (id) =>
      asyncRecord(ENEMY_SPRITE_VIEWS, (view) => loadSpriteTexture(playerAvatarSpriteAssetId(id), view)),
    ),
    asyncRecord(Object.keys(ASSET_MANIFEST.textures), loadTexture),
    loadAdsSpriteTexture("sniper"),
  ]);

  sniperAdsTexture.wrapS = THREE.RepeatWrapping;
  sniperAdsTexture.needsUpdate = true;

  return {
    enemyTextures,
    enemyAnimations,
    weaponTextures,
    weaponAdsTextures: { sniper: sniperAdsTexture },
    weaponLootTextures,
    muzzleFlashTexture,
    projectileTextures,
    pickupTextures,
    xpBloodTexture,
    corpsePartTextures,
    playerAvatarTextures,
    arenaTextures,
  };
}

/**
 * Resolve and decode the complete combat pack once. The snapshot is published
 * only after every required texture succeeds, so synchronous game systems never
 * observe a partially populated pack. A failed attempt can be retried.
 */
export function preloadCombatAssets(): Promise<void> {
  if (combatAssetSnapshot) return Promise.resolve();
  if (combatAssetPreloadPromise) return combatAssetPreloadPromise;

  combatAssetPreloadPromise = buildCombatAssetSnapshot()
    .then((snapshot) => {
      combatAssetSnapshot = snapshot;
      MUZZLE_FLASH_TEXTURE = snapshot.muzzleFlashTexture;
      XP_BLOOD_TEXTURE = snapshot.xpBloodTexture;
    })
    .catch((error) => {
      combatAssetPreloadPromise = undefined;
      throw error;
    });
  return combatAssetPreloadPromise;
}

export function combatAssetsReady(): boolean {
  return combatAssetSnapshot !== undefined;
}

export const ENEMY_SPRITE_TEXTURES: EnemyTextureRecord = liveRecord(
  ENEMY_SPRITE_KINDS,
  (kind) => requireCombatAssets().enemyTextures[kind],
);

export const ENEMY_SPRITE_ANIMATION_TEXTURES: EnemyAnimationTextureRecord = liveRecord(
  ENEMY_SPRITE_KINDS,
  (kind) => requireCombatAssets().enemyAnimations[kind],
);

export const ENEMY_SPRITE_ANIMATION_META: Record<
  EnemySpriteKind,
  Record<EnemySpriteAnimationState, { fps: number; loop: boolean; frameCount: number }>
> = {
  melee: animationStateMeta("melee"),
  ranged: animationStateMeta("ranged"),
  flying: animationStateMeta("flying"),
  hound: animationStateMeta("hound"),
  boss: animationStateMeta("boss"),
};

export const ENEMY_SPRITE_SCALES: Record<EnemySpriteKind, Record<EnemySpriteView, [number, number]>> = {
  melee: scaleViews(enemySpriteAssetId("melee")),
  ranged: scaleViews(enemySpriteAssetId("ranged")),
  flying: scaleViews(enemySpriteAssetId("flying")),
  hound: scaleViews(enemySpriteAssetId("hound")),
  boss: scaleViews(enemySpriteAssetId("boss")),
};

export const WEAPON_SPRITE_TEXTURES: Record<WeaponId, THREE.Texture> = liveRecord(
  WEAPON_IDS,
  (id) => requireCombatAssets().weaponTextures[id],
);

export const WEAPON_ADS_SPRITE_TEXTURES: Partial<Record<WeaponId, THREE.Texture>> = liveRecord(
  ["sniper"] as const,
  (id) => requireCombatAssets().weaponAdsTextures[id] as THREE.Texture,
);

export const WEAPON_LOOT_SPRITE_TEXTURES: Record<WeaponId, THREE.Texture> = liveRecord(
  WEAPON_IDS,
  (id) => requireCombatAssets().weaponLootTextures[id],
);

export const WEAPON_LOOT_SPRITE_SCALES: Record<WeaponId, [number, number]> = {
  pistol: spriteScale(weaponLootSpriteAssetId("pistol")),
  smg: spriteScale(weaponLootSpriteAssetId("smg")),
  shotgun: spriteScale(weaponLootSpriteAssetId("shotgun")),
  cannon: spriteScale(weaponLootSpriteAssetId("cannon")),
  sniper: spriteScale(weaponLootSpriteAssetId("sniper")),
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

export const WEAPON_ADS_SPRITE_CONFIG: Partial<Record<WeaponId, (typeof WEAPON_SPRITE_CONFIG)[WeaponId]>> = {
  sniper: adsWeaponConfig("sniper"),
};

export function weaponSpriteTexture(id: WeaponId): THREE.Texture {
  return WEAPON_SPRITE_TEXTURES[id];
}

export function weaponAdsSpriteTexture(id: WeaponId): THREE.Texture {
  return WEAPON_ADS_SPRITE_TEXTURES[id] ?? WEAPON_SPRITE_TEXTURES[id];
}

export function weaponHasAdsSprite(id: WeaponId): boolean {
  return WEAPON_ADS_SPRITE_CONFIG[id] !== undefined;
}

export function weaponSpriteConfig(id: WeaponId) {
  return WEAPON_SPRITE_CONFIG[id];
}

export function weaponAdsSpriteConfig(id: WeaponId) {
  return WEAPON_ADS_SPRITE_CONFIG[id] ?? WEAPON_SPRITE_CONFIG[id];
}

export let MUZZLE_FLASH_TEXTURE: THREE.Texture;

export const PROJECTILE_SPRITE_TEXTURES = liveRecord(
  ["enemy", "boss", "bolt", "orb"] as const,
  (id) => requireCombatAssets().projectileTextures[id],
);

export const PICKUP_SPRITE_TEXTURES = liveRecord(
  ["health", "ammo", "damage", "dual"] as const,
  (id) => requireCombatAssets().pickupTextures[id],
);

export const PICKUP_SPRITE_SCALES = {
  health: spriteScale(pickupSpriteAssetId("health")),
  ammo: spriteScale(pickupSpriteAssetId("ammo")),
  damage: spriteScale(pickupSpriteAssetId("damage")),
  dual: spriteScale(pickupSpriteAssetId("dual")),
} as const;

export let XP_BLOOD_TEXTURE: THREE.Texture;
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

export const CORPSE_PART_SPRITES: Array<{
  id: CorpsePartSpriteId;
  texture: THREE.Texture;
  scale: [number, number];
}> = CORPSE_PART_SPRITE_IDS.map((id) => {
  const part = { id, scale: spriteScale(id) } as {
    id: CorpsePartSpriteId;
    texture: THREE.Texture;
    scale: [number, number];
  };
  Object.defineProperty(part, "texture", {
    enumerable: true,
    get: () => requireCombatAssets().corpsePartTextures[id],
  });
  return part;
});

export const PLAYER_AVATAR_SPRITES: Record<
  PlayerAvatarId,
  { front: THREE.Texture; side: THREE.Texture; back: THREE.Texture }
> = liveRecord(["ranger", "heavy", "scout", "medic"] as const, (id) => requireCombatAssets().playerAvatarTextures[id]);

export const PLAYER_AVATAR_SCALES: Record<PlayerAvatarId, Record<SpriteView, [number, number]>> = {
  ranger: scaleViews(playerAvatarSpriteAssetId("ranger")),
  heavy: scaleViews(playerAvatarSpriteAssetId("heavy")),
  scout: scaleViews(playerAvatarSpriteAssetId("scout")),
  medic: scaleViews(playerAvatarSpriteAssetId("medic")),
};

// Front-facing avatar portraits and menu art are the intentionally small,
// synchronous boot surface. They do not instantiate THREE textures.
export const PLAYER_AVATAR_PREVIEW_URLS: Record<PlayerAvatarId, string> = {
  ranger: bootSpriteUrl(playerAvatarSpriteAssetId("ranger"), "front"),
  heavy: bootSpriteUrl(playerAvatarSpriteAssetId("heavy"), "front"),
  scout: bootSpriteUrl(playerAvatarSpriteAssetId("scout"), "front"),
  medic: bootSpriteUrl(playerAvatarSpriteAssetId("medic"), "front"),
};

export const MENU_HERO_URL = ASSET_CATALOG.runtimeUiUrl("menuTitle");

export const ARENA_TEXTURES = liveRecord(
  ["floor", "wall", "column", "block"] as const,
  (role) => requireCombatAssets().arenaTextures[`arena-${role}`],
);

export const ARENA_TEXTURE_REPEAT = {
  floor: textureEntry("arena-floor").repeat,
  wall: textureEntry("arena-wall").repeat,
  column: textureEntry("arena-column").repeat,
  block: textureEntry("arena-block").repeat,
} as const;

export function arenaTexture(id: string): THREE.Texture {
  const texture = requireCombatAssets().arenaTextures[id];
  if (!texture) throw new Error(`Scourge Survivors combat preload has no arena texture ${id}`);
  return texture;
}

export function arenaTextureRepeat(id: string): [number, number] {
  return textureEntry(id).repeat;
}

let runtimeVisualAssetUrlsPromise: Promise<Record<string, string>> | undefined;

/** Resolve the sandbox asset browser only when the sandbox UI is opened. */
export function loadRuntimeVisualAssetUrls(): Promise<Record<string, string>> {
  if (runtimeVisualAssetUrlsPromise) return runtimeVisualAssetUrlsPromise;
  const entries = [
    ...Object.entries(ASSET_MANIFEST.sprites).flatMap(([id, entry]) => {
      if (entry.views) {
        return Object.entries(entry.views).map(([view, viewEntry]) =>
          assetUrl(viewEntry.path).then((url) => [`${id}-${view}`, url] as const),
        );
      }
      return entry.path ? [assetUrl(entry.path).then((url) => [id, url] as const)] : [];
    }),
    ...Object.entries(ASSET_MANIFEST.textures).map(([id, entry]) =>
      assetUrl(entry.path).then((url) => [id, url] as const),
    ),
    ...Object.keys(ASSET_MANIFEST.ui).map((id) => Promise.resolve([id, uiUrl(id)] as const)),
  ];
  runtimeVisualAssetUrlsPromise = Promise.all(entries)
    .then((resolved) => Object.fromEntries(resolved))
    .catch((error) => {
      runtimeVisualAssetUrlsPromise = undefined;
      throw error;
    });
  return runtimeVisualAssetUrlsPromise;
}

export function loadRuntimeAudioAssetUrls(): Promise<Record<string, string>> {
  return Promise.resolve(
    Object.fromEntries(Object.keys(ASSET_MANIFEST.audio).map((id) => [id, audioUrl(id)])) as Record<string, string>,
  );
}

function weaponConfig(id: WeaponId) {
  return weaponConfigForSpriteId(weaponSpriteAssetId(id));
}

function adsWeaponConfig(id: WeaponId) {
  const spriteId = weaponSpriteAssetId(id);
  const entry = spriteEntry(spriteId);
  const ads = entry.adsSprite;
  const base = weaponConfigForSpriteId(spriteId);
  if (!ads) return base;
  return {
    scale: ads.scale ?? base.scale,
    offset: ads.offset ?? base.offset,
    muzzle: ads.muzzle ?? base.muzzle,
    flashScale: ads.flashScale ?? base.flashScale,
    flashRotation: ads.flashRotation ?? base.flashRotation,
  };
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
