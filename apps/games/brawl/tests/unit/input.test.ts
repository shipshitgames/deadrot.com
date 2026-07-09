import { describe, expect, test } from "bun:test";
import { type InputEventTarget, InputSystem } from "../../src/game/input/InputSystem";

class FakeTarget implements InputEventTarget {
  readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, init: Partial<KeyboardEvent> = {}) {
    let prevented = false;
    const event = {
      code: "",
      repeat: false,
      preventDefault: () => {
        prevented = true;
      },
      ...init,
    } as KeyboardEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return prevented;
  }

  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe("Brawl InputSystem", () => {
  test("latches combat edges once and tracks held movement", () => {
    const target = new FakeTarget();
    const input = new InputSystem(() => {}, target);
    input.start();

    expect(target.dispatch("keydown", { code: "KeyD" })).toBe(true);
    expect(input.isHeld("right")).toBe(true);
    target.dispatch("keydown", { code: "KeyJ" });
    expect(input.consumeAttack()).toBe("light");
    expect(input.consumeAttack()).toBeNull();
    target.dispatch("keyup", { code: "KeyD" });
    expect(input.isHeld("right")).toBe(false);
  });

  test("Escape pauses, but cannot resume the game behind settings/codex", () => {
    const target = new FakeTarget();
    let pauseRequests = 0;
    const input = new InputSystem(() => {
      pauseRequests += 1;
    }, target);
    input.start();

    target.dispatch("keydown", { code: "Escape" });
    expect(pauseRequests).toBe(1);
    input.setMenuOverlayOpen(true);
    target.dispatch("keydown", { code: "Escape" });
    expect(pauseRequests).toBe(1);
    input.setMenuOverlayOpen(false);
    target.dispatch("keydown", { code: "Escape", repeat: true });
    expect(pauseRequests).toBe(1);
  });

  test("dispose clears state and detaches every lifecycle listener", () => {
    const target = new FakeTarget();
    const input = new InputSystem(() => {}, target);
    input.start();
    input.start();
    expect(target.count("keydown")).toBe(1);
    expect(target.count("keyup")).toBe(1);
    expect(target.count("blur")).toBe(1);

    target.dispatch("keydown", { code: "KeyA" });
    input.setVirtual("guard", true);
    input.dispose();

    expect(input.isHeld("left")).toBe(false);
    expect(input.isHeld("guard")).toBe(false);
    expect(target.count("keydown")).toBe(0);
    expect(target.count("keyup")).toBe(0);
    expect(target.count("blur")).toBe(0);
  });
});
