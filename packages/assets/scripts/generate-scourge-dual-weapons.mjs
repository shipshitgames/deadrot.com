#!/usr/bin/env node
// Promote the purpose-built dual-wield imagegen masters for deadrot.com#258.
//
// The source PNGs contain genuine left/right held poses for all five tiers.
// This deterministic pass removes the baked neutral checkerboard, normalizes
// every sheet to five exact 435px cells, and emits runtime alpha WebP.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const marker = Buffer.from("ENDHDR\n");
const mode = process.argv.includes("--check") ? "check" : "write";
const outputSize = { width: 2175, height: 724 };
const rawRoot =
  "_archive/raw-generator-cache/codex-generated-images/2026-07-17/raw/019f6f5c-bac3-7ac0-8881-c7cb86fe01e7";

const targets = [
  {
    id: "pistol",
    source: `${rawRoot}/call_azOfo1vi9G5CGlbYrWuqyOEu.png`,
    output: "games/scourge-survivors/weapons/pyre/dual/pistol-dual-tiers.webp",
  },
  {
    id: "smg",
    source: `${rawRoot}/call_KmHRV7ExZz71dOLC1x3inS1a.png`,
    output: "games/scourge-survivors/weapons/pyre/dual/smg-dual-tiers.webp",
  },
  {
    id: "shotgun",
    source: `${rawRoot}/call_P08gr2NAJsBZbe2EcrjtoZpB.png`,
    output: "games/scourge-survivors/weapons/pyre/dual/shotgun-dual-tiers.webp",
  },
  {
    id: "sniper",
    source: `${rawRoot}/call_t0OguipFMmAzui2qGGFamph6.png`,
    output: "games/scourge-survivors/weapons/pyre/dual/sniper-dual-tiers.webp",
  },
];

function assertBinary(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`Missing required ${name} binary.`);
  }
}

function decodePng(path) {
  const output = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", path, "-frames:v", "1", "-pix_fmt", "rgba", "-f", "image2pipe", "-vcodec", "pam", "-"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  const headerEnd = output.indexOf(marker);
  if (headerEnd < 0) throw new Error(`${path}: ffmpeg did not return a PAM header`);

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

function encodeWebp(path, width, height, data) {
  const dir = mkdtempSync(join(tmpdir(), "deadrot-dual-weapons-"));
  const pamPath = join(dir, "sheet.pam");
  const webpPath = join(dir, "sheet.webp");
  try {
    writeFileSync(pamPath, pamBuffer(width, height, data));
    execFileSync(
      "cwebp",
      ["-quiet", "-q", "80", "-alpha_q", "100", "-m", "6", "-exact", pamPath, "-o", webpPath],
      { maxBuffer: 128 * 1024 * 1024 },
    );
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${path}: cwebp did not produce a valid output file`);
    }
    mkdirSync(dirname(path), { recursive: true });
    renameSync(webpPath, path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function isCheckerPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) >= 215 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 12;
}

function clearConnectedCheckerboard(image) {
  const { data, width, height } = image;
  const queued = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixel = y * width + x;
    if (queued[pixel] || !isCheckerPixel(data, pixel * 4)) return;
    queued[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return tail;
}

function resizeNearest(source, width, height) {
  if (source.width === width && source.height === height) return source.data;
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y * source.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      source.data.copy(output, outputOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return output;
}

function renderTarget(target) {
  const source = decodePng(resolve(packageRoot, target.source));
  const clearedPixels = clearConnectedCheckerboard(source);
  if (clearedPixels < source.width * source.height * 0.3) {
    throw new Error(`${target.id}: checkerboard cleanup removed too little background (${clearedPixels} px)`);
  }
  return {
    data: resizeNearest(source, outputSize.width, outputSize.height),
    width: outputSize.width,
    height: outputSize.height,
    clearedPixels,
  };
}

assertBinary("ffmpeg");
assertBinary("cwebp");

for (const target of targets) {
  const rendered = renderTarget(target);
  const destination = resolve(packageRoot, target.output);
  if (mode === "write") {
    encodeWebp(destination, rendered.width, rendered.height, rendered.data);
    console.log(
      `generated ${target.output}: ${rendered.width}x${rendered.height}, cleared ${rendered.clearedPixels} px`,
    );
    continue;
  }

  if (!existsSync(destination)) throw new Error(`${target.output}: missing; run this script without --check`);
  const dir = mkdtempSync(join(tmpdir(), "deadrot-dual-check-"));
  const generated = join(dir, "generated.webp");
  try {
    encodeWebp(generated, rendered.width, rendered.height, rendered.data);
    if (!readFileSync(generated).equals(readFileSync(destination))) {
      throw new Error(`${target.output}: stale; run this script without --check`);
    }
    console.log(`checked ${target.output}: deterministic`);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}
