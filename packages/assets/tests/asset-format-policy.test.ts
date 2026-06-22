import assert from "node:assert/strict";
import { test } from "node:test";

// The policy module is pure (no Vite import.meta.glob), so unlike the scourge
// manifest it loads fine under `bun test`.
import {
  cwebpArgsFor,
  extname,
  globAdmitsSourceRaster,
  globRasterExtensions,
  isAllowedRuntimeRasterPath,
  isRuntimeRaster,
  isSocialCard,
  isSourceTree,
  planConversion,
  rasterViolationReason,
  shouldUseLossless,
  webpDestFor,
} from "../scripts/lib/asset-format-policy.mjs";

test("extname lowercases and ignores dotfiles", () => {
  assert.equal(extname("a/b/c.PNG"), ".png");
  assert.equal(extname("hero.webp"), ".webp");
  assert.equal(extname("noext"), "");
  assert.equal(extname(".gitignore"), "");
  assert.equal(extname("a.b/c.jpeg"), ".jpeg");
});

test("isSourceTree detects source/master/provenance segments", () => {
  assert.equal(isSourceTree("sources/generated/2026-06-02/x.png"), true);
  assert.equal(isSourceTree("packages/assets/_archive/raw/x.png"), true);
  assert.equal(isSourceTree("games/foo/ui/masters/hero.png"), true);
  assert.equal(isSourceTree("games/foo/ui/cards/codex/breach.png"), false);
});

test("isSocialCard matches the OG slot only", () => {
  assert.equal(isSocialCard("games/foo/ui/social/og.jpg"), true);
  assert.equal(isSocialCard("games/foo/ui/menu/title.webp"), false);
});

test("isRuntimeRaster flags png/jpg/jpeg only", () => {
  assert.equal(isRuntimeRaster("x.png"), true);
  assert.equal(isRuntimeRaster("x.JPG"), true);
  assert.equal(isRuntimeRaster("x.jpeg"), true);
  assert.equal(isRuntimeRaster("x.webp"), false);
  assert.equal(isRuntimeRaster("x.ttf"), false);
});

test("isAllowedRuntimeRasterPath: webp ok, png/jpg rejected, social jpg ok", () => {
  assert.equal(isAllowedRuntimeRasterPath("games/foo/ui/cards/x.webp"), true);
  assert.equal(isAllowedRuntimeRasterPath("games/foo/ui/cards/x.png"), false);
  assert.equal(isAllowedRuntimeRasterPath("games/foo/ui/menu/hero.jpg"), false);
  assert.equal(isAllowedRuntimeRasterPath("games/foo/ui/social/og.jpg"), true);
  // non-raster assets are always allowed
  assert.equal(isAllowedRuntimeRasterPath("games/foo/audio/x.webm"), true);
  assert.equal(isAllowedRuntimeRasterPath("games/foo/fonts/x.ttf"), true);
});

test("rasterViolationReason explains png vs jpg, null when allowed", () => {
  assert.match(rasterViolationReason("a/b.png") ?? "", /PNG is a source\/master format/);
  assert.match(rasterViolationReason("a/menu/hero.jpg") ?? "", /JPEG is only allowed for social/);
  assert.equal(rasterViolationReason("a/b.webp"), null);
  assert.equal(rasterViolationReason("a/ui/social/og.jpg"), null);
});

test("webpDestFor swaps the extension", () => {
  assert.equal(webpDestFor("a/b/c.png"), "a/b/c.webp");
  assert.equal(webpDestFor("a/b/c.JPEG"), "a/b/c.webp");
  assert.equal(webpDestFor("noext"), "noext.webp");
});

test("shouldUseLossless: pixel art and tiny sprites crisp, photos lossy", () => {
  assert.equal(shouldUseLossless("shared/ui/icons/pixel/gold.png"), true);
  assert.equal(shouldUseLossless("games/foo/ui/icons/skull.png"), true);
  assert.equal(shouldUseLossless("games/foo/tiles/floor.png"), true);
  assert.equal(shouldUseLossless("games/foo/ui/menu/scourge-hero.png"), false);
  assert.equal(shouldUseLossless("games/foo/ui/cards/codex/breach.png"), false);
  // dimension hint
  assert.equal(shouldUseLossless("a/b.png", { width: 32, height: 32 }), true);
  assert.equal(shouldUseLossless("a/b.png", { width: 1024, height: 768 }), false);
  // exact 64x64 boundary: <=64 in both dimensions is crisp, one pixel over is not
  assert.equal(shouldUseLossless("a/b.png", { width: 64, height: 64 }), true);
  assert.equal(shouldUseLossless("a/b.png", { width: 65, height: 64 }), false);
  assert.equal(shouldUseLossless("a/b.png", { width: 64, height: 65 }), false);
  // explicit override wins
  assert.equal(shouldUseLossless("games/foo/ui/menu/hero.png", { force: true }), true);
  assert.equal(shouldUseLossless("shared/ui/icons/pixel/gold.png", { force: false }), false);
});

test("cwebpArgsFor: lossless uses -lossless -exact, lossy uses -q", () => {
  assert.deepEqual(cwebpArgsFor({ src: "a.png", dest: "a.webp", lossless: true }), [
    "-lossless",
    "-exact",
    "-z",
    "9",
    "a.png",
    "-o",
    "a.webp",
  ]);

  assert.deepEqual(cwebpArgsFor({ src: "a.png", dest: "a.webp", lossless: false, quality: 86 }), [
    "-q",
    "86",
    "-m",
    "6",
    "a.png",
    "-o",
    "a.webp",
  ]);

  // default quality when omitted
  assert.deepEqual(cwebpArgsFor({ src: "a.png", dest: "a.webp", lossless: false }).slice(0, 2), ["-q", "82"]);
});

test("planConversion picks mode + destination", () => {
  const photo = planConversion("games/foo/ui/menu/hero.png", { quality: 82 });
  assert.equal(photo.lossless, false);
  assert.equal(photo.dest, "games/foo/ui/menu/hero.webp");
  assert.equal(photo.quality, 82);

  const pixel = planConversion("shared/ui/icons/pixel/gold.png");
  assert.equal(pixel.lossless, true);
  assert.equal(pixel.dest, "shared/ui/icons/pixel/gold.webp");
  assert.equal(pixel.quality, undefined);
});

test("globRasterExtensions parses brace sets and single extensions", () => {
  assert.deepEqual(globRasterExtensions("../games/foo/ui/cards/**/*.{jpg,png}"), [".jpg", ".png"]);
  assert.deepEqual(globRasterExtensions("../games/foo/ui/cover/**/*.{jpg,png,webp}"), [".jpg", ".png", ".webp"]);
  assert.deepEqual(globRasterExtensions("../games/foo/ui/menu/**/*.webp"), [".webp"]);
  assert.deepEqual(globRasterExtensions("../games/foo/audio/**/*.webm"), [".webm"]);
});

test("globAdmitsSourceRaster: flags png/non-social jpg, allows webp + source trees", () => {
  assert.equal(globAdmitsSourceRaster("../games/foo/ui/cards/**/*.{jpg,png}"), true);
  assert.equal(globAdmitsSourceRaster("../games/foo/ui/menu/**/*.{jpg,png,webp}"), true);
  assert.equal(globAdmitsSourceRaster("../games/foo/ui/cards/**/*.webp"), false);
  // jpg under a social slot is allowed
  assert.equal(globAdmitsSourceRaster("../games/foo/ui/social/**/*.jpg"), false);
  // globs over source trees are exempt — PNG masters live there
  assert.equal(globAdmitsSourceRaster("../sources/generated/2026-06-02/**/*.png"), false);
  // non-raster globs never admit source raster
  assert.equal(globAdmitsSourceRaster("../games/foo/audio/**/*.webm"), false);
});
