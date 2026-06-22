#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const source = process.env.CODEX_GENERATED_IMAGES_DIR ?? resolve(process.env.HOME ?? "", ".codex/generated_images");
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const dest = resolve(repoRoot, "packages/assets/_archive/raw-generator-cache/codex-generated-images", date, "raw");

if (!existsSync(source)) {
  console.error(`Codex generated images directory not found: ${source}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

let copied = 0;
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const sourceDir = join(source, entry.name);
  const files = readdirSync(sourceDir).filter((name) => /\.(?:png|jpe?g|webp)$/i.test(name));
  if (files.length === 0) continue;

  const destDir = join(dest, basename(sourceDir));
  mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    cpSync(join(sourceDir, file), join(destDir, file), { preserveTimestamps: true });
    copied += 1;
  }
}

const size = statSync(dest).isDirectory() ? "done" : "unknown";
console.log(`Copied ${copied} images from ${source} to ${dest} (${size}).`);
