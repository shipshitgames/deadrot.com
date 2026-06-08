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
  const enemySpriteIds = ["enemy-melee", "enemy-ranged", "enemy-flying", "boss"] as const;

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
    expect(Object.keys(manifest.runtime.enemies).sort()).toEqual(["boss", "flying", "melee", "ranged"]);
    expect(Object.keys(manifest.runtime.pickups).sort()).toEqual(["ammo", "damage", "dual", "health", "xpBlood"]);
    expect(Object.keys(manifest.runtime.projectiles).sort()).toEqual(["boss", "enemy"]);
    expect(Object.keys(manifest.runtime.fx).sort()).toEqual(["muzzleFlash"]);
    expect(Object.keys(manifest.runtime.ui).sort()).toEqual([
      "cardBastionJpg",
      "cardBastionPng",
      "cardBreachJpg",
      "cardBreachPng",
      "cardFleshworksJpg",
      "cardFleshworksPng",
      "menuHeroJpg",
      "menuHeroPng",
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

    for (const [id, ref] of Object.entries(manifest.runtime.ui)) {
      expect(manifest.ui[ref.asset as keyof typeof manifest.ui], `ui.${id}`).toBeTruthy();
      expect(ASSET_CATALOG.runtimeUiUrl(id), `ui.${id} URL`).toMatch(/\.(webp|jpe?g|png)(\?|$)/);
    }
  });

  it("keeps enemies and player avatars covered by front, side, and back views", () => {
    const directionalSpriteIds = [
      "enemy-melee",
      "enemy-ranged",
      "enemy-flying",
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
    const enemySpriteIds = ["enemy-melee", "enemy-ranged", "enemy-flying", "boss"] as const;

    for (const id of enemySpriteIds) {
      const entry = manifest.sprites[id];
      expect(entry.filter, id).toBe("nearest");

      for (const view of Object.values(entry.views)) {
        expect(view.dimensions[0], `${id} width`).toBeLessThanOrEqual(128);
        expect(view.dimensions[1], `${id} height`).toBeLessThanOrEqual(id === "boss" ? 180 : 128);
      }
    }
  });

  it("keeps Scourge enemy sprite cutouts on the cleaned alpha baseline", () => {
    const hash = createHash("sha256");
    const paths = scourgeEnemySpritePaths();

    expect(paths).toHaveLength(228);

    for (const path of paths) {
      hash.update(path);
      hash.update("\0");
      hash.update(readFileSync(join(assetsRoot, path)));
      hash.update("\0");
    }

    expect(hash.digest("hex")).toBe("6bd4f67a7cf04e6a2657c0c4613e46f2b04b7de7c9c4d62810bceab0279a0f53");
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
        "sfx-smg-pyre",
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
      shootSmg: "sfx-smg-pyre",
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
