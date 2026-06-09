import { describe, expect, test } from "bun:test";
import { InputSystem } from "../../src/game/systems/InputSystem";
import type { RenderSystem } from "../../src/game/systems/RenderSystem";

// ---------------------------------------------------------------------------
// InputSystem's ability latch, driven headlessly. The constructor only wires
// listeners onto window + the canvas, so a no-op addEventListener on both is
// enough — the latch under test (pressAbility / takeAbilities / clearAbilities)
// is pure state shared by keyboard Q/W/E and the HUD tap-to-cast buttons.
// ---------------------------------------------------------------------------

const listenerSink = { addEventListener: () => {} };
(globalThis as { window?: unknown }).window ??= listenerSink;

function makeInput(): InputSystem {
  const canvas = listenerSink as unknown as HTMLCanvasElement;
  const render = {} as RenderSystem;
  return new InputSystem(canvas, render);
}

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
});
