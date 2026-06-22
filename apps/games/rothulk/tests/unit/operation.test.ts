// Breach Sabotage operation framing for Rothulk (#364). The briefing and the
// HUD objectives must read the SAME canon as the web hub and the Warline front:
// the operation name/line come from the typed lore (games.json warlineRole), and
// the three beats (ignite → collapse → escape) tie to Choir isolation (CANON
// §5/§6) and the Warline sabotage report. These pure seams back the briefing
// surface, so what the player reads provably equals the canon string.

import { describe, expect, it } from "bun:test";
import { getGameLore } from "@shipshitgames/assets/lore";
import { objectiveForPhase } from "../../src/game/coreLoop";
import {
  beatForPhase,
  FRONT_REPORT,
  OPERATION_LINE,
  OPERATION_NAME,
  SABOTAGE_BEATS,
} from "../../src/game/data/operation";
import type { CoreLoopPhase } from "../../src/game/types";

describe("Rothulk Warline operation framing (#364)", () => {
  it("operation name + line come straight from the canon warlineRole", () => {
    const role = getGameLore("rothulk")?.warlineRole;
    expect(role?.operation).toBeTruthy();
    expect(OPERATION_NAME).toBe(role?.operation as string);
    expect(OPERATION_LINE).toBe(role?.line as string);
    // The canon op for the lone Pyre breach-hulk climb.
    expect(OPERATION_NAME).toBe("Breach Sabotage");
  });

  it("the three sabotage beats run ignite → collapse → escape", () => {
    expect(SABOTAGE_BEATS.map((beat) => beat.id)).toEqual(["ignite", "collapse", "escape"]);
    for (const beat of SABOTAGE_BEATS) {
      expect(beat.title.trim().length).toBeGreaterThan(0);
      expect(beat.detail.trim().length).toBeGreaterThan(0);
      expect(beat.report.trim().length).toBeGreaterThan(0);
    }
  });

  it("each beat maps to exactly one core-loop phase and has an objective", () => {
    const phases: CoreLoopPhase[] = ["infiltrate", "escape", "won"];
    const beatPhases = SABOTAGE_BEATS.map((beat) => beat.phase);
    // Every phase is covered exactly once — beats and the loop stay in lockstep.
    expect(beatPhases.slice().sort()).toEqual(phases.slice().sort());
    for (const phase of phases) {
      expect(beatForPhase(phase).phase).toBe(phase);
      // The HUD objective for the same phase is real, non-empty copy.
      expect(objectiveForPhase(phase, false).length).toBeGreaterThan(0);
    }
  });

  it("the beats tie sabotage to Choir isolation (CANON §5/§6)", () => {
    const igniteBeat = beatForPhase("infiltrate");
    const collapseBeat = beatForPhase("escape");
    const escapeBeat = beatForPhase("won");
    expect(igniteBeat.id).toBe("ignite");
    expect(collapseBeat.id).toBe("collapse");
    expect(escapeBeat.id).toBe("escape");
    // Igniting wires into the Choir; collapsing severs the node; escape leaves it feral.
    expect(igniteBeat.detail).toMatch(/Choir/);
    expect(collapseBeat.detail).toMatch(/Choir|sever/i);
    expect(escapeBeat.detail).toMatch(/feral|blind/i);
  });

  it("the closing front report is the canon Warline sabotage dispatch", () => {
    const escapeBeat = beatForPhase("won");
    expect(FRONT_REPORT).toBe(escapeBeat.report);
    // Mirrors the canon warlineRole line: one sabotaged nest goes feral + blind.
    expect(FRONT_REPORT).toMatch(/feral and blind/i);
    expect(OPERATION_LINE).toContain("feral and blind");
  });
});
