#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(scriptDir, "..");
const repoRoot = resolve(assetsRoot, "../..");
const problems = [];

function fail(message) {
  problems.push(message);
}

function assetPath(...parts) {
  return join(assetsRoot, ...parts);
}

function existsPackagePath(path) {
  return existsSync(assetPath(path));
}

function trackedAssetFiles() {
  const output = execFileSync("git", ["ls-files", "packages/assets"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

  return output ? output.split("\n").filter((path) => existsSync(resolve(repoRoot, path))) : [];
}

function runtimeFolder(path) {
  return /^packages\/assets\/(?:brand|universe|games|entities|shared|concepts)\//.test(path);
}

function checkTrackedBoundaries() {
  for (const path of trackedAssetFiles()) {
    const name = basename(path).toLowerCase();

    if (path.startsWith("packages/assets/sources/")) fail(`tracked source archive remains in package: ${path}`);
    if (path.startsWith("packages/assets/sites/")) fail(`tracked site mirror remains in package: ${path}`);
    if (path.startsWith("packages/assets/sprites/")) fail(`tracked flat sprites folder remains in package: ${path}`);
    if (path.startsWith("packages/assets/node_modules/")) fail(`tracked node_modules file remains in package: ${path}`);
    if (path.includes("/source/")) fail(`tracked runtime source folder remains in package: ${path}`);

    if (runtimeFolder(path) && /\b(draft|source|clean)\b/.test(name.replace(/[-_.]/g, " "))) {
      fail(`runtime asset filename looks like draft/source/cleanup residue: ${path}`);
    }
  }
}

function readJpegSize(file) {
  const buffer = readFileSync(file);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("not a JPEG");

  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2) break;

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }

    offset += length;
  }

  throw new Error("missing JPEG size marker");
}

function readWebpSize(file) {
  const buffer = readFileSync(file);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("not a WebP");
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8 ") {
    const start = 20;
    if (buffer[start + 3] !== 0x9d || buffer[start + 4] !== 0x01 || buffer[start + 5] !== 0x2a) {
      throw new Error("missing VP8 frame header");
    }
    return {
      width: buffer.readUInt16LE(start + 6) & 0x3fff,
      height: buffer.readUInt16LE(start + 8) & 0x3fff,
    };
  }

  if (chunkType === "VP8L") {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  throw new Error(`unsupported WebP chunk ${chunkType}`);
}

function gameDirs() {
  return readdirSync(assetPath("games"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function checkImageContracts() {
  for (const slug of gameDirs()) {
    const ogPath = assetPath("games", slug, "ui/social/og.jpg");
    if (!existsSync(ogPath)) {
      fail(`missing game social image: games/${slug}/ui/social/og.jpg`);
      continue;
    }

    try {
      const size = readJpegSize(ogPath);
      if (size.width !== 1200 || size.height !== 630) {
        fail(`game social image must be 1200x630 JPEG: games/${slug}/ui/social/og.jpg is ${size.width}x${size.height}`);
      }
    } catch (error) {
      fail(`game social image must be readable JPEG: games/${slug}/ui/social/og.jpg (${error.message})`);
    }

    const titlePath = assetPath("games", slug, "ui/menu/title.webp");
    if (!existsSync(titlePath)) {
      fail(`missing game title art: games/${slug}/ui/menu/title.webp`);
      continue;
    }

    try {
      const size = readWebpSize(titlePath);
      if (size.width * 9 !== size.height * 16) {
        fail(`game title art must be 16:9 WebP: games/${slug}/ui/menu/title.webp is ${size.width}x${size.height}`);
      }
    } catch (error) {
      fail(`game title art must be readable WebP: games/${slug}/ui/menu/title.webp (${error.message})`);
    }
  }
}

function checkCatalogPaths() {
  const catalog = JSON.parse(readFileSync(assetPath("assets-catalog.json"), "utf8"));

  for (const entity of catalog.entities ?? []) {
    for (const [game, path] of Object.entries(entity.variants ?? {})) {
      if (path && !existsPackagePath(path)) {
        fail(`catalog variant missing file: ${entity.id}.${game} -> ${path}`);
      }
    }
  }

  for (const shared of catalog.shared ?? []) {
    if (shared.path && !existsPackagePath(shared.path)) {
      fail(`catalog shared asset missing file: ${shared.id} -> ${shared.path}`);
    }
  }
}

function collectManifestPaths(value, out = new Set()) {
  if (!value || typeof value !== "object") return out;

  if (typeof value.path === "string") out.add(value.path);
  if (value.views && typeof value.views === "object") {
    for (const view of Object.values(value.views)) collectManifestPaths(view, out);
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") collectManifestPaths(nested, out);
  }

  return out;
}

function checkScourgeManifestPaths() {
  const manifest = JSON.parse(readFileSync(assetPath("games/scourge-survivors/assets.json"), "utf8"));
  const paths = collectManifestPaths(manifest);

  for (const path of paths) {
    if (!path.startsWith("games/scourge-survivors/")) fail(`Scourge Survivors manifest path leaves game pack: ${path}`);
    if (path.includes("/source/") || path.includes("/sources/") || path.includes("/_archive/")) {
      fail(`Scourge Survivors manifest path points at non-runtime material: ${path}`);
    }
    if (!existsPackagePath(path)) fail(`Scourge Survivors manifest path missing file: ${path}`);
  }
}

function checkScourgeAnimationPack() {
  const packPath = assetPath("games/scourge-survivors/animations/scourge/animation-pack.json");
  const pack = JSON.parse(readFileSync(packPath, "utf8"));

  for (const [entityId, entity] of Object.entries(pack.entities ?? {})) {
    for (const [actionId, action] of Object.entries(entity.actions ?? {})) {
      for (const view of pack.views ?? []) {
        for (let frame = 0; frame < pack.framesPerAction; frame += 1) {
          const frameId = String(frame).padStart(2, "0");
          const path = `games/scourge-survivors/${action.pathTemplate
            .replace("{view}", view)
            .replace("{frame}", frameId)}`;
          if (path.includes("/source/") || path.includes("/sources/")) {
            fail(`animation pack path points at source material: ${entityId}.${actionId}.${view}.${frameId} -> ${path}`);
          }
          if (!existsPackagePath(path)) {
            fail(`animation pack frame missing: ${entityId}.${actionId}.${view}.${frameId} -> ${path}`);
          }
        }
      }
    }
  }
}

function checkNoEmptySourceTree() {
  const sourcesPath = assetPath("sources");
  if (existsSync(sourcesPath)) {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile()) files.push(relative(assetsRoot, fullPath));
      }
    };
    walk(sourcesPath);
    if (files.length > 0) fail(`packages/assets/sources must not contain runtime package files: ${files.join(", ")}`);
  }
}

checkTrackedBoundaries();
checkNoEmptySourceTree();
checkImageContracts();
checkCatalogPaths();
checkScourgeManifestPaths();
checkScourgeAnimationPack();

if (problems.length > 0) {
  console.error("Asset package check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Asset package check passed.");
