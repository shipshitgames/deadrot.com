import assert from "node:assert/strict";
import { test } from "node:test";
import { AudioEngine } from "../src/audio/AudioEngine";

class FakeParam {
  value = 1;
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeNode {
  readonly gain = new FakeParam();
  connect(): this {
    return this;
  }
  disconnect(): void {}
}

class FakeAudioContext {
  static closeCalls = 0;
  state: AudioContextState = "running";
  readonly destination = new FakeNode();
  createGain() {
    return new FakeNode();
  }
  createMediaElementSource() {
    return new FakeNode();
  }
  close() {
    FakeAudioContext.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

class FakeAudio {
  static latest: FakeAudio | null = null;
  preload = "";
  crossOrigin = "";
  loop = false;
  currentTime = 0;
  src = "";
  paused = 0;
  readonly listeners = new Map<string, Set<EventListener>>();
  constructor() {
    FakeAudio.latest = this;
  }
  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
  pause() {
    this.paused += 1;
  }
  play() {
    return Promise.resolve();
  }
  load(): void {}
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

class FakeWindow {
  readonly AudioContext = FakeAudioContext;
  readonly listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

test("AudioEngine dispose closes its context and removes media/unlock listeners", () => {
  const globals = globalThis as unknown as { window?: Window; Audio?: typeof Audio };
  const originalWindow = globals.window;
  const originalAudio = globals.Audio;
  const fakeWindow = new FakeWindow();
  FakeAudioContext.closeCalls = 0;
  FakeAudio.latest = null;
  globals.window = fakeWindow as unknown as Window;
  globals.Audio = FakeAudio as unknown as typeof Audio;

  try {
    const engine = new AudioEngine<"cue", never>({ palette: { cue: () => {} } });
    assert.equal(fakeWindow.count("pointerdown"), 1);
    assert.equal(fakeWindow.count("keydown"), 1);
    assert.equal(fakeWindow.count("touchstart"), 1);

    engine.unlock();
    assert.equal(engine.contextState, "running");
    engine.dispose();
    engine.dispose();

    assert.equal(engine.contextState, "none");
    assert.equal(FakeAudioContext.closeCalls, 1);
    const audioElement = FakeAudio.latest as FakeAudio | null;
    assert.ok(audioElement);
    assert.equal(audioElement.paused, 1);
    assert.equal(audioElement.listeners.get("error")?.size ?? 0, 0);
    assert.equal(audioElement.listeners.get("ended")?.size ?? 0, 0);
    assert.equal(fakeWindow.count("pointerdown"), 0);
    assert.equal(fakeWindow.count("keydown"), 0);
    assert.equal(fakeWindow.count("touchstart"), 0);
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globals, "window");
    else globals.window = originalWindow;
    if (originalAudio === undefined) Reflect.deleteProperty(globals, "Audio");
    else globals.Audio = originalAudio;
  }
});
