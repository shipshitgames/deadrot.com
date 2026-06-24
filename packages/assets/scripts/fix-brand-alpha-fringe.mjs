#!/usr/bin/env node
// Fix/check for deadrot.com#289.
//
// The brand marks had lossy-alpha dark matte bleed around transparent edges.
// This script remats those fringe pixels from nearby opaque subject colors,
// re-encodes the brand marks as high-quality alpha WebP, and keeps the flagged
// pickup sprites on lossless WebP.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { measureAlphaFringe, rematteDarkFringe, webpEncodingKind } from "./lib/alpha-fringe.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const marker = Buffer.from("ENDHDR\n");
const mode = process.argv.includes("--check") ? "check" : "fix";

const brandFiles = [
  "packages/assets/brand/wordmark.webp",
  "packages/assets/brand/title.webp",
  "packages/assets/brand/mark.webp",
];

const pickupLosslessFiles = [
  "packages/assets/games/scourge-survivors/pickups/ammo/bone-cache.webp",
  "packages/assets/games/scourge-survivors/pickups/bonus/damage-boost.webp",
  "packages/assets/games/scourge-survivors/pickups/health/blood-vial.webp",
];

function assertBinary(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`Missing required ${name} binary. Install libwebp tools before running this script.`);
  }
}

function repoPath(relPath) {
  return resolve(repoRoot, relPath);
}

function decodePam(path) {
  const output = execFileSync("dwebp", ["-quiet", path, "-pam", "-o", "-"], {
    maxBuffer: 128 * 1024 * 1024,
  });
  const headerEnd = output.indexOf(marker);
  if (headerEnd < 0) throw new Error(`${path}: dwebp did not return a PAM header`);

  const header = output.subarray(0, headerEnd + marker.length);
  const headerText = header.toString("ascii");
  if (!/^DEPTH 4$/m.test(headerText) || !/^MAXVAL 255$/m.test(headerText)) {
    throw new Error(`${path}: expected 8-bit RGBA PAM output`);
  }

  return {
    data: Buffer.from(output.subarray(headerEnd + marker.length)),
    header,
    height: Number(headerText.match(/^HEIGHT (\d+)$/m)?.[1]),
    width: Number(headerText.match(/^WIDTH (\d+)$/m)?.[1]),
  };
}

function encodeWebp(path, header, data, args) {
  const dir = mkdtempSync(join(tmpdir(), "deadrot-brand-alpha-"));
  const pamPath = join(dir, "image.pam");
  const webpPath = join(dir, "image.webp");
  try {
    writeFileSync(pamPath, Buffer.concat([header, data]));
    execFileSync("cwebp", ["-quiet", ...args, pamPath, "-o", webpPath], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${path}: cwebp did not produce a valid output file`);
    }
    renameSync(webpPath, path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function encodeBrandWebp(path, header, data) {
  encodeWebp(path, header, data, ["-q", "92", "-alpha_q", "100", "-m", "6", "-exact"]);
}

function encodeLosslessWebp(path, header, data) {
  encodeWebp(path, header, data, ["-lossless", "-exact", "-z", "9"]);
}

assertBinary("dwebp");
if (mode === "fix") assertBinary("cwebp");

const results = [];

for (const relPath of brandFiles) {
  const path = repoPath(relPath);
  const { header, data, width, height } = decodePam(path);
  const before = measureAlphaFringe(data, width, height);
  const cleanup = rematteDarkFringe(data, width, height);
  const after = measureAlphaFringe(data, width, height);
  const encoding = webpEncodingKind(readFileSync(path));

  if (mode === "fix" && (cleanup.changedPixels > 0 || encoding !== "lossy")) {
    encodeBrandWebp(path, header, data);
  }

  const finalEncoding = webpEncodingKind(readFileSync(path));
  results.push({ relPath, width, height, before, cleanup, after, encoding: finalEncoding });
}

for (const relPath of pickupLosslessFiles) {
  const path = repoPath(relPath);
  const { header, data, width, height } = decodePam(path);
  const alpha = measureAlphaFringe(data, width, height);

  if (mode === "fix") {
    encodeLosslessWebp(path, header, data);
  }

  const finalEncoding = webpEncodingKind(readFileSync(path));
  results.push({ relPath, width, height, alpha, encoding: finalEncoding });
}

if (mode === "check") {
  const badFringe = results.filter((result) => result.before && result.before.darkFringePixels > 0);
  const badEncoding = pickupLosslessFiles.filter(
    (relPath) => webpEncodingKind(readFileSync(repoPath(relPath))) !== "lossless",
  );
  if (badFringe.length > 0 || badEncoding.length > 0) {
    for (const result of badFringe) {
      console.error(
        `${result.relPath}: ${result.before.darkFringePixels} dark fringe pixels remain; run node packages/assets/scripts/fix-brand-alpha-fringe.mjs`,
      );
    }
    for (const relPath of badEncoding) {
      console.error(`${relPath}: expected lossless WebP encoding`);
    }
    process.exit(1);
  }
}

for (const result of results) {
  const rel = relative(repoRoot, repoPath(result.relPath));
  if (result.cleanup) {
    console.log(
      `${mode === "fix" ? "fixed" : "checked"} ${rel}: ${result.width}x${result.height}, ` +
        `dark fringe ${result.before.darkFringePixels} -> ${result.after.darkFringePixels}, ` +
        `rematted ${result.cleanup.remattedPixels}, cleared ${result.cleanup.clearedPixels}, ` +
        `encoding ${result.encoding}`,
    );
  } else {
    console.log(
      `${mode === "fix" ? "checked" : "checked"} ${rel}: ${result.width}x${result.height}, ` +
        `dark fringe ${result.alpha.darkFringePixels}, encoding ${result.encoding}`,
    );
  }
}
