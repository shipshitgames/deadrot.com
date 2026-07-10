import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { MusicDirector, type MusicSceneDef } from "../src/MusicDirector";
import { saveGlobalGameSettings } from "../src/settings";
import { createTestWindow, installTestWindow, removeTestWindow, type TestWindow } from "./browser";

class FakeAudioParam {
  value = 0;
  readonly targets: number[] = [];
  readonly ramps: number[] = [];

  cancelScheduledValues(): void {}

  linearRampToValueAtTime(value: number): void {
    this.value = value;
    this.ramps.push(value);
  }

  setTargetAtTime(value: number): void {
    this.value = value;
    this.targets.push(value);
  }

  setValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  connectCalls = 0;
  disconnectCalls = 0;

  connect(): void {
    this.connectCalls++;
  }

  disconnect(): void {
    this.disconnectCalls++;
  }
}

class FakeSourceNode {
  connectCalls = 0;
  disconnectCalls = 0;

  connect(): void {
    this.connectCalls++;
  }

  disconnect(): void {
    this.disconnectCalls++;
  }
}

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];

  crossOrigin = "";
  currentTime = 0;
  loop = false;
  onended: (() => void) | null = null;
  pauseCalls = 0;
  playCalls = 0;
  preload = "";
  src = "";

  constructor() {
    FakeAudioElement.instances.push(this);
  }

  pause(): void {
    this.pauseCalls++;
  }

  play(): Promise<void> {
    this.playCalls++;
    return Promise.resolve();
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  readonly currentTime = 4;
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeSourceNode[] = [];
  closeCalls = 0;
  resumeCalls = 0;
  state: AudioContextState = "suspended";

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  close(): Promise<void> {
    this.closeCalls++;
    this.state = "closed";
    return Promise.resolve();
  }

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    const source = new FakeSourceNode();
    this.sources.push(source);
    return source as unknown as MediaElementAudioSourceNode;
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    this.state = "running";
    return Promise.resolve();
  }
}

const menuScene: MusicSceneDef = {
  id: "menu",
  tracks: [{ id: "menu-bed", url: "/audio/menu.webm", gain: 0.8 }],
  crossfadeMs: 100,
};

let testWindow: TestWindow;
let previousAudio: PropertyDescriptor | undefined;

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioElement.instances = [];
  testWindow = createTestWindow({}, FakeAudioContext as unknown as typeof AudioContext);
  installTestWindow(testWindow);
  previousAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudioElement,
    writable: true,
  });
});

afterEach(() => {
  removeTestWindow();
  if (previousAudio) Object.defineProperty(globalThis, "Audio", previousAudio);
  else Reflect.deleteProperty(globalThis, "Audio");
});

test("MusicDirector lazily creates and resumes one audio graph", () => {
  const director = new MusicDirector({ baseGain: 0.4 });
  assert.equal(FakeAudioContext.instances.length, 0);

  director.resume();
  director.resume();

  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(FakeAudioContext.instances[0]?.resumeCalls, 1);
  assert.equal(testWindow.listenerCount("shipshitgames:game-settings"), 1);
  assert.equal(testWindow.listenerCount("storage"), 1);
  assert.deepEqual(FakeAudioContext.instances[0]?.gains[0]?.gain.targets, [0.4, 0.4]);

  director.dispose();
});

test("MusicDirector plays, deduplicates scenes, tracks settings, and advances playlists", () => {
  const director = new MusicDirector({ baseGain: 0.5 });
  director.play(menuScene);
  director.play(menuScene);

  assert.equal(FakeAudioElement.instances.length, 1);
  assert.equal(FakeAudioElement.instances[0]?.playCalls, 1);
  assert.equal(FakeAudioElement.instances[0]?.src, "/audio/menu.webm");
  assert.equal(FakeAudioElement.instances[0]?.loop, true);

  const context = FakeAudioContext.instances[0];
  const master = context?.gains[0];
  saveGlobalGameSettings({ effectLevels: { music: 0.2 } });
  saveGlobalGameSettings({ musicMuted: true });
  assert.deepEqual(master?.gain.targets.slice(-2), [0.1, 0]);

  director.play({
    id: "combat",
    tracks: [
      { id: "a", url: "/audio/a.webm" },
      { id: "b", url: "/audio/b.webm" },
    ],
    shuffle: false,
    crossfadeMs: 0,
  });
  assert.equal(FakeAudioElement.instances.length, 2);
  FakeAudioElement.instances[1]?.onended?.();
  assert.equal(FakeAudioElement.instances[0]?.playCalls, 2);
  assert.equal(FakeAudioElement.instances[1]?.playCalls, 1);

  director.setIntensity(2);
  assert.equal(director.currentIntensity, 1);
  director.setIntensity(-1);
  assert.equal(director.currentIntensity, 0);
  director.dispose();
});

test("dispose removes subscriptions, media handlers, audio nodes, and pending fade timers", () => {
  const director = new MusicDirector();
  director.play(menuScene);
  director.stop(500);
  assert.equal(testWindow.pendingTimeoutCount(), 1);

  const context = FakeAudioContext.instances[0];
  const master = context?.gains[0];
  const targetCount = master?.gain.targets.length;
  const audio = FakeAudioElement.instances[0];
  director.dispose();
  director.dispose();

  assert.equal(testWindow.pendingTimeoutCount(), 0);
  assert.equal(testWindow.listenerCount("shipshitgames:game-settings"), 0);
  assert.equal(testWindow.listenerCount("storage"), 0);
  assert.equal(context?.closeCalls, 1);
  assert.equal(audio?.src, "");
  assert.equal(audio?.onended, null);
  assert.equal(context?.sources[0]?.disconnectCalls, 1);

  saveGlobalGameSettings({ effectLevels: { music: 0.7 } });
  assert.equal(master?.gain.targets.length, targetCount);
});

test("a fresh director after HMR-style disposal owns exactly one new graph and subscription", () => {
  const first = new MusicDirector();
  first.play(menuScene);
  first.dispose();

  const replacement = new MusicDirector();
  replacement.play(menuScene);

  assert.equal(FakeAudioContext.instances.length, 2);
  assert.equal(testWindow.listenerCount("shipshitgames:game-settings"), 1);
  assert.equal(testWindow.listenerCount("storage"), 1);
  replacement.dispose();
});

test("MusicDirector is SSR-safe", () => {
  removeTestWindow();
  const director = new MusicDirector();
  assert.doesNotThrow(() => director.play(menuScene));
  assert.doesNotThrow(() => director.resume());
  assert.doesNotThrow(() => director.dispose());
});
