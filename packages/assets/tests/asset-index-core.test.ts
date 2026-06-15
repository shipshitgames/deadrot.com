import assert from "node:assert/strict";
import { test } from "node:test";

// Unit tests for the pure classification + addressing helpers in
// asset-index-core.mjs. These are side-effect free (no fs, no process), so they
// load and run cleanly under `bun test tests`.
import {
  INDEX_VERSION,
  INDEXED_ROOTS,
  MEDIA_EXTENSIONS,
  cdnPathFor,
  compareByPath,
  gameFor,
  idFor,
  isIndexableMedia,
  joinCdnUrl,
  kindFor,
  mediaTypeFor,
  toPosix,
} from "../scripts/lib/asset-index-core.mjs";

test("isIndexableMedia — true for shipped media under indexed roots", () => {
  assert.equal(isIndexableMedia("games/redline/ui/menu/title.webp"), true);
  assert.equal(isIndexableMedia("shared/ui/icon.svg"), true);
  assert.equal(isIndexableMedia("shared/audio/hit.webm"), true);
  assert.equal(isIndexableMedia("shared/fonts/inter.woff2"), true);
});

test("isIndexableMedia — false inside source/master trees", () => {
  assert.equal(isIndexableMedia("games/foo/sources/x.webp"), false);
  assert.equal(isIndexableMedia("shared/masters/y.png"), false);
});

test("isIndexableMedia — false for non-media extensions", () => {
  assert.equal(isIndexableMedia("games/foo/assets.json"), false);
  assert.equal(isIndexableMedia("games/foo/README.md"), false);
});

test("isIndexableMedia — false outside indexed roots", () => {
  assert.equal(isIndexableMedia("docs/x.webp"), false);
  assert.equal(isIndexableMedia("src/x.webp"), false);
});

test("mediaTypeFor — known extensions map to IANA media types", () => {
  assert.equal(mediaTypeFor("a.webp"), "image/webp");
  assert.equal(mediaTypeFor("a.jpg"), "image/jpeg");
  assert.equal(mediaTypeFor("a.jpeg"), "image/jpeg");
  assert.equal(mediaTypeFor("a.png"), "image/png");
  assert.equal(mediaTypeFor("a.svg"), "image/svg+xml");
  assert.equal(mediaTypeFor("a.webm"), "video/webm");
  assert.equal(mediaTypeFor("a.ttf"), "font/ttf");
  assert.equal(mediaTypeFor("a.woff2"), "font/woff2");
  assert.equal(mediaTypeFor("a.mp3"), "audio/mpeg");
});

test("mediaTypeFor — unknown extension is null", () => {
  assert.equal(mediaTypeFor("a.md"), null);
});

test("kindFor — extension maps to semantic kind", () => {
  assert.equal(kindFor("a.webp"), "image");
  assert.equal(kindFor("a.svg"), "vector");
  assert.equal(kindFor("a.ttf"), "font");
  assert.equal(kindFor("a.mp3"), "audio");
});

test("kindFor — webm/mp4 under an audio segment resolve to audio", () => {
  assert.equal(kindFor("games/x/audio/music/a.webm"), "audio");
  assert.equal(kindFor("games/x/cutscene/intro.webm"), "video");
  assert.equal(kindFor("games/x/audio/sfx/a.mp4"), "audio");
  assert.equal(kindFor("games/x/cutscene/intro.mp4"), "video");
});

test("kindFor — unknown extension is null", () => {
  assert.equal(kindFor("a.md"), null);
});

test("gameFor — slug under games/<slug>/… else null", () => {
  assert.equal(gameFor("games/redline/a.webp"), "redline");
  assert.equal(gameFor("shared/a.webp"), null);
  assert.equal(gameFor("brand/x.webp"), null);
});

test("idFor — strips the media extension", () => {
  assert.equal(idFor("games/redline/ui/menu/title.webp"), "games/redline/ui/menu/title");
});

test("idFor — a path with no extension returns itself", () => {
  assert.equal(idFor("games/redline/ui/menu/title"), "games/redline/ui/menu/title");
});

test("cdnPathFor — equals toPosix(input)", () => {
  assert.equal(cdnPathFor("games/redline/a.webp"), toPosix("games/redline/a.webp"));
  assert.equal(cdnPathFor("games\\redline\\a.webp"), "games/redline/a.webp");
});

test("joinCdnUrl — tolerates trailing/leading slashes", () => {
  assert.equal(joinCdnUrl("https://cdn.test/", "/a/b.webp"), "https://cdn.test/a/b.webp");
  assert.equal(joinCdnUrl("https://cdn.test", "a.webp"), "https://cdn.test/a.webp");
});

test("toPosix — converts backslashes to forward slashes", () => {
  assert.equal(toPosix("a\\b\\c.webp"), "a/b/c.webp");
});

test("compareByPath — orders by .path and sorts in codepoint order", () => {
  assert.ok(compareByPath({ path: "a" }, { path: "b" }) < 0);
  assert.ok(compareByPath({ path: "b" }, { path: "a" }) > 0);
  assert.equal(compareByPath({ path: "a" }, { path: "a" }), 0);

  const items = [{ path: "games/b.webp" }, { path: "brand/a.webp" }, { path: "games/a.webp" }];
  const sorted = [...items].sort(compareByPath);
  assert.deepEqual(
    sorted.map((x) => x.path),
    ["brand/a.webp", "games/a.webp", "games/b.webp"],
  );
});

test("INDEXED_ROOTS / MEDIA_EXTENSIONS / INDEX_VERSION sanity", () => {
  assert.ok(INDEXED_ROOTS.includes("games"));
  assert.ok(INDEXED_ROOTS.includes("shared"));
  assert.ok(MEDIA_EXTENSIONS.includes(".webp"));
  assert.ok(MEDIA_EXTENSIONS.includes(".woff2"));
  assert.equal(INDEX_VERSION, "1");
});
