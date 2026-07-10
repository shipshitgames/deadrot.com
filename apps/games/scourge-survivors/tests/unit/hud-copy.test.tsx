import { describe, expect, it } from "vitest";
import { killStatLabel, runModeLabel } from "../../src/components/hud/shared";

describe("HUD copy uses Survivors run vocabulary (#77)", () => {
  it("labels stored/internal run modes without exposing legacy campaign wording", () => {
    expect(runModeLabel("campaign")).toBe("Breach");
    expect(runModeLabel("structured")).toBe("Structured");
    expect(runModeLabel("endless")).toBe("Endless");
    expect(runModeLabel("arena")).toBe("Arena Preview");
    expect(runModeLabel("sandbox")).toBe("Sandbox");
    expect(runModeLabel()).toBe("Run");
  });

  it("keeps the shared aggregate stat label stable", () => {
    expect(killStatLabel()).toBe("Kills");
  });
});
