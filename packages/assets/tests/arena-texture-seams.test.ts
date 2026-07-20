import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  ARENA_TEXTURE_MAPS,
  ARENA_TEXTURE_ROLES,
  ARENA_TEXTURE_SIZE,
  renderArenaTexture,
} from "../sources/generated/2026-07-16/scourge-survivors/arena-surfaces/generate-arena-textures.ts";

function pixelDelta(pixels: Uint8Array, a: number, b: number) {
  return (
    (Math.abs(pixels[a] - pixels[b]) +
      Math.abs(pixels[a + 1] - pixels[b + 1]) +
      Math.abs(pixels[a + 2] - pixels[b + 2])) /
    3
  );
}

function seamRatios(pixels: Uint8Array) {
  let internalX = 0;
  let internalY = 0;
  let seamX = 0;
  let seamY = 0;
  let internalCount = 0;

  for (let y = 0; y < ARENA_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < ARENA_TEXTURE_SIZE; x += 1) {
      const current = (y * ARENA_TEXTURE_SIZE + x) * 3;
      if (x < ARENA_TEXTURE_SIZE - 1) {
        internalX += pixelDelta(pixels, current, current + 3);
        internalCount += 1;
      }
      if (y < ARENA_TEXTURE_SIZE - 1) {
        internalY += pixelDelta(pixels, current, current + ARENA_TEXTURE_SIZE * 3);
      }
    }
    seamX += pixelDelta(pixels, (y * ARENA_TEXTURE_SIZE + ARENA_TEXTURE_SIZE - 1) * 3, y * ARENA_TEXTURE_SIZE * 3);
  }

  for (let x = 0; x < ARENA_TEXTURE_SIZE; x += 1) {
    seamY += pixelDelta(pixels, ((ARENA_TEXTURE_SIZE - 1) * ARENA_TEXTURE_SIZE + x) * 3, x * 3);
  }

  return {
    x: seamX / ARENA_TEXTURE_SIZE / Math.max(internalX / internalCount, 0.01),
    y: seamY / ARENA_TEXTURE_SIZE / Math.max(internalY / internalCount, 0.01),
  };
}

test("every campaign arena surface avoids anomalous wrap-edge deltas", { timeout: 30_000 }, () => {
  const renderHash = createHash("sha256");

  for (const mapId of ARENA_TEXTURE_MAPS) {
    for (const role of ARENA_TEXTURE_ROLES) {
      const pixels = renderArenaTexture(mapId, role);
      const ratios = seamRatios(pixels);
      assert.ok(ratios.x < 2, `${mapId} ${role} horizontal seam ratio ${ratios.x.toFixed(2)}`);
      assert.ok(ratios.y < 2, `${mapId} ${role} vertical seam ratio ${ratios.y.toFixed(2)}`);
      renderHash.update(`${mapId}/${role}\0`);
      renderHash.update(pixels);
    }
  }

  assert.equal(renderHash.digest("hex"), "5722db9cd27eddee99a0e88175d4255f5b2e238f110dc6cd621322386f851f5d");
});
