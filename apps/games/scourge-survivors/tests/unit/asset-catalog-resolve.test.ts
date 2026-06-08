import { describe, expect, it } from "vitest";
import {
  ASSET_CATALOG,
  ASSET_MANIFEST,
  AssetCatalog,
  assetUrl,
  audioEntry,
  audioUrl,
  spriteEntry,
  spriteScale,
  spriteUrl,
  textureEntry,
  uiEntry,
  uiUrl,
} from "../../src/assets/catalog";

const URL_EXT = /\.(webp|jpe?g|png|webm)(\?|$)/;

describe("asset catalog resolution (#76)", () => {
  it("exposes the singleton catalog bound to the shared manifest", () => {
    expect(ASSET_CATALOG).toBeInstanceOf(AssetCatalog);
    expect(ASSET_CATALOG.manifest).toBe(ASSET_MANIFEST);
    expect(ASSET_CATALOG.manifest.runtime).toBeTruthy();
  });

  describe("runtime enemy lookups", () => {
    it("resolves a known enemy id to its runtime ref and a real sprite entry", () => {
      const ref = ASSET_CATALOG.enemy("melee");
      expect(ref).toEqual(ASSET_MANIFEST.runtime.enemies.melee);
      expect(ref.sprite).toBe("enemy-melee");
      // enemy() internally validates the referenced sprite exists.
      const sprite = ASSET_CATALOG.spriteEntry(ref.sprite);
      expect(sprite.type).toBe("sprite");
      expect(sprite.views).toBeTruthy();
      // enemies carry an animation reference.
      expect(ref.animation.entity).toBe("host-grunt");
      expect(ref.animation.actions.move).toBe("walk");
    });

    it("throws a descriptive error for an unknown enemy id", () => {
      expect(() => ASSET_CATALOG.enemy("does-not-exist")).toThrowError(
        /Unknown Scourge Survivors runtime enemy id: does-not-exist/,
      );
    });
  });

  describe("runtime sprite-domain lookups (player/weapon/pickup/fx)", () => {
    it("resolves a player id through spriteRef to a real sprite", () => {
      const ref = ASSET_CATALOG.player("ranger");
      expect(ref.sprite).toBe("player-ranger");
      expect(ASSET_CATALOG.spriteEntry(ref.sprite).type).toBe("sprite");
    });

    it("resolves a weapon id and the weapon sprite carries placement metadata", () => {
      const ref = ASSET_CATALOG.weapon("pistol");
      expect(ref.sprite).toBe("weapon-pistol");
      const sprite = ASSET_CATALOG.spriteEntry(ref.sprite);
      expect(sprite.path).toMatch(/\.webp$/);
      expect(sprite.weapon?.muzzle).toHaveLength(3);
    });

    it("resolves pickup and fx ids", () => {
      expect(ASSET_CATALOG.pickup("health").sprite).toBe("pickup-health");
      expect(ASSET_CATALOG.fx("muzzleFlash").sprite).toBe("muzzle-flash-pyre");
    });

    it("throws with the domain name baked into the message for unknown ids", () => {
      expect(() => ASSET_CATALOG.weapon("railgun")).toThrowError(
        /Unknown Scourge Survivors runtime weapons id: railgun/,
      );
      expect(() => ASSET_CATALOG.player("ghost")).toThrowError(/Unknown Scourge Survivors runtime players id: ghost/);
      expect(() => ASSET_CATALOG.pickup("nope")).toThrowError(/Unknown Scourge Survivors runtime pickups id: nope/);
    });
  });

  describe("runtime ui lookups", () => {
    it("resolves a ui id to its asset ref and a resolvable url", () => {
      const ref = ASSET_CATALOG.ui("menuTitle");
      expect(ref.asset).toBe("ui-menu-title");
      const url = ASSET_CATALOG.runtimeUiUrl("menuTitle");
      expect(url).toMatch(URL_EXT);
      // runtimeUiUrl must agree with resolving the underlying ui asset directly.
      expect(url).toBe(ASSET_CATALOG.uiUrl(ref.asset));
    });

    it("throws for an unknown ui id", () => {
      expect(() => ASSET_CATALOG.ui("missingPanel")).toThrowError(
        /Unknown Scourge Survivors runtime UI id: missingPanel/,
      );
    });
  });

  describe("sprite/texture/audio entry resolution", () => {
    it("returns the manifest entry for a known sprite id", () => {
      const entry = spriteEntry("weapon-pistol");
      expect(entry).toBe(ASSET_MANIFEST.sprites["weapon-pistol"]);
      expect(entry.type).toBe("sprite");
    });

    it("returns the manifest entry for a known texture id", () => {
      const entry = textureEntry("arena-floor");
      expect(entry.type).toBe("texture");
      expect(entry.colorSpace).toBe("srgb");
    });

    it("returns the manifest entry for a known audio id", () => {
      const entry = audioEntry("sfx-sniper");
      expect(entry.type).toBe("audio");
      expect(entry.cue).toBe("shootSniper");
    });

    it("returns the manifest entry for a known ui id", () => {
      const entry = uiEntry("ui-menu-title");
      expect(entry.type).toBe("ui");
      expect(entry.path.length).toBeGreaterThan(0);
    });

    it("throws on unknown ids per asset domain", () => {
      expect(() => spriteEntry("no-such-sprite")).toThrowError(
        /Unknown Scourge Survivors sprite asset id: no-such-sprite/,
      );
      expect(() => textureEntry("no-such-texture")).toThrowError(
        /Unknown Scourge Survivors texture asset id: no-such-texture/,
      );
      expect(() => audioEntry("no-such-audio")).toThrowError(/Unknown Scourge Survivors audio asset id: no-such-audio/);
      expect(() => uiEntry("no-such-ui")).toThrowError(/Unknown Scourge Survivors UI asset id: no-such-ui/);
    });
  });

  describe("url resolution", () => {
    it("resolves a directly-pathed sprite url", () => {
      const url = spriteUrl("weapon-pistol");
      expect(url).toMatch(/\.webp(\?|$)/);
    });

    it("resolves a per-view sprite url for a directional sprite", () => {
      const front = spriteUrl("enemy-melee", "front");
      const back = spriteUrl("enemy-melee", "back");
      expect(front).toMatch(URL_EXT);
      expect(back).toMatch(URL_EXT);
      expect(front).not.toBe(back);
    });

    it("throws when requesting a view the sprite does not define", () => {
      // weapon-pistol has a direct path but no per-view variants.
      expect(() => spriteUrl("weapon-pistol", "front")).toThrowError(
        /Scourge Survivors sprite asset weapon-pistol has no front view/,
      );
    });

    it("throws when requesting a direct url for a view-only sprite", () => {
      // enemy-melee is split into views and has no direct path.
      expect(() => spriteUrl("enemy-melee")).toThrowError(
        /Scourge Survivors sprite asset enemy-melee has no direct path/,
      );
    });

    it("resolves audio and ui urls", () => {
      expect(audioUrl("sfx-sniper")).toMatch(/\.webm(\?|$)/);
      expect(uiUrl("ui-menu-title")).toMatch(URL_EXT);
    });

    it("throws when resolving a manifest path that has no underlying file", () => {
      expect(() => assetUrl("games/scourge-survivors/this/file/does/not/exist.webp")).toThrowError(/missing file/);
    });
  });

  describe("sprite scale resolution", () => {
    it("returns a 2-tuple of positive scale values for a per-view sprite", () => {
      const scale = spriteScale("enemy-melee", "front");
      expect(scale).toHaveLength(2);
      expect(scale[0]).toBeGreaterThan(0);
      expect(scale[1]).toBeGreaterThan(0);
    });

    it("returns the direct scale for a sprite that defines one", () => {
      const scale = spriteScale("weapon-pistol");
      expect(scale).toHaveLength(2);
      expect(scale[0]).toBeGreaterThan(0);
    });

    it("throws when a view scale is not defined", () => {
      expect(() => spriteScale("weapon-pistol", "back")).toThrowError(
        /Scourge Survivors sprite asset weapon-pistol has no back view/,
      );
    });
  });

  describe("standalone helpers delegate to the singleton", () => {
    it("spriteEntry/spriteUrl/audioEntry match the catalog methods", () => {
      expect(spriteEntry("weapon-pistol")).toBe(ASSET_CATALOG.spriteEntry("weapon-pistol"));
      expect(spriteUrl("weapon-pistol")).toBe(ASSET_CATALOG.spriteUrl("weapon-pistol"));
      expect(audioEntry("sfx-sniper")).toBe(ASSET_CATALOG.audioEntry("sfx-sniper"));
    });
  });
});
