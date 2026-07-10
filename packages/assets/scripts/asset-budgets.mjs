#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_APPS } from "../../catalog/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(scriptDir, "..");
const repoRoot = resolve(assetsRoot, "../..");
const configPath = join(assetsRoot, "asset-budgets.json");

const RUNTIME_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".glb",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".ogg",
  ".png",
  ".svg",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff2",
]);
const RASTER_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const FORBIDDEN_RUNTIME_RASTER = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png"]);
const OG_CARD_PATTERN = /^games\/[^/]+\/ui\/social\/og\.jpg$/;
const BROWSER_BUDGET_FIELDS = [
  "maxBootResourceRequests",
  "maxBootWebpRequests",
  "maxBootDecodedBodyBytes",
  "maxCombatResourceRequests",
  "maxCombatWebpRequests",
  "maxCombatDecodedBodyBytes",
];

const options = parseArgs(process.argv.slice(2));
const report = analyzeAssetBudgets();

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderTextReport(report));
}

if (options.check && report.violations.length > 0) process.exitCode = 1;

export function analyzeAssetBudgets() {
  const config = readJson(configPath);
  const catalog = readJson(join(assetsRoot, "assets-catalog.json"));
  const games = GAME_APPS.map((game) => analyzeGame(game, config, catalog));
  const violations = games.flatMap((game) =>
    game.violations.map((violation) => ({
      game: game.slug,
      ...violation,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    config: relative(repoRoot, configPath),
    games,
    violations,
  };
}

function analyzeGame(game, config, catalog) {
  const slug = game.slug;
  const gameConfig = config.games?.[slug] ?? {};
  const category = gameConfig.category ?? "small-arcade";
  const categoryBudget = config.categories?.[category] ?? {};
  const budget = {
    ...categoryBudget,
    ...gameConfig,
    category,
  };

  const files = new Map();
  const missingFiles = [];
  const manifestPaths = new Set();
  const initialPaths = new Set();

  const addFile = (assetPath, source) => {
    const normalized = normalizeAssetPath(assetPath);
    if (!isRuntimeAssetPath(normalized)) return;

    const fullPath = join(assetsRoot, ...normalized.split("/"));
    if (!existsSync(fullPath)) {
      missingFiles.push({ path: normalized, source });
      return;
    }

    const stat = statSync(fullPath);
    if (!stat.isFile()) return;

    const existing = files.get(normalized) ?? {
      path: normalized,
      bytes: stat.size,
      sources: new Set(),
      manifestCovered: false,
      initial: false,
    };
    existing.sources.add(source);
    if (source === "manifest" || source === "animation-pack" || source === "catalog") existing.manifestCovered = true;
    if (initialPaths.has(normalized) || isInitialCandidate(normalized)) existing.initial = true;
    files.set(normalized, existing);
  };

  for (const file of walkFiles(join(assetsRoot, "games", slug))) {
    addFile(toAssetPath(file), "game-dir");
  }

  for (const path of catalogPathsForGame(catalog, slug)) {
    manifestPaths.add(path);
    addFile(path, "catalog");
  }

  for (const record of readGameManifestRecords(slug)) {
    manifestPaths.add(record.path);
    if (record.initial) initialPaths.add(record.path);
    addFile(record.path, "manifest");
  }

  for (const path of readAnimationPackPaths(slug)) {
    manifestPaths.add(path);
    addFile(path, "animation-pack");
  }

  for (const path of initialPaths) {
    const file = files.get(path);
    if (file) file.initial = true;
  }

  const fileList = [...files.values()].map((file) => ({
    ...file,
    sources: [...file.sources].sort(),
  }));
  fileList.sort((a, b) => a.path.localeCompare(b.path));

  const totalBytes = sum(fileList.map((file) => file.bytes));
  // This is a declaration/path heuristic, not an observation of browser boot
  // requests. Browser budgets are enforced by each game's production E2E gate.
  const declaredInitialFiles = fileList.filter((file) => file.initial);
  const declaredInitialBytes = sum(declaredInitialFiles.map((file) => file.bytes));
  const coveredFiles = fileList.filter((file) => file.manifestCovered);
  const manifestCoverage = fileList.length ? coveredFiles.length / fileList.length : 1;
  const largestFiles = [...fileList].sort((a, b) => b.bytes - a.bytes).slice(0, 10);
  const violations = collectViolations({
    slug,
    budget,
    fileList,
    missingFiles,
    totalBytes,
    declaredInitialBytes,
    manifestCoverage,
  });

  return {
    slug,
    title: game.title,
    category,
    budget: pickBudgetFields(budget),
    files: fileList.length,
    totalBytes,
    declaredInitialBytes,
    declaredInitialFiles: declaredInitialFiles.length,
    manifestCoveredFiles: coveredFiles.length,
    manifestCoverage,
    largestFiles: largestFiles.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      sources: file.sources,
    })),
    violations,
  };
}

function collectViolations({ budget, fileList, missingFiles, totalBytes, declaredInitialBytes, manifestCoverage }) {
  const violations = [];

  if (totalBytes > budget.maxTotalBytes) {
    violations.push({
      type: "total-budget",
      limitBytes: budget.maxTotalBytes,
      actualBytes: totalBytes,
      files: fileList.map((file) => file.path),
    });
  }

  if (declaredInitialBytes > budget.maxInitialBytes) {
    violations.push({
      type: "declared-initial-budget",
      limitBytes: budget.maxInitialBytes,
      actualBytes: declaredInitialBytes,
      files: fileList.filter((file) => file.initial).map((file) => file.path),
    });
  }

  const hasBrowserBudget = BROWSER_BUDGET_FIELDS.some((field) => budget[field] !== undefined);
  if (hasBrowserBudget) {
    for (const field of BROWSER_BUDGET_FIELDS) {
      if (!Number.isInteger(budget[field]) || budget[field] <= 0) {
        violations.push({
          type: "invalid-browser-budget",
          field,
          reason: "browser budget fields must be positive integers and must be configured as a complete set",
          files: [],
        });
      }
    }
  }

  for (const file of fileList) {
    if (file.bytes > budget.maxFileBytes) {
      violations.push({
        type: "file-budget",
        limitBytes: budget.maxFileBytes,
        actualBytes: file.bytes,
        files: [file.path],
      });
    }

    const extension = extname(file.path).toLowerCase();
    if (
      RASTER_EXTENSIONS.has(extension) &&
      FORBIDDEN_RUNTIME_RASTER.has(extension) &&
      !OG_CARD_PATTERN.test(file.path)
    ) {
      violations.push({
        type: "runtime-raster-format",
        reason: "runtime raster must be WebP; JPEG is only allowed for ui/social/og.jpg",
        files: [file.path],
      });
    }
  }

  if (manifestCoverage < budget.minManifestCoverage) {
    violations.push({
      type: "manifest-coverage",
      minimum: budget.minManifestCoverage,
      actual: manifestCoverage,
      files: fileList.filter((file) => !file.manifestCovered).map((file) => file.path),
    });
  }

  for (const missing of missingFiles) {
    violations.push({
      type: "missing-runtime-file",
      source: missing.source,
      files: [missing.path],
    });
  }

  return violations;
}

function catalogPathsForGame(catalog, slug) {
  const paths = [];
  for (const entity of catalog.entities ?? []) {
    const path = entity.variants?.[slug];
    if (typeof path === "string" && path.trim()) paths.push(path);
  }
  return paths;
}

function readGameManifestRecords(slug) {
  const manifestPath = join(assetsRoot, "games", slug, "assets.json");
  if (!existsSync(manifestPath)) return [];
  return collectManifestRecords(readJson(manifestPath));
}

function collectManifestRecords(node, records = [], inheritedInitial = false) {
  if (Array.isArray(node)) {
    for (const item of node) collectManifestRecords(item, records, inheritedInitial);
    return records;
  }

  if (!node || typeof node !== "object") return records;

  const explicitInitial = inheritedInitial || node.preload === true || node.initial === true || node.eager === true;
  if (typeof node.path === "string") {
    records.push({
      path: normalizeAssetPath(node.path),
      initial: explicitInitial || isInitialCandidate(node.path),
    });
  }

  for (const value of Object.values(node)) collectManifestRecords(value, records, explicitInitial);
  return records;
}

function readAnimationPackPaths(slug) {
  const paths = [];
  for (const packPath of walkFiles(join(assetsRoot, "games", slug))) {
    if (!packPath.endsWith(`${sep}animation-pack.json`)) continue;
    const pack = readJson(packPath);
    const atlasPages = Array.isArray(pack.runtimeAtlas?.pages) ? pack.runtimeAtlas.pages : [];
    for (const page of atlasPages) {
      if (typeof page?.path === "string" && page.path.trim()) paths.push(normalizeAssetPath(page.path));
    }

    const views = Array.isArray(pack.views) ? pack.views : [];
    const framesPerAction = Number(pack.framesPerAction);
    if (!Number.isInteger(framesPerAction) || framesPerAction <= 0) continue;

    for (const entity of Object.values(pack.entities ?? {})) {
      for (const action of Object.values(entity.actions ?? {})) {
        if (typeof action.pathTemplate !== "string") continue;
        for (const view of views) {
          for (let frame = 0; frame < framesPerAction; frame += 1) {
            const frameId = String(frame).padStart(2, "0");
            paths.push(`games/${slug}/${action.pathTemplate.replace("{view}", view).replace("{frame}", frameId)}`);
          }
        }
      }
    }
  }
  return paths;
}

function walkFiles(root, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, out);
    else if (entry.isFile()) out.push(fullPath);
  }
  return out;
}

function isRuntimeAssetPath(assetPath) {
  if (!assetPath) return false;
  if (assetPath.includes("/sources/") || assetPath.includes("/source/") || assetPath.includes("/_archive/")) {
    return false;
  }
  return RUNTIME_EXTENSIONS.has(extname(assetPath).toLowerCase());
}

function isInitialCandidate(assetPath) {
  return /^games\/[^/]+\/(?:fonts|ui\/cover|ui\/menu)\//.test(normalizeAssetPath(assetPath));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toAssetPath(file) {
  return normalizeAssetPath(relative(assetsRoot, file));
}

function normalizeAssetPath(path) {
  return path.split(sep).join("/").replace(/^\/+/, "");
}

function pickBudgetFields(budget) {
  const fields = {
    maxTotalBytes: budget.maxTotalBytes,
    maxDeclaredInitialBytes: budget.maxInitialBytes,
    maxFileBytes: budget.maxFileBytes,
    minManifestCoverage: budget.minManifestCoverage,
  };
  for (const field of BROWSER_BUDGET_FIELDS) {
    if (budget[field] !== undefined) fields[field] = budget[field];
  }
  return fields;
}

function renderTextReport(report) {
  const lines = ["Runtime asset budget report", ""];

  for (const game of report.games) {
    const mark = game.violations.length ? "FAIL" : "PASS";
    lines.push(
      `${mark} ${game.slug} (${game.category}) ${formatBytes(game.totalBytes)} total, ${formatBytes(
        game.declaredInitialBytes,
      )} declared initial, ${game.files} files, ${Math.round(game.manifestCoverage * 100)}% covered`,
    );
    if (game.budget.maxBootWebpRequests !== undefined) {
      lines.push(
        `  Browser budgets: boot <= ${game.budget.maxBootResourceRequests} resources / ${formatBytes(
          game.budget.maxBootDecodedBodyBytes,
        )} decoded / ${game.budget.maxBootWebpRequests} WebPs; combat <= ${
          game.budget.maxCombatResourceRequests
        } resources / ${formatBytes(
          game.budget.maxCombatDecodedBodyBytes,
        )} decoded / ${game.budget.maxCombatWebpRequests} WebPs`,
      );
    }
    lines.push("  Largest files:");
    for (const file of game.largestFiles.slice(0, 5)) {
      lines.push(`  - ${formatBytes(file.bytes).padStart(9)} ${file.path}`);
    }
    if (game.violations.length) {
      lines.push("  Violations:");
      for (const violation of game.violations) {
        lines.push(`  - ${violation.type}: ${violation.files.join(", ")}`);
      }
    }
  }

  lines.push("");
  if (report.violations.length) {
    lines.push(`Asset budget check failed with ${report.violations.length} violation(s).`);
  } else {
    lines.push("Asset budget check passed.");
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    json: argv.includes("--json"),
  };
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
