import { describe, expect, it } from "vitest";
import { killStatLabel, runModeLabel } from "../../src/components/hud/shared";

describe("HUD copy uses Survivors run vocabulary (#77)", () => {
  it("labels stored/internal run modes without exposing legacy campaign wording", () => {
    expect(runModeLabel("campaign")).toBe("Breach");
    expect(runModeLabel("structured")).toBe("Structured");
    expect(runModeLabel("endless")).toBe("Endless");
    expect(runModeLabel("coop")).toBe("Co-op");
    expect(runModeLabel("sandbox")).toBe("Sandbox");
    expect(runModeLabel()).toBe("Run");
  });

  it("uses co-op neutral kill vocabulary instead of frag language", () => {
    expect(killStatLabel()).toBe("Kills");
  });
});
