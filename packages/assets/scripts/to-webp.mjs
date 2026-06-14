#!/usr/bin/env node
// to-webp — the reusable runtime-WebP conversion command (deadrot.com#118).
//
// Converts source raster (PNG/JPEG) into runtime WebP using the shared policy:
// pixel art and tiny crisp UI sprites convert lossless; everything else uses
// high-quality lossy WebP. Author-run: it shells out to `cwebp`, which is NOT
// installed in CI, so the promoted .webp files are committed, not regenerated
// on the runner.
//
//   bun run --cwd packages/assets assets:to-webp <files-or-dirs...> [flags]
//
// Flags:
//   --lossless        force lossless for every input
//   --lossy           force lossy for every input
//   --quality <n>     lossy quality 0..100 (default 82)
//   --out <path>      explicit output (single-file input only)
//   --keep            keep source files (default keeps them too; see --rm)
//   --rm              delete each source after a successful conversion
//   --force           overwrite an existing .webp
//   --dry-run         print the plan without invoking cwebp
//
// Examples:
//   assets:to-webp games/scourge-survivors/ui/cards/codex/breach.png
//   assets:to-webp games/scourge-survivors/ui --rm
//   assets:to-webp shared/ui/icons/pixel --lossless

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRuntimeRaster, planConversion } from "./lib/asset-format-policy.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseArgs(argv) {
  const opts = {
    inputs: [],
    force: undefined, // lossless override: true | false | undefined
    quality: undefined,
    out: undefined,
    rm: false,
    overwrite: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--lossless":
        opts.force = true;
        break;
      case "--lossy":
        opts.force = false;
        break;
      case "--quality":
        opts.quality = Number.parseInt(argv[++i], 10);
        break;
      case "--out":
        opts.out = argv[++i];
        break;
      case "--keep":
        opts.rm = false;
        break;
      case "--rm":
        opts.rm = true;
        break;
      case "--force":
        opts.overwrite = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        opts.inputs.push(arg);
    }
  }
  return opts;
}

/** Recursively collect source raster files under a file or directory. */
function collectRasterFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return isRuntimeRaster(target) ? [target] : [];
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const child = join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectRasterFiles(child));
    else if (entry.isFile() && isRuntimeRaster(child)) out.push(child);
  }
  return out;
}

function hasCwebp() {
  const probe = spawnSync("cwebp", ["-version"], { stdio: "ignore" });
  return probe.status === 0;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`to-webp: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  if (opts.inputs.length === 0) {
    console.error("to-webp: nothing to convert. Pass one or more files or directories.");
    process.exitCode = 2;
    return;
  }
  if (opts.out && opts.inputs.length !== 1) {
    console.error("to-webp: --out only works with a single file input.");
    process.exitCode = 2;
    return;
  }
  if (opts.quality !== undefined && (Number.isNaN(opts.quality) || opts.quality < 0 || opts.quality > 100)) {
    console.error("to-webp: --quality must be an integer between 0 and 100.");
    process.exitCode = 2;
    return;
  }

  const sources = [];
  for (const input of opts.inputs) {
    const abs = resolve(input);
    if (!existsSync(abs)) {
      console.error(`to-webp: no such path: ${input}`);
      process.exitCode = 2;
      return;
    }
    sources.push(...collectRasterFiles(abs));
  }

  if (sources.length === 0) {
    console.error("to-webp: no PNG/JPEG source raster found in the given paths.");
    process.exitCode = 1;
    return;
  }

  if (!opts.dryRun && !hasCwebp()) {
    console.error(
      "to-webp: `cwebp` not found on PATH. Install it (macOS: `brew install webp`) and re-run. " +
        "Conversion is author-run; CI does not need cwebp because promoted .webp files are committed.",
    );
    process.exitCode = 127;
    return;
  }

  let converted = 0;
  let failed = 0;
  for (const src of sources) {
    const plan = planConversion(src, {
      force: opts.force,
      quality: opts.quality,
      dest: opts.out ? resolve(opts.out) : undefined,
    });
    const rel = (p) => relative(packageRoot, p) || p;
    const mode = plan.lossless ? "lossless" : `lossy q=${plan.quality}`;

    if (!opts.overwrite && existsSync(plan.dest)) {
      console.log(`skip   ${rel(plan.dest)} (exists; pass --force to overwrite)`);
      continue;
    }
    if (opts.dryRun) {
      console.log(`plan   ${rel(src)} → ${rel(plan.dest)} [${mode}]`);
      continue;
    }

    const result = spawnSync("cwebp", plan.args, { stdio: ["ignore", "ignore", "pipe"] });
    if (result.status !== 0) {
      failed++;
      const stderr = result.stderr ? result.stderr.toString().trim() : "unknown error";
      console.error(`fail   ${rel(src)}: ${stderr}`);
      continue;
    }
    converted++;
    console.log(`ok     ${rel(src)} → ${rel(plan.dest)} [${mode}]`);
    if (opts.rm) {
      rmSync(src);
      console.log(`rm     ${rel(src)}`);
    }
  }

  if (!opts.dryRun) {
    console.log(`\nto-webp: ${converted} converted, ${failed} failed.`);
  }
  if (failed > 0) process.exitCode = 1;
}

main();
