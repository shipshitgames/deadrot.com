import { describe, expect, test } from "bun:test";
import { HudSystem } from "../../src/systems/hud";
import type { GameState } from "../../src/types";
import { getBannerSnapshot, subscribeBanner } from "../../src/ui/bannerBridge";

function makeState(): GameState {
  return {
    phase: "menu",
    gold: 175,
    wave: 0,
    baseHp: 20,
    hintText: "HOLD THE LINE",
    selectedTower: "ember",
    towers: [],
    creeps: [],
    projectiles: [],
    buildProgress: 0,
    buildTargetKey: null,
    buildSpeedLevel: 0,
    runSpeedLevel: 0,
    lastBonus: null,
    spawnList: [],
    spawnTimer: 0,
    interWaveTimer: 0,
  };
}

describe("Deadlane HUD lifecycle", () => {
  test("idle frames do not publish duplicate React snapshots", () => {
    const hud = new HudSystem();
    const state = makeState();
    let notifications = 0;
    const unsubscribe = subscribeBanner(() => notifications++);

    hud.update(state, 0, true);
    const afterMount = notifications;
    for (let i = 0; i < 300; i++) hud.update(state, 1 / 60);

    expect(notifications).toBe(afterMount);
    expect(hud.publicationCount).toBe(1);
    unsubscribe();
  });

  test("changing HUD data is throttled to at most 10 publications per second and can flush immediately", () => {
    const hud = new HudSystem();
    const state = makeState();
    hud.update(state, 0, true);
    const before = hud.publicationCount;

    for (let frame = 0; frame < 60; frame++) {
      state.hintText = `BUILDING ${frame}%`;
      hud.update(state, 1 / 60);
    }

    expect(hud.publicationCount - before).toBeGreaterThan(0);
    expect(hud.publicationCount - before).toBeLessThanOrEqual(10);

    state.hintText = "TOWER ONLINE";
    hud.update(state, 0, true);
    expect(getBannerSnapshot().hint).toBe("TOWER ONLINE");
  });
});
