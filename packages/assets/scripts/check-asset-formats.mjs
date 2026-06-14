#!/usr/bin/env node
// check-asset-formats — enforces the runtime asset-format policy (deadrot.com#118).
//
// Pure JS (no cwebp / sharp), so it runs on plain CI runners. Wired into the
// package `assets:check`, which CI invokes via
// `bun run --cwd packages/assets assets:check`.
//
// Scope, deliberately narrow so it gates the runtime *bundle surface* without
// policing every loose file on disk (source PNGs legitimately live under
// sources/, _archive/, masters/, ... and must NOT fail the build):
//
//   1. Manifest raster paths — every `path` a game's assets.json declares must
//      be an allowed runtime format (WebP; JPEG only for ui/social OG cards).
//      A manifest is the list of assets the game loads, so a PNG here means a
//      source master leaked into the runtime catalog.
//
//   2. Bundle glob patterns — every `import.meta.glob` raster pattern in
//      packages/assets/src must not admit a source PNG/JPEG into the bundle
//      (acceptance criterion #4: "runtime bundles do not accidentally import
//      large source PNGs"). Catches the risk even when no PNG currently sits
//      in the globbed folder.
//
// Usage:
//   node scripts/check-asset-formats.mjs [--root <packages/assets dir>]

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  globAdmitsSourceRaster,
  globRasterExtensions,
  isSourceTree,
  rasterViolationReason,
} from "./lib/asset-format-policy.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseRoot(argv) {
  const i = argv.indexOf("--root");
  return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : defaultRoot;
}

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

function walkFiles(dir, predicate) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(child, predicate));
    else if (entry.isFile() && predicate(child)) out.push(child);
  }
  return out;
}

/** Recursively collect every string value stored under a `path` key. */
function collectPathValues(node, sink) {
  if (Array.isArray(node)) {
    for (const item of node) collectPathValues(item, sink);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "path" && typeof value === "string") sink.push(value);
      else collectPathValues(value, sink);
    }
  }
}

/** Violations where a game manifest declares a source-format runtime raster. */
function checkManifestFormats(root) {
  const violations = [];
  for (const gameDir of listDirs(join(root, "games"))) {
    const manifestFile = join(gameDir, "assets.json");
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    } catch {
      continue; // not every game pack has an assets.json
    }
    const paths = [];
    collectPathValues(manifest, paths);
    for (const p of paths) {
      // PNG is allowed inside source trees; a manifest pointing into a source
      // tree is a *different* lint (check-assets.mjs owns that), not ours.
      if (isSourceTree(p)) continue;
      const reason = rasterViolationReason(p);
      if (reason) {
        violations.push({ file: relative(root, manifestFile), path: p, reason });
      }
    }
  }
  return violations;
}

// A quoted string literal that looks like a Vite asset glob: contains a `*` and
// a trailing extension/brace-set.
const GLOB_LITERAL = /["'`]([^"'`]*\*[^"'`]*\.(?:\{[^}]*\}|[A-Za-z0-9]+))["'`]/g;

/** Violations where a bundle glob would admit a source PNG/JPEG. */
function checkBundleGlobs(root) {
  const violations = [];
  const srcFiles = walkFiles(join(root, "src"), (f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  for (const file of srcFiles) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
      for (const match of line.matchAll(GLOB_LITERAL)) {
        const pattern = match[1];
        // Only raster globs are in scope; ignore audio/font/etc. globs.
        if (globRasterExtensions(pattern).length === 0) continue;
        if (globAdmitsSourceRaster(pattern)) {
          violations.push({
            file: relative(root, file),
            line: idx + 1,
            pattern,
            reason: "bundle glob admits source raster (PNG/JPEG) — restrict it to *.webp",
          });
        }
      }
    });
  }
  return violations;
}

export function findViolations(root = defaultRoot) {
  return {
    manifest: checkManifestFormats(root),
    glob: checkBundleGlobs(root),
  };
}

function main() {
  const root = parseRoot(process.argv.slice(2));
  try {
    statSync(root);
  } catch {
    console.error(`check-asset-formats: root not found: ${root}`);
    process.exitCode = 2;
    return;
  }

  const { manifest, glob } = findViolations(root);
  const total = manifest.length + glob.length;

  if (total === 0) {
    console.log("check-asset-formats: OK — runtime raster is WebP; no bundle glob imports source PNG/JPEG.");
    return;
  }

  console.error(`check-asset-formats: ${total} policy violation(s).\n`);
  if (manifest.length > 0) {
    console.error("Manifest runtime raster must be WebP (JPEG only for ui/social OG cards):");
    for (const v of manifest) console.error(`  ${v.file}: ${v.path}\n    → ${v.reason}`);
    console.error("");
  }
  if (glob.length > 0) {
    console.error("Bundle globs must not import source PNG/JPEG:");
    for (const v of glob) console.error(`  ${v.file}:${v.line}: ${v.pattern}\n    → ${v.reason}`);
    console.error("");
  }
  console.error("Fix: convert with `bun run --cwd packages/assets assets:to-webp <path>` and");
  console.error("update the manifest / glob to the .webp twin. See docs/asset-format-policy.md.");
  process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
