import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alphaBounds,
  alphaMargins,
  copyRgbaCrop,
  cropForBounds,
  edgeAlphaCount,
} from "../scripts/lib/alpha-margin.mjs";

function rgba(width: number, height: number, opaquePixels: Array<[number, number]>): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (const [x, y] of opaquePixels) {
    const offset = (y * width + x) * 4;
    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }
  return data;
}

test("alphaBounds and alphaMargins report the visible subject box", () => {
  const data = rgba(6, 5, [
    [2, 1],
    [4, 1],
    [3, 3],
  ]);

  const bounds = alphaBounds(data, 6, 5);
  assert.deepEqual(bounds, { minX: 2, minY: 1, maxX: 4, maxY: 3, pixels: 3 });
  assert.deepEqual(alphaMargins(bounds, 6, 5), { left: 2, top: 1, right: 1, bottom: 1 });
});

test("edgeAlphaCount catches opaque pixels touching the canvas border", () => {
  const data = rgba(4, 4, [
    [0, 0],
    [3, 1],
    [2, 2],
    [1, 3],
  ]);

  assert.equal(edgeAlphaCount(data, 4, 4), 3);
});

test("cropForBounds pads and clamps to the source canvas", () => {
  const crop = cropForBounds({ minX: 1, minY: 2, maxX: 5, maxY: 6 }, 8, 8, 3);

  assert.deepEqual(crop, { x: 0, y: 0, width: 8, height: 8 });
});

test("copyRgbaCrop extracts the requested rows and columns", () => {
  const data = rgba(5, 4, [
    [1, 1],
    [3, 2],
  ]);
  const cropped = copyRgbaCrop(data, 5, { x: 1, y: 1, width: 3, height: 2 });

  assert.deepEqual(alphaBounds(cropped, 3, 2), { minX: 0, minY: 0, maxX: 2, maxY: 1, pixels: 2 });
});
