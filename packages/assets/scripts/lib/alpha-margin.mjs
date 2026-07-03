// Helpers for transparent runtime sprites represented as RGBA byte buffers.
// Kept dependency-free so tests can cover the crop/margin math without image
// tooling such as dwebp/cwebp.

function assertRgbaBuffer(data, width, height) {
  if (!Number.isInteger(width) || width <= 0) throw new Error(`invalid width: ${width}`);
  if (!Number.isInteger(height) || height <= 0) throw new Error(`invalid height: ${height}`);
  if (!data || data.length !== width * height * 4) {
    throw new Error(`expected RGBA buffer length ${width * height * 4}, got ${data?.length ?? 0}`);
  }
}

export function alphaBounds(data, width, height, alphaThreshold = 0) {
  assertRgbaBuffer(data, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= alphaThreshold) continue;
      pixels += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  return pixels === 0 ? null : { minX, minY, maxX, maxY, pixels };
}

export function alphaMargins(bounds, width, height) {
  if (!bounds) return null;
  return {
    left: bounds.minX,
    top: bounds.minY,
    right: width - 1 - bounds.maxX,
    bottom: height - 1 - bounds.maxY,
  };
}

export function edgeAlphaCount(data, width, height, alphaThreshold = 0) {
  assertRgbaBuffer(data, width, height);

  let pixels = 0;
  for (let x = 0; x < width; x += 1) {
    if (data[x * 4 + 3] > alphaThreshold) pixels += 1;
    if (data[((height - 1) * width + x) * 4 + 3] > alphaThreshold) pixels += 1;
  }
  for (let y = 1; y < height - 1; y += 1) {
    if (data[y * width * 4 + 3] > alphaThreshold) pixels += 1;
    if (data[(y * width + width - 1) * 4 + 3] > alphaThreshold) pixels += 1;
  }
  return pixels;
}

export function cropForBounds(bounds, sourceWidth, sourceHeight, padding) {
  if (!bounds) throw new Error("cannot crop empty alpha bounds");
  if (!Number.isInteger(padding) || padding < 0) throw new Error(`invalid padding: ${padding}`);

  const x = Math.max(0, bounds.minX - padding);
  const y = Math.max(0, bounds.minY - padding);
  const maxX = Math.min(sourceWidth - 1, bounds.maxX + padding);
  const maxY = Math.min(sourceHeight - 1, bounds.maxY + padding);

  return {
    x,
    y,
    width: maxX - x + 1,
    height: maxY - y + 1,
  };
}

export function copyRgbaCrop(data, sourceWidth, crop) {
  if (!Number.isInteger(sourceWidth) || sourceWidth <= 0) throw new Error(`invalid source width: ${sourceWidth}`);
  if (!Number.isInteger(crop.width) || crop.width <= 0) throw new Error(`invalid crop width: ${crop.width}`);
  if (!Number.isInteger(crop.height) || crop.height <= 0) throw new Error(`invalid crop height: ${crop.height}`);

  const out = Buffer.alloc(crop.width * crop.height * 4);
  for (let row = 0; row < crop.height; row += 1) {
    const sourceStart = ((crop.y + row) * sourceWidth + crop.x) * 4;
    const sourceEnd = sourceStart + crop.width * 4;
    const destStart = row * crop.width * 4;
    data.copy(out, destStart, sourceStart, sourceEnd);
  }
  return out;
}
