/**
 * 3D model manifest resolver (deadrot.com#493).
 *
 * The first real 3D assets — the Hunyuan3D-3.1 `scourge-host` GLBs — live under
 * `packages/assets/models/<entity>/` as Git LFS-tracked masters. This module is
 * the typed front door games and gyms use to load a model **by stable id**, the
 * same way {@link ./asset-index} resolves 2D sprites by id:
 *
 * - {@link resolveModelPath} → package-relative path, for dev/build tooling
 *   (Vite, desktop) that reads bytes off disk.
 * - {@link resolveModelUrl} → absolute CDN URL, for deployed runtime. The base
 *   origin comes from an explicit `baseUrl`, then `ASSET_BASE_URL`, then the
 *   manifest's baked-in {@link ModelManifest.cdnBase}.
 *
 * A model can carry several variants (a `static` master, an `animated` master,
 * and later an optimized `runtime` derivative); pass `variant` to select one, or
 * omit it to get the model's `defaultVariant`.
 */

import manifestJson from "../models/models.manifest.json" with { type: "json" };

/** Container format of a model's files. */
export type ModelFormat = "glb" | "gltf";

/** Whether a variant carries animation channels. */
export type ModelPose = "static" | "animated";

/** `master` is the raw source-of-truth; `runtime` is a Draco/WebP-optimized derivative. */
export type ModelOptimization = "master" | "runtime";

/** One concrete GLB/glTF file for a model. */
export interface ModelVariant {
  /** Variant selector, unique within a model (e.g. `static`, `animated`, `runtime`). */
  key: string;
  pose: ModelPose;
  optimization: ModelOptimization;
  /** Package-relative path to the LFS-tracked file. */
  path: string;
  /** File size in bytes (matches the LFS pointer `size`). */
  bytes: number;
  /** Hex SHA-256 of the file contents (matches the LFS pointer `oid`). */
  sha256: string;
  /** The `key` of the variant this one was derived from, if any. */
  derivedFrom?: string;
  /** Tool that produced a derived variant. */
  tool?: string;
}

/** How and where a model master was generated. */
export interface ModelSource {
  provider: string;
  model: string;
  predictionId?: string;
  generatedAt?: string;
  url?: string;
}

/** One catalogued 3D model, addressable by its stable `id`. */
export interface ModelEntry {
  id: string;
  /** Canonical universe entity id this model renders (links to the asset catalog). */
  entity?: string;
  name: string;
  faction?: string;
  format: ModelFormat;
  pbr: boolean;
  faceCount?: number;
  source: ModelSource;
  license?: string;
  provenance?: string;
  /** The `key` of the variant resolvers return when none is requested. */
  defaultVariant: string;
  variants: ModelVariant[];
}

/** The committed 3D model manifest document. */
export interface ModelManifest {
  $schema?: string;
  version: string;
  note?: string;
  /** Default CDN origin; overridable at runtime via `ASSET_BASE_URL`/`baseUrl`. */
  cdnBase: string;
  models: ModelEntry[];
}

/** Options for resolving a model variant to a path or URL. */
export interface ResolveModelOptions {
  /** Variant `key` to select; defaults to the model's `defaultVariant`. */
  variant?: string;
  /** Explicit CDN origin; wins over env/manifest defaults (URL resolution only). */
  baseUrl?: string;
}

/** The 3D model manifest, loaded from `models/models.manifest.json`. */
export const modelManifest: ModelManifest = manifestJson as unknown as ModelManifest;

const byId = new Map<string, ModelEntry>(modelManifest.models.map((m) => [m.id, m]));

/** Read `ASSET_BASE_URL` without assuming a Node `process` global exists. */
function envBaseUrl(): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const value = proc?.env?.ASSET_BASE_URL;
  return value && value.length > 0 ? value : undefined;
}

/** Look up a model entry by its stable id. */
export function getModel(id: string): ModelEntry | undefined {
  return byId.get(id);
}

/** Every catalogued model. */
export function listModels(): ModelEntry[] {
  return modelManifest.models;
}

/**
 * The selected variant for a model: the requested `variant` key, else the
 * model's `defaultVariant`. Returns `undefined` if the model or key is unknown.
 */
export function getModelVariant(id: string, variant?: string): ModelVariant | undefined {
  const model = byId.get(id);
  if (!model) return undefined;
  const key = variant ?? model.defaultVariant;
  return model.variants.find((v) => v.key === key);
}

/**
 * The package-relative path for a model id (+ optional variant), or `undefined`
 * if unknown. Use for dev/build tooling that reads bytes from `packages/assets`.
 */
export function resolveModelPath(id: string, opts: ResolveModelOptions = {}): string | undefined {
  return getModelVariant(id, opts.variant)?.path;
}

/** The effective CDN origin: explicit `baseUrl`, else `ASSET_BASE_URL`, else the manifest default. */
export function modelBaseUrl(opts: Pick<ResolveModelOptions, "baseUrl"> = {}): string {
  return opts.baseUrl ?? envBaseUrl() ?? modelManifest.cdnBase;
}

/**
 * The absolute CDN URL for a model id (+ optional variant), or `undefined` if
 * unknown. Tolerates a trailing slash on the base and a leading slash on the path.
 */
export function resolveModelUrl(id: string, opts: ResolveModelOptions = {}): string | undefined {
  const variant = getModelVariant(id, opts.variant);
  if (!variant) return undefined;
  const base = modelBaseUrl(opts).replace(/\/+$/, "");
  const path = variant.path.replace(/^\/+/, "");
  return `${base}/${path}`;
}
