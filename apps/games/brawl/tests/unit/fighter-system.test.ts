import { describe, expect, test } from "bun:test";
import { FighterSystem } from "../../src/game/fighters/FighterSystem";
import { type InputEventTarget, InputSystem } from "../../src/game/input/InputSystem";
import type { FighterSpec } from "../../src/game/roster";
import type { BrawlAudioPort, FighterRenderPort, FighterVisual, RuntimeFighter } from "../../src/game/runtime";
import type { HudState } from "../../src/game/types";

const inertTarget: InputEventTarget = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

class FakeRender implements FighterRenderPort {
  private nextId = 1;
  disposed = 0;
  createFighterVisual(_spec: FighterSpec): FighterVisual {
    return { id: this.nextId++ };
  }
  transformFighter(_fighter: RuntimeFighter): void {}
  setFighterVisible(_fighter: RuntimeFighter, _visible: boolean): void {}
  disposeFighterVisual(_fighter: RuntimeFighter): void {
    this.disposed += 1;
  }
  spawnSparks(_x: number, _y: number, _color: string, _count?: number): void {}
  addShake(_amount: number): void {}
}

class FakeAudio implements BrawlAudioPort {
  unlock(): void {}
  roundStart(_mode: "duel" | "arena"): void {}
  jump(): void {}
  impact(_blocked: boolean, _damage: number): void {}
  miss(): void {}
  ringOut(): void {}
  roundEnd(_outcome: "victory" | "defeat"): void {}
  dispose(): void {}
}

function createSystem() {
  const render = new FakeRender();
  const input = new InputSystem(() => {}, inertTarget);
  let latest: HudState | null = null;
  const fighters = new FighterSystem(render, input, new FakeAudio(), (next) => {
    latest = next;
  });
  return { fighters, input, render, latest: () => latest as HudState };
}

describe("Brawl FighterSystem", () => {
  test("selection, arena launch, pause/resume, and roster reset preserve the chosen setup", () => {
    const { fighters, render, latest } = createSystem();
    fighters.selectFighter("warden-bastion");
    fighters.setMode("arena");
    fighters.setArenaSlots(99);
    fighters.startArena();

    expect(latest().status).toBe("playing");
    expect(latest().selectedId).toBe("warden-bastion");
    expect(latest().arenaSlots).toBe(4);
    expect(latest().arena?.fighters).toHaveLength(4);

    fighters.pause();
    expect(latest().status).toBe("paused");
    fighters.resume();
    expect(latest().status).toBe("playing");
    fighters.returnToRoster();

    expect(latest().status).toBe("select");
    expect(latest().selectedId).toBe("warden-bastion");
    expect(latest().mode).toBe("arena");
    expect(latest().result).toBeNull();
    expect(render.disposed).toBe(4);
  });

  test("a queued attack advances through windup, hit, recovery, and cooldown state", () => {
    const { fighters, input } = createSystem();
    fighters.startFight("pyre-duelist");
    fighters.debugSetDuelPositions(-1, 1);
    const before = fighters.snapshot().opponent?.health ?? 0;

    input.command("light");
    fighters.updateDuel(0.01);
    expect(fighters.snapshot().player?.attacking).toBe("light");

    fighters.updateDuel(0.07);
    expect(fighters.snapshot().opponent?.health).toBeLessThan(before);

    fighters.updateDuel(0.2);
    expect(fighters.snapshot().player?.attacking).toBeNull();
  });

  test("dispose is idempotent and releases every live fighter visual", () => {
    const { fighters, render } = createSystem();
    fighters.startFight();
    fighters.dispose();
    fighters.dispose();
    expect(render.disposed).toBe(2);
  });
});
