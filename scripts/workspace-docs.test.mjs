import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");

test("generated repository catalog is current and describes the real boundary", () => {
  execFileSync(process.execPath, ["scripts/generate-workspace-docs.mjs", "--check"], {
    cwd: repoRoot,
    stdio: "pipe",
  });

  const catalog = readFileSync(resolve(repoRoot, "docs/repository-catalog.generated.md"), "utf8");
  assert.match(catalog, /seven playable front games plus \*\*Warline\*\*/);
  assert.match(catalog, /\| Brawl \| `brawl` \| Playable front game/);
  assert.match(catalog, /`packages\/catalog`/);
  assert.match(catalog, /`packages\/game-kit`/);
  assert.equal(existsSync(resolve(repoRoot, "packages/engine")), false);
  assert.equal(existsSync(resolve(repoRoot, "packages/assetgen")), false);
});
