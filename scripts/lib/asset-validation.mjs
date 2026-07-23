import { createHash } from "node:crypto";

const RUNTIME_RASTER_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const RUNTIME_ASSET_ROOTS = new Set(["brand", "concepts", "entities", "games", "lore", "models", "shared", "universe"]);
const NON_RUNTIME_MANIFEST_SEGMENTS = new Set([
  "_archive",
  "archive",
  "archives",
  "cache",
  "caches",
  "draft",
  "drafts",
  "master",
  "masters",
  "provenance",
  "source",
  "sources",
  "temp",
  "temporary",
  "tmp",
]);
const TEMPORARY_CUSTODY_SEGMENTS = new Set(["cache", "caches", "draft", "drafts", "temp", "temporary", "tmp"]);
const BANNED_GENERATOR_PATTERN = /\b(?:grok|x[\s._-]?ai)\b/i;

export const ASSET_CUSTODY = Object.freeze({
  GENERATED_HISTORY: "generated-history",
  MASTER: "master",
  OTHER: "other",
  QUARANTINE: "quarantine",
  RUNTIME: "runtime",
  TEMPORARY: "temporary",
});

function assetPathSegments(filePath) {
  const segments = String(filePath)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  if (segments[0] === "packages" && segments[1] === "assets") return segments.slice(2);
  return segments;
}

/**
 * Classify a package path by the custody decision documented in
 * packages/assets/docs/generated-asset-custody-policy.md.
 */
export function assetCustodyForPath(filePath) {
  const segments = assetPathSegments(filePath);
  if (segments[0] === "sources" && segments[1] === "generated") return ASSET_CUSTODY.GENERATED_HISTORY;
  if (segments[0] === "masters" || segments.includes("master") || segments.includes("masters")) {
    return ASSET_CUSTODY.MASTER;
  }
  if (segments.includes("_archive") || segments.includes("archive") || segments.includes("archives")) {
    return ASSET_CUSTODY.QUARANTINE;
  }
  if (segments.some((segment) => TEMPORARY_CUSTODY_SEGMENTS.has(segment))) return ASSET_CUSTODY.TEMPORARY;
  if (RUNTIME_ASSET_ROOTS.has(segments[0])) return ASSET_CUSTODY.RUNTIME;
  return ASSET_CUSTODY.OTHER;
}

/**
 * Return a reason when a promoted manifest path crosses into non-runtime
 * custody. Manifests may only address package-relative runtime paths.
 */
export function manifestPathCustodyViolation(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/");
  const segments = assetPathSegments(normalized);
  if (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) ||
    segments.includes("..")
  ) {
    return "must be a package-relative path without traversal";
  }

  const forbidden = segments.find((segment) => NON_RUNTIME_MANIFEST_SEGMENTS.has(segment));
  if (forbidden) return `enters non-runtime asset custody at "${forbidden}"`;
  return null;
}

/** Collect every nested `path` field with a stable JSON-pointer-like location. */
export function collectManifestPathFields(value, pointer = "$", out = []) {
  if (!value || typeof value !== "object") return out;

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      collectManifestPathFields(child, `${pointer}[${index}]`, out);
    });
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}.${key}`;
    if (key === "path" && typeof child === "string") out.push({ path: child, pointer: childPointer });
    if (child && typeof child === "object") collectManifestPathFields(child, childPointer, out);
  }
  return out;
}

/** Locate banned generator names anywhere in a promoted manifest. */
export function findBannedGeneratorReferences(value, pointer = "$", out = []) {
  if (typeof value === "string") {
    if (BANNED_GENERATOR_PATTERN.test(value)) out.push(pointer);
    return out;
  }
  if (!value || typeof value !== "object") return out;

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      findBannedGeneratorReferences(child, `${pointer}[${index}]`, out);
    });
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    findBannedGeneratorReferences(child, `${pointer}.${key}`, out);
  }
  return out;
}

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
