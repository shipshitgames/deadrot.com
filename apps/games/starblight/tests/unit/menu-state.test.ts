import { describe, expect, test } from "bun:test";
import type { HudState } from "../../src/game/types";
import { menuSnapshotFromHud, sameMenuSnapshot } from "../../src/ui/menuState";

function hudState(overrides: Partial<HudState> = {}): HudState {
  return {
    phase: "playing",
    level: 7,
    xp01: 0.4,
    timeSec: 125.9,
    integrity: 60,
    maxIntegrity: 100,
    gems: 48,
    kills: 92,
    build: [
      {
        id: "lance",
        icon: "◆",
        name: "Void Lance",
        level: 3,
        max: 5,
        kind: "weapon",
      },
    ],
    draft: null,
    bossHp01: null,
    lowIntegrity: false,
    ...overrides,
  };
}

describe("menu state", () => {
  test("publishes only the phase during live play", () => {
    expect(menuSnapshotFromHud(hudState())).toEqual({
      phase: "playing",
      level: 1,
      timeSec: 0,
      salvage: 0,
      kills: 0,
      build: [],
    });
  });

  test("captures a stable terminal run summary", () => {
    const state = hudState({ phase: "victory" });
    const snapshot = menuSnapshotFromHud(state);

    expect(snapshot).toEqual({
      phase: "victory",
      level: 7,
      timeSec: 125,
      salvage: 48,
      kills: 92,
      build: state.build,
    });
    expect(snapshot.build).not.toBe(state.build);
    expect(snapshot.build[0]).not.toBe(state.build[0]);
  });

  test("dirty-checks scalar and build changes", () => {
    const snapshot = menuSnapshotFromHud(hudState({ phase: "paused" }));
    const identical = { ...snapshot, build: snapshot.build.map((chip) => ({ ...chip })) };

    expect(sameMenuSnapshot(snapshot, identical)).toBe(true);
    expect(sameMenuSnapshot(snapshot, { ...identical, kills: identical.kills + 1 })).toBe(false);
    expect(
      sameMenuSnapshot(snapshot, {
        ...identical,
        build: identical.build.map((chip) => ({ ...chip, level: chip.level + 1 })),
      }),
    ).toBe(false);
  });
});
