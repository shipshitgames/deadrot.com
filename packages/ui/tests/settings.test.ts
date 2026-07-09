import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  clampEffectsLevel,
  DEFAULT_GLOBAL_GAME_SETTINGS,
  loadGlobalGameSettings,
  saveGlobalGameSettings,
  setGlobalEffectLevel,
  subscribeGlobalGameSettings,
  toggleGlobalMusicMuted,
} from "../src/settings";
import { createTestWindow, installTestWindow, removeTestWindow, SETTINGS_KEY, type TestWindow } from "./browser";

let testWindow: TestWindow;

beforeEach(() => {
  testWindow = createTestWindow();
  installTestWindow(testWindow);
});

afterEach(removeTestWindow);

test("settings storage returns defaults and normalizes malformed or partial values", () => {
  assert.deepEqual(loadGlobalGameSettings(), DEFAULT_GLOBAL_GAME_SETTINGS);
  assert.equal(clampEffectsLevel(-1), 0);
  assert.equal(clampEffectsLevel(2), 1);
  assert.equal(clampEffectsLevel("bad"), 1);

  testWindow.localStorage.setItem(SETTINGS_KEY, "not json");
  assert.deepEqual(loadGlobalGameSettings(), DEFAULT_GLOBAL_GAME_SETTINGS);

  testWindow.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ effectLevels: { music: 0.25, flash: 4 }, musicMuted: true }),
  );
  assert.deepEqual(loadGlobalGameSettings(), {
    effectLevels: { music: 0.25, sound: 1, particles: 1, flash: 1, shake: 1 },
    musicMuted: true,
  });
});

test("settings writes merge patches, clamp levels, and round-trip mute state", () => {
  assert.deepEqual(saveGlobalGameSettings({ effectLevels: { sound: 0.4 } }), {
    effectLevels: { music: 1, sound: 0.4, particles: 1, flash: 1, shake: 1 },
    musicMuted: false,
  });
  assert.equal(setGlobalEffectLevel("sound", 9).effectLevels.sound, 1);
  assert.equal(toggleGlobalMusicMuted().musicMuted, true);
  assert.deepEqual(JSON.parse(testWindow.localStorage.getItem(SETTINGS_KEY) ?? "null"), loadGlobalGameSettings());
});

test("subscriptions emit initial, custom-event, and relevant storage updates, then fully unsubscribe", () => {
  const received: ReturnType<typeof loadGlobalGameSettings>[] = [];
  const unsubscribe = subscribeGlobalGameSettings((settings) => received.push(settings));

  assert.equal(received.length, 1);
  assert.equal(testWindow.listenerCount("shipshitgames:game-settings"), 1);
  assert.equal(testWindow.listenerCount("storage"), 1);

  saveGlobalGameSettings({ musicMuted: true });
  assert.equal(received.length, 2);
  assert.equal(received.at(-1)?.musicMuted, true);

  testWindow.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
  assert.equal(received.length, 2);

  testWindow.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ effectLevels: { music: 0.2 }, musicMuted: false }));
  testWindow.dispatchEvent(Object.assign(new Event("storage"), { key: SETTINGS_KEY }));
  assert.equal(received.length, 3);
  assert.equal(received.at(-1)?.effectLevels.music, 0.2);

  unsubscribe();
  assert.equal(testWindow.listenerCount("shipshitgames:game-settings"), 0);
  assert.equal(testWindow.listenerCount("storage"), 0);
  saveGlobalGameSettings({ musicMuted: true });
  assert.equal(received.length, 3);
});

test("settings APIs are SSR-safe", () => {
  removeTestWindow();
  assert.deepEqual(loadGlobalGameSettings(), DEFAULT_GLOBAL_GAME_SETTINGS);
  assert.doesNotThrow(() => saveGlobalGameSettings({ musicMuted: true }));
  assert.doesNotThrow(() => subscribeGlobalGameSettings(() => {})());
});
