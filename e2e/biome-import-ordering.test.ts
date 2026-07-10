import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Issue #54 — Decide Biome import ordering.
//
// Verifies the repo-wide import-order gate two ways:
//   1. `biome check` ENFORCES organizeImports on ordinary files (fails CI on
//      unorganized imports).
//   2. The override in biome.json EXEMPTS curated barrels
//      (`packages/*/src/index.ts`) so their hand-grouped exports survive.
// See docs/biome-import-ordering.md.

const repoRoot = join(import.meta.dir, "..");
const biomeBin = join(repoRoot, "node_modules", ".bin", "biome");

// Throwaway package so we can drive the real override glob
// (`**/packages/*/src/index.ts`) against controlled inputs without touching a
// shipped package.
const fixturePkg = "__biome_import_order_fixture__";
const fixtureDir = join(repoRoot, "packages", fixturePkg);
const fixtureSrc = join(fixtureDir, "src");

// Imports are intentionally out of order; organizeImports would re-sort them.
const UNORDERED = `${[
  'import { zebra } from "./zebra";',
  'import { apple } from "./apple";',
  "",
  "export const value = apple + zebra;",
].join("\n")}\n`;

function biomeCheck(relPath: string, extraArgs: string[] = []) {
  const proc = Bun.spawnSync([biomeBin, "check", ...extraArgs, relPath], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: proc.exitCode,
    output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
  };
}

beforeAll(() => {
  mkdirSync(fixtureSrc, { recursive: true });
  // Barrel path → matches the override glob → should be exempt.
  writeFileSync(join(fixtureSrc, "index.ts"), UNORDERED);
  // Non-barrel path → not matched by the glob → should be enforced.
  writeFileSync(join(fixtureSrc, "widget.ts"), UNORDERED);
});

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("biome import-order gate (#54)", () => {
  test("flags unorganized imports in ordinary files", () => {
    const { code, output } = biomeCheck(`packages/${fixturePkg}/src/widget.ts`);
    expect(code).not.toBe(0);
    expect(output).toContain("organizeImports");
  });

  test("exempts curated barrels via the packages/*/src/index.ts override", () => {
    const { code } = biomeCheck(`packages/${fixturePkg}/src/index.ts`);
    expect(code).toBe(0);
  });

  test("the four shipped curated barrels pass the gate as committed", () => {
    for (const barrel of [
      "packages/assets/src/index.ts",
      "packages/game-kit/src/index.ts",
      "packages/ui/src/index.ts",
      "packages/warline/src/index.ts",
    ]) {
      const { code, output } = biomeCheck(barrel);
      expect(`${barrel} -> ${code}\n${output}`).toContain(`${barrel} -> 0`);
    }
  });
});
