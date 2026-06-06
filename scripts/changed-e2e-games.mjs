#!/usr/bin/env node
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const gamesRoot = path.join(repoRoot, "apps/games");
const args = process.argv.slice(2);

const all = args.includes("--all");
const base =
  flagValue("--base") ??
  process.env.BASE_SHA ??
  process.env.GITHUB_BASE_SHA ??
  process.env.GITHUB_EVENT_BEFORE ??
  "origin/master";
const head = flagValue("--head") ?? process.env.HEAD_SHA ?? process.env.GITHUB_HEAD_SHA ?? process.env.GITHUB_SHA ?? "HEAD";

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

const reasons = new Map(gameDirs.map((slug) => [slug, []]));
const changedFiles = all ? [] : gitChangedFiles();

if (all) {
  markAll("--all");
} else {
  for (const file of changedFiles) markAffectedGames(file);
}

const selectedGames = gameDirs.filter((slug) => reasons.get(slug).length > 0);
const outputs = {
  game_slugs: selectedGames.join(","),
  count: String(selectedGames.length),
};

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `game_slugs=${outputs.game_slugs}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `count=${outputs.count}\n`);
}

if (!selectedGames.length) {
  console.log(`No game E2E changes detected between ${base} and ${head}.`);
  process.exit(0);
}

console.log(`Game E2E candidates (${selectedGames.length}):`);
for (const slug of selectedGames) {
  const slugReasons = reasons.get(slug);
  const visible = slugReasons.slice(0, 6).join(", ");
  const more = slugReasons.length > 6 ? ` (+${slugReasons.length - 6} more)` : "";
  console.log(`- ${slug}: ${visible}${more}`);
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

function runGit(gitArgs, required) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
  if (required && result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result;
}

function lines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function markAffectedGames(file) {
  if (isE2eInfra(file) || isRootDependencyFile(file)) {
    markAll(file);
    return;
  }

  const gameMatch = file.match(/^apps\/games\/([^/]+)\//);
  if (gameMatch) {
    markGame(gameMatch[1], file);
    return;
  }

  const gameAssetMatch = file.match(/^packages\/assets\/games\/([^/]+)\//);
  if (gameAssetMatch) {
    markGame(gameAssetMatch[1], file);
    return;
  }

  const shared = sharedPackageFor(file);
  if (!shared) return;

  for (const [slug, pkg] of gamePackages) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (deps[shared]) markGame(slug, file);
  }
}

function markGame(slug, reason) {
  if (!reasons.has(slug)) return;
  reasons.get(slug).push(reason);
}

function markAll(reason) {
  for (const slug of gameDirs) markGame(slug, reason);
}

function isE2eInfra(file) {
  return (
    file === ".github/workflows/e2e.yml" ||
    file === "playwright.config.ts" ||
    file === "scripts/changed-e2e-games.mjs" ||
    file === "scripts/run-e2e-docker.sh" ||
    file === "docker/e2e.Dockerfile" ||
    file.startsWith("e2e/")
  );
}

function isRootDependencyFile(file) {
  return ["package.json", "bun.lock", "turbo.json"].includes(file);
}

function sharedPackageFor(file) {
  if (matchesSharedPackage(file, "assets")) return "@shipshitgames/assets";
  if (matchesSharedPackage(file, "engine")) return "@shipshitgames/engine";
  if (matchesSharedPackage(file, "ui")) return "@shipshitgames/ui";
  if (matchesSharedPackage(file, "warline")) return "@shipshitgames/warline";
  return null;
}

function matchesSharedPackage(file, name) {
  const prefix = `packages/${name}/`;
  if (!file.startsWith(prefix)) return false;
  if (!existsSync(path.join(repoRoot, prefix, "package.json"))) return false;
  return true;
}
