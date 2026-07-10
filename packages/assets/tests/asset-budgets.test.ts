import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/asset-budgets.mjs", import.meta.url));
const CONFIG = fileURLToPath(new URL("../asset-budgets.json", import.meta.url));

function run(...args: string[]) {
  return spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
}

test("Scourge browser budgets are complete positive integers and surface in the report", () => {
  const config = JSON.parse(readFileSync(CONFIG, "utf8"));
  const configured = config.games["scourge-survivors"];
  const fieldNames = [
    "maxBootResourceRequests",
    "maxBootWebpRequests",
    "maxBootDecodedBodyBytes",
    "maxCombatResourceRequests",
    "maxCombatWebpRequests",
    "maxCombatDecodedBodyBytes",
  ] as const;

  for (const field of fieldNames) {
    assert.ok(Number.isInteger(configured[field]) && configured[field] > 0, `${field} must be a positive integer`);
  }

  const result = run("--json");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const scourge = report.games.find((game: { slug: string }) => game.slug === "scourge-survivors");
  assert.ok(scourge, "expected a Scourge Survivors budget report");
  assert.equal(typeof scourge.declaredInitialBytes, "number");
  assert.equal(typeof scourge.declaredInitialFiles, "number");
  assert.equal(scourge.initialBytes, undefined, "the path heuristic must not be labeled as browser initial bytes");
  assert.equal(scourge.initialFiles, undefined, "the path heuristic must not be labeled as browser initial files");
  assert.equal(scourge.budget.maxInitialBytes, undefined, "the report must label the heuristic ceiling explicitly");
  assert.equal(scourge.budget.maxDeclaredInitialBytes, config.categories[configured.category].maxInitialBytes);

  for (const field of fieldNames) {
    assert.equal(scourge.budget[field], configured[field]);
  }

  const runtimeAtlasPage = scourge.largestFiles.find(
    (file: { path: string }) => file.path === "games/scourge-survivors/animations/scourge/scourge.atlas0.webp",
  );
  assert.ok(runtimeAtlasPage, "expected the Scourge runtime atlas page in the report");
  assert.ok(runtimeAtlasPage.sources.includes("animation-pack"), "runtime atlas pages must be manifest-covered");
});

test("text output labels the heuristic and browser budgets explicitly", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /scourge-survivors[\s\S]*declared initial/);
  assert.match(
    result.stdout,
    /Browser budgets: boot <= 36 resources \/ 2\.50 MiB decoded \/ 22 WebPs; combat <= 170 resources \/ 18\.00 MiB decoded \/ 80 WebPs/,
  );
});
