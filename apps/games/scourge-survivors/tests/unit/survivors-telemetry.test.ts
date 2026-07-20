import { describe, expect, it } from "vitest";
import {
  survivorBuildTelemetry,
  survivorChoiceCategory,
  survivorChoiceTelemetry,
  warEffortTierFromDamageMultiplier,
} from "../../src/game/systems/SurvivorsTelemetrySystem";

describe("Survivors balance telemetry payloads", () => {
  it("classifies draft choices and records the decision state", () => {
    expect(survivorChoiceTelemetry({ id: "orbit", name: "Ring", desc: "", icon: "orbit", level: 0, max: 6 })).toEqual({
      id: "orbit",
      category: "offensive",
      current_level: 0,
      max_level: 6,
      state: "new",
    });
    expect(
      survivorChoiceTelemetry({ id: "armor", name: "Armor", desc: "", icon: "armor", level: 2, max: 5 }),
    ).toMatchObject({
      category: "defensive",
      state: "level-up",
    });
    expect(
      survivorChoiceTelemetry({
        id: "evo-orbit",
        name: "Cyclone",
        desc: "",
        icon: "orbit",
        level: 0,
        max: 1,
        golden: true,
      }),
    ).toMatchObject({
      category: "offensive",
      state: "evolution",
    });
    expect(survivorChoiceCategory("magnet")).toBe("utility");
  });

  it("builds stable offensive, defensive, and utility loadout summaries", () => {
    expect(
      survivorBuildTelemetry({ orbit: 6, dmg: 2, armor: 3, magnet: 1 }, { orbit: true, bolt: false, nova: false }),
    ).toEqual({
      offensive: [
        { id: "dmg", level: 2, evolved: false },
        { id: "orbit", level: 6, evolved: true },
      ],
      defensive: [{ id: "armor", level: 3, evolved: false }],
      utility: [{ id: "magnet", level: 1, evolved: false }],
    });
  });

  it("derives the discrete shared-war tier from the applied damage multiplier", () => {
    expect(warEffortTierFromDamageMultiplier(1)).toBe(0);
    expect(warEffortTierFromDamageMultiplier(1.12)).toBe(3);
    expect(warEffortTierFromDamageMultiplier(Number.NaN)).toBe(0);
  });
});
