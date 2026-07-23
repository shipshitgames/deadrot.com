import { describe, expect, test } from "bun:test";

import {
  ASSET_CUSTODY,
  animationPlaceholderReason,
  assetCustodyForPath,
  collectManifestPathFields,
  duplicatePathGroups,
  findBannedGeneratorReferences,
  hasMultipleUniqueFrames,
  isAppSourceRuntimeRasterPath,
  manifestPathCustodyViolation,
  pathGroupKey,
} from "./lib/asset-validation.mjs";

describe("app source raster custody", () => {
  test("rejects raster files under nested app src trees", () => {
    expect(isAppSourceRuntimeRasterPath("apps/games/starblight/src/assets/player.webp")).toBe(true);
    expect(isAppSourceRuntimeRasterPath("apps/example/src/image.PNG")).toBe(true);
  });

  test("allows package assets and non-raster app source", () => {
    expect(isAppSourceRuntimeRasterPath("packages/assets/games/starblight/player.webp")).toBe(false);
    expect(isAppSourceRuntimeRasterPath("apps/games/starblight/src/game.ts")).toBe(false);
    expect(isAppSourceRuntimeRasterPath("apps/games/starblight/public/favicon.png")).toBe(false);
  });
});

describe("animation placeholder metadata", () => {
  test("detects a repeated static frame sequence", () => {
    expect(hasMultipleUniqueFrames(["same", "same", "same"])).toBe(false);
    expect(hasMultipleUniqueFrames(["frame-a", "frame-b", "frame-a"])).toBe(true);
  });

  test("requires an explicit marker with a reason", () => {
    expect(animationPlaceholderReason({ placeholder: true }, {})).toBeNull();
    expect(
      animationPlaceholderReason(
        { placeholder: true, placeholderReason: "Static poses pending authored animation." },
        {},
      ),
    ).toBe("Static poses pending authored animation.");
  });

  test("lets an action override an unmarked entity", () => {
    expect(animationPlaceholderReason({}, { placeholder: true, placeholderReason: "Temporary action strip." })).toBe(
      "Temporary action strip.",
    );
  });
});

describe("duplicate placeholder groups", () => {
  test("groups identical records independently of input order", () => {
    const groups = duplicatePathGroups([
      { hash: "title", path: "games/pactfall/ui/menu/title.webp" },
      { hash: "other", path: "games/redline/ui/menu/title.webp" },
      { hash: "title", path: "games/brawl/ui/menu/title.webp" },
    ]);

    expect(groups).toEqual([["games/brawl/ui/menu/title.webp", "games/pactfall/ui/menu/title.webp"]]);
    expect(pathGroupKey(groups[0])).toBe("games/brawl/ui/menu/title.webp\ngames/pactfall/ui/menu/title.webp");
  });
});

describe("generated asset custody", () => {
  test("classifies the keep, promote, quarantine, and temporary paths", () => {
    expect(assetCustodyForPath("packages/assets/sources/generated/2026-07-23/pyre/duelist.png")).toBe(
      ASSET_CUSTODY.GENERATED_HISTORY,
    );
    expect(assetCustodyForPath("packages/assets/masters/art/pyre/duelist/turnaround.png")).toBe(ASSET_CUSTODY.MASTER);
    expect(assetCustodyForPath("packages/assets/games/brawl/players/pyre/duelist.webp")).toBe(ASSET_CUSTODY.RUNTIME);
    expect(assetCustodyForPath("packages/assets/_archive/provider-cache/raw.png")).toBe(ASSET_CUSTODY.QUARANTINE);
    expect(assetCustodyForPath("packages/assets/cache/provider/raw.png")).toBe(ASSET_CUSTODY.TEMPORARY);
  });

  test("rejects every non-runtime custody segment in manifest paths", () => {
    for (const path of [
      "sources/generated/2026-07-23/duelist.png",
      "_archive/rejected/duelist.png",
      "games/brawl/cache/duelist.webp",
      "games/brawl/drafts/duelist.webp",
      "masters/art/pyre/duelist.png",
      "provenance/duelist.json",
    ]) {
      expect(manifestPathCustodyViolation(path)).toMatch(/non-runtime asset custody/);
    }
    expect(manifestPathCustodyViolation("games/brawl/players/pyre/duelist.webp")).toBeNull();
    expect(manifestPathCustodyViolation("shared/audio/hit.webm")).toBeNull();
    expect(manifestPathCustodyViolation("../outside.webp")).toMatch(/package-relative/);
    expect(manifestPathCustodyViolation("/absolute/outside.webp")).toMatch(/package-relative/);
    expect(manifestPathCustodyViolation("https://cdn.example.com/outside.webp")).toMatch(/package-relative/);
  });

  test("collects nested runtime path fields with their locations", () => {
    const manifest = {
      ui: { title: { path: "games/demo/ui/menu/title.webp" } },
      variants: [{ source: { path: "sources/generated/2026-07-23/title.png" } }],
    };
    expect(collectManifestPathFields(manifest)).toEqual([
      { path: "games/demo/ui/menu/title.webp", pointer: "$.ui.title.path" },
      { path: "sources/generated/2026-07-23/title.png", pointer: "$.variants[0].source.path" },
    ]);
  });

  test("finds banned provider provenance without flagging approved providers", () => {
    expect(
      findBannedGeneratorReferences({
        approved: { provider: "OpenAI", model: "gpt-image-2" },
        rejected: [{ provider: "xAI" }, { model: "grok-4-image" }],
      }),
    ).toEqual(["$.rejected[0].provider", "$.rejected[1].model"]);
    expect(findBannedGeneratorReferences({ provider: "Replicate", model: "Hunyuan3D" })).toEqual([]);
  });
});
