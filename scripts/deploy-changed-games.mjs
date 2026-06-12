#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const gamesRoot = path.join(repoRoot, "apps/games");
const args = process.argv.slice(2);

const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const noBuild = args.includes("--no-build");
const preview = args.includes("--preview");
const base =
  flagValue("--base") ??
  process.env.VERCEL_GIT_PREVIOUS_SHA ??
  process.env.GITHUB_BASE_REF ??
  process.env.BASE_REF ??
  "origin/master";
const head = flagValue("--head") ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";

const gameDirs = readdirSync(gamesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const gamePackages = new Map(
  gameDirs.map((slug) => {
    const packageJson = path.join(gamesRoot, slug, "package.json");
    const pkg = JSON.parse(readFileSync(packageJson, "utf8"));
    return [slug, pkg];
  }),
);

const changedFiles = all ? [] : unique([...gitChangedFiles(), ...gitLocalChangedFiles(), ...gitUntrackedFiles()]);
const deployReasons = new Map(gameDirs.map((slug) => [slug, []]));

if (all) {
  for (const slug of gameDirs) deployReasons.get(slug).push("--all");
} else {
  for (const file of changedFiles) markAffectedGames(file);
}

const gamesToDeploy = gameDirs.filter((slug) => deployReasons.get(slug).length > 0);

if (!gamesToDeploy.length) {
  console.log(`No game code changes detected between ${base} and ${head}; skipping game deploys.`);
  process.exit(0);
}

console.log(`Game deploy candidates (${preview ? "preview" : "production"}):`);
for (const slug of gamesToDeploy) {
  const reasons = deployReasons.get(slug).slice(0, 6).join(", ");
  const more = deployReasons.get(slug).length > 6 ? ` (+${deployReasons.get(slug).length - 6} more)` : "";
  console.log(`- ${slug}: ${reasons}${more}`);
}

if (dryRun) process.exit(0);

for (const slug of gamesToDeploy) {
  const cwd = path.join(gamesRoot, slug);
  if (!noBuild) {
    run("bun", ["run", "build"], cwd);
    run("node", ["scripts/sentry-upload-vite-sourcemaps.mjs", `--app=${slug}`], repoRoot);
  }
  run("bunx", ["vercel", "deploy", ...(preview ? [] : ["--prod"]), "--yes", "--cwd", cwd], repoRoot);
}

function flagValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function gitChangedFiles() {
  const range = `${base}...${head}`;
  const result = runGit(["diff", "--name-only", range], false);
  if (result.status === 0) return lines(result.stdout);
  return lines(runGit(["diff", "--name-only", base, head], true).stdout);
}

function gitUntrackedFiles() {
  return lines(runGit(["ls-files", "--others", "--exclude-standard"], true).stdout);
}

function gitLocalChangedFiles() {
  return unique([
    ...lines(runGit(["diff", "--name-only"], true).stdout),
    ...lines(runGit(["diff", "--cached", "--name-only"], true).stdout),
  ]);
}

function runGit(gitArgs, required) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
  if (required && result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result;
}

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function markAffectedGames(file) {
  const gameMatch = file.match(/^apps\/games\/([^/]+)\/(.+)$/);
  if (gameMatch) {
    const [, slug, rel] = gameMatch;
    if (deployReasons.has(slug) && isGameCodeFile(rel)) deployReasons.get(slug).push(file);
    return;
  }

  const shared = sharedPackageFor(file);
  if (!shared) return;
  for (const [slug, pkg] of gamePackages) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps[shared]) deployReasons.get(slug).push(file);
  }
}

function isGameCodeFile(rel) {
  if (rel.startsWith("src/") || rel.startsWith("party/")) return true;
  return [
    "components.json",
    "index.html",
    "package.json",
    "partykit.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
  ].includes(rel);
}

function sharedPackageFor(file) {
  if (matchesSharedCode(file, "assets")) return "@shipshitgames/assets";
  if (matchesSharedCode(file, "engine")) return "@shipshitgames/engine";
  if (matchesSharedCode(file, "ui")) return "@shipshitgames/ui";
  if (matchesSharedCode(file, "warline")) return "@shipshitgames/warline";
  return null;
}

function matchesSharedCode(file, name) {
  const prefix = `packages/${name}/`;
  if (!file.startsWith(prefix)) return false;
  const rel = file.slice(prefix.length);
  if (rel.startsWith("sources/") || rel.startsWith(".turbo/")) return false;
  if (!existsSync(path.join(repoRoot, prefix, "package.json"))) return false;
  return isPackageCodeFile(rel);
}

function isPackageCodeFile(rel) {
  if (rel === "package.json") return true;
  if (rel.startsWith("src/") || rel.startsWith("party/")) return true;
  return ["tsconfig.json", "tsconfig.node.json", "vite.config.ts", "vitest.config.ts"].includes(rel);
}
