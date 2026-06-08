import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(testDir, "../content");
const bloodlanePath = path.join(contentRoot, "Games/Bloodlane.md");
const pactfallPath = path.join(contentRoot, "Games/Pactfall.md");
const indexPath = path.join(contentRoot, "00-Index.md");

function readContent(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function collectMarkdownBasenames(dir: string, names = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      collectMarkdownBasenames(entryPath, names);
      continue;
    }

    if (entry.endsWith(".md")) {
      names.add(path.basename(entry, ".md"));
    }
  }

  return names;
}

describe("Bloodlane lore design doc", () => {
  test("covers the small #143 deliverable", () => {
    const content = readContent(bloodlanePath);
    const requiredSections = [
      "# Bloodlane",
      "## Problem",
      "## Goal",
      "## V1 Format",
      "## Win Condition",
      "## Scourge Jungle",
      "## Forced-Truce Loop",
      "## Deferred",
      "## Canon Guardrails",
    ];

    for (const section of requiredSections) {
      assert(content.includes(section), `Expected Bloodlane design doc to include ${section}`);
    }

    assert.match(content, /one-lane/i);
    assert.match(content, /base seal|base-seal/i);
    assert.match(content, /forced truce|forced-truce/i);
    assert.match(content, /Scourge/i);
  });

  test("is discoverable from Pactfall and the canon index", () => {
    assert.match(readContent(pactfallPath), /\[\[Bloodlane\]\]/);
    assert.match(readContent(indexPath), /\[\[Bloodlane\]\]/);
  });

  test("resolves its wikilinks inside the lore vault", () => {
    const existing = collectMarkdownBasenames(contentRoot);
    const content = readContent(bloodlanePath);
    const links = [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
      .map((match) => match[1])
      .map((target) => path.basename(target));

    for (const link of links) {
      assert(existing.has(link), `Expected [[${link}]] to resolve to a markdown file`);
    }
  });
});
