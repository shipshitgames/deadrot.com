#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { alphaBounds, alphaMargins, copyRgbaCrop, cropForBounds, edgeAlphaCount } from "./lib/alpha-margin.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const atlasPath = join(packageRoot, "games/warline/props/portal-deck/portal-deck-atlas.webp");
const marker = Buffer.from("ENDHDR\n");
const padding = 32;
const minimumMargin = 24;

// Connected-component bounds measured from the committed portal-deck atlas.
// The individual crops had been cut tighter than these source components.
const targets = [
  {
    id: "command-table",
    dest: "games/warline/props/portal-deck/command-table.webp",
    bounds: { minX: 439, minY: 566, maxX: 1001, maxY: 935 },
  },
  {
    id: "green-lift",
    dest: "games/warline/props/portal-deck/green-lift.webp",
    bounds: { minX: 1216, minY: 47, maxX: 1488, maxY: 482 },
  },
  {
    id: "red-pit",
    dest: "games/warline/props/portal-deck/red-pit.webp",
    bounds: { minX: 1055, minY: 540, maxX: 1468, maxY: 944 },
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

  const headerText = output.subarray(0, headerEnd + marker.length).toString("ascii");
  if (!/^DEPTH 4$/m.test(headerText) || !/^MAXVAL 255$/m.test(headerText)) {
    throw new Error(`${path}: expected 8-bit RGBA PAM output`);
  }

  return {
    data: Buffer.from(output.subarray(headerEnd + marker.length)),
    width: Number(headerText.match(/^WIDTH (\d+)$/m)?.[1]),
    height: Number(headerText.match(/^HEIGHT (\d+)$/m)?.[1]),
  };
}

function pamBuffer(width, height, data) {
  return Buffer.concat([
    Buffer.from(`P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`),
    data,
  ]);
}

function encodeWebp(dest, width, height, data) {
  const dir = mkdtempSync(join(tmpdir(), "deadrot-warline-prop-"));
  const pamPath = join(dir, "prop.pam");
  const webpPath = join(dir, "prop.webp");
  try {
    writeFileSync(pamPath, pamBuffer(width, height, data));
    execFileSync("cwebp", ["-quiet", "-lossless", "-m", "4", "-exact", pamPath, "-o", webpPath], {
      maxBuffer: 32 * 1024 * 1024,
    });
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${dest}: cwebp did not produce a valid output file`);
    }
    renameSync(webpPath, dest);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function statsFor(path) {
  const decoded = decodePam(path);
  const bounds = alphaBounds(decoded.data, decoded.width, decoded.height);
  const margins = alphaMargins(bounds, decoded.width, decoded.height);
  return {
    width: decoded.width,
    height: decoded.height,
    bounds,
    margins,
    borderPixels: edgeAlphaCount(decoded.data, decoded.width, decoded.height),
  };
}

function ensureStats(target, stats) {
  if (!stats.bounds || !stats.margins) throw new Error(`${target.id}: no opaque pixels found`);
  const tooTight = Object.entries(stats.margins).filter(([, value]) => value < minimumMargin);
  if (stats.borderPixels > 0 || tooTight.length > 0) {
    throw new Error(
      `${target.id}: expected >=${minimumMargin}px transparent margins and 0 border pixels; ` +
        `got margins ${JSON.stringify(stats.margins)}, borderPixels=${stats.borderPixels}`,
    );
  }
}

function fix() {
  assertBinary("cwebp");
  const atlas = decodePam(atlasPath);
  for (const target of targets) {
    const crop = cropForBounds(target.bounds, atlas.width, atlas.height, padding);
    const data = copyRgbaCrop(atlas.data, atlas.width, crop);
    const dest = join(packageRoot, target.dest);
    encodeWebp(dest, crop.width, crop.height, data);
    const stats = statsFor(dest);
    ensureStats(target, stats);
    console.log(
      `${target.id}: ${crop.width}x${crop.height}, margins=${JSON.stringify(stats.margins)}, ` +
        `borderPixels=${stats.borderPixels}`,
    );
  }
}

function check() {
  for (const target of targets) {
    const dest = join(packageRoot, target.dest);
    const stats = statsFor(dest);
    ensureStats(target, stats);
    console.log(
      `${target.id}: OK ${stats.width}x${stats.height}, margins=${JSON.stringify(stats.margins)}, ` +
        `borderPixels=${stats.borderPixels}`,
    );
  }
}

assertBinary("dwebp");

try {
  if (process.argv.includes("--check")) check();
  else fix();
} catch (error) {
  console.error(`fix-warline-portal-prop-margins: ${error.message}`);
  process.exit(1);
}
