import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";

import {
  hasTransparentNeighbor,
  isDarkFringePixel,
  measureAlphaFringe,
  rematteDarkFringe,
  replacementColorNear,
  webpEncodingKind,
} from "../scripts/lib/alpha-fringe.mjs";

function image(width: number, height: number, pixels: number[][]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 1) {
    data.set(pixels[i], i * 4);
  }
  return data;
}

test("isDarkFringePixel flags semi-transparent dark matte pixels only", () => {
  assert.equal(isDarkFringePixel(4, 5, 6, 128), true);
  assert.equal(isDarkFringePixel(230, 220, 200, 128), false);
  assert.equal(isDarkFringePixel(205, 35, 28, 128), false);
  assert.equal(isDarkFringePixel(58, 27, 26, 111), false);
  assert.equal(isDarkFringePixel(4, 5, 6, 255), false);
  assert.equal(isDarkFringePixel(4, 5, 6, 0), false);
});

test("measureAlphaFringe counts dark semi-transparent pixels touching alpha", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [5, 5, 5, 128],
    [235, 220, 190, 255],
    [0, 0, 0, 0],
    [235, 220, 190, 255],
    [235, 220, 190, 255],
  ]);

  assert.equal(hasTransparentNeighbor(data, 3, 3, 1, 1), true);
  assert.deepEqual(measureAlphaFringe(data, 3, 3), {
    darkFringePixels: 1,
    semiTransparentPixels: 1,
    borderPixels: 3,
    margins: { left: 1, top: 1, right: 0, bottom: 0 },
  });
});

test("rematteDarkFringe uses nearby opaque subject color and preserves alpha", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [8, 8, 8, 120],
    [235, 220, 190, 255],
    [0, 0, 0, 0],
    [205, 35, 28, 255],
    [235, 220, 190, 255],
  ]);

  assert.deepEqual(replacementColorNear(data, 3, 3, 1, 1), [225, 158, 136]);
  assert.deepEqual(rematteDarkFringe(data, 3, 3), {
    changedPixels: 1,
    remattedPixels: 1,
    clearedPixels: 0,
  });
  assert.deepEqual(Array.from(data.subarray((1 * 3 + 1) * 4, (1 * 3 + 1) * 4 + 4)), [225, 158, 136, 120]);
  assert.equal(measureAlphaFringe(data, 3, 3).darkFringePixels, 0);
});

test("rematteDarkFringe clears isolated dark matte when no subject color exists", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [8, 8, 8, 120],
    [20, 20, 20, 255],
    [0, 0, 0, 0],
    [20, 20, 20, 255],
    [20, 20, 20, 255],
  ]);

  assert.deepEqual(rematteDarkFringe(data, 3, 3), {
    changedPixels: 1,
    remattedPixels: 0,
    clearedPixels: 1,
  });
  assert.deepEqual(Array.from(data.subarray((1 * 3 + 1) * 4, (1 * 3 + 1) * 4 + 4)), [0, 0, 0, 0]);
});

test("webpEncodingKind detects VP8L lossless and VP8 lossy chunks", () => {
  const lossless = Buffer.alloc(24);
  lossless.write("RIFF", 0, "ascii");
  lossless.write("WEBP", 8, "ascii");
  lossless.write("VP8L", 12, "ascii");
  lossless.writeUInt32LE(4, 16);
  assert.equal(webpEncodingKind(lossless), "lossless");

  const lossy = Buffer.alloc(24);
  lossy.write("RIFF", 0, "ascii");
  lossy.write("WEBP", 8, "ascii");
  lossy.write("VP8 ", 12, "ascii");
  lossy.writeUInt32LE(4, 16);
  assert.equal(webpEncodingKind(lossy), "lossy");
});
