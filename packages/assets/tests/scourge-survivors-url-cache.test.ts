import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ScourgeSurvivorsAssetUrlCache } from "../src/scourge-survivors-url-cache";

test("Scourge asset URL cache deduplicates concurrent and completed loads", async () => {
  const cache = new ScourgeSurvivorsAssetUrlCache();
  let calls = 0;
  let resolveLoad: ((url: string) => void) | undefined;
  const deferred = new Promise<string>((resolve) => {
    resolveLoad = resolve;
  });
  const load = () => {
    calls += 1;
    return deferred;
  };

  const first = cache.load("combat.webp", load);
  const concurrent = cache.load("combat.webp", load);
  assert.equal(first, concurrent, "concurrent callers receive the same promise");
  assert.equal(calls, 1, "the URL module loader runs once");

  resolveLoad?.("/assets/combat.hash.webp");
  assert.equal(await first, "/assets/combat.hash.webp");
  assert.equal(await concurrent, "/assets/combat.hash.webp");

  const completed = cache.load("combat.webp", load);
  assert.equal(completed, first, "the completed promise remains cached");
  assert.equal(await completed, "/assets/combat.hash.webp");
  assert.equal(calls, 1);
});

test("Scourge asset URL cache evicts failures and maps retry errors descriptively", async () => {
  const cache = new ScourgeSurvivorsAssetUrlCache();
  let calls = 0;
  const load = () => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error("chunk unavailable")) : Promise.resolve("/assets/retry.webp");
  };
  const mapError = (error: unknown) =>
    new Error(`Scourge URL failed: ${error instanceof Error ? error.message : String(error)}`);

  await assert.rejects(cache.load("retry.webp", load, mapError), /Scourge URL failed: chunk unavailable/);
  assert.equal(await cache.load("retry.webp", load, mapError), "/assets/retry.webp");
  assert.equal(calls, 2, "a rejected URL module can be retried");
});

test("Scourge Vite globs keep boot media targeted and combat media lazy", () => {
  const sourcePath = fileURLToPath(new URL("../src/scourge-survivors.ts", import.meta.url));
  const source = readFileSync(sourcePath, "utf8");
  const bootStart = source.indexOf("const scourgeSurvivorsBootAssetModules");
  const lazyStart = source.indexOf("const scourgeSurvivorsLazyAssetModules");
  const cacheStart = source.indexOf("const scourgeSurvivorsAssetUrlCache");
  assert.ok(bootStart >= 0 && lazyStart > bootStart && cacheStart > lazyStart);

  const bootGlob = source.slice(bootStart, lazyStart);
  assert.match(bootGlob, /players\/\*\*\/front\.webp/);
  assert.match(bootGlob, /ui\/\*\*\/\*\.webp/);
  assert.doesNotMatch(bootGlob, /weapons/);
  assert.doesNotMatch(bootGlob, /textures/);

  const lazyGlob = source.slice(lazyStart, cacheStart);
  assert.match(lazyGlob, /eager: false/);
});
