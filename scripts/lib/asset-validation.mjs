import { createHash } from "node:crypto";

const RUNTIME_RASTER_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);

export function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function hasMultipleUniqueFrames(frameHashes) {
  return new Set(frameHashes).size > 1;
}

export function isAppSourceRuntimeRasterPath(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/");
  const extension = normalized.split(".").pop()?.toLowerCase() ?? "";
  return /^apps\/(?:[^/]+\/)+src\//.test(normalized) && RUNTIME_RASTER_EXTENSIONS.has(extension);
}

export function animationPlaceholderReason(entity, action) {
  if (action?.placeholder === true) {
    return typeof action.placeholderReason === "string" && action.placeholderReason.trim()
      ? action.placeholderReason.trim()
      : null;
  }
  if (entity?.placeholder === true) {
    return typeof entity.placeholderReason === "string" && entity.placeholderReason.trim()
      ? entity.placeholderReason.trim()
      : null;
  }
  return null;
}

export function pathGroupKey(paths) {
  return [...new Set(paths)].sort().join("\n");
}

export function duplicatePathGroups(records) {
  const pathsByHash = new Map();
  for (const { hash, path } of records) {
    const paths = pathsByHash.get(hash) ?? [];
    paths.push(path);
    pathsByHash.set(hash, paths);
  }

  return [...pathsByHash.values()]
    .filter((paths) => paths.length > 1)
    .map((paths) => [...paths].sort())
    .sort((left, right) => pathGroupKey(left).localeCompare(pathGroupKey(right)));
}
