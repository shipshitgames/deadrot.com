// asset-index-core — pure classification + addressing helpers for the canonical
// asset index (deadrot.com#343).
//
// These are deliberately side-effect free (no fs, no process) so both the
// generator (generate-asset-index.mjs) and the unit tests can share one source
// of truth for: which files belong in the index, how a path becomes a stable
// id, what kind/media-type/game an asset is, and how a local path maps to a CDN
// address.

import { extname, isSourceTree, pathSegments } from "./asset-format-policy.mjs";

/** Format version of the generated `assets.index.json` document. */
export const INDEX_VERSION = "1";

/**
 * Default CDN origin baked into the committed index. Runtime consumers override
 * it with the `ASSET_BASE_URL` env var or an explicit `baseUrl`. It is a
 * constant (not env-derived) so the committed manifest stays deterministic and
 * the CI drift check is reproducible.
 */
export const DEFAULT_CDN_BASE = "https://assets.deadrot.com";

/**
 * Package-relative roots the index covers. These are the shipped runtime media
 * trees of `packages/assets`; source/master trees inside them are excluded via
 * {@link isSourceTree}. `packages/assets/sites/**` is intentionally absent: the
 * `assets:check` boundary gate forbids tracking a site mirror in this package.
 */
export const INDEXED_ROOTS = ["entities", "games", "shared", "brand", "universe", "concepts", "tokens"];

/** Media extension → semantic kind. webm/mp4 are refined by path (see kindFor). */
const KIND_BY_EXT = {
  ".webp": "image",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".avif": "image",
  ".svg": "vector",
  ".webm": "video",
  ".mp4": "video",
  ".mov": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".m4a": "audio",
  ".flac": "audio",
  ".woff2": "font",
  ".woff": "font",
  ".ttf": "font",
  ".otf": "font",
};

/** Media extension → IANA media (MIME) type. */
const MIME_BY_EXT = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/** Every extension the index admits. */
export const MEDIA_EXTENSIONS = Object.keys(KIND_BY_EXT);

/** Normalize OS path separators to POSIX for stable, cross-platform ids/paths. */
export function toPosix(p) {
  return String(p).replace(/\\/g, "/");
}

/**
 * Whether a package-relative path is an indexable shipped media file: under an
 * indexed root, not inside a source/master tree, and a known media extension.
 */
export function isIndexableMedia(relPath) {
  const p = toPosix(relPath);
  if (isSourceTree(p)) return false;
  const ext = extname(p);
  if (!Object.hasOwn(KIND_BY_EXT, ext)) return false;
  const root = pathSegments(p)[0];
  return INDEXED_ROOTS.includes(root);
}

/** IANA media type for a path, or `null` when not an indexed media extension. */
export function mediaTypeFor(relPath) {
  return MIME_BY_EXT[extname(toPosix(relPath))] ?? null;
}

/**
 * Semantic kind for a path. webm/mp4 carry audio in this repo's `audio/`
 * trees (music + sfx in a webm container), so they resolve to `audio` there and
 * `video` elsewhere — mediaType stays the honest container MIME.
 */
export function kindFor(relPath) {
  const p = toPosix(relPath);
  const ext = extname(p);
  const base = KIND_BY_EXT[ext] ?? null;
  if (base === "video" && pathSegments(p).includes("audio")) return "audio";
  return base;
}

/** Game slug if the path lives under `games/<slug>/…`, else `null`. */
export function gameFor(relPath) {
  const seg = pathSegments(toPosix(relPath));
  return seg[0] === "games" && seg.length > 1 ? seg[1] : null;
}

/**
 * Stable id for an asset: its POSIX package-relative path with the media
 * extension stripped (e.g. `games/redline/ui/menu/title`). Ids are unique
 * because the asset-format policy forbids same-name format twins in runtime
 * trees; {@link buildIndex} still hard-fails on any collision.
 */
export function idFor(relPath) {
  const p = toPosix(relPath);
  const ext = extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

/** CDN-relative path for an asset (currently identical to the local path). */
export function cdnPathFor(relPath) {
  return toPosix(relPath);
}

/**
 * Compose an absolute CDN URL from a base origin and a cdn-relative path,
 * tolerating a trailing slash on the base and a leading slash on the path.
 */
export function joinCdnUrl(base, cdnPath) {
  return `${String(base).replace(/\/+$/, "")}/${toPosix(cdnPath).replace(/^\/+/, "")}`;
}

/** Codepoint-stable path comparison for deterministic, locale-independent order. */
export function compareByPath(a, b) {
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
}
