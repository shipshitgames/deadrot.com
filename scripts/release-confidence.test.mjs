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
  test("docs-only pull requests still emit both required aggregate gates", () => {
    const workflows = [
      {
        path: ".github/workflows/e2e.yml",
        gate: "game-e2e-gate",
        needs: "needs: [affected-games, games",
        matrix: "games",
        skipCondition: "if: needs.affected-games.outputs.count != '0'",
      },
      {
        path: ".github/workflows/web-e2e.yml",
        gate: "web-e2e-gate",
        needs: "needs: [detect, web-e2e]",
        matrix: "web-e2e",
        skipCondition: "if: needs.detect.outputs.run_web == 'true'",
      },
    ];

    for (const workflow of workflows) {
      const source = read(workflow.path);
      const trigger = pullRequestTrigger(source);
      expect(trigger).toBe("  pull_request:\n");
      expect(trigger).not.toContain("paths");

      // A docs-only diff makes the heavy matrix skip, but the fixed aggregate
      // context must still run and treat that skip as a legitimate pass.
      expect(job(source, workflow.matrix)).toContain(workflow.skipCondition);
      const gate = job(source, workflow.gate);
      expect(gate).toContain(`name: ${workflow.gate}`);
      expect(gate).toContain(workflow.needs);
      expect(gate).toContain("if: always()");
      expect(gate).toContain("success|skipped)");
    }

    expect(job(read(".github/workflows/e2e.yml"), "affected-games")).toContain("outputs.count");
    expect(job(read(".github/workflows/web-e2e.yml"), "detect")).toContain('echo "run_web=false"');
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
    const ci = read(".github/workflows/ci.yml");
    const ciQuality = job(ci, "quality");
    expect(ciQuality).toContain("run: bun run build");
    expect(job(ci, "unit")).toContain("run: bun run test:scripts");

    const release = read(".github/workflows/release.yml");
    expect(job(release, "build")).toContain("run: bun run build");
    expect(job(release, "unit")).toContain("run: bun run test:scripts");
    expect(job(release, "release-gate")).toContain(
      "needs: [quality, unit, build, web-e2e, all-games, game-e2e, secret-scan]",
    );
  });
});
