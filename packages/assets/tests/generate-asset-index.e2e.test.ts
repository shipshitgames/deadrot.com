import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// End-to-end gate test: spawn the real `generate-asset-index.mjs` CLI against
// throwaway fixture trees and assert the emitted manifest + `--check` drift
// behavior. Pure JS — file bytes are arbitrary; dimension parsing simply yields
// none for malformed bytes, which is fine here — so it runs on plain CI runners
// as part of `bun test tests`.

const GENERATOR = fileURLToPath(new URL("../scripts/generate-asset-index.mjs", import.meta.url));

/** Write a map of relative-path → contents into a fresh temp dir. */
function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "gai-"));
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

function run(args: string[]) {
  const result = spawnSync("node", [GENERATOR, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function withCleanup(root: string, fn: () => void) {
  try {
    fn();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The standard fixture: two indexable assets + one excluded source file + one excluded non-media file. */
function standardFiles(): Record<string, string> {
  return {
    "games/foo/ui/menu/title.webp": "fake-webp-bytes",
    "shared/ui/icon.svg": "<svg></svg>",
    "games/foo/sources/draft.webp": "source-tree-bytes", // excluded: source tree
    "games/foo/assets.json": "{}", // excluded: non-media
  };
}

function readManifest(root: string) {
  return JSON.parse(readFileSync(join(root, "assets.index.json"), "utf8"));
}

test("generate writes a parseable manifest with the expected shape and entry", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    const { status } = run(["--root", root]);
    assert.equal(status, 0);

    const manifest = readManifest(root);
    assert.equal(manifest.version, "1");
    assert.equal(manifest.cdnBase, "https://assets.deadrot.com");

    // Only the two non-source, media files are indexed.
    assert.equal(manifest.assetCount, 2);
    assert.equal(manifest.assets.length, 2);

    const title = manifest.assets.find((a: { id: string }) => a.id === "games/foo/ui/menu/title");
    assert.ok(title, "expected an entry for games/foo/ui/menu/title");
    assert.equal(title.path, "games/foo/ui/menu/title.webp");
    assert.equal(title.kind, "image");
    assert.equal(title.mediaType, "image/webp");
  });
});

test("a file inside a source tree is excluded", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    run(["--root", root]);
    const manifest = readManifest(root);
    const ids = manifest.assets.map((a: { id: string }) => a.id);
    assert.ok(!ids.includes("games/foo/sources/draft"), "source-tree file must not be indexed");
  });
});

test("a non-media file is excluded", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    run(["--root", root]);
    const manifest = readManifest(root);
    const paths = manifest.assets.map((a: { path: string }) => a.path);
    assert.ok(!paths.includes("games/foo/assets.json"), "non-media file must not be indexed");
  });
});

test("--check exits 0 and reports in sync right after generate", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    assert.equal(run(["--root", root]).status, 0);
    const { status, stdout } = run(["--root", root, "--check"]);
    assert.equal(status, 0);
    assert.match(stdout, /in sync/);
  });
});

test("--check exits 1 (stale) after a media file's bytes change", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    run(["--root", root]);
    // Overwrite an indexed media file with different bytes → hash drifts.
    writeFileSync(join(root, "games/foo/ui/menu/title.webp"), "different-webp-bytes");
    const { status, stderr } = run(["--root", root, "--check"]);
    assert.equal(status, 1);
    assert.match(stderr, /stale/);
  });
});

test("--check exits 1 after a new media file is added", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    run(["--root", root]);
    const extra = join(root, "shared/ui/new-icon.svg");
    mkdirSync(dirname(extra), { recursive: true });
    writeFileSync(extra, "<svg id='new'></svg>");
    assert.equal(run(["--root", root, "--check"]).status, 1);
  });
});

test("--check exits 1 (missing) after the manifest is deleted", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    run(["--root", root]);
    unlinkSync(join(root, "assets.index.json"));
    const { status, stderr } = run(["--root", root, "--check"]);
    assert.equal(status, 1);
    assert.match(stderr, /missing/);
  });
});

test("--cdn-base sets manifest.cdnBase while cdnPath stays package-relative", () => {
  const root = makeFixture(standardFiles());
  withCleanup(root, () => {
    const { status } = run(["--root", root, "--cdn-base", "https://cdn.test"]);
    assert.equal(status, 0);

    const manifest = readManifest(root);
    assert.equal(manifest.cdnBase, "https://cdn.test");

    const title = manifest.assets.find((a: { id: string }) => a.id === "games/foo/ui/menu/title");
    assert.ok(title);
    // cdnPath is the package-relative path, independent of the CDN base.
    assert.equal(title.cdnPath, "games/foo/ui/menu/title.webp");
  });
});

test("real image bytes yield intrinsic width/height in the manifest", () => {
  // A genuine 1x1 PNG so the dimension parser has a real header to read, unlike
  // the arbitrary-byte fixtures above.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const root = mkdtempSync(join(tmpdir(), "gai-"));
  withCleanup(root, () => {
    const file = join(root, "shared/ui/dot.png");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, png);

    assert.equal(run(["--root", root]).status, 0);
    const dot = readManifest(root).assets.find((a: { id: string }) => a.id === "shared/ui/dot");
    assert.ok(dot, "expected an entry for shared/ui/dot");
    assert.equal(dot.width, 1);
    assert.equal(dot.height, 1);
  });
});

test("an id collision between format twins hard-fails the generator", () => {
  // Two files whose ids both strip to `games/foo/icon` must abort, never let one
  // silently shadow the other.
  const root = makeFixture({
    "games/foo/icon.webp": "webp-bytes",
    "games/foo/icon.png": "png-bytes",
  });
  withCleanup(root, () => {
    const { status, stderr } = run(["--root", root]);
    assert.notEqual(status, 0);
    assert.match(stderr, /id collision/);
  });
});

test("the provenance sidecar enriches only matching entries", () => {
  const files = standardFiles();
  files["asset-provenance.json"] = JSON.stringify({
    "games/foo/ui/menu/title.webp": { provenance: "assetgen · test", license: "CC0-1.0" },
  });
  const root = makeFixture(files);
  withCleanup(root, () => {
    assert.equal(run(["--root", root]).status, 0);
    const manifest = readManifest(root);

    const title = manifest.assets.find((a: { id: string }) => a.id === "games/foo/ui/menu/title");
    assert.ok(title);
    assert.equal(title.provenance, "assetgen · test");
    assert.equal(title.license, "CC0-1.0");

    // An asset with no sidecar key gains neither field.
    const icon = manifest.assets.find((a: { id: string }) => a.id === "shared/ui/icon");
    assert.ok(icon);
    assert.equal(icon.provenance, undefined);
    assert.equal(icon.license, undefined);
  });
});

test("a missing --root exits 2", () => {
  const root = makeFixture({ "games/foo/ui/menu/title.webp": "x" });
  withCleanup(root, () => {
    const { status } = run(["--root", join(root, "does-not-exist")]);
    assert.equal(status, 2);
  });
});
