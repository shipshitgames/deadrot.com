import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const assetsRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultPackPath = join(assetsRoot, "games/scourge-survivors/animations/scourge/animation-pack.json");
const comicPackPath = join(assetsRoot, "games/scourge-survivors/animations/scourge-comic/animation-pack.json");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Scourge default animation atlas covers every manifest frame exactly once", () => {
  const pack = readJson(defaultPackPath);
  const runtimeAtlas = pack.runtimeAtlas;
  assert.ok(runtimeAtlas, "default animation pack must own runtimeAtlas metadata");
  assert.equal(runtimeAtlas.tool, "@shipshitgames/assetgen atlas");
  assert.match(runtimeAtlas.note, /pathTemplate remains the authoritative authored frame identity/);
  assert.match(runtimeAtlas.license, /inherit/);

  const mapPath = join(assetsRoot, runtimeAtlas.mapPath);
  assert.ok(existsSync(mapPath), `atlas map exists: ${runtimeAtlas.mapPath}`);
  const atlas = readJson(mapPath);
  assert.equal(atlas.padding, runtimeAtlas.padding);
  assert.equal(atlas.pages.length, runtimeAtlas.pages.length);

  const expected = new Map<string, [number, number]>();
  for (const entity of Object.values(pack.entities) as Array<{
    frameDimensions: [number, number];
    actions: Record<string, { pathTemplate: string }>;
  }>) {
    for (const action of Object.values(entity.actions)) {
      assert.ok(
        action.pathTemplate.startsWith("animations/scourge/"),
        `default pathTemplate stays authoritative: ${action.pathTemplate}`,
      );
      for (const view of pack.views as string[]) {
        for (let frame = 0; frame < pack.framesPerAction; frame += 1) {
          const frameId = String(frame).padStart(2, "0");
          const authoredPath = action.pathTemplate.replace("{view}", view).replace("{frame}", frameId);
          const atlasId = authoredPath.replace("animations/scourge/", "");
          assert.ok(!expected.has(atlasId), `manifest frame id is unique: ${atlasId}`);
          expected.set(atlasId, entity.frameDimensions);

          const splitPath = join(assetsRoot, "games/scourge-survivors", authoredPath);
          assert.ok(existsSync(splitPath), `authored split fallback exists: ${authoredPath}`);
        }
      }
    }
  }

  assert.equal(expected.size, 270);
  assert.equal(runtimeAtlas.frameCount, expected.size);
  assert.equal(atlas.frameCount, expected.size);
  assert.equal(atlas.frames.length, expected.size);

  for (const [pageIndex, page] of runtimeAtlas.pages.entries()) {
    const generatedPage = atlas.pages[pageIndex];
    assert.ok(generatedPage, `generated page ${pageIndex} exists`);
    assert.equal(basename(page.path), generatedPage.image);
    assert.equal(page.width, generatedPage.width);
    assert.equal(page.height, generatedPage.height);
    const pagePath = join(assetsRoot, page.path);
    assert.ok(existsSync(pagePath), `atlas page exists: ${page.path}`);
    assert.ok(statSync(pagePath).size > 0, `atlas page is non-empty: ${page.path}`);
  }

  const seen = new Set<string>();
  for (const frame of atlas.frames) {
    assert.ok(!seen.has(frame.id), `generated atlas frame is unique: ${frame.id}`);
    seen.add(frame.id);
    const dimensions = expected.get(frame.id);
    assert.ok(dimensions, `generated atlas frame belongs to the manifest: ${frame.id}`);
    assert.deepEqual([frame.w, frame.h], dimensions);
    const page = atlas.pages[frame.page];
    assert.ok(page, `frame ${frame.id} references page ${frame.page}`);
    assert.ok(frame.x >= 0 && frame.y >= 0, `frame ${frame.id} starts in bounds`);
    assert.ok(frame.x + frame.w <= page.width, `frame ${frame.id} fits page width`);
    assert.ok(frame.y + frame.h <= page.height, `frame ${frame.id} fits page height`);
  }
  assert.deepEqual([...seen].sort(), [...expected.keys()].sort());
});

test("comic animation remains split with atomic default fallback for wound-hound", () => {
  const defaultPack = readJson(defaultPackPath);
  const comicPack = readJson(comicPackPath);
  assert.equal(comicPack.runtimeAtlas, undefined);
  assert.deepEqual(Object.keys(comicPack.entities).sort(), [
    "breach-boss",
    "host-grunt",
    "spitter-host",
    "winged-host",
  ]);
  assert.ok(defaultPack.entities["wound-hound"], "default pack retains wound-hound");
  assert.equal(comicPack.entities["wound-hound"], undefined, "comic mode must fall back atomically for wound-hound");

  for (const [entityId, entity] of Object.entries(comicPack.entities) as Array<
    [string, { actions: Record<string, { pathTemplate: string }> }]
  >) {
    assert.deepEqual(Object.keys(entity.actions).sort(), Object.keys(defaultPack.entities[entityId].actions).sort());
    for (const action of Object.values(entity.actions)) {
      assert.ok(action.pathTemplate.startsWith("animations/scourge-comic/"));
    }
  }
});

test("Scourge Vite globs keep boot media targeted and default split frames out of runtime imports", () => {
  const sourcePath = join(dirname(defaultPackPath), "../../../../src/scourge-survivors.ts");
  const source = readFileSync(sourcePath, "utf8");
  const bootStart = source.indexOf("const scourgeSurvivorsBootAssetModules");
  const lazyStart = source.indexOf("const scourgeSurvivorsLazyAssetModules");
  const cacheStart = source.indexOf("const scourgeSurvivorsAssetUrlCache");
  assert.ok(bootStart >= 0 && lazyStart > bootStart && cacheStart > lazyStart);

  const bootGlob = source.slice(bootStart, lazyStart);
  assert.match(bootGlob, /players\/\*\*\/front\.webp/);
  assert.match(bootGlob, /ui\/\*\*\/\*\.webp/);
  assert.doesNotMatch(bootGlob, /animations/);
  assert.doesNotMatch(bootGlob, /weapons/);
  assert.doesNotMatch(bootGlob, /textures/);

  const lazyGlob = source.slice(lazyStart, cacheStart);
  assert.match(lazyGlob, /animations\/scourge\/scourge\.atlas\*\.webp/);
  assert.match(lazyGlob, /animations\/scourge-comic\/\*\*\/\*\.webp/);
  assert.doesNotMatch(lazyGlob, /animations\/scourge\/\*\*\/\*\.webp/);
  assert.match(lazyGlob, /eager: false/);
});
