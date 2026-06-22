import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = path.resolve(testDir, "../content");

// The "agent layer" of a vault entry is a one-line `**At a glance:**` digest that
// sits directly under the H1 title (see Universe/Vault-Conventions.md). It lets an
// agent or artist pull the canon facts without parsing a paragraph of prose. This
// test pins that cohesion across the canonical entry directories so the layer can't
// silently regress (lore card #139, "agent overview lore polish").
const ENTRY_DIRS = ["Bestiary", "Characters", "Games", "Factions", "Locations", "Tech", "Universe"];

// The convention document itself only *documents* the digest format (it prints the
// template literally), so it is not an entry that owns a digest. Exempt it by its
// declared frontmatter type rather than by a brittle filename match.
const EXEMPT_TYPES = new Set(["vault-convention"]);

const GLANCE = "**At a glance:**";
// The middot separator from the Vault-Conventions template:
// `**At a glance:** <type / role> · <key trait> · ... · appears in [[Game]] / [[Game]].`
const SEPARATOR = " · ";
// The pre-convention hyphen separator the digests were normalized away from. A
// spaced em-dash (" — ") is legitimate prose punctuation and is not flagged.
const HYPHEN_SEPARATOR = " - ";

function readContent(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function collectMarkdownFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const entryPath = path.join(dir, entry);

    if (statSync(entryPath).isDirectory()) {
      collectMarkdownFiles(entryPath, acc);
      continue;
    }

    if (entry.endsWith(".md")) {
      acc.push(entryPath);
    }
  }

  return acc;
}

function collectMarkdownBasenames(dir: string, names = new Set<string>()): Set<string> {
  for (const file of collectMarkdownFiles(dir)) {
    names.add(path.basename(file, ".md"));
  }

  return names;
}

function frontmatterType(content: string): string | null {
  const block = content.match(/^---\n([\s\S]*?)\n---/);
  if (!block) {
    return null;
  }

  const typeLine = block[1].match(/^type:\s*(.+)$/m);
  return typeLine ? typeLine[1].trim() : null;
}

function linkTargets(content: string): string[] {
  return [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)]
    .map((match) => match[1])
    .map((target) => path.basename(target));
}

// The digest may soft-wrap across several source lines; join the block from the
// `**At a glance:**` marker up to the next blank line into one logical line.
function digestParagraph(lines: string[], start: number): string {
  const collected: string[] = [];

  for (let i = start; i < lines.length; i += 1) {
    if (i > start && lines[i].trim() === "") {
      break;
    }
    collected.push(lines[i]);
  }

  return collected.join(" ");
}

interface Entry {
  filePath: string;
  rel: string;
  content: string;
  lines: string[];
  h1Index: number;
}

function entries(): Entry[] {
  const result: Entry[] = [];

  for (const dir of ENTRY_DIRS) {
    for (const filePath of collectMarkdownFiles(path.join(contentRoot, dir))) {
      const content = readContent(filePath);
      const lines = content.split("\n");
      const h1Index = lines.findIndex((line) => line.startsWith("# "));

      // A fragment with no H1 is not a player/agent entry.
      if (h1Index === -1) {
        continue;
      }

      const type = frontmatterType(content);
      if (type && EXEMPT_TYPES.has(type)) {
        continue;
      }

      result.push({ filePath, rel: path.relative(contentRoot, filePath), content, lines, h1Index });
    }
  }

  return result;
}

describe("Agent-layer cohesion — At a glance digests (#139)", () => {
  const allEntries = entries();
  const knownNotes = collectMarkdownBasenames(contentRoot);

  test("the vault exposes a populated set of canon entries", () => {
    assert(allEntries.length >= 50, `Expected a populated vault, found ${allEntries.length} entries`);
  });

  for (const entry of allEntries) {
    test(`${entry.rel} carries a well-formed At a glance digest under its title`, () => {
      const glanceIndex = entry.lines.findIndex((line) => line.includes(GLANCE));
      assert(glanceIndex !== -1, `${entry.rel} is missing the '${GLANCE}' agent-layer digest`);

      // The digest sits directly under the H1 (title, blank, digest) in every entry.
      const offset = glanceIndex - entry.h1Index;
      assert(
        offset >= 1 && offset <= 2,
        `${entry.rel}: the digest must sit directly under the H1 (found ${offset} lines below, expected 1-2)`,
      );

      // Format checks run on the digest's own line, so a digest cannot satisfy the
      // separator rule by borrowing a middot from a following prose line, and the
      // one-line-digest convention is enforced implicitly.
      const digestLine = entry.lines[glanceIndex];
      assert(
        digestLine.includes(SEPARATOR),
        `${entry.rel}: the digest must use the ' · ' middot separator from the convention template`,
      );
      assert(
        !digestLine.includes(HYPHEN_SEPARATOR),
        `${entry.rel}: the digest must use ' · ' middots, not ' - ' hyphen separators (em-dashes ' — ' are fine)`,
      );

      // Every wikilink in the digest must resolve to a real note. The digest may
      // soft-wrap, so sweep the whole paragraph for link targets.
      for (const target of linkTargets(digestParagraph(entry.lines, glanceIndex))) {
        assert(knownNotes.has(target), `${entry.rel}: digest links [[${target}]], which does not resolve to a note`);
      }
    });
  }
});
