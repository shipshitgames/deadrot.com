import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assetBaseUrl,
  assetIndex,
  getAssetEntry,
  getAssetEntryByPath,
  listAssets,
  resolveAssetPath,
  resolveAssetUrl,
} from "../src/asset-index.ts";

// Unit tests for the typed resolver. We exercise the REAL committed
// `assets.index.json` so the contract is checked against shipped data, and we
// derive a sample entry at runtime (assetIndex.assets[0]) to avoid brittle
// hardcoded ids.

const sample = assetIndex.assets[0];
const SHA256_RE = /^[0-9a-f]{64}$/;

test("structural invariants of the committed index", () => {
  assert.ok(sample, "index must contain at least one asset");
  assert.equal(assetIndex.assetCount, assetIndex.assets.length);

  const seen = new Set<string>();
  let prevPath: string | null = null;
  for (const a of assetIndex.assets) {
    assert.ok(typeof a.id === "string" && a.id.length > 0, "id non-empty");
    assert.ok(typeof a.kind === "string" && a.kind.length > 0, "kind non-empty");
    assert.ok(typeof a.path === "string" && a.path.length > 0, "path non-empty");
    assert.ok(typeof a.cdnPath === "string" && a.cdnPath.length > 0, "cdnPath non-empty");
    assert.ok(typeof a.mediaType === "string" && a.mediaType.length > 0, "mediaType non-empty");
    assert.match(a.sha256, SHA256_RE, `sha256 of ${a.id} is 64 hex chars`);
    assert.ok(Number.isFinite(a.bytes) && a.bytes >= 0, `bytes of ${a.id} >= 0`);
    if (a.width !== undefined) {
      assert.ok(Number.isInteger(a.width) && a.width > 0, `width of ${a.id} is a positive integer`);
    }
    if (a.height !== undefined) {
      assert.ok(Number.isInteger(a.height) && a.height > 0, `height of ${a.id} is a positive integer`);
    }

    assert.ok(!seen.has(a.id), `id ${a.id} is unique`);
    seen.add(a.id);

    if (prevPath !== null) {
      assert.ok(prevPath <= a.path, `assets sorted ascending by path (${prevPath} <= ${a.path})`);
    }
    prevPath = a.path;
  }
});

test("getAssetEntry resolves a known id and rejects unknown", () => {
  assert.deepEqual(getAssetEntry(sample.id), sample);
  assert.equal(getAssetEntry("nope/missing"), undefined);
});

test("getAssetEntryByPath returns the same entry as getAssetEntry", () => {
  assert.deepEqual(getAssetEntryByPath(sample.path), sample);
  assert.equal(getAssetEntryByPath("nope/missing.webp"), undefined);
});

test("resolveAssetPath maps id to its package-relative path", () => {
  assert.equal(resolveAssetPath(sample.id), sample.path);
  assert.equal(resolveAssetPath("nope"), undefined);
});

test("resolveAssetUrl builds CDN urls and trims slashes", () => {
  // The default-base assertion must not depend on an ambient ASSET_BASE_URL, so
  // clear it for that branch and restore afterwards.
  const prev = process.env.ASSET_BASE_URL;
  try {
    delete process.env.ASSET_BASE_URL;
    assert.equal(resolveAssetUrl(sample.id), `${assetIndex.cdnBase}/${sample.cdnPath}`);
  } finally {
    if (prev === undefined) delete process.env.ASSET_BASE_URL;
    else process.env.ASSET_BASE_URL = prev;
  }
  // Explicit baseUrl wins regardless of env, and slashes are normalized.
  assert.equal(resolveAssetUrl(sample.id, { baseUrl: "https://x.test/cdn/" }), `https://x.test/cdn/${sample.cdnPath}`);
  assert.equal(resolveAssetUrl("nope"), undefined);
});

test("resolveAssetUrl honors the ASSET_BASE_URL env override", () => {
  const prev = process.env.ASSET_BASE_URL;
  try {
    process.env.ASSET_BASE_URL = "https://env-cdn.test/";
    assert.equal(resolveAssetUrl(sample.id), `https://env-cdn.test/${sample.cdnPath}`);
    // An explicit baseUrl still outranks the env override.
    assert.equal(
      resolveAssetUrl(sample.id, { baseUrl: "https://explicit.test" }),
      `https://explicit.test/${sample.cdnPath}`,
    );
  } finally {
    if (prev === undefined) delete process.env.ASSET_BASE_URL;
    else process.env.ASSET_BASE_URL = prev;
  }
});

test("assetBaseUrl precedence: baseUrl > env > manifest", () => {
  // Snapshot and clear ambient env so the default branch is deterministic
  // regardless of how the suite is invoked; restore in `finally`.
  const prev = process.env.ASSET_BASE_URL;
  try {
    delete process.env.ASSET_BASE_URL;
    // With no env override, the default falls back to the manifest's cdnBase.
    assert.equal(assetBaseUrl(), assetIndex.cdnBase);

    // Explicit baseUrl wins over everything.
    assert.equal(assetBaseUrl({ baseUrl: "https://explicit.test" }), "https://explicit.test");

    // ASSET_BASE_URL env override is honored.
    process.env.ASSET_BASE_URL = "https://env.test";
    assert.equal(assetBaseUrl(), "https://env.test");
    // baseUrl still outranks the env override.
    assert.equal(assetBaseUrl({ baseUrl: "https://explicit.test" }), "https://explicit.test");
  } finally {
    if (prev === undefined) delete process.env.ASSET_BASE_URL;
    else process.env.ASSET_BASE_URL = prev;
  }
});

test("listAssets filters by kind", () => {
  const audio = listAssets({ kind: "audio" });
  assert.ok(audio.length > 0, "expected at least one audio asset");
  for (const a of audio) assert.equal(a.kind, "audio");
});

test("listAssets filters by game slug", () => {
  const scourge = listAssets({ game: "scourge-survivors" });
  assert.ok(scourge.length > 0, "expected at least one scourge-survivors asset");
  for (const a of scourge) assert.equal(a.game, "scourge-survivors");
});

test("listAssets accepts a non-playable game slug (warline)", () => {
  // `game` is typed `string | null`, not the playable-only `GameSlug` union, so
  // a directory-derived slug like `warline` both compiles and resolves.
  const warline = listAssets({ game: "warline" });
  assert.ok(warline.length > 0, "expected at least one warline asset");
  for (const a of warline) assert.equal(a.game, "warline");
});

test("listAssets({ game: null }) returns only shared assets", () => {
  const shared = listAssets({ game: null });
  assert.ok(shared.length > 0, "expected at least one shared asset");
  for (const a of shared) assert.equal(a.game, null);
});

test("listAssets filters by mediaType", () => {
  const webp = listAssets({ mediaType: "image/webp" });
  assert.ok(webp.length > 0, "expected at least one image/webp asset");
  for (const a of webp) assert.equal(a.mediaType, "image/webp");
});

test("listAssets combines filters to narrow results", () => {
  const combined = listAssets({ game: null, kind: "image", mediaType: "image/webp" });
  for (const a of combined) {
    assert.equal(a.game, null);
    assert.equal(a.kind, "image");
    assert.equal(a.mediaType, "image/webp");
  }
  // The combined result is a subset of each single-filter result.
  const justWebp = listAssets({ mediaType: "image/webp" });
  assert.ok(combined.length <= justWebp.length);
});

test("listAssets() with no filter returns the full index", () => {
  assert.equal(listAssets().length, assetIndex.assets.length);
  assert.deepEqual(listAssets(), assetIndex.assets);
});
