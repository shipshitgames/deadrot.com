import type { PlayerAvatarId } from "../net/playerAvatars";
import { ASSET_CATALOG, bootSpriteUrl } from "./catalog";

/**
 * The still art the shell paints before a run exists: the title hero and the
 * front-facing avatar portraits on the loadout screen.
 *
 * These are plain URLs, but their natural home — `game/spriteAssets` — builds
 * the combat texture atlas and so imports Three.js. Keeping them here lets the
 * menus render without the renderer.
 */
export function playerAvatarSpriteAssetId(id: PlayerAvatarId): string {
  return ASSET_CATALOG.player(id).sprite;
}

export const PLAYER_AVATAR_PREVIEW_URLS: Record<PlayerAvatarId, string> = {
  ranger: bootSpriteUrl(playerAvatarSpriteAssetId("ranger"), "front"),
  heavy: bootSpriteUrl(playerAvatarSpriteAssetId("heavy"), "front"),
  scout: bootSpriteUrl(playerAvatarSpriteAssetId("scout"), "front"),
  medic: bootSpriteUrl(playerAvatarSpriteAssetId("medic"), "front"),
};

export const MENU_HERO_URL = ASSET_CATALOG.runtimeUiUrl("menuTitle");
