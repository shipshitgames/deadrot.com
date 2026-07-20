#!/usr/bin/env node
// check-models — validate the curated 3D model manifest (deadrot.com#493).
//
// The 3D masters under packages/assets/models/ are large GLB/glTF files kept in
// Git LFS. Their rich metadata (prediction id, model, PBR, face count, license,
// provenance) is authored by hand in models.manifest.json, so — unlike the 2D
// asset index — this manifest is NOT machine-generated; it is validated.
//
// The integrity check is LFS-safe: it verifies each variant's `bytes`/`sha256`
// against EITHER the real binary (hashing it) OR the on-disk LFS pointer text
// (parsing its `oid sha256:` / `size`). So it passes both locally (files smudged
// by LFS) and on a runner that only checked out pointers — the drift/integrity
// gate never depends on a 45MB blob being present.
//
// Usage: node scripts/check-models.mjs [--root <dir>]

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_FILENAME = "models/models.manifest.json";
const MODEL_PATH_RE = /^models\/.+\.(glb|gltf)$/;

function isSafeModelPath(path) {
  if (typeof path !== "string" || !MODEL_PATH_RE.test(path) || path.includes("\\")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function modelFiles(root) {
  const modelsRoot = join(root, "models");
  if (!existsSync(modelsRoot)) return [];

  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
      } else if (entry.isFile() && /\.(glb|gltf)$/.test(entry.name)) {
        files.push(relative(root, abs).split(sep).join("/"));
      }
    }
  };
  visit(modelsRoot);
  return files.sort();
}

/** Parse a Git LFS pointer file's oid + size, or null if it isn't a pointer. */
export function parseLfsPointer(text) {
  if (!text.startsWith("version https://git-lfs.github.com/spec/v1")) return null;
  const oid = /^oid sha256:([0-9a-f]{64})$/m.exec(text);
  const size = /^size (\d+)$/m.exec(text);
  if (!oid || !size) return null;
  return { sha256: oid[1], bytes: Number(size[1]) };
}

/** Resolve the effective bytes/sha256 for a file, whether real or an LFS pointer. */
function integrityOf(absPath) {
  const buf = readFileSync(absPath);
  // LFS pointers are tiny UTF-8 text (<200 bytes); only sniff small files.
  if (buf.length < 1024) {
    const pointer = parseLfsPointer(buf.toString("utf8"));
    if (pointer) return { ...pointer, kind: "lfs-pointer" };
  }
  return {
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    kind: "blob",
  };
}

/** Validate the model manifest at `root`; returns { ok, errors }. */
export function checkModels(root = defaultRoot) {
  const errors = [];
  const manifestPath = join(root, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    return { ok: false, errors: [`manifest missing: ${manifestPath}`] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return { ok: false, errors: [`manifest is not valid JSON: ${err.message}`] };
  }

  if (typeof manifest.version !== "string") errors.push("manifest.version must be a string");
  if (typeof manifest.cdnBase !== "string") errors.push("manifest.cdnBase must be a string");
  if (!Array.isArray(manifest.models)) {
    errors.push("manifest.models must be an array");
    return { ok: false, errors };
  }

  const seenIds = new Set();
  const manifestPaths = new Set();
  for (const model of manifest.models) {
    const id = model?.id;
    const label = typeof id === "string" ? id : "<no id>";
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`model has no string id: ${JSON.stringify(model)}`);
      continue;
    }
    if (seenIds.has(id)) errors.push(`duplicate model id: "${id}"`);
    seenIds.add(id);

    if (typeof model.name !== "string") errors.push(`${label}: name must be a string`);
    if (model.format !== "glb" && model.format !== "gltf") errors.push(`${label}: format must be "glb" or "gltf"`);
    if (typeof model.pbr !== "boolean") errors.push(`${label}: pbr must be a boolean`);
    if (!model.source || typeof model.source.provider !== "string" || typeof model.source.model !== "string") {
      errors.push(`${label}: source.provider and source.model are required`);
    }

    if (!Array.isArray(model.variants) || model.variants.length === 0) {
      errors.push(`${label}: variants must be a non-empty array`);
      continue;
    }

    const variantKeys = new Set();
    for (const variant of model.variants) {
      const key = variant?.key;
      const vlabel = `${label}[${typeof key === "string" ? key : "?"}]`;
      if (typeof key !== "string" || key.length === 0) {
        errors.push(`${label}: variant has no string key`);
        continue;
      }
      if (variantKeys.has(key)) errors.push(`${label}: duplicate variant key "${key}"`);
      variantKeys.add(key);

      if (variant.pose !== "static" && variant.pose !== "animated") {
        errors.push(`${vlabel}: pose must be "static" or "animated"`);
      }
      if (variant.optimization !== "master" && variant.optimization !== "runtime") {
        errors.push(`${vlabel}: optimization must be "master" or "runtime"`);
      }

      if (!isSafeModelPath(variant.path)) {
        errors.push(`${vlabel}: path must be a safe models/…(.glb|.gltf) path without dot segments`);
        continue;
      }
      manifestPaths.add(variant.path);

      const validBytes = Number.isInteger(variant.bytes) && variant.bytes >= 0;
      const validSha256 = /^[0-9a-f]{64}$/.test(String(variant.sha256));
      if (!validBytes) {
        errors.push(`${vlabel}: bytes must be a non-negative integer`);
      }
      if (!validSha256) {
        errors.push(`${vlabel}: sha256 must be 64 lowercase hex characters`);
      }

      const abs = join(root, variant.path);
      if (!existsSync(abs) || !statSync(abs).isFile()) {
        errors.push(`${vlabel}: file not found: ${variant.path}`);
        continue;
      }
      const actual = integrityOf(abs);
      if (validBytes && actual.bytes !== variant.bytes) {
        errors.push(`${vlabel}: bytes drift — manifest ${variant.bytes}, ${actual.kind} ${actual.bytes}`);
      }
      if (validSha256 && actual.sha256 !== variant.sha256) {
        errors.push(`${vlabel}: sha256 drift — manifest ${variant.sha256}, ${actual.kind} ${actual.sha256}`);
      }
    }

    if (typeof model.defaultVariant !== "string" || !variantKeys.has(model.defaultVariant)) {
      errors.push(`${label}: defaultVariant "${model.defaultVariant}" is not one of [${[...variantKeys].join(", ")}]`);
    }
    for (const variant of model.variants) {
      if (variant.derivedFrom !== undefined && !variantKeys.has(variant.derivedFrom)) {
        errors.push(`${label}[${variant.key ?? "?"}]: derivedFrom "${variant.derivedFrom}" is not a variant key`);
      }
    }
  }

  for (const path of modelFiles(root)) {
    if (!manifestPaths.has(path)) {
      errors.push(`unmanifested model file: ${path}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const argv = process.argv.slice(2);
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag >= 0 && argv[rootFlag + 1] ? resolve(argv[rootFlag + 1]) : defaultRoot;

  const { ok, errors } = checkModels(root);
  if (ok) {
    console.log("check-models: OK — model manifest is valid and in sync.");
    return;
  }
  console.error("check-models: FAIL");
  for (const e of errors) console.error(`  - ${e}`);
  console.error("Fix models.manifest.json (or regenerate bytes/sha256 for changed GLBs).");
  process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();

// re-export for tests
export { defaultRoot as MODELS_ROOT, MANIFEST_FILENAME };
