import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME_APPS } from "@deadrot/catalog";

// Issue #7 — deep per-game E2E coverage guard. Enforces, at bun-unit speed (no
// Playwright launch), that the deep-spec fan-out actually covers every shipped
// game: catalog ↔ filesystem parity, a dedicated deep spec per slug, and a
// complete project matrix (slug × viewport).

const appsGamesDir = join(import.meta.dir, "..", "apps", "games");
const e2eDir = import.meta.dir;
const VIEWPORTS = ["desktop", "mobile"] as const;
const slugs = GAME_APPS.map((game) => game.slug);

// Every e2e/*.spec.ts that is a per-game deep spec — i.e. not the shared boot
// smoke (games.spec.ts), which iterates all games via gameSpecs rather than
// owning a single slug.
function deepSpecFiles(): string[] {
  return readdirSync(e2eDir)
    .filter((name) => name.endsWith(".spec.ts") && name !== "games.spec.ts")
    .sort();
}

// Resolve `startsWith(...)` guards in a spec to their literal string. Some deep
// specs reference the project prefix through a const alias
// (e.g. `const WARLINE_PROJECT = "warline:"; ... startsWith(WARLINE_PROJECT)`),
// so a naive substring scan for `startsWith("warline:")` would miss them. We
// expand `const NAME = "literal";` aliases and inline them, then collect every
// literal that flows into a `.startsWith(...)` call. This keeps the coverage
// assertion accurate rather than merely green.
function startsWithLiterals(source: string): Set<string> {
  const aliases = new Map<string, string>();
  const aliasPattern = /const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"\s*;/g;
  for (let match = aliasPattern.exec(source); match; match = aliasPattern.exec(source)) {
    const name = match[1];
    const value = match[2];
    if (name && value !== undefined) aliases.set(name, value);
  }

  const literals = new Set<string>();
  const startsWithPattern = /\.startsWith\(\s*(?:"([^"]*)"|([A-Za-z_$][\w$]*))\s*\)/g;
  for (let match = startsWithPattern.exec(source); match; match = startsWithPattern.exec(source)) {
    const literal = match[1];
    const identifier = match[2];
    if (literal !== undefined) {
      literals.add(literal);
    } else if (identifier) {
      const resolved = aliases.get(identifier);
      if (resolved !== undefined) literals.add(resolved);
    }
  }
  return literals;
}

describe("catalog ↔ filesystem parity", () => {
  test("apps/games directory names equal the GAME_APPS slugs (sorted)", () => {
    const shippedGameSlugs = readdirSync(appsGamesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const configuredGameSlugs = [...slugs].sort();
    expect(configuredGameSlugs).toEqual(shippedGameSlugs);
  });
});

describe("deep-spec-per-game", () => {
  test('every game slug has a dedicated deep spec guarded by startsWith("<slug>:")', () => {
    const specs = deepSpecFiles();
    const guardLiteralsBySpec = new Map(
      specs.map((name) => [name, startsWithLiterals(readFileSync(join(e2eDir, name), "utf8"))] as const),
    );

    for (const slug of slugs) {
      const wanted = `${slug}:`;
      const owners = specs.filter((name) => guardLiteralsBySpec.get(name)?.has(wanted));
      expect(owners.length, `No deep spec guards startsWith("${wanted}") for slug "${slug}"`).toBeGreaterThan(0);
    }
  });
});

describe("project-matrix completeness", () => {
  test("matrix is GAME_APPS.length × [desktop, mobile] with both viewports per slug", () => {
    const projectNames = slugs.flatMap((slug) => VIEWPORTS.map((viewport) => `${slug}:${viewport}`));

    expect(projectNames.length).toBe(GAME_APPS.length * 2);
    expect(new Set(projectNames).size).toBe(projectNames.length);

    for (const slug of slugs) {
      expect(projectNames).toContain(`${slug}:desktop`);
      expect(projectNames).toContain(`${slug}:mobile`);
    }
  });
});
