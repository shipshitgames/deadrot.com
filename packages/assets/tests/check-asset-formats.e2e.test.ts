import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// End-to-end gate test: spawn the real validator / conversion CLIs against
// throwaway fixture trees and assert exit codes + messages. Pure JS — no cwebp,
// so it runs on plain CI runners as part of `bun test tests`.

const VALIDATOR = fileURLToPath(new URL("../scripts/check-asset-formats.mjs", import.meta.url));
const TO_WEBP = fileURLToPath(new URL("../scripts/to-webp.mjs", import.meta.url));

/** Write a map of relative-path → contents into a fresh temp dir. */
function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "afp-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

function run(script: string, args: string[]) {
  const result = spawnSync("node", [script, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function manifest(path: string): string {
  return JSON.stringify({ ui: { x: { type: "ui", path } } }, null, 2);
}

function withCleanup(root: string, fn: () => void) {
  try {
    fn();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("validator passes a clean webp manifest", () => {
  const root = makeFixture({ "games/foo/assets.json": manifest("games/foo/ui/menu/title.webp") });
  withCleanup(root, () => {
    const { status, stdout } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 0);
    assert.match(stdout, /OK/);
  });
});

test("validator fails a manifest that references a source PNG", () => {
  const root = makeFixture({ "games/foo/assets.json": manifest("games/foo/ui/cards/breach.png") });
  withCleanup(root, () => {
    const { status, stderr } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 1);
    assert.match(stderr, /breach\.png/);
    assert.match(stderr, /WebP/);
  });
});

test("validator fails a non-social JPEG manifest reference", () => {
  const root = makeFixture({ "games/foo/assets.json": manifest("games/foo/ui/menu/hero.jpg") });
  withCleanup(root, () => {
    const { status, stderr } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 1);
    assert.match(stderr, /hero\.jpg/);
    assert.match(stderr, /JPEG/);
  });
});

test("validator fails a .jpeg (long extension) manifest reference", () => {
  const root = makeFixture({ "games/foo/assets.json": manifest("games/foo/ui/menu/hero.jpeg") });
  withCleanup(root, () => {
    const { status, stderr } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 1);
    assert.match(stderr, /hero\.jpeg/);
  });
});

test("validator allows the social OG JPEG slot", () => {
  const root = makeFixture({ "games/foo/assets.json": manifest("games/foo/ui/social/og.jpg") });
  withCleanup(root, () => {
    const { status } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 0);
  });
});

test("validator ignores PNGs that live in a source tree", () => {
  const root = makeFixture({
    "games/foo/assets.json": manifest("sources/generated/2026-06-02/foo/breach.png"),
  });
  withCleanup(root, () => {
    const { status } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 0);
  });
});

test("validator fails a bundle glob that admits source raster", () => {
  const root = makeFixture({
    "games/foo/assets.json": manifest("games/foo/ui/menu/title.webp"),
    "src/foo.ts": 'const m = import.meta.glob(["../games/foo/ui/cards/**/*.{jpg,png}"]);\n',
  });
  withCleanup(root, () => {
    const { status, stderr } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 1);
    assert.match(stderr, /bundle glob/i);
  });
});

test("validator passes a webp-only bundle glob", () => {
  const root = makeFixture({
    "games/foo/assets.json": manifest("games/foo/ui/menu/title.webp"),
    "src/foo.ts": 'const m = import.meta.glob(["../games/foo/ui/cards/**/*.webp"]);\n',
  });
  withCleanup(root, () => {
    const { status } = run(VALIDATOR, ["--root", root]);
    assert.equal(status, 0);
  });
});

test("to-webp --dry-run plans a conversion without invoking cwebp", () => {
  const root = makeFixture({ "art/breach.png": "not-a-real-png" });
  withCleanup(root, () => {
    const { status, stdout } = run(TO_WEBP, [join(root, "art/breach.png"), "--dry-run"]);
    assert.equal(status, 0);
    assert.match(stdout, /plan/);
    assert.match(stdout, /breach\.webp/);
  });
});

test("to-webp rejects no inputs and out-of-range quality", () => {
  assert.equal(run(TO_WEBP, []).status, 2);
  const root = makeFixture({ "art/x.png": "x" });
  withCleanup(root, () => {
    assert.equal(run(TO_WEBP, [join(root, "art/x.png"), "--quality", "999", "--dry-run"]).status, 2);
  });
});
