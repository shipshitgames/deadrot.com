// Pure alpha-edge helpers for deterministic asset QA scripts.

export const DEFAULT_DARK_FRINGE = {
  alphaMin: 1,
  alphaMax: 249,
  darkLumaMax: 75,
  subjectLumaMin: 90,
  maxRadius: 8,
};

export function pixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

export function luma(r, g, b) {
  return (r + g + b) / 3;
}

export function hasTransparentNeighbor(data, width, height, x, y) {
  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
      if (xx === x && yy === y) continue;
      if (data[pixelOffset(width, xx, yy) + 3] === 0) return true;
    }
  }
  return false;
}

export function isDarkFringePixel(r, g, b, a, opts = {}) {
  const cfg = { ...DEFAULT_DARK_FRINGE, ...opts };
  if (a < cfg.alphaMin || a > cfg.alphaMax) return false;
  if (luma(r, g, b) > cfg.darkLumaMax) return false;
  if (r >= 55 && r > g * 1.25 && r > b * 1.25) return false;
  if (g >= 75 && g > r * 1.15 && g > b * 1.15) return false;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread <= 35;
}

export function isSubjectReplacementPixel(r, g, b, a, opts = {}) {
  const cfg = { ...DEFAULT_DARK_FRINGE, ...opts };
  if (a < 250) return false;
  if (luma(r, g, b) >= cfg.subjectLumaMin) return true;
  const redDominant = r >= 100 && r > g * 1.35 && r > b * 1.2;
  const greenDominant = g >= 95 && g > r * 1.15 && g > b * 1.15;
  return redDominant || greenDominant;
}

export function replacementColorNear(data, width, height, x, y, opts = {}) {
  const cfg = { ...DEFAULT_DARK_FRINGE, ...opts };
  for (let radius = 1; radius <= cfg.maxRadius; radius += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
        if (xx === x && yy === y) continue;
        const offset = pixelOffset(width, xx, yy);
        const pr = data[offset];
        const pg = data[offset + 1];
        const pb = data[offset + 2];
        const pa = data[offset + 3];
        if (!isSubjectReplacementPixel(pr, pg, pb, pa, cfg)) continue;
        r += pr;
        g += pg;
        b += pb;
        count += 1;
      }
    }

    if (count > 0) {
      return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    }
  }
  return null;
}

export function measureAlphaFringe(data, width, height, opts = {}) {
  let darkFringePixels = 0;
  let semiTransparentPixels = 0;
  let borderPixels = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset(width, x, y);
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && a > 0) {
        borderPixels += 1;
      }
      if (a <= 0 || a >= 250) continue;
      semiTransparentPixels += 1;
      if (isDarkFringePixel(r, g, b, a, opts) && hasTransparentNeighbor(data, width, height, x, y)) {
        darkFringePixels += 1;
      }
    }
  }

  const margins =
    minX === Infinity
      ? null
      : {
          left: minX,
          top: minY,
          right: width - 1 - maxX,
          bottom: height - 1 - maxY,
        };

  return { darkFringePixels, semiTransparentPixels, borderPixels, margins };
}

export function rematteDarkFringe(data, width, height, opts = {}) {
  let changedPixels = 0;
  let remattedPixels = 0;
  let clearedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset(width, x, y);
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (!isDarkFringePixel(r, g, b, a, opts) || !hasTransparentNeighbor(data, width, height, x, y)) {
        continue;
      }

      const replacement = replacementColorNear(data, width, height, x, y, opts);
      if (replacement) {
        data[offset] = replacement[0];
        data[offset + 1] = replacement[1];
        data[offset + 2] = replacement[2];
        remattedPixels += 1;
      } else {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
        clearedPixels += 1;
      }
      changedPixels += 1;
    }
  }

  return { changedPixels, remattedPixels, clearedPixels };
}

export function webpEncodingKind(buf) {
  if (buf.length < 16) return "unknown";
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return "unknown";

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const fourcc = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (fourcc === "VP8L") return "lossless";
    if (fourcc === "VP8 ") return "lossy";
    offset += 8 + size + (size % 2);
  }
  return "unknown";
}
