import { describe, expect, test } from "bun:test";

import {
  animationPlaceholderReason,
  duplicatePathGroups,
  hasMultipleUniqueFrames,
  isAppSourceRuntimeRasterPath,
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
