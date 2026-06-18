export const CATALOG_TO_LORE_EXCEPTIONS = {
  "scourge-swarm": "swarm-ripper",
  "scourge-spitter": "swarm-spitter",
  "scourge-elite": "render",
};

const VIEW_SUFFIX = /-(?:front|side|back|left|right|three-quarter|idle|walk|run|attack|fly)$/;
const BROAD_PATH_TERMS = new Set(["scourge", "the-scourge", "pyre", "the-pyre", "warden", "the-warden"]);

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function stripViewSuffix(value) {
  return slugify(value).replace(VIEW_SUFFIX, "");
}

function isBroadPathTerm(term) {
  return BROAD_PATH_TERMS.has(slugify(term));
}

function catalogLoreCandidates(entity) {
  const id = slugify(entity.id);
  const name = slugify(entity.name);
  const excepted = CATALOG_TO_LORE_EXCEPTIONS[id];
  return unique([
    excepted,
    id,
    name,
    id.replace(/^(pyre|warden|scourge)-/, ""),
    name.replace(/^(pyre|warden|scourge)-/, ""),
  ]);
}

function termsFor(entry, catalogEntities) {
  return unique([
    entry.slug,
    slugify(entry.name),
    stripViewSuffix(entry.spriteBase),
    ...catalogEntities.map((entity) => slugify(entity.id)),
  ]).filter((term) => term.length >= 3);
}

function matchPaths(paths, terms, prefix) {
  const pathTerms = terms.filter((term) => !isBroadPathTerm(term));
  const scoped = prefix ? paths.filter((path) => path.startsWith(prefix)) : paths;
  return scoped
    .filter((path) => {
      const normalized = slugify(path);
      return pathTerms.some((term) => normalized.includes(term));
    })
    .sort();
}

function pathExists(assetIndexByPath, path) {
  return assetIndexByPath.has(path);
}

function parseTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  if (cells.length < 6 || cells.every((cell) => /^-+$/.test(cell.replace(/\s/g, "")))) return null;
  return cells;
}

export function parseManualStatus(markdown) {
  const rows = new Map();
  for (const line of String(markdown ?? "").split(/\r?\n/)) {
    const cells = parseTableLine(line);
    if (!cells || /^lore note$/i.test(cells[0])) continue;
    const match = cells[0].match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (!match) continue;
    const note = match[1];
    rows.set(slugify(note), {
      note,
      good: cells[3] || "",
      locked: cells[4] || "",
      source: cells[5] || "",
      nextAction: cells[6] || "",
    });
  }
  return rows;
}

function collectRuntimeRecords(gameManifests) {
  const records = [];
  for (const [game, manifest] of Object.entries(gameManifests ?? {})) {
    for (const [bucket, value] of Object.entries(manifest ?? {})) {
      if (!value || typeof value !== "object") continue;
      collectRuntimeRecordsFromObject(records, game, bucket, "", value, null);
    }
  }
  return records;
}

function collectRuntimeRecordsFromObject(records, game, bucket, keyPath, value, inheritedLicense) {
  if (!value || typeof value !== "object") return;
  const license = value.license ?? inheritedLicense ?? null;
  if (typeof value.path === "string") {
    records.push({
      game,
      bucket,
      key: keyPath.split(".")[0] || "",
      keyPath,
      path: value.path,
      license,
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (!child || typeof child !== "object") continue;
    collectRuntimeRecordsFromObject(records, game, bucket, keyPath ? `${keyPath}.${key}` : key, child, license);
  }
}

function runtimeMatches(entry, runtimeRecords, assetIndexByPath) {
  const spriteKey = stripViewSuffix(entry.spriteBase);
  const entrySlug = slugify(entry.slug);
  const safeSpriteKey = spriteKey && !isBroadPathTerm(spriteKey) ? spriteKey : "";
  const safeEntryPathTerm = entrySlug && !isBroadPathTerm(entrySlug) ? entrySlug : "";
  return runtimeRecords
    .filter((record) => {
      const key = slugify(record.key);
      const keyPath = slugify(record.keyPath);
      const path = slugify(record.path);
      return (
        (safeSpriteKey &&
          (key === safeSpriteKey || key === `comic-${safeSpriteKey}` || keyPath.includes(safeSpriteKey))) ||
        key === entrySlug ||
        (safeEntryPathTerm && path.includes(safeEntryPathTerm))
      );
    })
    .map((record) => ({
      ...record,
      exists: pathExists(assetIndexByPath, record.path),
      generated: Boolean(record.license?.tool || record.license?.kind),
    }))
    .sort((a, b) => `${a.game}:${a.path}`.localeCompare(`${b.game}:${b.path}`));
}

function catalogCoverage(entry, catalogEntities, assetIndexByPath) {
  const games = entry.appearsIn?.length ? entry.appearsIn : unique(catalogEntities.flatMap((entity) => entity.games ?? []));
  const variants = [];
  for (const entity of catalogEntities) {
    for (const game of games) {
      const variantPath = entity.variants?.[game] ?? null;
      variants.push({
        entityId: entity.id,
        game,
        path: variantPath,
        exists: variantPath ? pathExists(assetIndexByPath, variantPath) : false,
      });
    }
  }
  return variants.sort((a, b) => `${a.entityId}:${a.game}`.localeCompare(`${b.entityId}:${b.game}`));
}

function statusFor(entry) {
  if (/^yes$/i.test(entry.manual?.locked ?? "")) return "locked";
  if (entry.catalog.existing > 0 && entry.runtime.existing > 0) return "runtime-linked";
  if (
    entry.catalog.existing > 0 ||
    entry.runtime.existing > 0 ||
    entry.packageAssets.count > 0 ||
    entry.masters.count > 0
  ) {
    return "in-progress";
  }
  if (entry.sources.count > 0 || entry.previews.count > 0) return "drafted";
  return "missing";
}

export function buildLoreArtMap(input) {
  const assetIndexByPath = new Map((input.assetIndex?.assets ?? []).map((asset) => [asset.path, asset]));
  const catalogEntities = input.catalog?.entities ?? [];
  const runtimeRecords = collectRuntimeRecords(input.gameManifests);
  const manualStatus = parseManualStatus(input.manualStatusMarkdown);
  const entries = [];

  for (const [type, sourceEntries] of [
    ["character", input.characters ?? []],
    ["bestiary", input.bestiary ?? []],
  ]) {
    for (const source of sourceEntries) {
      const entrySlug = slugify(source.slug);
      const matchedCatalog = catalogEntities.filter((entity) => catalogLoreCandidates(entity).includes(entrySlug));
      const terms = termsFor(source, matchedCatalog);
      const catalog = catalogCoverage(source, matchedCatalog, assetIndexByPath);
      const runtime = runtimeMatches(source, runtimeRecords, assetIndexByPath);
      const packageAssets = matchPaths(input.assetPaths ?? [], terms, "packages/assets/entities/");
      const previews = matchPaths(input.assetPaths ?? [], terms, "packages/assets/lore/asset-status/previews/");
      const masters = matchPaths(input.assetPaths ?? [], terms, "packages/assets/masters/");
      const loreMasters = matchPaths(input.assetPaths ?? [], terms, "packages/assets/lore/art-masters/");
      const sources = matchPaths(input.assetPaths ?? [], terms, "packages/assets/sources/generated/");
      const manual = manualStatus.get(entrySlug) ?? null;
      const notePath = input.notePaths?.get?.(entrySlug) ?? null;
      const row = {
        type,
        slug: source.slug,
        name: source.name,
        notePath,
        appearsIn: source.appearsIn ?? [],
        spriteBase: source.spriteBase ?? null,
        catalogEntities: matchedCatalog.map((entity) => entity.id),
        catalog: {
          expected: catalog.length,
          existing: catalog.filter((variant) => variant.exists).length,
          missing: catalog.filter((variant) => !variant.exists).length,
          variants: catalog,
        },
        runtime: {
          existing: runtime.filter((record) => record.exists).length,
          generated: runtime.filter((record) => record.exists && record.generated).length,
          records: runtime,
        },
        packageAssets: { count: packageAssets.length, paths: packageAssets.slice(0, 12) },
        previews: { count: previews.length, paths: previews.slice(0, 12) },
        masters: { count: masters.length + loreMasters.length, paths: [...masters, ...loreMasters].slice(0, 12) },
        sources: { count: sources.length, paths: sources.slice(0, 12) },
        manual,
      };
      row.status = statusFor(row);
      entries.push(row);
    }
  }

  entries.sort((a, b) => `${a.type}:${a.slug}`.localeCompare(`${b.type}:${b.slug}`));
  const summary = {
    entries: entries.length,
    locked: entries.filter((entry) => entry.status === "locked").length,
    runtimeLinked: entries.filter((entry) => entry.status === "runtime-linked").length,
    inProgress: entries.filter((entry) => entry.status === "in-progress").length,
    drafted: entries.filter((entry) => entry.status === "drafted").length,
    missing: entries.filter((entry) => entry.status === "missing").length,
    catalogLinked: entries.filter((entry) => entry.catalog.existing > 0).length,
    runtimeManifestLinked: entries.filter((entry) => entry.runtime.existing > 0).length,
    packageLinked: entries.filter((entry) => entry.packageAssets.count > 0).length,
    hasMasters: entries.filter((entry) => entry.masters.count > 0).length,
    hasSources: entries.filter((entry) => entry.sources.count > 0).length,
  };

  return {
    version: 1,
    generatedBy: "packages/assets/scripts/generate-lore-art-map.mjs",
    summary,
    entries,
  };
}

function coverageText(value) {
  if (value.expected === 0) return "none";
  return `${value.existing}/${value.expected}`;
}

function wiki(entry) {
  const title = entry.notePath?.split("/").pop()?.replace(/\.md$/, "") ?? entry.name;
  return `[[${title}|${entry.name}]]`;
}

function displayList(paths) {
  if (!paths.length) return "-";
  return paths.map((path) => `\`${path}\``).join("<br>");
}

export function renderLoreArtMapMarkdown(report) {
  const lines = [
    "---",
    "status: active",
    "type: lore-art-map",
    "generatedBy: packages/assets/scripts/generate-lore-art-map.mjs",
    "---",
    "",
    "# Lore Asset Map",
    "",
    "Generated coverage board for lore entries and their package-owned generated art. Do not edit this file by hand; run `bun run --cwd packages/assets lore:art-map`.",
    "",
    "## Summary",
    "",
    `- Entries: ${report.summary.entries}`,
    `- Locked: ${report.summary.locked}`,
    `- Runtime linked: ${report.summary.runtimeLinked}`,
    `- In progress: ${report.summary.inProgress}`,
    `- Drafted only: ${report.summary.drafted}`,
    `- Missing: ${report.summary.missing}`,
    `- Catalog-linked: ${report.summary.catalogLinked}`,
    `- Runtime manifest-linked: ${report.summary.runtimeManifestLinked}`,
    `- Package asset-linked: ${report.summary.packageLinked}`,
    `- Has masters: ${report.summary.hasMasters}`,
    `- Has generated sources: ${report.summary.hasSources}`,
    "",
    "## Coverage",
    "",
    "| Lore entry | Type | Status | Appears in | Catalog | Runtime | Package | Masters | Sources | Manual lock | Next action |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  ];

  for (const entry of report.entries) {
    lines.push(
      `| ${wiki(entry)} | ${entry.type} | ${entry.status} | ${entry.appearsIn.join(", ") || "-"} | ${coverageText(entry.catalog)} | ${entry.runtime.existing} | ${entry.packageAssets.count} | ${entry.masters.count} | ${entry.sources.count} | ${entry.manual?.locked || "-"} | ${entry.manual?.nextAction || "-"} |`,
    );
  }

  lines.push("", "## Missing Or Draft Only", "");
  const weak = report.entries.filter((entry) => entry.status === "missing" || entry.status === "drafted");
  if (!weak.length) {
    lines.push("All tracked entries have at least catalog, runtime, or master coverage.");
  } else {
    for (const entry of weak) {
      lines.push(`- ${wiki(entry)}: ${entry.status}; appears in ${entry.appearsIn.join(", ") || "no game"}; spriteBase \`${entry.spriteBase ?? "none"}\`.`);
    }
  }

  lines.push("", "## Detail", "");
  for (const entry of report.entries) {
    lines.push(
      `### ${entry.name}`,
      "",
      `- Type: ${entry.type}`,
      `- Status: ${entry.status}`,
      `- Note: ${entry.notePath ? `\`${entry.notePath}\`` : "not resolved"}`,
      `- Sprite base: \`${entry.spriteBase ?? "none"}\``,
      `- Catalog entities: ${entry.catalogEntities.length ? entry.catalogEntities.map((id) => `\`${id}\``).join(", ") : "none"}`,
      `- Catalog variants: ${coverageText(entry.catalog)}`,
      `- Runtime records: ${entry.runtime.existing}`,
      `- Package asset paths: ${displayList(entry.packageAssets.paths)}`,
      `- Preview paths: ${displayList(entry.previews.paths)}`,
      `- Master paths: ${displayList(entry.masters.paths)}`,
      `- Generated source paths: ${displayList(entry.sources.paths)}`,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

export function serializeLoreArtMap(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
