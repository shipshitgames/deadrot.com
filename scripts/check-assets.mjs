import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = join(repoRoot, "packages/assets");
const failures = [];
let checkedFiles = 0;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${relative(repoRoot, path)}: invalid JSON (${error.message})`);
    return null;
  }
}

function fail(message) {
  failures.push(message);
}

function assertAssetPath(relPath, source) {
  if (relPath === null || relPath === undefined) return;
  if (typeof relPath !== "string" || relPath.trim() === "") {
    fail(`${source}: asset path must be a non-empty string`);
    return;
  }

  const normalized = normalize(relPath);
  const fullPath = resolve(assetsRoot, normalized);
  if (!fullPath.startsWith(`${assetsRoot}${sep}`)) {
    fail(`${source}: asset path escapes packages/assets (${relPath})`);
    return;
  }
  if (!existsSync(fullPath)) {
    fail(`${source}: missing asset file ${relPath}`);
    return;
  }
  const stat = statSync(fullPath);
  if (!stat.isFile()) {
    fail(`${source}: asset path is not a file ${relPath}`);
    return;
  }
  if (stat.size <= 0) {
    fail(`${source}: asset file is empty ${relPath}`);
    return;
  }
  checkedFiles += 1;
}

function walkFiles(root, predicate, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, predicate, out);
    else if (predicate(fullPath)) out.push(fullPath);
  }
  return out;
}

function checkPathFields(value, source) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      checkPathFields(item, `${source}[${index}]`);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childSource = `${source}.${key}`;
    if (key === "path") assertAssetPath(child, childSource);
    else checkPathFields(child, childSource);
  }
}

function checkCanonCatalog() {
  const catalogPath = join(assetsRoot, "assets-catalog.json");
  const catalog = readJson(catalogPath);
  if (!catalog) return;

  for (const entity of catalog.entities ?? []) {
    const id = entity.id ?? "<unknown>";
    for (const [game, relPath] of Object.entries(entity.variants ?? {})) {
      assertAssetPath(relPath, `assets-catalog entity ${id}.${game}`);
    }
  }

  for (const shared of catalog.shared ?? []) {
    assertAssetPath(shared.path, `assets-catalog shared ${shared.id ?? "<unknown>"}.path`);
  }
}

function checkGameAssetManifests() {
  const manifestPaths = walkFiles(join(assetsRoot, "games"), (path) => path.endsWith(`${sep}assets.json`));

  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);
    if (!manifest) continue;
    checkPathFields(manifest, relative(repoRoot, manifestPath));
  }
}

function checkAnimationPacks() {
  const packPaths = walkFiles(join(assetsRoot, "games"), (path) => path.endsWith(`${sep}animation-pack.json`));

  for (const packPath of packPaths) {
    const pack = readJson(packPath);
    if (!pack) continue;

    const parts = relative(assetsRoot, packPath).split(sep);
    const game = parts[1];
    const gamePrefix = `games/${game}`;
    const views = Array.isArray(pack.views) ? pack.views : [];
    const framesPerAction = Number(pack.framesPerAction);
    if (!Number.isInteger(framesPerAction) || framesPerAction <= 0) {
      fail(`${relative(repoRoot, packPath)}: framesPerAction must be a positive integer`);
      continue;
    }

    for (const [entityId, entity] of Object.entries(pack.entities ?? {})) {
      for (const [actionId, action] of Object.entries(entity.actions ?? {})) {
        if (typeof action.pathTemplate !== "string") {
          fail(`${relative(repoRoot, packPath)} ${entityId}/${actionId}: missing pathTemplate`);
          continue;
        }
        for (const view of views) {
          for (let frame = 0; frame < framesPerAction; frame += 1) {
            const frameId = String(frame).padStart(2, "0");
            const relPath = `${gamePrefix}/${action.pathTemplate.replace("{view}", view).replace("{frame}", frameId)}`;
            assertAssetPath(relPath, `${relative(repoRoot, packPath)} ${entityId}/${actionId}/${view}/${frameId}`);
          }
        }
      }
    }
  }
}

checkCanonCatalog();
checkGameAssetManifests();
checkAnimationPacks();

if (failures.length > 0) {
  console.error(`Asset check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Asset check passed (${checkedFiles} referenced files verified).`);
