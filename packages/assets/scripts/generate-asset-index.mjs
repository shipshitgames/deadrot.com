#!/usr/bin/env node
// generate-asset-index — emit the canonical `assets.index.json` for
// packages/assets (deadrot.com#343).
//
// One stable contract for resolving Deadrot media: every shipped asset gets a
// stable id, semantic kind, owning game, package-relative path (dev/build),
// CDN-relative path (deployed runtime), media type, byte size, content hash,
// and intrinsic dimensions where the format allows. Apps consume it through the
// typed resolver in `src/asset-index.ts`.
//
// Pure JS — no sharp/cwebp/image-size deps — so it runs on plain CI runners,
// the same constraint as the other `assets:*` gates. The document is fully
// deterministic (sorted by path, no timestamps), so `--check` can fail CI when
// the committed manifest drifts from the files on disk.
//
// Usage:
//   node scripts/generate-asset-index.mjs [--root <dir>] [--out <file>]
//                                         [--cdn-base <url>] [--check]
//
//   --root <dir>       package root to scan      (default: packages/assets)
//   --out <file>       manifest path to write    (default: <root>/assets.index.json)
//   --cdn-base <url>   CDN origin baked into the manifest (default: DEFAULT_CDN_BASE)
//   --check            do not write; exit 1 if the committed manifest is stale

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extname } from "./lib/asset-format-policy.mjs";
import {
  cdnPathFor,
  compareByPath,
  DEFAULT_CDN_BASE,
  gameFor,
  INDEX_VERSION,
  INDEXED_ROOTS,
  idFor,
  isIndexableMedia,
  kindFor,
  mediaTypeFor,
  toPosix,
} from "./lib/asset-index-core.mjs";
import { dimensionsFromBuffer } from "./lib/image-size.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const INDEX_FILENAME = "assets.index.json";
const PROVENANCE_FILENAME = "asset-provenance.json";
const GENERATOR_REF = "scripts/generate-asset-index.mjs";

/** Directory names never descended into while scanning. */
const SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Recursively collect package-relative POSIX paths of indexable media. */
function walkMedia(root) {
  const found = [];
  const visit = (absDir, relDir) => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const absChild = join(absDir, entry.name);
      const relChild = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        visit(absChild, relChild);
      } else if (entry.isFile() && isIndexableMedia(relChild)) {
        found.push(relChild);
      }
    }
  };
  for (const rootName of INDEXED_ROOTS) {
    const absRoot = join(root, rootName);
    if (existsSync(absRoot)) visit(absRoot, rootName);
  }
  return found;
}

/** Optional `<root>/asset-provenance.json`: { "<rel path>": { provenance, license } }. */
function loadProvenance(root) {
  const file = join(root, PROVENANCE_FILENAME);
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Build one index entry from a package-relative media path. */
export function buildEntry(root, relPath, provenanceMap = {}) {
  const abs = join(root, relPath);
  const buf = readFileSync(abs);
  const ext = extname(relPath);
  const dims = dimensionsFromBuffer(buf, ext);
  const entry = {
    id: idFor(relPath),
    kind: kindFor(relPath),
    game: gameFor(relPath),
    path: toPosix(relPath),
    cdnPath: cdnPathFor(relPath),
    mediaType: mediaTypeFor(relPath),
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
  if (dims) {
    entry.width = dims.width;
    entry.height = dims.height;
  }
  const prov = provenanceMap[entry.path];
  if (prov && typeof prov === "object") {
    if (typeof prov.provenance === "string") entry.provenance = prov.provenance;
    if (typeof prov.license === "string") entry.license = prov.license;
  }
  return entry;
}

/**
 * Build the full index document for `root`. Hard-fails on id collisions so a
 * format twin can never silently shadow another asset.
 */
export function buildIndex(root, { cdnBase = DEFAULT_CDN_BASE } = {}) {
  const provenanceMap = loadProvenance(root);
  const assets = walkMedia(root)
    .map((rel) => buildEntry(root, rel, provenanceMap))
    .sort(compareByPath);

  const seen = new Map();
  for (const a of assets) {
    if (seen.has(a.id)) {
      throw new Error(`asset id collision: "${a.id}" maps to both ${seen.get(a.id)} and ${a.path}`);
    }
    seen.set(a.id, a.path);
  }

  return {
    $schema: "./assets.index.schema.json",
    version: INDEX_VERSION,
    generator: GENERATOR_REF,
    note: "Generated — do not edit by hand. Run `bun run --cwd packages/assets assets:index`.",
    cdnBase,
    assetCount: assets.length,
    assets,
  };
}

/** Canonical serialization (2-space, trailing newline) shared by write + check. */
export function serializeIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Compare the on-disk manifest with a freshly built one. */
export function checkDrift(root, outFile, opts = {}) {
  const next = serializeIndex(buildIndex(root, opts));
  if (!existsSync(outFile)) {
    return { ok: false, reason: `manifest missing: ${outFile}` };
  }
  const current = readFileSync(outFile, "utf8");
  if (current === next) return { ok: true };
  return { ok: false, reason: "manifest is stale", current, next };
}

function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const root = resolve(get("--root") ?? defaultRoot);
  const out = resolve(get("--out") ?? join(root, INDEX_FILENAME));
  const cdnBase = get("--cdn-base") ?? DEFAULT_CDN_BASE;
  const check = argv.includes("--check");
  return { root, out, cdnBase, check };
}

function main() {
  const { root, out, cdnBase, check } = parseArgs(process.argv.slice(2));

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`generate-asset-index: root not found: ${root}`);
    process.exitCode = 2;
    return;
  }

  if (check) {
    const result = checkDrift(root, out, { cdnBase });
    if (result.ok) {
      console.log(`generate-asset-index: OK — ${relative(root, out)} is in sync.`);
      return;
    }
    console.error(`generate-asset-index: ${result.reason}.`);
    console.error("Regenerate with: bun run --cwd packages/assets assets:index");
    process.exitCode = 1;
    return;
  }

  const index = buildIndex(root, { cdnBase });
  writeFileSync(out, serializeIndex(index));
  console.log(`generate-asset-index: wrote ${index.assetCount} assets → ${relative(root, out)}`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
