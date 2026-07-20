#!/usr/bin/env node
// Fix/check for deadrot.com#17.
//
// The default Scourge enemy pack was generated against magenta/green matte
// backgrounds. This script removes residual magenta edge pixels from the
// affected static billboard sprites and authoritative split animation frames
// without changing dimensions, anchors, or manifest paths, then rebuilds the
// generated runtime page from the committed atlas map and cleaned frames.

import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanMagentaFringe,
  copyRgbaFrameWithExtrudedPadding,
  countRgbaRectMismatches,
  measureMagentaFringe,
} from "./lib/alpha-fringe.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const marker = Buffer.from("ENDHDR\n");
const mode = process.argv.includes("--check") ? "check" : "fix";
const affectedEntities = ["breach-boss", "host-grunt", "spitter-host", "winged-host", "wound-hound"];
const staticRoot = resolve(repoRoot, "packages/assets/games/scourge-survivors/enemies/scourge");
const animationRoot = resolve(repoRoot, "packages/assets/games/scourge-survivors/animations/scourge");
const atlasPath = join(animationRoot, "scourge.atlas0.webp");
const atlasMapPath = join(animationRoot, "scourge.atlas.json");

function assertBinary(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`Missing required ${name} binary. Install libwebp tools before running this script.`);
  }
}

function walkWebpFiles(root, out = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) walkWebpFiles(fullPath, out);
    else if (entry.isFile() && fullPath.endsWith(".webp")) out.push(fullPath);
  }
  return out;
}

function decodePam(path) {
  const output = execFileSync("dwebp", ["-quiet", path, "-pam", "-o", "-"], {
    maxBuffer: 256 * 1024 * 1024,
  });
  const headerEnd = output.indexOf(marker);
  if (headerEnd < 0) throw new Error(`${path}: dwebp did not return a PAM header`);

  const header = output.subarray(0, headerEnd + marker.length);
  const headerText = header.toString("ascii");
  if (!/^DEPTH 4$/m.test(headerText) || !/^MAXVAL 255$/m.test(headerText)) {
    throw new Error(`${path}: expected 8-bit RGBA PAM output`);
  }
  const height = Number(headerText.match(/^HEIGHT (\d+)$/m)?.[1]);
  const width = Number(headerText.match(/^WIDTH (\d+)$/m)?.[1]);
  const data = Buffer.from(output.subarray(headerEnd + marker.length));
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`${path}: dwebp returned invalid PAM dimensions`);
  }
  if (data.length !== width * height * 4) {
    throw new Error(`${path}: expected ${width * height * 4} RGBA bytes, received ${data.length}`);
  }

  return {
    data,
    header,
    height,
    width,
  };
}

function encodeLosslessWebp(path, header, data) {
  const token = `${process.pid}-${randomUUID()}`;
  const pamPath = join(dirname(path), `.deadrot-scourge-alpha-${token}.pam`);
  const webpPath = join(dirname(path), `.deadrot-scourge-alpha-${token}.tmp`);
  try {
    writeFileSync(pamPath, Buffer.concat([header, data]));
    execFileSync("cwebp", ["-quiet", "-lossless", "-exact", "-z", "9", pamPath, "-o", webpPath], {
      maxBuffer: 256 * 1024 * 1024,
    });
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${path}: cwebp did not produce a valid output file`);
    }
    renameSync(webpPath, path);
  } finally {
    rmSync(pamPath, { force: true });
    rmSync(webpPath, { force: true });
  }
}

function validateAtlasSourceEquality() {
  const atlas = decodePam(atlasPath);
  const atlasMap = JSON.parse(readFileSync(atlasMapPath, "utf8"));
  const page = atlasMap.pages?.[0];
  if (!page || atlasMap.pages.length !== 1 || page.image !== "scourge.atlas0.webp") {
    throw new Error(`${relative(repoRoot, atlasMapPath)}: expected one scourge.atlas0.webp page`);
  }
  if (page.width !== atlas.width || page.height !== atlas.height) {
    throw new Error(
      `${relative(repoRoot, atlasPath)}: decoded ${atlas.width}x${atlas.height}, map declares ${page.width}x${page.height}`,
    );
  }

  const mismatches = [];
  let mismatchedPixels = 0;
  for (const frame of atlasMap.frames ?? []) {
    const sourcePath = join(animationRoot, frame.id);
    const source = decodePam(sourcePath);
    if (source.width !== frame.w || source.height !== frame.h) {
      throw new Error(
        `${relative(repoRoot, sourcePath)}: decoded ${source.width}x${source.height}, atlas rect declares ${frame.w}x${frame.h}`,
      );
    }
    const count = countRgbaRectMismatches(
      source.data,
      source.width,
      source.height,
      atlas.data,
      atlas.width,
      frame.x,
      frame.y,
    );
    if (count > 0) {
      mismatches.push({ count, id: frame.id });
      mismatchedPixels += count;
    }
  }

  if (mismatches.length > 0) {
    for (const mismatch of mismatches.slice(0, 20)) {
      console.error(`${mismatch.id}: ${mismatch.count} pixels differ from the runtime atlas`);
    }
    if (mismatches.length > 20) console.error(`...and ${mismatches.length - 20} more frames`);
    throw new Error(
      `Scourge runtime atlas differs from ${mismatches.length} authored frames (${mismatchedPixels} pixels). ` +
        "Regenerate it with @shipshitgames/assetgen atlas.",
    );
  }

  return atlasMap.frames?.length ?? 0;
}

function rebuildAtlasFromSources() {
  const atlas = decodePam(atlasPath);
  const atlasMap = JSON.parse(readFileSync(atlasMapPath, "utf8"));
  const padding = atlasMap.padding;
  if (!Number.isInteger(padding) || padding < 0) {
    throw new Error(`${relative(repoRoot, atlasMapPath)}: invalid atlas padding ${padding}`);
  }

  for (const frame of atlasMap.frames ?? []) {
    const sourcePath = join(animationRoot, frame.id);
    const source = decodePam(sourcePath);
    if (source.width !== frame.w || source.height !== frame.h) {
      throw new Error(
        `${relative(repoRoot, sourcePath)}: decoded ${source.width}x${source.height}, atlas rect declares ${frame.w}x${frame.h}`,
      );
    }
    copyRgbaFrameWithExtrudedPadding(
      source.data,
      source.width,
      source.height,
      atlas.data,
      atlas.width,
      atlas.height,
      frame.x,
      frame.y,
      padding,
    );
  }

  encodeLosslessWebp(atlasPath, atlas.header, atlas.data);
  return atlasMap.frames?.length ?? 0;
}

assertBinary("dwebp");
if (mode === "fix") assertBinary("cwebp");

const files = affectedEntities
  .flatMap((entity) => [join(staticRoot, entity), join(animationRoot, entity)])
  .flatMap((root) => walkWebpFiles(root))
  .sort();
const flagged = [];
let changedFiles = 0;
let changedPixels = 0;
let remattedPixels = 0;

for (const path of files) {
  const decoded = decodePam(path);
  const before = measureMagentaFringe(decoded.data, decoded.width, decoded.height);
  if (before.total === 0) continue;

  flagged.push({ path: relative(repoRoot, path), ...before });
  changedFiles += 1;
  if (mode === "check") {
    changedPixels += before.total;
    continue;
  }

  let after = before;
  let passes = 0;
  let fileChangedPixels = 0;
  let fileRemattedPixels = 0;
  while (after.total > 0 && passes < 12) {
    const cleanup = cleanMagentaFringe(decoded.data, decoded.width, decoded.height);
    if (cleanup.changedPixels === 0) break;
    fileChangedPixels += cleanup.changedPixels;
    fileRemattedPixels += cleanup.remattedPixels;
    after = measureMagentaFringe(decoded.data, decoded.width, decoded.height);
    passes += 1;
  }
  if (after.total !== 0) {
    throw new Error(
      `${relative(repoRoot, path)}: cleanup mismatch (${before.total} flagged, ` +
        `${fileChangedPixels} changed across ${passes} passes, ${after.total} remain)`,
    );
  }
  changedPixels += fileChangedPixels;
  remattedPixels += fileRemattedPixels;
  encodeLosslessWebp(path, decoded.header, decoded.data);
}

if (mode === "check" && changedPixels > 0) {
  for (const result of flagged.slice(0, 20)) {
    console.error(
      `${result.path}: ${result.total} magenta fringe pixels ` +
        `(${result.purpleAlphaPixels} alpha, ${result.opaqueMagentaEdgePixels} opaque edge)`,
    );
  }
  if (flagged.length > 20) console.error(`...and ${flagged.length - 20} more files`);
  console.error(
    `Scourge enemy alpha check failed: ${changedPixels} magenta fringe pixels across ${changedFiles} files.`,
  );
  process.exit(1);
}

if (mode === "fix") {
  const atlasFrames = rebuildAtlasFromSources();
  validateAtlasSourceEquality();
  console.log(
    `Cleaned ${files.length} Scourge enemy sprite files; ${changedPixels} pixels across ${changedFiles} files ` +
      `(${remattedPixels} rematted).`,
  );
  console.log(`Rebuilt scourge.atlas0.webp from ${atlasFrames} authoritative split frames.`);
} else {
  const atlasFrames = validateAtlasSourceEquality();
  console.log(
    `Checked ${files.length} Scourge enemy sprite files and ${atlasFrames} atlas frames; ` +
      "no magenta fringe or source/atlas pixel drift found.",
  );
}
