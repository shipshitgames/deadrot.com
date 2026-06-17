// image-size — dependency-free intrinsic dimensions from media file bytes.
//
// Pure JS header parsing (no sharp / image-size npm), so it runs on plain CI
// runners as part of the asset-index generator. Covers the raster/vector
// formats this repo actually ships: WebP (lossy VP8, lossless VP8L, extended
// VP8X), PNG, JPEG, GIF, and SVG. Unknown or unparseable inputs return `null`
// so the generator simply omits `width`/`height` for that asset.
//
// All readers are defensive: a truncated or malformed header yields `null`
// rather than throwing, because the index generator must never crash on one
// odd file.

import { readFileSync } from "node:fs";
import { extname } from "./asset-format-policy.mjs";

/**
 * @typedef {{ width: number, height: number }} Dimensions
 */

/** Read a big-endian uint16 at `off`, or `null` if out of range. */
function u16be(buf, off) {
  if (off + 1 >= buf.length) return null;
  return buf[off] * 256 + buf[off + 1];
}

/** Read a little-endian uint16 at `off`, or `null` if out of range. */
function u16le(buf, off) {
  if (off + 1 >= buf.length) return null;
  return buf[off] + buf[off + 1] * 256;
}

/** Read a little-endian uint24 at `off`, or `null` if out of range. */
function u24le(buf, off) {
  if (off + 2 >= buf.length) return null;
  return buf[off] + buf[off + 1] * 256 + buf[off + 2] * 65536;
}

/** Read a big-endian uint32 at `off`, or `null` if out of range. */
function u32be(buf, off) {
  if (off + 3 >= buf.length) return null;
  return buf[off] * 16777216 + buf[off + 1] * 65536 + buf[off + 2] * 256 + buf[off + 3];
}

/** PNG: 8-byte signature, then IHDR with width/height as BE uint32. */
function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  const width = u32be(buf, 16);
  const height = u32be(buf, 20);
  return width && height ? { width, height } : null;
}

/** GIF: "GIF87a"/"GIF89a" then logical-screen width/height as LE uint16. */
function gifSize(buf) {
  if (buf.length < 10) return null;
  if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) return null;
  const width = u16le(buf, 6);
  const height = u16le(buf, 8);
  return width && height ? { width, height } : null;
}

/** JPEG: scan marker segments for the first Start-Of-Frame (SOFn). */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) {
      off++;
      continue;
    }
    // A marker is 0xFF followed by a non-0xFF, non-0x00 byte. The spec lets any
    // number of 0xFF fill bytes pad before the marker, so skip the whole run.
    let markerOff = off;
    while (markerOff < buf.length && buf[markerOff] === 0xff) markerOff++;
    if (markerOff >= buf.length) return null;
    const marker = buf[markerOff];
    // 0xFF00 is a stuffed literal inside entropy data, not a marker — step over.
    if (marker === 0x00) {
      off = markerOff + 1;
      continue;
    }
    // `seg` is the 0xFF that introduces this marker; the length/payload follow
    // the marker byte exactly as in the canonical [FF][marker][len..] layout.
    const seg = markerOff - 1;
    // SOF0..SOF15, excluding the non-frame markers C4 (DHT), C8 (JPG), CC (DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16be(buf, seg + 5);
      const width = u16be(buf, seg + 7);
      return width && height ? { width, height } : null;
    }
    // Standalone markers (RSTn / SOI / EOI / TEM) carry no length payload.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      off = markerOff + 1;
      continue;
    }
    const segLen = u16be(buf, seg + 2);
    if (segLen === null || segLen < 2) return null;
    off = seg + 2 + segLen;
  }
  return null;
}

/** WebP: RIFF container with a VP8 / VP8L / VP8X chunk. */
function webpSize(buf) {
  if (buf.length < 30) return null;
  // "RIFF" .... "WEBP"
  if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return null;
  if (buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50) return null;
  const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);

  if (fourcc === "VP8 ") {
    // Lossy: 3-byte frame tag, then start code 0x9d 0x01 0x2a, then 14-bit dims.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = (u16le(buf, 26) ?? 0) & 0x3fff;
    const height = (u16le(buf, 28) ?? 0) & 0x3fff;
    return width && height ? { width, height } : null;
  }

  if (fourcc === "VP8L") {
    // Lossless: signature byte 0x2f at offset 20, then a 32-bit little-endian
    // header packing 14b (width-1), 14b (height-1), 1b alpha, 3b version. Bytes
    // 21..24 are always present — the function guards `buf.length < 30` above.
    if (buf[20] !== 0x2f) return null;
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    // width-1 is 14 bits; height-1's top 4 bits live in b3 and must be masked
    // off the alpha/version bits. Both are already 14-bit, so no post-`+1` mask.
    const width = (((b1 & 0x3f) << 8) | b0) + 1;
    const height = (((b3 & 0x0f) << 10) | (b2 << 2) | (b1 >> 6)) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (fourcc === "VP8X") {
    // Extended: canvas width-1 / height-1 as 24-bit LE at offsets 24 / 27.
    const width = (u24le(buf, 24) ?? 0) + 1;
    const height = (u24le(buf, 27) ?? 0) + 1;
    return width > 1 && height > 1 ? { width, height } : null;
  }

  return null;
}

/** SVG: prefer explicit width/height, else derive from the viewBox. */
function svgSize(buf) {
  const text = buf.toString("utf8", 0, Math.min(buf.length, 65536));
  const tag = text.match(/<svg[^>]*>/i);
  if (!tag) return null;
  const head = tag[0];

  const num = (re) => {
    const m = head.match(re);
    if (!m) return null;
    const v = Number.parseFloat(m[1]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  // Only treat unit-less or px widths as pixel dimensions; %, em, etc. fall back
  // to the viewBox. The `(?<![-\w])` guard keeps `width`/`height` from matching
  // inside compound attributes like `stroke-width`.
  const w = num(/(?<![-\w])width\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  const h = num(/(?<![-\w])height\s*=\s*["']\s*([\d.]+)(?:px)?\s*["']/i);
  if (w && h) return { width: Math.round(w), height: Math.round(h) };

  const vb = head.match(/\bviewBox\s*=\s*["']\s*([\d.\-\s,]+?)\s*["']/i);
  if (vb) {
    const parts = vb[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
    }
  }
  return null;
}

const PARSERS = {
  ".png": pngSize,
  ".gif": gifSize,
  ".jpg": jpegSize,
  ".jpeg": jpegSize,
  ".webp": webpSize,
  ".svg": svgSize,
};

/**
 * Intrinsic dimensions for a raster/vector buffer, or `null` when the format is
 * unsupported (video/audio/font) or the header is unreadable.
 *
 * @param {Buffer} buf
 * @param {string} ext  lowercased extension including the dot, e.g. ".webp".
 * @returns {Dimensions | null}
 */
export function dimensionsFromBuffer(buf, ext) {
  const parser = PARSERS[ext];
  if (!parser) return null;
  try {
    return parser(buf);
  } catch {
    return null;
  }
}

/**
 * Intrinsic dimensions for a file on disk, or `null`.
 *
 * @param {string} file  absolute or relative path.
 * @returns {Dimensions | null}
 */
export function dimensionsFromFile(file) {
  const ext = extname(file);
  if (!PARSERS[ext]) return null;
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  return dimensionsFromBuffer(buf, ext);
}

/** Extensions for which {@link dimensionsFromBuffer} can report dimensions. */
export const SIZEABLE_EXTENSIONS = Object.keys(PARSERS);
