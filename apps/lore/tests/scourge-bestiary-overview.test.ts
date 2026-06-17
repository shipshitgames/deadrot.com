import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(testDir, "../content");
const bestiaryDir = path.join(contentRoot, "Bestiary");
const scourgePath = path.join(bestiaryDir, "Scourge.md");
const indexPath = path.join(contentRoot, "00-Index.md");

// The Scourge overview is the index hub for the whole bestiary (#133). It must
// keep the locked canon framing, sharpen the three threat tiers against the
// Scourge-Survivors roster, and link every catalogued creature note.
const requiredSections = [
  "## Nature",
  "## The Choir & its weakness",
  "## Visual identity",
  "## Threat tiers",
  "## Bestiary index",
  "## Across the games",
];

// Canon hooks + the framing the PRD says to keep ("zerg-like, no general").
const requiredReferences = ["CANON", "Scourge-Host-Families", "Deadlane", "Scourge-Survivors", "Starblight"];

// Threat-tier mechanics drawn from the fpsdemo's actual enemy types:
// swarm = melee + ranged fodder, elites = mutated spike-pressure, breach-boss
// = shield/enrage/barrage. ('feral' is asserted separately — it belongs to the
// Choir-weakness section, not the threat tiers.)
const threatTierTerms = [
  /\bmelee\b/i,
  /\branged\b/i,
  /\bfodder\b/i,
  /\bdensity\b/i,
  /\bmutated\b/i,
  /\bspike\b/i,
  /\bpressure\b/i,
  /\bshield/i,
  /\benrage/i,
  /\bbarrage/i,
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

function bestiaryBasenames(): string[] {
  // Recursive (reuses collectMarkdownBasenames) so the index-completeness
  // guarantee still holds if the Bestiary ever grows sub-folders.
  return [...collectMarkdownBasenames(bestiaryDir)];
}

function linkTargets(content: string): string[] {
  return [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1])
    .map((target) => path.basename(target));
}

function hasWikilink(content: string, basename: string): boolean {
  return linkTargets(content).includes(basename);
}

describe("Scourge bestiary overview (#133)", () => {
  test("keeps core-canon frontmatter and the index-hub framing", () => {
    const content = readContent(scourgePath);

    assert.match(content, /^status: core canon$/m, "Expected Scourge.md to stay status: core canon");

    for (const section of requiredSections) {
      assert(content.includes(section), `Expected Scourge.md to include ${section}`);
    }
  });

  test("locks the host-dependent parasite nature, not free-standing fungal rot", () => {
    const content = readContent(scourgePath);

    assert.match(content, /host-dependent parasite/i, "Expected the locked host-dependent parasite nature");
    assert.match(content, /no native form/i, "Expected the 'no native form' canon detail");
    assert.match(content, /\[\[CANON\]\]/, "Expected an explicit [[CANON]] reference");
    // The migrated source note's "fungal-rot" framing is superseded by CANON §1.
    // Back that intent with a real assertion: the note must explicitly mark the
    // supersession rather than silently asserting a free-standing fungal organism.
    assert.match(content, /supersedes/i, "Expected an explicit canon-lock superseding the fungal-rot framing");
  });

  test("keeps the zerg-like, no-general and limited-radius framing", () => {
    const content = readContent(scourgePath);

    assert.match(content, /zerg/i, "Expected the zerg-like analogue framing to survive");
    assert.match(content, /no single general|no general/i, "Expected the 'no general' framing");
    assert.match(content, /limited radius/i, "Expected the Choir limited-radius weakness");
    assert.match(content, /\bferal\b/i, "Expected the goes-feral-on-isolation weakness to survive");
  });

  test("sharpens the three threat tiers against the Survivors roster", () => {
    const content = readContent(scourgePath);

    for (const tier of ["**Swarm**", "**Elites**", "**Breach-bosses**"]) {
      assert(content.includes(tier), `Expected threat tier ${tier}`);
    }

    for (const term of threatTierTerms) {
      assert.match(content, term, `Expected threat-tier mechanics to mention ${term}`);
    }
  });

  test("indexes every catalogued bestiary creature note", () => {
    const content = readContent(scourgePath);
    const creatures = bestiaryBasenames().filter((name) => name !== "Scourge");

    assert(creatures.length >= 20, `Expected a populated bestiary, found ${creatures.length} creatures`);

    for (const creature of creatures) {
      assert(hasWikilink(content, creature), `Expected the Scourge overview to link [[${creature}]]`);
    }
  });

  test("keeps the cross-game framing (Deadlane waves / Survivors up-close)", () => {
    const content = readContent(scourgePath);

    for (const reference of requiredReferences) {
      assert(hasWikilink(content, reference), `Expected Scourge.md to reference [[${reference}]]`);
    }

    assert.match(content, /wave/i, "Expected the Deadlane 'waves' framing");
    assert.match(content, /up close|up-close/i, "Expected the Survivors 'up close' framing");
  });

  test("every wikilink in the overview resolves inside the vault", () => {
    const existing = collectMarkdownBasenames(contentRoot);

    for (const link of linkTargets(readContent(scourgePath))) {
      assert(existing.has(link), `Expected [[${link}]] to resolve to a markdown file`);
    }
  });

  test("the Scourge overview is discoverable from the canon index", () => {
    assert.match(readContent(indexPath), /\[\[Scourge\]\]/, "Expected 00-Index to link [[Scourge]]");
  });
});
