const DEFAULT_ALPHA_THRESHOLD = 16;

export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

export function hasTransparentNeighbor(data, width, height, x, y, alphaThreshold = DEFAULT_ALPHA_THRESHOLD) {
  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
      if (xx === x && yy === y) continue;
      if (data[pixelOffset(width, xx, yy) + 3] < alphaThreshold) return true;
    }
  }
  return false;
}

export function nearestForegroundColor(data, width, height, x, y, options = {}) {
  const maxRadius = options.maxRadius ?? 8;
  const minAlpha = options.minAlpha ?? 180;
  const minLuma = options.minLuma ?? 30;

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
        if (xx === x && yy === y) continue;
        const offset = pixelOffset(width, xx, yy);
        if (data[offset + 3] < minAlpha) continue;
        if (luma(data[offset], data[offset + 1], data[offset + 2]) < minLuma) continue;
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count += 1;
      }
    }

    if (count > 0) {
      return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    }
  }

  return null;
}

export function rematteDarkEdgePixels(data, width, height, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const includeOpaque = options.includeOpaque ?? false;
  const minLumaDelta = options.minLumaDelta ?? 18;
  const source = Buffer.from(data);
  let changed = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset(width, x, y);
      const alpha = source[offset + 3];
      if (alpha < alphaThreshold) continue;
      if (!includeOpaque && alpha >= 250) continue;
      if (!hasTransparentNeighbor(source, width, height, x, y, alphaThreshold)) continue;

      const replacement = nearestForegroundColor(source, width, height, x, y, options);
      if (!replacement) continue;

      const currentLuma = luma(source[offset], source[offset + 1], source[offset + 2]);
      const replacementLuma = luma(replacement[0], replacement[1], replacement[2]);
      if (replacementLuma - currentLuma < minLumaDelta) continue;

      data[offset] = replacement[0];
      data[offset + 1] = replacement[1];
      data[offset + 2] = replacement[2];
      changed += 1;
    }
  }

  return changed;
}

export function opaqueBounds(data, width, height, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[pixelOffset(width, x, y) + 3] < alphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pixels += 1;
    }
  }

  if (pixels === 0) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    pixels,
    margin: {
      left: minX,
      top: minY,
      right: width - 1 - maxX,
      bottom: height - 1 - maxY,
    },
  };
}

export function countBorderOpaquePixels(data, width, height, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      if (data[pixelOffset(width, x, y) + 3] >= alphaThreshold) count += 1;
    }
  }

  return count;
}

export function edgeQualityMetrics(data, width, height, options = {}) {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  let edgePixels = 0;
  let edgeLuma = 0;
  let innerPixels = 0;
  let innerLuma = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = pixelOffset(width, x, y);
      const alpha = data[offset + 3];
      if (alpha < alphaThreshold) continue;
      const value = luma(data[offset], data[offset + 1], data[offset + 2]);
      if (hasTransparentNeighbor(data, width, height, x, y, alphaThreshold)) {
        edgePixels += 1;
        edgeLuma += value;
      } else if (alpha > 220) {
        innerPixels += 1;
        innerLuma += value;
      }
    }
  }

  const averageEdgeLuma = edgeLuma / Math.max(1, edgePixels);
  const averageInnerLuma = innerLuma / Math.max(1, innerPixels);
  return {
    edgePixels,
    averageEdgeLuma,
    innerPixels,
    averageInnerLuma,
    fringe: averageInnerLuma - averageEdgeLuma,
  };
}

export function padHorizontalTierSheet(data, width, height, options) {
  const columns = options.columns;
  if (!Number.isInteger(columns) || columns <= 0) {
    throw new Error("padHorizontalTierSheet requires a positive integer column count");
  }

  const padding = {
    bottom: options.padding?.bottom ?? 0,
    left: options.padding?.left ?? 0,
    right: options.padding?.right ?? 0,
    top: options.padding?.top ?? 0,
  };

  const targetCellWidth = options.targetCellWidth ?? Math.ceil(width / columns) + padding.left + padding.right;
  const targetWidth = targetCellWidth * columns;
  const targetHeight = options.targetHeight ?? height + padding.top + padding.bottom;
  const out = Buffer.alloc(targetWidth * targetHeight * 4);

  for (let column = 0; column < columns; column += 1) {
    const sourceLeft = Math.round((column * width) / columns);
    const sourceRight = Math.round(((column + 1) * width) / columns);
    const sourceCellWidth = sourceRight - sourceLeft;
    const targetLeft = column * targetCellWidth + padding.left;

    if (targetLeft + sourceCellWidth > (column + 1) * targetCellWidth) {
      throw new Error(`target cell width ${targetCellWidth} is too small for source cell ${sourceCellWidth}`);
    }
    if (padding.top + height > targetHeight) {
      throw new Error(`target height ${targetHeight} is too small for source height ${height}`);
    }

    for (let y = 0; y < height; y += 1) {
      const sourceStart = pixelOffset(width, sourceLeft, y);
      const sourceEnd = sourceStart + sourceCellWidth * 4;
      const targetStart = pixelOffset(targetWidth, targetLeft, padding.top + y);
      data.copy(out, targetStart, sourceStart, sourceEnd);
    }
  }

  return {
    data: out,
    width: targetWidth,
    height: targetHeight,
    targetCellWidth,
  };
}
