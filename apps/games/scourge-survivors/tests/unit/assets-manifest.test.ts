import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import animationManifest from "@shipshitgames/assets/games/scourge-survivors/animations/scourge/animation-pack.json";
import manifest from "@shipshitgames/assets/games/scourge-survivors/assets.json";
import { describe, expect, it } from "vitest";
import { ASSET_CATALOG } from "../../src/assets/catalog";
import { CAMPAIGN_ORDER, MAPS } from "../../src/game/data/maps";

type Manifest = typeof manifest;
type SpriteEntry = Manifest["sprites"][keyof Manifest["sprites"]];
type WeaponSpriteEntry = {
  path: string;
  tierSheet?: {
    columns: number;
    tiers: string[];
  };
  weapon?: {
    flashScale: number;
    muzzles?: {
      left: [number, number, number];
      right: [number, number, number];
    };
  };
};
type AudioEntry = Manifest["audio"][keyof Manifest["audio"]];
type UiEntry = Manifest["ui"][keyof Manifest["ui"]];

const assetsRoot = fileURLToPath(new URL("../../../../../packages/assets/", import.meta.url));

function expectExistingAsset(path: string) {
  const fullPath = join(assetsRoot, path);
  expect(existsSync(fullPath), path).toBe(true);
  expect(statSync(fullPath).size, path).toBeGreaterThan(0);
}

function expectLicenseRecord(entry: { license?: unknown }, id: string) {
  expect(entry.license, `${id} license`).toBeTruthy();
  expect(entry.license, `${id} license`).toMatchObject({
    tool: expect.any(String),
    plan: expect.any(String),
    date: expect.any(String),
    kind: expect.any(String),
  });
}

function scourgeEnemySpritePaths() {
  const paths: string[] = [];
  const enemySpriteIds = ["enemy-melee", "enemy-ranged", "enemy-flying", "enemy-hound", "boss"] as const;

  for (const id of enemySpriteIds) {
    for (const view of Object.values(manifest.sprites[id].views)) paths.push(view.path);
  }

  for (const entity of Object.values(animationManifest.entities) as Array<{
    actions: Record<string, { pathTemplate: string }>;
  }>) {
    for (const action of Object.values(entity.actions)) {
      for (const view of animationManifest.views) {
        for (let frame = 0; frame < animationManifest.framesPerAction; frame += 1) {
          const frameId = String(frame).padStart(2, "0");
          paths.push(
            `games/scourge-survivors/${action.pathTemplate.replace("{view}", view).replace("{frame}", frameId)}`,
          );
        }
      }
    }
  }

  return paths.sort();
}

describe("asset manifest", () => {
  it("references files that exist on disk", () => {
    for (const entry of Object.values(manifest.sprites) as SpriteEntry[]) {
      if ("path" in entry && entry.path) expectExistingAsset(entry.path);
      if ("adsSprite" in entry && entry.adsSprite) expectExistingAsset(entry.adsSprite.path);
      if ("views" in entry && entry.views) {
        for (const view of Object.values(entry.views)) expectExistingAsset(view.path);
      }
    }

    for (const entry of Object.values(manifest.textures)) expectExistingAsset(entry.path);
    for (const entry of Object.values(manifest.audio)) expectExistingAsset(entry.path);
    for (const entry of Object.values(manifest.ui) as UiEntry[]) expectExistingAsset(entry.path);
  });

  it("keeps provenance records on every manifest entry", () => {
    for (const [id, entry] of Object.entries(manifest.sprites)) expectLicenseRecord(entry, id);
    for (const [id, entry] of Object.entries(manifest.textures)) expectLicenseRecord(entry, id);
    for (const [id, entry] of Object.entries(manifest.audio)) expectLicenseRecord(entry, id);
    for (const [id, entry] of Object.entries(manifest.ui)) expectLicenseRecord(entry, id);
  });

  it("defines catalog aliases for all Scourge runtime surfaces", () => {
    expect(Object.keys(manifest.runtime.weapons).sort()).toEqual(["cannon", "pistol", "shotgun", "smg", "sniper"]);
    expect(Object.keys(manifest.runtime.players).sort()).toEqual(["heavy", "medic", "ranger", "scout"]);
    expect(Object.keys(manifest.runtime.enemies).sort()).toEqual(["boss", "flying", "hound", "melee", "ranged"]);
    expect(Object.keys(manifest.runtime.pickups).sort()).toEqual(["ammo", "damage", "dual", "health", "xpBlood"]);
    expect(Object.keys(manifest.runtime.projectiles).sort()).toEqual(["bolt", "boss", "enemy", "orb"]);
    expect(Object.keys(manifest.runtime.fx).sort()).toEqual(["muzzleFlash"]);
    expect(Object.keys(manifest.runtime.ui).sort()).toEqual([
      "cardBastion",
      "cardBreach",
      "cardFleshworks",
      "menuHero",
      "menuTitle",
    ]);
  });

  it("resolves runtime catalog aliases to real manifest entries", () => {
    for (const [kind, ref] of Object.entries(manifest.runtime.enemies)) {
      expect(manifest.sprites[ref.sprite as keyof typeof manifest.sprites], `${kind} sprite`).toBeTruthy();

      const entity = animationManifest.entities[ref.animation.entity as keyof typeof animationManifest.entities];
      expect(entity, `${kind} animation entity`).toBeTruthy();
      for (const [state, action] of Object.entries(ref.animation.actions)) {
        expect(entity.actions[action as keyof typeof entity.actions], `${kind} ${state} animation`).toBeTruthy();
      }
    }

    for (const [domain, refs] of Object.entries({
      players: manifest.runtime.players,
      weapons: manifest.runtime.weapons,
      pickups: manifest.runtime.pickups,
      projectiles: manifest.runtime.projectiles,
      fx: manifest.runtime.fx,
    })) {
      for (const [id, ref] of Object.entries(refs)) {
        expect(manifest.sprites[ref.sprite as keyof typeof manifest.sprites], `${domain}.${id}`).toBeTruthy();
      }
    }

    for (const [id, ref] of Object.entries(manifest.runtime.weapons)) {
      expect(ref.lootSprite, `weapons.${id} loot sprite alias`).toBeTruthy();
      const lootSprite = manifest.sprites[ref.lootSprite as keyof typeof manifest.sprites];
      expect(lootSprite, `weapons.${id} loot sprite`).toBeTruthy();
      expect(lootSprite.path, `weapons.${id} loot path`).toMatch(/-loot\.webp$/);
      expect(lootSprite.scale, `weapons.${id} loot pickup scale`).toEqual([1.4, 1.4]);
    }

    for (const [id, ref] of Object.entries(manifest.runtime.ui)) {
      expect(manifest.ui[ref.asset as keyof typeof manifest.ui], `ui.${id}`).toBeTruthy();
      // Runtime UI raster ships as WebP (deadrot.com#118). The OG social card is
      // the only allowed non-WebP runtime raster and is not part of runtime.ui.
      expect(ASSET_CATALOG.runtimeUiUrl(id), `ui.${id} URL`).toMatch(/\.webp(\?|$)/);
    }
  });

  it("covers every dual-compatible firearm with dedicated tier art and per-hand muzzle metadata", () => {
    const dualCompatible = ["pistol", "smg", "shotgun", "sniper"] as const;

    for (const id of dualCompatible) {
      const ref = manifest.runtime.weapons[id];
      expect(ref.dualSprite, `weapons.${id} dedicated dual sprite`).toBe(`weapon-${id}-dual`);
      const dual = manifest.sprites[ref.dualSprite as keyof typeof manifest.sprites] as WeaponSpriteEntry;
      const primary = manifest.sprites[ref.sprite as keyof typeof manifest.sprites] as WeaponSpriteEntry;
      expect(dual.path, `${id} dual path`).toMatch(/\/dual\/.+-dual-tiers\.webp$/);
      expect(dual.path, `${id} dedicated runtime path`).not.toBe(primary.path);
      expect(dual.tierSheet, `${id} dual tier coverage`).toEqual(primary.tierSheet);
      expect(dual.weapon?.muzzles?.left, `${id} left muzzle`).toHaveLength(3);
      expect(dual.weapon?.muzzles?.right, `${id} right muzzle`).toHaveLength(3);
      expect(dual.weapon?.muzzles?.left[0], `${id} left/right separation`).toBeLessThan(
        dual.weapon?.muzzles?.right[0] ?? 0,
      );
      expect(dual.weapon?.flashScale, `${id} flash scale`).toBeGreaterThan(0);
    }

    expect(manifest.runtime.weapons.cannon).not.toHaveProperty("dualSprite");
    expect(manifest.sprites).not.toHaveProperty("weapon-cannon-dual");
  });

  it("promotes purpose-built raw dual masters without a mirror-composite fallback", () => {
    const generatorPath = join(assetsRoot, "scripts/generate-scourge-dual-weapons.mjs");
    const generator = readFileSync(generatorPath, "utf8");
    expect(generator).toContain("_archive/raw-generator-cache/codex-generated-images/2026-07-17");
    expect(generator).not.toMatch(/compositeHand|flop|mirrorUv|weaponTierCellUvMirrored/);
  });

  it("keeps enemies and player avatars covered by front, side, and back views", () => {
    const directionalSpriteIds = [
      "enemy-melee",
      "enemy-ranged",
      "enemy-flying",
      "enemy-hound",
      "boss",
      "player-ranger",
      "player-heavy",
      "player-scout",
      "player-medic",
    ] as const;

    for (const id of directionalSpriteIds) {
      const views = manifest.sprites[id].views;
      expect(Object.keys(views).sort(), id).toEqual(["back", "front", "side"]);
      for (const view of Object.values(views)) {
        expect(view.dimensions[0], `${id} width`).toBeGreaterThan(0);
        expect(view.dimensions[1], `${id} height`).toBeGreaterThan(0);
        expect(view.scale[0], `${id} scale width`).toBeGreaterThan(0);
        expect(view.scale[1], `${id} scale height`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps promoted enemy sprites low-resolution and nearest-filtered for pixel art", () => {
    const enemySpriteIds = ["enemy-melee", "enemy-ranged", "enemy-flying", "enemy-hound", "boss"] as const;

    for (const id of enemySpriteIds) {
      const entry = manifest.sprites[id];
      expect(entry.filter, id).toBe("nearest");

      for (const view of Object.values(entry.views)) {
        expect(view.dimensions[0], `${id} width`).toBeLessThanOrEqual(id === "enemy-hound" ? 256 : 128);
        expect(view.dimensions[1], `${id} height`).toBeLessThanOrEqual(id === "boss" ? 180 : 128);
      }
    }
  });

  it("keeps Scourge enemy sprite cutouts on the cleaned alpha baseline", () => {
    const hash = createHash("sha256");
    const paths = scourgeEnemySpritePaths();

    expect(paths).toHaveLength(285);

    for (const path of paths) {
      hash.update(path);
      hash.update("\0");
      hash.update(readFileSync(join(assetsRoot, path)));
      hash.update("\0");
    }

    expect(hash.digest("hex")).toBe("fc4e03208cc242061cd550e229baf8f83b9c8ec1bce9d9d55e449f74a40db75d");
  });

  it("defines weapon sprite metadata needed for first-person runtime placement", () => {
    const weaponSpriteIds = [
      "weapon-pistol",
      "weapon-smg",
      "weapon-shotgun",
      "weapon-cannon",
      "weapon-sniper",
    ] as const;

    for (const id of weaponSpriteIds) {
      const entry = manifest.sprites[id];
      expect(entry.path, `${id} path`).toMatch(/\.webp$/);
      expect(entry.scale?.[0], `${id} scale width`).toBeGreaterThan(0);
      expect(entry.scale?.[1], `${id} scale height`).toBeGreaterThan(0);
      expect(entry.weapon?.offset, `${id} offset`).toHaveLength(3);
      expect(entry.weapon?.muzzle, `${id} muzzle`).toHaveLength(3);
      expect(entry.weapon?.flashScale, `${id} flash scale`).toBeGreaterThan(0);
    }
  });

  it("ships a scoped ADS view-model sheet for the sniper", () => {
    const entry = manifest.sprites["weapon-sniper"];

    expect(entry.adsSprite?.path).toBe("games/scourge-survivors/weapons/pyre/sniper-ads-tiers.webp");
    expect(entry.adsSprite?.dimensions).toEqual(entry.dimensions);
    expect(entry.adsSprite?.scale?.[0]).toBeGreaterThan(entry.scale[0]);
    expect(entry.adsSprite?.scale?.[1]).toBeGreaterThan(entry.scale[1]);
  });

  it("ships every weapon as a 5-cell tier sheet (base->evolved) UV-sampled per visual tier", () => {
    const weaponSpriteIds = [
      "weapon-pistol",
      "weapon-smg",
      "weapon-shotgun",
      "weapon-cannon",
      "weapon-sniper",
    ] as const;
    const expectedTiers = ["base", "tier-2", "tier-3", "tier-4", "evolved"];

    for (const id of weaponSpriteIds) {
      const entry = manifest.sprites[id];
      expect(entry.path, `${id} path`).toMatch(/^games\/scourge-survivors\/weapons\/pyre\/.*-tiers\.webp$/);
      expect(entry.filter, id).toBe("nearest");
      expect(entry.dimensions?.[0], `${id} width`).toBeGreaterThan(0);
      expect(entry.dimensions?.[1], `${id} height`).toBeGreaterThan(0);
      expect(entry.license.tool, `${id} tool`).toBe("gpt-image-2");
      // One horizontal sheet, one cell per visual tier, in canonical order.
      expect(entry.tierSheet?.columns, `${id} columns`).toBe(5);
      expect(entry.tierSheet?.tiers, `${id} tiers`).toEqual(expectedTiers);
      expect(entry.tierSheet?.columns).toBe(entry.tierSheet?.tiers.length);
    }

    // The retired pistol per-tier sprites must be gone (superseded by the sheet).
    for (const t of ["tier-2", "tier-3", "tier-4", "evolved"]) {
      expect(manifest.sprites[`weapon-pistol-${t}`], `weapon-pistol-${t} retired`).toBeUndefined();
    }
  });

  it("keeps pickup sprites low-resolution and nearest-filtered", () => {
    const pickupSpriteIds = [
      "pickup-health",
      "pickup-ammo",
      "pickup-damage",
      "pickup-dual",
      "pickup-xp-blood",
    ] as const;

    for (const id of pickupSpriteIds) {
      const entry = manifest.sprites[id];
      expect(entry.path, `${id} path`).toMatch(/\.webp$/);
      expect(entry.filter, id).toBe("nearest");
      expect(entry.dimensions, `${id} dimensions`).toEqual([64, 64]);
      expect(entry.scale?.[0], `${id} scale width`).toBeGreaterThan(0);
      expect(entry.scale?.[1], `${id} scale height`).toBeGreaterThan(0);
    }
  });

  it("keeps current music and gun audio cues in the manifest", () => {
    const audio = manifest.audio as Record<string, AudioEntry>;
    expect(Object.keys(audio)).toEqual(
      expect.arrayContaining([
        "music-ash-reactor",
        "music-blood-circuit-ascension",
        "sfx-pistol-pyre",
        "sfx-sniper",
        "sfx-smg",
        "sfx-shotgun",
        "sfx-cannon",
      ]),
    );

    expect(audio["music-ash-reactor"].category).toBe("music");
    expect(audio["music-ash-reactor"].loop).toBe(true);
    expect(audio["music-blood-circuit-ascension"].category).toBe("music");
    expect(audio["music-blood-circuit-ascension"].loop).toBe(true);

    const cueToId = Object.fromEntries(Object.entries(audio).map(([id, entry]) => [entry.cue, id]));
    expect(cueToId).toMatchObject({
      shoot: "sfx-pistol-pyre",
      shootSmg: "sfx-smg",
      shootSniper: "sfx-sniper",
      shootShotgun: "sfx-shotgun",
      shootCannon: "sfx-cannon",
    });
  });

  it("keeps every campaign arena backed by authored materials and environment dressing", () => {
    const textureIds = new Set(Object.keys(manifest.textures));

    for (const mapId of CAMPAIGN_ORDER) {
      const map = MAPS[mapId];
      const materialIds = Object.values(map.materials);

      expect(new Set(materialIds).size, `${mapId} unique material roles`).toBe(materialIds.length);
      for (const id of materialIds) {
        expect(textureIds.has(id), `${mapId} material ${id}`).toBe(true);
        expectExistingAsset(manifest.textures[id as keyof typeof manifest.textures].path);
      }

      expect(map.environment.silhouettes.length, `${mapId} distant silhouettes`).toBeGreaterThanOrEqual(3);
      expect(map.environment.decals.length, `${mapId} floor decals`).toBeGreaterThanOrEqual(3);
      expect(map.environment.props.length, `${mapId} arena props`).toBeGreaterThanOrEqual(4);
      for (const decal of map.environment.decals) {
        expect(textureIds.has(decal.texture), `${mapId} decal ${decal.texture}`).toBe(true);
        expectExistingAsset(manifest.textures[decal.texture as keyof typeof manifest.textures].path);
      }
      for (const prop of map.environment.props) {
        expect(textureIds.has(prop.texture), `${mapId} prop ${prop.texture}`).toBe(true);
        expectExistingAsset(manifest.textures[prop.texture as keyof typeof manifest.textures].path);
      }
    }
  });
});
