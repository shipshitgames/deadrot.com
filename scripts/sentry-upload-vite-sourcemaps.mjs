#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apps = [
  { name: "deadlane", dir: "apps/games/deadlane", project: "deadrot-deadlane" },
  { name: "pactfall", dir: "apps/games/pactfall", project: "deadrot-pactfall" },
  { name: "redline", dir: "apps/games/redline", project: "deadrot-redline" },
  { name: "rothulk", dir: "apps/games/rothulk", project: "deadrot-rothulk" },
  { name: "scourge-survivors", dir: "apps/games/scourge-survivors", project: "deadrot-scourge-survivors" },
  { name: "starblight", dir: "apps/games/starblight", project: "deadrot-starblight" },
  { name: "warline", dir: "apps/games/warline", project: "deadrot-warline" },
];

const shellEnvKeys = new Set(Object.keys(process.env));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepSourcemaps = args.includes("--keep-sourcemaps") || process.env.SENTRY_KEEP_SOURCEMAPS === "1";
const selectedApps = new Set(
  args
    .filter((arg) => arg.startsWith("--app="))
    .flatMap((arg) => arg.slice("--app=".length).split(","))
    .map((app) => app.trim())
    .filter(Boolean),
);

loadEnvFile(path.join(root, ".env.production"));
loadEnvFile(path.join(root, ".env.local"), { overrideFileValues: true });

const org = process.env.SENTRY_ORG || "shipshitgames";
const release = resolveRelease();
const appsToUpload = selectedApps.size > 0 ? apps.filter((app) => selectedApps.has(app.name)) : apps;

if (appsToUpload.length === 0) {
  fail(`No matching apps for ${[...selectedApps].join(", ")}`);
}

if (!process.env.SENTRY_AUTH_TOKEN && !dryRun) {
  fail("SENTRY_AUTH_TOKEN is required to upload source maps.");
}

console.log(`Sentry org: ${org}`);
console.log(`Sentry release: ${release}`);
console.log(`Apps: ${appsToUpload.map((app) => app.name).join(", ")}`);

for (const app of appsToUpload) {
  const distDir = path.join(root, app.dir, "dist");
  if (!existsSync(distDir)) {
    fail(`${app.name}: missing dist directory. Run its production build first.`);
  }

  const mapFiles = findFiles(distDir, (file) => file.endsWith(".map"));
  if (mapFiles.length === 0) {
    fail(`${app.name}: no sourcemaps found in ${distDir}. Make sure Vite build.sourcemap is enabled.`);
  }

  if (!dryRun) {
    run("sentry-cli", ["releases", "new", "--org", org, "--project", app.project, release], { allowFailure: true });
  }

  console.log(`\n${app.name}: injecting debug IDs`);
  run("sentry-cli", ["sourcemaps", "inject", "--org", org, "--project", app.project, "--release", release, distDir]);

  console.log(`${app.name}: uploading ${mapFiles.length} source maps`);
  run("sentry-cli", [
    "sourcemaps",
    "upload",
    "--org",
    org,
    "--project",
    app.project,
    "--release",
    release,
    "--dist",
    app.name,
    "--validate",
    "--wait",
    distDir,
  ]);

  if (!keepSourcemaps) {
    removeSourcemapReferences(distDir);
    for (const mapFile of findFiles(distDir, (file) => file.endsWith(".map"))) {
      if (!dryRun) rmSync(mapFile);
    }
    console.log(`${app.name}: ${dryRun ? "would remove" : "removed"} generated source maps from dist`);
  }

  if (!dryRun) {
    run("sentry-cli", ["releases", "finalize", "--org", org, "--project", app.project, release], {
      allowFailure: true,
    });
  }
}

console.log("\nSentry Vite sourcemap upload complete.");

function loadEnvFile(file, options = {}) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 0) continue;
    const key = line.slice(0, equals).trim();
    if (process.env[key] !== undefined && (!options.overrideFileValues || shellEnvKeys.has(key))) continue;
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function resolveRelease() {
  const explicit =
    process.env.SENTRY_RELEASE ||
    process.env.VITE_DEADROT_RELEASE ||
    process.env.NEXT_PUBLIC_DEADROT_RELEASE ||
    process.env.VITE_APP_VERSION;
  if (explicit) return explicit;

  try {
    const sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (sha) return `deadrot@${sha}`;
  } catch {
    // Fall through to package version fallback.
  }

  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return `deadrot@${packageJson.version ?? "local"}`;
}

function findFiles(dir, predicate) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(fullPath, predicate));
    else if (predicate(fullPath)) found.push(fullPath);
  }
  return found;
}

function removeSourcemapReferences(dir) {
  for (const file of findFiles(dir, (candidate) => /\.(c|m)?js$/.test(candidate))) {
    const before = readFileSync(file, "utf8");
    const after = before.replace(/\n?\/\/# sourceMappingURL=.*?\.map\s*$/gm, "");
    if (after !== before && !dryRun) writeFileSync(file, after);
  }
}

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(" ");
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return;
  }

  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status || 1);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
