#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLoreArtMap, renderLoreArtMapMarkdown, serializeLoreArtMap, slugify } from "./lib/lore-art-map-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(scriptDir, "..");
const repoRoot = resolve(assetsRoot, "../..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function packageAssetPaths() {
  return walk(assetsRoot)
    .map((path) => relative(repoRoot, path).replace(/\\/g, "/"))
    .sort();
}

function notePaths() {
  const root = join(repoRoot, "apps/lore/content");
  const notes = new Map();
  for (const file of walk(root)) {
    if (!file.endsWith(".md")) continue;
    const rel = relative(root, file).replace(/\\/g, "/");
    const base = rel.split("/").pop()?.replace(/\.md$/, "");
    const key = slugify(base);
    if (key && !notes.has(key)) notes.set(key, rel);
  }
  return notes;
}

function gameManifests() {
  const gamesRoot = join(assetsRoot, "games");
  const manifests = {};
  if (!existsSync(gamesRoot)) return manifests;
  for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(gamesRoot, entry.name, "assets.json");
    if (existsSync(manifestPath)) manifests[entry.name] = readJson(manifestPath);
  }
  return manifests;
}

function parseArgs(argv) {
  const opts = {
    check: false,
    jsonOut: join(assetsRoot, "lore/art-map.json"),
    mdOut: join(repoRoot, "apps/lore/content/Art/Lore-Asset-Map.md"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") opts.check = true;
    else if (arg === "--json-out") opts.jsonOut = resolve(argv[++i]);
    else if (arg === "--md-out") opts.mdOut = resolve(argv[++i]);
    else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function writeIfChanged(path, content, check) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === content) return false;
  if (check) return true;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

function buildReport() {
  return buildLoreArtMap({
    characters: readJson(join(assetsRoot, "lore/characters.json")),
    bestiary: readJson(join(assetsRoot, "lore/bestiary.json")),
    catalog: readJson(join(assetsRoot, "assets-catalog.json")),
    assetIndex: readJson(join(assetsRoot, "assets.index.json")),
    gameManifests: gameManifests(),
    assetPaths: packageAssetPaths(),
    notePaths: notePaths(),
    manualStatusMarkdown: existsSync(join(repoRoot, "apps/lore/content/Art/Character-Asset-Status.md"))
      ? readFileSync(join(repoRoot, "apps/lore/content/Art/Character-Asset-Status.md"), "utf8")
      : "",
  });
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const report = buildReport();
  const json = serializeLoreArtMap(report);
  const markdown = renderLoreArtMapMarkdown(report);
  const staleJson = writeIfChanged(opts.jsonOut, json, opts.check);
  const staleMd = writeIfChanged(opts.mdOut, markdown, opts.check);

  if (opts.check && (staleJson || staleMd)) {
    console.error("lore art map is stale; regenerate with `bun run --cwd packages/assets lore:art-map`");
    if (staleJson) console.error(`  stale: ${relative(repoRoot, opts.jsonOut)}`);
    if (staleMd) console.error(`  stale: ${relative(repoRoot, opts.mdOut)}`);
    process.exit(1);
  }

  const action = opts.check ? "checked" : "wrote";
  console.log(
    `lore art map ${action}: ${report.summary.entries} entries, ${report.summary.locked} locked, ` +
      `${report.summary.runtimeLinked} runtime-linked, ${report.summary.missing} missing`,
  );
} catch (error) {
  console.error(`generate-lore-art-map: ${error.message}`);
  process.exit(1);
}
