import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// The image-size module is pure header parsing (no Vite import.meta.glob), so it
// loads fine under `bun test`. We exercise every real WebP encoding the repo
// ships (VP8 lossy, VP8L lossless, VP8X extended) against actual committed
// assets, plus synthetic PNG/GIF/SVG fixtures and the null fallbacks.
import { dimensionsFromBuffer, dimensionsFromFile } from "../scripts/lib/image-size.mjs";

const pkg = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

test("WebP VP8X (extended) — real asset", () => {
  assert.deepEqual(dimensionsFromFile(pkg("brand/mark.webp")), { width: 500, height: 500 });
});

test("WebP VP8L (lossless) — real asset", () => {
  assert.deepEqual(dimensionsFromFile(pkg("entities/breach-boss/deadlane.webp")), { width: 128, height: 180 });
});

test("WebP VP8 (lossy) — real asset", () => {
  assert.deepEqual(dimensionsFromFile(pkg("entities/pyre-courier/redline.webp")), { width: 768, height: 768 });
});

test("PNG — real asset", () => {
  assert.deepEqual(dimensionsFromFile(pkg("concepts/zero-day/ui/social/og.png")), { width: 1200, height: 630 });
});

test("JPEG — real asset", () => {
  assert.deepEqual(dimensionsFromFile(pkg("games/brawl/ui/social/og.jpg")), { width: 1200, height: 630 });
});

test("SVG — real asset (viewBox)", () => {
  assert.deepEqual(dimensionsFromFile(pkg("shared/ui/icon-breach.svg")), { width: 128, height: 128 });
});

test("synthetic 1x1 PNG", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  assert.deepEqual(dimensionsFromBuffer(png, ".png"), { width: 1, height: 1 });
});

test("synthetic 1x1 GIF", () => {
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  assert.deepEqual(dimensionsFromBuffer(gif, ".gif"), { width: 1, height: 1 });
});

test("synthetic VP8X webp with known canvas size", () => {
  // RIFF/WEBP container with a VP8X chunk encoding canvas 16x32 (width-1=15,
  // height-1=31 as 24-bit little-endian at offsets 24 and 27).
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  buf[20] = 0x10; // flags
  buf[24] = 15; // width-1 LE24
  buf[27] = 31; // height-1 LE24
  assert.deepEqual(dimensionsFromBuffer(buf, ".webp"), { width: 16, height: 32 });
});

test("WebP VP8L at max 16384x16384 — no post-+1 mask wrap (regression)", () => {
  // width-1 = height-1 = 0x3fff (14 bits all set) packs to bytes ff ff ff 0f.
  // A `& 0x3fff` applied AFTER the `+1` would wrap 16384 back to 0.
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8L", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  buf[20] = 0x2f;
  buf[21] = 0xff;
  buf[22] = 0xff;
  buf[23] = 0xff;
  buf[24] = 0x0f;
  assert.deepEqual(dimensionsFromBuffer(buf, ".webp"), { width: 16384, height: 16384 });
});

test("SVG stroke-width does not shadow the real width attribute (regression)", () => {
  // A `\bwidth` regex matches inside `stroke-width`; the lookbehind guard must
  // reject it so the genuine width="32" attribute wins.
  const svg = Buffer.from('<svg stroke-width="4" width="32" height="32" viewBox="0 0 32 32"></svg>');
  assert.deepEqual(dimensionsFromBuffer(svg, ".svg"), { width: 32, height: 32 });
});

test("JPEG with 0xFF fill bytes before the SOF marker (regression)", () => {
  // The spec allows any run of 0xFF fill bytes before a marker; a naive scanner
  // reads the fill byte as the marker and desyncs into the segment length.
  const buf = Buffer.from([
    0xff,
    0xd8, // SOI
    0xff,
    0xff,
    0xc0, // a fill 0xFF, then the SOF0 marker (FF C0)
    0x00,
    0x11, // segment length 17
    0x08, // precision
    0x00,
    0x64, // height 100
    0x00,
    0xc8, // width 200
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01, // component padding
  ]);
  assert.deepEqual(dimensionsFromBuffer(buf, ".jpg"), { width: 200, height: 100 });
});

test("SVG width/height attributes win over viewBox", () => {
  const svg = Buffer.from('<svg width="64px" height="48" viewBox="0 0 10 10"></svg>');
  assert.deepEqual(dimensionsFromBuffer(svg, ".svg"), { width: 64, height: 48 });
});

test("SVG percentage width falls back to viewBox", () => {
  const svg = Buffer.from('<svg width="100%" height="100%" viewBox="0 0 320 240"></svg>');
  assert.deepEqual(dimensionsFromBuffer(svg, ".svg"), { width: 320, height: 240 });
});

test("non-raster formats report null", () => {
  assert.equal(dimensionsFromFile(pkg("shared/fonts/inter.woff2")), null);
  assert.equal(dimensionsFromBuffer(Buffer.from("anything"), ".webm"), null);
  assert.equal(dimensionsFromBuffer(Buffer.from("anything"), ".ttf"), null);
});

test("truncated / malformed headers return null, never throw", () => {
  assert.equal(dimensionsFromBuffer(Buffer.from([0x89, 0x50]), ".png"), null);
  assert.equal(dimensionsFromBuffer(Buffer.from("not a webp at all"), ".webp"), null);
  assert.equal(dimensionsFromBuffer(Buffer.from("<nope/>"), ".svg"), null);
  assert.equal(dimensionsFromBuffer(Buffer.alloc(0), ".jpeg"), null);
});

test("dimensionsFromFile returns null for a missing file", () => {
  assert.equal(dimensionsFromFile(pkg("does/not/exist.png")), null);
});
