import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";

import {
  cleanMagentaFringe,
  copyRgbaFrameWithExtrudedPadding,
  countRgbaRectMismatches,
  hasTransparentNeighbor,
  isDarkFringePixel,
  isMagentaDominantPixel,
  isOpaqueMagentaFringePixel,
  isPurpleFringePixel,
  measureAlphaFringe,
  measureMagentaFringe,
  nonMagentaReplacementColorNear,
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

test("magenta fringe detectors distinguish matte residue from opaque subject color", () => {
  assert.equal(isPurpleFringePixel(150, 40, 180, 128), true);
  assert.equal(isPurpleFringePixel(150, 40, 180, 255), false);
  assert.equal(isMagentaDominantPixel(220, 25, 210, 255), true);
  assert.equal(isMagentaDominantPixel(150, 70, 180, 255), true);
  assert.equal(isMagentaDominantPixel(250, 20, 90, 255), true);
  assert.equal(isMagentaDominantPixel(90, 20, 250, 255), true);
  assert.equal(isMagentaDominantPixel(205, 35, 28, 255), false);
  assert.equal(isOpaqueMagentaFringePixel(127, 0, 110, 255), true);
  assert.equal(isOpaqueMagentaFringePixel(250, 20, 90, 255), true);
  assert.equal(isOpaqueMagentaFringePixel(90, 20, 250, 255), true);
  assert.equal(isOpaqueMagentaFringePixel(80, 10, 45, 255), true);
  assert.equal(isOpaqueMagentaFringePixel(80, 10, 44, 255), false);
  assert.equal(isOpaqueMagentaFringePixel(159, 75, 138, 255), false);
});

test("measureMagentaFringe counts purple alpha and opaque magenta edge residue", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [150, 40, 180, 128],
    [220, 25, 210, 255],
    [0, 0, 0, 0],
    [205, 35, 28, 255],
    [235, 220, 190, 255],
  ]);

  assert.deepEqual(measureMagentaFringe(data, 3, 3), {
    purpleAlphaPixels: 1,
    opaqueMagentaEdgePixels: 1,
    total: 2,
  });
});

test("cleanMagentaFringe remats purple alpha and opaque magenta edges without changing alpha", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [150, 40, 180, 128],
    [220, 25, 210, 255],
    [0, 0, 0, 0],
    [205, 35, 28, 255],
    [235, 220, 190, 255],
  ]);

  assert.deepEqual(nonMagentaReplacementColorNear(data, 3, 3, 2, 1), [220, 128, 109]);
  assert.deepEqual(cleanMagentaFringe(data, 3, 3), {
    changedPixels: 2,
    remattedPixels: 2,
  });
  assert.deepEqual(Array.from(data.subarray((1 * 3 + 1) * 4, (1 * 3 + 1) * 4 + 4)), [220, 128, 109, 128]);
  assert.deepEqual(Array.from(data.subarray((1 * 3 + 2) * 4, (1 * 3 + 2) * 4 + 4)), [220, 128, 109, 255]);
  assert.equal(measureMagentaFringe(data, 3, 3).total, 0);

  const once = Buffer.from(data);
  assert.deepEqual(cleanMagentaFringe(data, 3, 3), {
    changedPixels: 0,
    remattedPixels: 0,
  });
  assert.deepEqual(data, once);
});

test("nonMagentaReplacementColorNear rejects a magenta average and falls back to subject color", () => {
  const data = image(
    5,
    5,
    Array.from({ length: 25 }, () => [0, 0, 0, 0]),
  );
  const set = (x: number, y: number, rgba: [number, number, number, number]) => {
    data.set(rgba, (y * 5 + x) * 4);
  };
  set(1, 2, [205, 35, 28, 255]);
  set(3, 2, [28, 35, 205, 255]);
  set(2, 0, [235, 220, 190, 255]);

  assert.deepEqual(nonMagentaReplacementColorNear(data, 5, 5, 2, 2), [205, 35, 28]);
});

test("nonMagentaReplacementColorNear falls back to the closest subject color when averages stay magenta", () => {
  const data = image(3, 3, [
    [0, 0, 0, 0],
    [205, 35, 28, 255],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [127, 0, 107, 255],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [28, 35, 205, 255],
    [0, 0, 0, 0],
  ]);

  assert.deepEqual(nonMagentaReplacementColorNear(data, 3, 3, 1, 1), [205, 35, 28]);
});

test("countRgbaRectMismatches compares authored pixels with an atlas rectangle", () => {
  const source = image(2, 1, [
    [205, 35, 28, 255],
    [235, 220, 190, 255],
  ]);
  const atlas = image(4, 2, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [205, 35, 28, 255],
    [235, 220, 190, 255],
    [0, 0, 0, 0],
  ]);

  assert.equal(countRgbaRectMismatches(source, 2, 1, atlas, 4, 1, 1), 0);
  atlas[(1 * 4 + 2) * 4] = 0;
  assert.equal(countRgbaRectMismatches(source, 2, 1, atlas, 4, 1, 1), 1);
});

test("copyRgbaFrameWithExtrudedPadding rebuilds an atlas rect and its gutter", () => {
  const source = image(2, 1, [
    [205, 35, 28, 255],
    [235, 220, 190, 255],
  ]);
  const atlas = image(
    6,
    3,
    Array.from({ length: 18 }, () => [0, 0, 0, 0]),
  );

  copyRgbaFrameWithExtrudedPadding(source, 2, 1, atlas, 6, 3, 2, 1, 1);

  assert.deepEqual(Array.from(atlas.subarray((1 * 6 + 2) * 4, (1 * 6 + 4) * 4)), Array.from(source));
  assert.deepEqual(Array.from(atlas.subarray((1 * 6 + 1) * 4, (1 * 6 + 2) * 4)), [205, 35, 28, 255]);
  assert.deepEqual(Array.from(atlas.subarray((1 * 6 + 4) * 4, (1 * 6 + 5) * 4)), [235, 220, 190, 255]);
  assert.deepEqual(Array.from(atlas.subarray((0 * 6 + 2) * 4, (0 * 6 + 4) * 4)), Array.from(source));
  assert.deepEqual(Array.from(atlas.subarray((2 * 6 + 2) * 4, (2 * 6 + 4) * 4)), Array.from(source));
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
