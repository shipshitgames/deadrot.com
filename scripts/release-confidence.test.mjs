import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");

function read(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function pullRequestTrigger(source) {
  const match = source.match(/^on:\n([\s\S]*?)(?=^ {2}push:)/m);
  if (!match) throw new Error("workflow is missing an on.pull_request block before on.push");
  return match[1];
}

function job(source, name) {
  const marker = `  ${name}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`workflow is missing job ${name}`);
  const remainder = source.slice(start + marker.length);
  const nextJob = remainder.search(/^ {2}[a-zA-Z0-9_-]+:\n/m);
  return nextJob < 0 ? remainder : remainder.slice(0, nextJob);
}

describe("release-confidence wiring", () => {
  test("required game and web E2E workflows start on every pull request", () => {
    for (const workflow of [".github/workflows/e2e.yml", ".github/workflows/web-e2e.yml"]) {
      const trigger = pullRequestTrigger(read(workflow));
      expect(trigger).toBe("  pull_request:\n");
      expect(trigger).not.toContain("paths");
    }
  });

  test("required E2E aggregate jobs always report detector and matrix results", () => {
    const gameGate = job(read(".github/workflows/e2e.yml"), "game-e2e-gate");
    expect(gameGate).toContain("needs: [affected-games, games]");
    expect(gameGate).toContain("if: always()");

    const webGate = job(read(".github/workflows/web-e2e.yml"), "web-e2e-gate");
    expect(webGate).toContain("needs: [detect, web-e2e]");
    expect(webGate).toContain("if: always()");
  });

  test("Turbo completes Scourge before web copies its build", () => {
    const turbo = JSON.parse(read("turbo.json"));
    expect(turbo.tasks["web#build"].dependsOn).toContain("scourge-survivors#build");

    const syncScript = read("apps/web/scripts/sync-public-game-builds.mjs");
    expect(syncScript).not.toContain('from "node:child_process"');
    expect(syncScript).not.toContain('["run", "build"]');
    expect(syncScript).toContain("Missing completed build output");
  });

  test("CI and release both gate on the deterministic full build", () => {
    const ciQuality = job(read(".github/workflows/ci.yml"), "quality");
    expect(ciQuality).toContain("run: bun run build");

    const release = read(".github/workflows/release.yml");
    expect(job(release, "build")).toContain("run: bun run build");
    expect(job(release, "release-gate")).toContain(
      "needs: [quality, unit, build, web-e2e, all-games, game-e2e, secret-scan]",
    );
  });
});
