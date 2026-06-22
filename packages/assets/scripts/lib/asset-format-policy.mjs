// Shared runtime asset-format policy — pure, I/O-free logic (deadrot.com#118).
//
// One place encodes "what format is a runtime raster allowed to be?" so the
// validator (scripts/check-asset-formats.mjs) and the conversion CLI
// (scripts/to-webp.mjs) agree, and so the rules are unit-testable without
// touching the filesystem.
//
// Policy, in one breath:
//   - Runtime-loaded raster (sprites, UI, textures) ships as WebP.
//   - PNG / JPEG are source/master/provenance formats; they stay in clearly
//     named source trees and never get imported into the runtime bundle.
//   - The lone exception is the Open Graph social card (ui/social/*.jpg), which
//     stays JPEG because crawlers prefer it.
//   - Pixel art and tiny crisp UI sprites convert with lossless WebP.
//
// Docs: packages/assets/docs/asset-format-policy.md

/** Runtime delivery roots within packages/assets (promoted assets live here). */
export const RUNTIME_ROOTS = ["games", "entities", "shared", "brand", "universe", "concepts", "lore"];

/** Raster extensions that must be promoted to WebP for runtime delivery. */
export const RUNTIME_RASTER_EXTENSIONS = [".png", ".jpg", ".jpeg"];

/** The promoted runtime raster format. */
export const RUNTIME_RASTER_FORMAT = ".webp";

/**
 * Lowercased path segments that mark a source / master / provenance tree. PNG
 * (and other source raster) is allowed to live under any of these.
 */
export const SOURCE_SEGMENTS = ["sources", "source", "drafts", "draft", "_archive", "provenance", "masters", "master"];

/** Segment under a game pack where Open Graph cards live; JPEG is allowed there. */
export const SOCIAL_SEGMENT = "social";

/** Normalize to forward slashes and split into non-empty lowercased segments. */
export function pathSegments(p) {
  return String(p)
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

/** Lowercased file extension including the leading dot ("" when none). */
export function extname(p) {
  const base =
    String(p)
      .split(/[\\/]+/)
      .pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/** True when the path lives inside a source/master/provenance tree. */
export function isSourceTree(p) {
  const segs = pathSegments(p);
  return segs.some((s) => SOURCE_SEGMENTS.includes(s));
}

/** True for the Open Graph social card slot (ui/social/...), which stays JPEG. */
export function isSocialCard(p) {
  return pathSegments(p).includes(SOCIAL_SEGMENT);
}

/** True when the extension is a source raster format (png/jpg/jpeg). */
export function isRuntimeRaster(p) {
  return RUNTIME_RASTER_EXTENSIONS.includes(extname(p));
}

/**
 * Is a manifest-referenced runtime path an allowed format?
 *   - non-raster (audio, font, webp, ...) → allowed
 *   - .jpg/.jpeg under a social/ slot → allowed (OG cards)
 *   - .png anywhere, or .jpg/.jpeg outside social → violation
 */
export function isAllowedRuntimeRasterPath(p) {
  const ext = extname(p);
  if (!RUNTIME_RASTER_EXTENSIONS.includes(ext)) return true;
  if ((ext === ".jpg" || ext === ".jpeg") && isSocialCard(p)) return true;
  return false;
}

/** Human-readable reason a runtime raster path violates the policy, or null. */
export function rasterViolationReason(p) {
  if (isAllowedRuntimeRasterPath(p)) return null;
  const ext = extname(p);
  if (ext === ".png") {
    return "PNG is a source/master format — promote runtime raster to WebP (.webp)";
  }
  return "JPEG is only allowed for social OG cards (ui/social/*.jpg) — use WebP for runtime raster";
}

/** Destination path for converting a source raster to its runtime WebP twin. */
export function webpDestFor(p) {
  const ext = extname(p);
  if (!ext) return `${p}${RUNTIME_RASTER_FORMAT}`;
  return `${String(p).slice(0, -ext.length)}${RUNTIME_RASTER_FORMAT}`;
}

/**
 * Should this asset convert with lossless WebP? Pixel art and tiny crisp UI
 * sprites must stay crisp; everything else uses high-quality lossy WebP.
 * Driven by path convention (icons/pixel/sprite/tile segments) plus an optional
 * pixel-dimension hint. Callers can always force it with an explicit flag.
 */
export function shouldUseLossless(p, { width, height, force } = {}) {
  if (force === true) return true;
  if (force === false) return false;
  const segs = pathSegments(p);
  const stem = (segs[segs.length - 1] ?? "").replace(/\.[^.]+$/, "");
  const crispHint = /(^|[-_])(icon|pixel|sprite|tile|glyph)s?([-_]|$)/;
  if (segs.some((s) => s === "pixel" || s === "icons" || s === "tiles")) return true;
  if (crispHint.test(stem)) return true;
  if (typeof width === "number" && typeof height === "number") {
    if (width <= 64 && height <= 64) return true;
  }
  return false;
}

/** Default lossy quality for photographic / large runtime raster. */
export const DEFAULT_LOSSY_QUALITY = 82;

/** Build the cwebp argument vector for one conversion. */
export function cwebpArgsFor({ src, dest, lossless, quality }) {
  if (lossless) {
    // -exact preserves RGB under fully-transparent pixels; -z 9 is max effort.
    return ["-lossless", "-exact", "-z", "9", src, "-o", dest];
  }
  const q = typeof quality === "number" ? quality : DEFAULT_LOSSY_QUALITY;
  return ["-q", String(q), "-m", "6", src, "-o", dest];
}

/**
 * Plan a single conversion: pick lossless vs lossy and the destination path.
 * Returns { src, dest, lossless, quality, args }.
 */
export function planConversion(src, opts = {}) {
  const lossless = shouldUseLossless(src, opts);
  const dest = opts.dest ?? webpDestFor(src);
  const quality = lossless ? undefined : (opts.quality ?? DEFAULT_LOSSY_QUALITY);
  const args = cwebpArgsFor({ src, dest, lossless, quality });
  return { src, dest, lossless, quality, args };
}

/**
 * The raster extensions a Vite-style glob pattern admits. Handles a trailing
 * `*.{a,b,c}` brace set or a single `*.ext`. Returns lowercased ".ext" tokens.
 */
export function globRasterExtensions(pattern) {
  const brace = String(pattern).match(/\*\.\{([^}]*)\}\s*$/);
  if (brace) {
    return brace[1]
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((s) => (s.startsWith(".") ? s : `.${s}`));
  }
  const single = String(pattern).match(/\*\.([A-Za-z0-9]+)\s*$/);
  if (single) return [`.${single[1].toLowerCase()}`];
  return [];
}

/**
 * Does an asset-bundle glob admit a *source* raster format (a PNG anywhere, or a
 * JPEG outside a social slot)? This is the "runtime bundle accidentally imports
 * a source PNG" guard (acceptance criterion #4). Globs that target a source tree
 * are exempt — those folders are allowed to hold PNGs.
 */
export function globAdmitsSourceRaster(pattern) {
  if (isSourceTree(pattern)) return false;
  const social = isSocialCard(pattern);
  return globRasterExtensions(pattern).some((ext) => {
    if (ext === ".png") return true;
    if ((ext === ".jpg" || ext === ".jpeg") && !social) return true;
    return false;
  });
}
