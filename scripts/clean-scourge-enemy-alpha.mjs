import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const assetRoots = [
  "packages/assets/games/scourge-survivors/enemies/scourge",
  "packages/assets/games/scourge-survivors/animations/scourge",
];
const marker = Buffer.from("ENDHDR\n");

const mode = process.argv.includes("--check") ? "check" : "fix";

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
    maxBuffer: 64 * 1024 * 1024,
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

function isPurpleFringePixel(r, g, b, a) {
  if (a === 0 || a >= 250) return false;
  return b > 45 && r > 35 && b > g * 1.25 && r > g * 1.12;
}

function isBrightMagentaPixel(r, g, b, a) {
  if (a < 250) return false;
  return r >= 140 && b >= 140 && g <= 85 && Math.abs(r - b) <= 95 && (r + b) / 2 - g >= 95;
}

function isMagentaDominantPixel(r, g, b, a) {
  if (a < 250) return false;
  return r >= 110 && b >= 110 && g <= 110 && Math.abs(r - b) <= 125 && (r + b) / 2 - g >= 55;
}

function hasTransparentNeighbor(data, width, height, x, y) {
  for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
      if (xx === x && yy === y) continue;
      if (data[(yy * width + xx) * 4 + 3] === 0) return true;
    }
  }
  return false;
}

function replacementColor(data, width, height, x, y) {
  for (let radius = 1; radius <= 5; radius += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
        if (xx === x && yy === y) continue;
        const offset = (yy * width + xx) * 4;
        if (data[offset + 3] < 250) continue;
        if (isMagentaDominantPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) continue;
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count += 1;
      }
    }

    if (count > 0) return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
  }

  return null;
}

function cleanPurpleFringe(data, width, height) {
  let changedPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (isPurpleFringePixel(r, g, b, a)) {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
        changedPixels += 1;
        continue;
      }

      if (!isBrightMagentaPixel(r, g, b, a) || !hasTransparentNeighbor(data, width, height, x, y)) continue;
      const replacement = replacementColor(data, width, height, x, y);
      if (replacement && !isMagentaDominantPixel(replacement[0], replacement[1], replacement[2], 255)) {
        data[offset] = replacement[0];
        data[offset + 1] = replacement[1];
        data[offset + 2] = replacement[2];
      } else {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
      }
      changedPixels += 1;
    }
  }
  return changedPixels;
}

function encodeWebp(path, header, data) {
  const dir = mkdtempSync(join(tmpdir(), "deadrot-scourge-alpha-"));
  const pamPath = join(dir, "sprite.pam");
  const webpPath = join(dir, "sprite.webp");
  try {
    writeFileSync(pamPath, Buffer.concat([header, data]));
    execFileSync("cwebp", ["-quiet", "-lossless", "-m", "4", "-exact", pamPath, "-o", webpPath], {
      maxBuffer: 16 * 1024 * 1024,
    });
    if (!existsSync(webpPath) || statSync(webpPath).size <= 0) {
      throw new Error(`${path}: cwebp did not produce a valid output file`);
    }
    renameSync(webpPath, path);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

assertBinary("dwebp");
if (mode === "fix") assertBinary("cwebp");

const files = assetRoots.flatMap((root) => walkWebpFiles(resolve(repoRoot, root))).sort();
let changedFiles = 0;
let changedPixels = 0;

for (const path of files) {
  const { header, data, width, height } = decodePam(path);
  const fileChangedPixels = cleanPurpleFringe(data, width, height);
  if (fileChangedPixels === 0) continue;

  changedFiles += 1;
  changedPixels += fileChangedPixels;
  if (mode === "fix") encodeWebp(path, header, data);
}

if (mode === "check" && changedPixels > 0) {
  console.error(
    `Scourge enemy alpha check failed: ${changedPixels} magenta fringe pixels across ${changedFiles} files.`,
  );
  process.exit(1);
}

const action = mode === "fix" ? "Cleaned" : "Checked";
console.log(
  `${action} ${files.length} Scourge enemy sprite files; ${changedPixels} magenta fringe pixels in ${changedFiles} files.`,
);
