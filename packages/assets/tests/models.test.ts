import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkModels, parseLfsPointer } from "../scripts/check-models.mjs";
import {
  getModel,
  getModelVariant,
  listModels,
  modelManifest,
  resolveModelPath,
  resolveModelUrl,
} from "../src/models.ts";

// Unit tests exercise the REAL committed `models/models.manifest.json`, so the
// contract is checked against shipped data. The `assets:check` gate wraps
// `checkModels` for CI; here we assert both the typed resolver and the gate.

const ASSETS_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHA256_RE = /^[0-9a-f]{64}$/;

test("committed model manifest is structurally valid", () => {
  assert.ok(modelManifest.models.length > 0, "manifest must list at least one model");
  assert.ok(typeof modelManifest.cdnBase === "string" && modelManifest.cdnBase.length > 0);

  const seenIds = new Set<string>();
  for (const model of modelManifest.models) {
    assert.ok(model.id.length > 0, "model id non-empty");
    assert.ok(!seenIds.has(model.id), `duplicate model id: ${model.id}`);
    seenIds.add(model.id);
    assert.ok(["glb", "gltf"].includes(model.format), "format is glb/gltf");
    assert.equal(typeof model.pbr, "boolean");
    assert.ok(model.source.provider.length > 0 && model.source.model.length > 0);
    assert.ok(model.variants.length > 0, "at least one variant");

    const keys = new Set<string>();
    for (const v of model.variants) {
      assert.ok(!keys.has(v.key), `duplicate variant key: ${model.id}[${v.key}]`);
      keys.add(v.key);
      assert.match(v.path, /^models\/.+\.(glb|gltf)$/, "variant path under models/");
      assert.ok(v.bytes >= 0);
      assert.match(v.sha256, SHA256_RE, "variant sha256 is 64 hex");
    }
    assert.ok(keys.has(model.defaultVariant), `defaultVariant resolves: ${model.id}`);
  }
});

test("resolver returns paths and URLs by id and variant", () => {
  const model = modelManifest.models[0];
  const def = model.variants.find((v) => v.key === model.defaultVariant);
  assert.ok(def);

  // default variant
  assert.equal(getModel(model.id)?.id, model.id);
  assert.equal(resolveModelPath(model.id), def.path);
  assert.equal(getModelVariant(model.id)?.key, model.defaultVariant);

  // explicit variant
  for (const v of model.variants) {
    assert.equal(resolveModelPath(model.id, { variant: v.key }), v.path);
    assert.equal(getModelVariant(model.id, v.key)?.sha256, v.sha256);
  }

  // CDN URL: manifest default and explicit override
  assert.equal(resolveModelUrl(model.id), `${modelManifest.cdnBase}/${def.path}`);
  assert.equal(
    resolveModelUrl(model.id, { baseUrl: "https://cdn.example.com/" }),
    `https://cdn.example.com/${def.path}`,
  );

  // unknown ids and variants resolve to undefined
  assert.equal(getModel("does-not-exist"), undefined);
  assert.equal(resolveModelPath(model.id, { variant: "nope" }), undefined);
  assert.equal(resolveModelUrl("does-not-exist"), undefined);

  assert.ok(listModels().length === modelManifest.models.length);
});

test("scourge-host seed is addressable by id (acceptance)", () => {
  const model = getModel("scourge-host");
  assert.ok(model, "scourge-host model exists");
  assert.equal(model.source.model, "tencent/hunyuan-3d-3.1");
  assert.equal(model.source.predictionId, "8tx0svhhahrmt0cz8xhvpf3nhc");
  assert.ok(getModelVariant("scourge-host", "static"));
  assert.ok(getModelVariant("scourge-host", "animated"));
});

test("committed GLBs match the manifest (real bytes or LFS pointer)", () => {
  // Passes both locally (real GLB, smudged by LFS) and on a runner that only
  // checked out pointers — integrityOf handles either. This is the same gate
  // `assets:check` runs.
  const { ok, errors } = checkModels(ASSETS_ROOT);
  assert.ok(ok, `model manifest failed validation:\n${errors.join("\n")}`);
});

test("checkModels verifies bytes/sha against an LFS pointer file", () => {
  const root = mkdtempSync(join(tmpdir(), "models-"));
  try {
    const body = Buffer.from("pretend this is a 45MB GLB");
    const sha256 = createHash("sha256").update(body).digest("hex");
    const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${sha256}\nsize ${body.length}\n`;

    const glbPath = "models/demo/demo.glb";
    const abs = join(root, glbPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, pointer);

    assert.deepEqual(parseLfsPointer(pointer), { sha256, bytes: body.length });

    const manifest = {
      version: "1",
      cdnBase: "https://assets.deadrot.com",
      models: [
        {
          id: "demo",
          name: "Demo",
          format: "glb",
          pbr: false,
          source: { provider: "replicate", model: "tencent/hunyuan-3d-3.1" },
          defaultVariant: "static",
          variants: [
            { key: "static", pose: "static", optimization: "master", path: glbPath, bytes: body.length, sha256 },
          ],
        },
      ],
    };
    mkdirSync(join(root, "models"), { recursive: true });
    writeFileSync(join(root, "models/models.manifest.json"), JSON.stringify(manifest));

    assert.equal(checkModels(root).ok, true);

    // Byte drift is caught even through a pointer.
    manifest.models[0].variants[0].bytes = body.length + 1;
    writeFileSync(join(root, "models/models.manifest.json"), JSON.stringify(manifest));
    const drift = checkModels(root);
    assert.equal(drift.ok, false);
    assert.ok(drift.errors.some((e) => e.includes("bytes drift")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
