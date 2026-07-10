import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  animationPlaceholderReason,
  contentHash,
  duplicatePathGroups,
  hasMultipleUniqueFrames,
  isAppSourceRuntimeRasterPath,
  pathGroupKey,
} from "./lib/asset-validation.mjs";

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
        const placeholderReason = animationPlaceholderReason(entity, action);
        if ((entity.placeholder === true || action.placeholder === true) && !placeholderReason) {
          fail(
            `${relative(repoRoot, packPath)} ${entityId}/${actionId}: placeholder animations require a non-empty placeholderReason`,
          );
        }

        for (const view of views) {
          const frameHashes = [];
          for (let frame = 0; frame < framesPerAction; frame += 1) {
            const frameId = String(frame).padStart(2, "0");
            const relPath = `${gamePrefix}/${action.pathTemplate.replace("{view}", view).replace("{frame}", frameId)}`;
            assertAssetPath(relPath, `${relative(repoRoot, packPath)} ${entityId}/${actionId}/${view}/${frameId}`);
            const fullPath = resolve(assetsRoot, relPath);
            if (existsSync(fullPath) && statSync(fullPath).isFile()) {
              frameHashes.push(contentHash(readFileSync(fullPath)));
            }
          }

          if (
            framesPerAction > 1 &&
            frameHashes.length === framesPerAction &&
            !hasMultipleUniqueFrames(frameHashes) &&
            !placeholderReason
          ) {
            fail(
              `${relative(repoRoot, packPath)} ${entityId}/${actionId}/${view}: ${framesPerAction} frame slots contain only one unique frame; mark the entity/action placeholder with a reason or supply authored frames`,
            );
          }
        }
      }
    }
  }
}

function checkAppSourceRasterCustody() {
  const rasterPaths = walkFiles(join(repoRoot, "apps"), (path) =>
    isAppSourceRuntimeRasterPath(relative(repoRoot, path).split(sep).join("/")),
  );

  for (const path of rasterPaths) {
    fail(`app source tree owns runtime raster; move it to packages/assets: ${relative(repoRoot, path)}`);
  }
}

function checkFaviconCustody() {
  const canonicalFiles = [
    "masters/ui/brand/favicon/favicon.svg",
    "masters/ui/brand/favicon/favicon-32x32.png",
    "masters/ui/brand/favicon/favicon-192x192.png",
    "masters/ui/brand/favicon/favicon-512x512.png",
    "masters/ui/brand/favicon/apple-touch-icon.png",
  ];
  for (const path of canonicalFiles) assertAssetPath(path, "canonical favicon set");

  const publicRoots = [
    join(repoRoot, "apps/web/public"),
    ...readdirSync(join(repoRoot, "apps/games"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(repoRoot, "apps/games", entry.name, "public")),
  ];

  for (const publicRoot of publicRoots) {
    if (!existsSync(publicRoot)) continue;
    for (const entry of readdirSync(publicRoot, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (/^(?:apple-touch-icon|favicon(?:-|\.|$))/i.test(entry.name)) {
        fail(
          `app public folder duplicates canonical favicon asset: ${relative(repoRoot, join(publicRoot, entry.name))}`,
        );
      }
    }
  }
}

function checkDuplicatePlaceholderGroups() {
  const placeholderPath = join(assetsRoot, "asset-placeholders.json");
  const placeholderManifest = readJson(placeholderPath);
  if (!placeholderManifest) return;

  const declaredKeys = new Set();
  for (const group of placeholderManifest.duplicateGroups ?? []) {
    const source = `asset-placeholders ${group.id ?? "<unknown>"}`;
    const paths = Array.isArray(group.paths) ? group.paths : [];
    if (group.status !== "placeholder") fail(`${source}: status must be placeholder`);
    if (typeof group.reason !== "string" || !group.reason.trim()) fail(`${source}: reason must be non-empty`);
    if (paths.length < 2 || new Set(paths).size !== paths.length) {
      fail(`${source}: paths must contain at least two unique asset paths`);
      continue;
    }
    if (paths.some((path) => !/^games\/[^/]+\/ui\/(?:menu\/title\.webp|social\/og\.jpg)$/.test(path))) {
      fail(`${source}: only game title.webp and social og.jpg duplicate placeholders may be declared`);
      continue;
    }

    const hashes = [];
    for (const path of paths) {
      assertAssetPath(path, source);
      const fullPath = resolve(assetsRoot, path);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) hashes.push(contentHash(readFileSync(fullPath)));
    }
    if (hashes.length === paths.length && new Set(hashes).size !== 1) {
      fail(`${source}: declaration is stale because its files are no longer identical; remove the placeholder group`);
    }
    declaredKeys.add(pathGroupKey(paths));
  }

  const records = [];
  for (const entry of readdirSync(join(assetsRoot, "games"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const slot of ["ui/menu/title.webp", "ui/social/og.jpg"]) {
      const path = `games/${entry.name}/${slot}`;
      const fullPath = resolve(assetsRoot, path);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        records.push({ hash: contentHash(readFileSync(fullPath)), path });
      }
    }
  }

  for (const paths of duplicatePathGroups(records)) {
    if (!declaredKeys.has(pathGroupKey(paths))) {
      fail(`identical game title/social assets must be declared as placeholders: ${paths.join(", ")}`);
    }
  }
}

checkCanonCatalog();
checkGameAssetManifests();
checkAnimationPacks();
checkAppSourceRasterCustody();
checkFaviconCustody();
checkDuplicatePlaceholderGroups();

if (failures.length > 0) {
  console.error(`Asset check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Asset check passed (${checkedFiles} referenced files verified).`);
