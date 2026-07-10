import { afterEach, describe, expect, test } from "bun:test";
import { InputSystem } from "../../src/game/systems/InputSystem";
import type { RenderSystem } from "../../src/game/systems/RenderSystem";

// ---------------------------------------------------------------------------
// InputSystem's ability latch, driven headlessly. The constructor only wires
// listeners onto window + the canvas, so a no-op addEventListener on both is
// enough — the latch under test (pressAbility / takeAbilities / clearAbilities)
// is pure state shared by keyboard Q/W/E and the HUD tap-to-cast buttons.
// ---------------------------------------------------------------------------

class ListenerSink {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  get listenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) count += listeners.size;
    return count;
  }
}

const listenerSink = new ListenerSink();
(globalThis as { window?: unknown }).window = listenerSink;
const createdInputs: InputSystem[] = [];

function makeInput(): InputSystem {
  const canvas = listenerSink as unknown as HTMLCanvasElement;
  const render = {} as RenderSystem;
  const input = new InputSystem(canvas, render);
  createdInputs.push(input);
  return input;
}

afterEach(() => {
  for (const input of createdInputs.splice(0)) input.dispose();
});

describe("InputSystem — Q/W/E ability latch", () => {
  test("pressAbility latches presses in order; takeAbilities drains the queue once", () => {
    const input = makeInput();
    input.pressAbility("q");
    input.pressAbility("e");
    input.pressAbility("w");
    expect(input.takeAbilities()).toEqual(["q", "e", "w"]);
    expect(input.takeAbilities()).toEqual([]); // drained — nothing fires twice
  });

  test("the latch caps buffered presses so a mash never builds a stale backlog", () => {
    const input = makeInput();
    for (let i = 0; i < 10; i++) input.pressAbility("q");
    expect(input.takeAbilities()).toHaveLength(4);
  });

  test("clearAbilities drops everything buffered — the beginRun/resume reset path", () => {
    const input = makeInput();
    input.pressAbility("q");
    input.pressAbility("w");
    input.pressAbility("e");
    input.clearAbilities();
    expect(input.takeAbilities()).toEqual([]);
  });

  test("the latch keeps working after a clear (clear is a reset, not a kill)", () => {
    const input = makeInput();
    input.pressAbility("q");
    input.clearAbilities();
    input.pressAbility("w");
    expect(input.takeAbilities()).toEqual(["w"]);
  });

  test("mount -> dispose -> mount never duplicates browser listeners", () => {
    const first = makeInput();
    expect(listenerSink.listenerCount).toBe(6);
    first.dispose();
    first.dispose();
    expect(listenerSink.listenerCount).toBe(0);

    const second = makeInput();
    expect(listenerSink.listenerCount).toBe(6);
    second.dispose();
    expect(listenerSink.listenerCount).toBe(0);
  });
});
