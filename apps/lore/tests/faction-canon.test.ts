import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(testDir, "../content");
const pyrePath = path.join(contentRoot, "Factions/The-Pyre.md");
const wardensPath = path.join(contentRoot, "Factions/The-Wardens.md");
const indexPath = path.join(contentRoot, "00-Index.md");
const premisePath = path.join(contentRoot, "Universe/Premise.md");
const pactPath = path.join(contentRoot, "Factions/The-Pact.md");

const requiredSections = [
  "## Who they are",
  "## Command & structure",
  "## Creed & doctrine",
  "## Iconography",
  "## Recruitment & culture",
  "## Playstyle",
  "## Rivalry (not war)",
  "## Named cast",
  "## Appears in",
];

const requiredReferences = ["CANON", "Style-Bible", "The-Pact", "Pactfall"];

const pyreCrossLinks = [
  "Pyre-Cauterizer",
  "Pyre-Courier",
  "Pyre-Duelist",
  "Pyre-Interceptor-Pilot",
  "Pyre-Saboteur",
  "Patch",
  "Ranger",
  "Vector",
  "Bulwark",
];

const wardenCrossLinks = [
  "Warden-Bastion",
  "Warden-Artillerist",
  "Warden-Courier",
  "Warden-Defense-Pilot",
  "Field-Engineer",
  "Lane-Gunner",
  "Wallwright",
];

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

function linkTargets(content: string): string[] {
  return [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1])
    .map((target) => path.basename(target));
}

function hasWikilink(content: string, basename: string): boolean {
  return linkTargets(content).includes(basename);
}

describe("Faction canon notes (#135)", () => {
  for (const [name, factionPath] of [
    ["The Pyre", pyrePath],
    ["The Wardens", wardensPath],
  ] as const) {
    test(`${name} is promoted to canon with the full faction spec`, () => {
      const content = readContent(factionPath);

      assert.match(content, /^status: canon$/m, `Expected ${name} frontmatter to be status: canon`);

      for (const section of requiredSections) {
        assert(content.includes(section), `Expected ${name} to include ${section}`);
      }

      for (const reference of requiredReferences) {
        assert(hasWikilink(content, reference), `Expected ${name} to reference [[${reference}]]`);
      }

      assert.match(content, /rivalry/i, `Expected ${name} to keep the rivalry framing`);
      assert.match(
        content,
        /breach opens|the instant a breach|stops the instant/i,
        `Expected ${name} to keep the rivalry-not-war (truce on breach) framing`,
      );
    });
  }

  test("The Pyre cross-links to its named operators", () => {
    const content = readContent(pyrePath);

    for (const target of pyreCrossLinks) {
      assert(hasWikilink(content, target), `Expected The Pyre to link [[${target}]]`);
    }
  });

  test("The Wardens cross-link to their named operators", () => {
    const content = readContent(wardensPath);

    for (const target of wardenCrossLinks) {
      assert(hasWikilink(content, target), `Expected The Wardens to link [[${target}]]`);
    }
  });

  test("both factions are discoverable from the canon index", () => {
    const index = readContent(indexPath);

    assert.match(index, /\[\[The-Pyre\]\]/, "Expected 00-Index to link [[The-Pyre]]");
    assert.match(index, /\[\[The-Wardens\]\]/, "Expected 00-Index to link [[The-Wardens]]");
  });

  test("the rivalry hangs off the shared Pact and Premise canon", () => {
    assert.match(readContent(pactPath), /breach|truce|rivalry/i);
    assert.match(readContent(premisePath), /Pact/);
  });

  test("every wikilink in both faction notes resolves inside the vault", () => {
    const existing = collectMarkdownBasenames(contentRoot);

    for (const factionPath of [pyrePath, wardensPath]) {
      for (const link of linkTargets(readContent(factionPath))) {
        assert(existing.has(link), `Expected [[${link}]] to resolve to a markdown file`);
      }
    }
  });
});
