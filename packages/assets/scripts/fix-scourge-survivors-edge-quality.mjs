#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  countBorderOpaquePixels,
  edgeQualityMetrics,
  opaqueBounds,
  padHorizontalTierSheet,
  rematteDarkEdgePixels,
} from "./lib/edge-quality.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const marker = Buffer.from("ENDHDR\n");

const rematteTargets = [
  {
    path: "games/scourge-survivors/players/pyre/vector/side.webp",
    options: { minLumaDelta: 18 },
  },
  {
    path: "games/scourge-survivors/players/pyre/ranger/side.webp",
    options: { minLumaDelta: 18 },
  },
  {
    path: "games/scourge-survivors/fx/pyre/muzzle-flash.webp",
    options: { includeOpaque: true, minLuma: 50, minLumaDelta: 10 },
  },
  {
    path: "games/scourge-survivors/projectiles/scourge/enemy-spit.webp",
    options: { minLumaDelta: 18 },
  },
];

const tierSheetTargets = [
  {
    path: "games/scourge-survivors/weapons/pyre/smg-tiers.webp",
    columns: 5,
    expectedSource: { width: 2175, height: 724 },
    padded: { width: 2415, height: 772, cellWidth: 483 },
  },
  {
    path: "games/scourge-survivors/weapons/pyre/cannon-tiers.webp",
    columns: 5,
    expectedSource: { width: 2172, height: 724 },
    padded: { width: 2415, height: 772, cellWidth: 483 },
  },
];

function assertBinary(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`Missing required ${name} binary. Install libwebp tools before running this script.`);
  }
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

  return {
    data: Buffer.from(output.subarray(headerEnd + marker.length)),
    height: Number(headerText.match(/^HEIGHT (\d+)$/m)?.[1]),
    width: Number(headerText.match(/^WIDTH (\d+)$/m)?.[1]),
  };
}

function pamHeader(width, height) {
  return Buffer.from(`P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`);
}

function encodeWebp(path, data, width, height) {
  const dir = mkdtempSync(join(tmpdir(), "deadrot-edge-quality-"));
  const pamPath = join(dir, "asset.pam");
  const webpPath = join(dir, "asset.webp");
  try {
    writeFileSync(pamPath, Buffer.concat([pamHeader(width, height), data]));
    execFileSync("cwebp", ["-quiet", "-lossless", "-m", "4", "-exact", pamPath, "-o", webpPath], {
      maxBuffer: 64 * 1024 * 1024,
    });
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${path}: cwebp did not produce a valid output file`);
    }
    renameSync(webpPath, path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function fmtMetric(value) {
  return Number(value.toFixed(2));
}

assertBinary("dwebp");
assertBinary("cwebp");

for (const target of rematteTargets) {
  const absPath = resolve(packageRoot, target.path);
  const { data, width, height } = decodePam(absPath);
  const before = edgeQualityMetrics(data, width, height);
  let changed = 0;
  let totalChanged = 0;
  let passes = 0;

  do {
    changed = rematteDarkEdgePixels(data, width, height, target.options);
    totalChanged += changed;
    passes += 1;
  } while (changed > 0 && passes < 12);

  if (changed > 0) {
    throw new Error(`${target.path}: rematte did not converge after ${passes} passes`);
  }
  if (totalChanged > 0) encodeWebp(absPath, data, width, height);
  const after = edgeQualityMetrics(data, width, height);
  console.log(
    [
      totalChanged > 0 ? "rematted" : "clean",
      target.path,
      `${totalChanged} px/${passes} pass${passes === 1 ? "" : "es"}`,
      `fringe ${fmtMetric(before.fringe)} -> ${fmtMetric(after.fringe)}`,
    ].join("  "),
  );
}

for (const target of tierSheetTargets) {
  const absPath = resolve(packageRoot, target.path);
  const { data, width, height } = decodePam(absPath);

  if (width === target.padded.width && height === target.padded.height) {
    const bounds = opaqueBounds(data, width, height);
    console.log(
      [
        "padded",
        target.path,
        `${width}x${height}`,
        `${countBorderOpaquePixels(data, width, height)} border px`,
        `margin ${JSON.stringify(bounds?.margin ?? null)}`,
      ].join("  "),
    );
    continue;
  }

  if (width !== target.expectedSource.width || height !== target.expectedSource.height) {
    throw new Error(
      `${target.path}: expected ${target.expectedSource.width}x${target.expectedSource.height} or ` +
        `${target.padded.width}x${target.padded.height}, got ${width}x${height}`,
    );
  }

  const padded = padHorizontalTierSheet(data, width, height, {
    columns: target.columns,
    padding: { bottom: 24, left: 24, right: 24, top: 24 },
    targetCellWidth: target.padded.cellWidth,
    targetHeight: target.padded.height,
  });
  encodeWebp(absPath, padded.data, padded.width, padded.height);
  const bounds = opaqueBounds(padded.data, padded.width, padded.height);
  console.log(
    [
      "padded",
      target.path,
      `${width}x${height} -> ${padded.width}x${padded.height}`,
      `${countBorderOpaquePixels(padded.data, padded.width, padded.height)} border px`,
      `margin ${JSON.stringify(bounds?.margin ?? null)}`,
    ].join("  "),
  );
}
