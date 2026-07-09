import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { GAME_APPS, type GameSlug, gameRoute } from "@deadrot/catalog";
import {
  GAME_MENU_CONFIGS,
  gameMenuConfig,
  gameMenuCopyHtml,
  gameMenuTitleHtml,
  gameMenuTitleText,
} from "../src/gameMenuConfig";
import {
  gameHref,
  gameJumpHtml,
  gameJumpTargets,
  goToWarlineLobby,
  isDevFleetPage,
  warlineLobbyHref,
} from "../src/lobby";
import { createTestWindow, installTestWindow, removeTestWindow, type TestWindow } from "./browser";

let testWindow: TestWindow;

beforeEach(() => {
  testWindow = createTestWindow();
  installTestWindow(testWindow);
});

afterEach(removeTestWindow);

test("menu configuration covers the catalog exactly and exposes stable per-game copy", () => {
  assert.deepEqual(Object.keys(GAME_MENU_CONFIGS).sort(), GAME_APPS.map((game) => game.slug).sort());
  for (const game of GAME_APPS) {
    const config = gameMenuConfig(game.slug);
    assert.equal(config.slug, game.slug);
    assert.ok(config.titleKicker.length > 0);
    assert.ok(config.titleLines.length > 0);
    assert.equal(gameMenuTitleText(game.slug), config.titleLines.map((line) => line.text).join(" "));
  }
  assert.equal(gameMenuConfig("warline").fastTravelLabel, "Portals - direct deploy");
});

test("imperative menu markup escapes caller-provided text and preserves authored configuration", () => {
  const title = gameMenuTitleHtml("redline", { id: 'title" onclick="bad', className: "x<y" });
  assert.match(title, /id="title&quot; onclick=&quot;bad"/);
  assert.match(title, /ssg-main-menu-title x&lt;y/);
  assert.match(title, />RED<.*>LINE</);

  const copy = gameMenuCopyHtml("redline", {
    subtitle: "Run <script>alert('no')</script>",
    status: ["Ready & waiting"],
  });
  assert.match(copy, /Run &lt;script&gt;alert\(&#39;no&#39;\)&lt;\/script&gt;/);
  assert.match(copy, /Ready &amp; waiting/);
});

test("navigation uses hub routes outside the dev fleet", () => {
  assert.equal(isDevFleetPage(), false);
  assert.equal(gameHref("deadlane"), gameRoute("deadlane"));
  assert.equal(warlineLobbyHref(), "/warline/");

  goToWarlineLobby();
  assert.equal(testWindow.location.href, "/warline/");
});

test("navigation targets sibling Vite ports within the local dev fleet", () => {
  testWindow = createTestWindow({
    href: "http://127.0.0.1:5178/",
    hostname: "127.0.0.1",
    port: "5178",
    protocol: "http:",
  });
  installTestWindow(testWindow);

  assert.equal(isDevFleetPage(), true);
  assert.equal(gameHref("deadlane"), "http://127.0.0.1:5174/");
  assert.equal(warlineLobbyHref(), "http://127.0.0.1:5180/");
});

test("quick-jump output includes only playable non-lobby targets and excludes the current game", () => {
  const targets = gameJumpTargets();
  assert.deepEqual(
    targets.map((target) => target.slug),
    ["scourge-survivors"] satisfies GameSlug[],
  );
  assert.equal(gameJumpTargets("scourge-survivors").length, 0);
  assert.equal(gameJumpHtml("scourge-survivors"), "");
  assert.match(gameJumpHtml(undefined, "Deploy & burn"), /Deploy & burn/);
  assert.match(gameJumpHtml(), /href="\/scourge-survivors\/"/);
});

test("navigation helpers are SSR-safe", () => {
  removeTestWindow();
  assert.equal(isDevFleetPage(), false);
  assert.equal(gameHref("warline"), "/warline/");
  assert.doesNotThrow(goToWarlineLobby);
});
