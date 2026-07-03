import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countBorderOpaquePixels,
  edgeQualityMetrics,
  opaqueBounds,
  padHorizontalTierSheet,
  rematteDarkEdgePixels,
} from "../scripts/lib/edge-quality.mjs";

function rgba(width: number, height: number, pixels: number[][]): Buffer {
  const out = Buffer.alloc(width * height * 4);
  pixels.forEach(([x, y, r, g, b, a]) => {
    const offset = (y * width + x) * 4;
    out[offset] = r;
    out[offset + 1] = g;
    out[offset + 2] = b;
    out[offset + 3] = a;
  });
  return out;
}

function pixel(data: Buffer, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

test("rematteDarkEdgePixels replaces dark semi-transparent edge RGB from nearby foreground", () => {
  const data = rgba(5, 5, [
    [1, 2, 0, 0, 0, 128],
    [2, 2, 210, 170, 120, 255],
    [3, 2, 220, 180, 130, 255],
  ]);

  const before = edgeQualityMetrics(data, 5, 5);
  const changed = rematteDarkEdgePixels(data, 5, 5, { minLumaDelta: 20 });
  const after = edgeQualityMetrics(data, 5, 5);

  assert.equal(changed, 1);
  assert.deepEqual(pixel(data, 5, 1, 2).slice(3), [128]);
  assert.ok(pixel(data, 5, 1, 2)[0] > 200);
  assert.ok(after.fringe < before.fringe);
});

test("rematteDarkEdgePixels preserves opaque black contour pixels by default", () => {
  const data = rgba(5, 5, [
    [1, 2, 0, 0, 0, 255],
    [2, 2, 220, 180, 130, 255],
    [3, 2, 220, 180, 130, 255],
  ]);

  const changed = rematteDarkEdgePixels(data, 5, 5, { minLumaDelta: 20 });

  assert.equal(changed, 0);
  assert.deepEqual(pixel(data, 5, 1, 2), [0, 0, 0, 255]);
});

test("rematteDarkEdgePixels can include opaque FX edge pixels when requested", () => {
  const data = rgba(5, 5, [
    [1, 2, 8, 5, 0, 255],
    [2, 2, 255, 130, 20, 255],
    [3, 2, 255, 130, 20, 255],
  ]);

  const changed = rematteDarkEdgePixels(data, 5, 5, {
    includeOpaque: true,
    minLuma: 40,
    minLumaDelta: 10,
  });

  assert.equal(changed, 1);
  assert.ok(pixel(data, 5, 1, 2)[0] > 200);
  assert.equal(pixel(data, 5, 1, 2)[3], 255);
});

test("padHorizontalTierSheet pads every tier cell without leaking opaque border pixels", () => {
  const data = rgba(6, 2, [
    [0, 0, 10, 0, 0, 255],
    [1, 0, 20, 0, 0, 255],
    [2, 0, 30, 0, 0, 255],
    [3, 0, 40, 0, 0, 255],
    [4, 0, 50, 0, 0, 255],
    [5, 0, 60, 0, 0, 255],
  ]);

  const padded = padHorizontalTierSheet(data, 6, 2, {
    columns: 3,
    padding: { bottom: 1, left: 1, right: 1, top: 1 },
  });

  assert.equal(padded.width, 12);
  assert.equal(padded.height, 4);
  assert.equal(countBorderOpaquePixels(padded.data, padded.width, padded.height), 0);
  assert.deepEqual(opaqueBounds(padded.data, padded.width, padded.height)?.margin, {
    bottom: 2,
    left: 1,
    right: 1,
    top: 1,
  });
  assert.deepEqual(pixel(padded.data, padded.width, 1, 1), [10, 0, 0, 255]);
  assert.deepEqual(pixel(padded.data, padded.width, 6, 1), [40, 0, 0, 255]);
});
