// Operation framing for the run summary (#361): the post-run summary must tell
// the player what operation they ran and what it bought the Warline front. The
// operation NAME is canon and comes from the typed lore (games.json
// warlineRole); the front contribution is the same biomass App.tsx banks into
// the shared war-effort pool (#280). These pure seams back the GameOverScreen
// cells, so the number shown provably equals the number reported to the front.
import { getGameLore } from "@shipshitgames/assets/lore";
import { describe, expect, it } from "vitest";
import { frontContribution, OPERATION_LINE, OPERATION_NAME } from "../../src/game/data/operation";
import { runBiomass } from "../../src/game/data/survivors";

describe("operation framing surfaces canon lore (#361)", () => {
  it("operation name + line come straight from the canon warlineRole", () => {
    const role = getGameLore("scourge-survivors")?.warlineRole;
    expect(role?.operation).toBeTruthy();
    expect(OPERATION_NAME).toBe(role?.operation);
    expect(OPERATION_LINE).toBe(role?.line);
    // The canon op for the flagship Pyre breach descent.
    expect(OPERATION_NAME).toBe("Breach Purge");
  });

  it("front contribution equals the run biomass reported to the pool", () => {
    for (const [kills, level, time] of [
      [0, 0, 0],
      [100, 10, 200],
      [9999, 99, 9999],
    ] as const) {
      expect(frontContribution(kills, level, time)).toBe(runBiomass(kills, level, time));
    }
  });

  it("a lost run still contributes (kills bank biomass regardless of outcome)", () => {
    // Even with no win, a run that thinned the swarm buys the front something.
    expect(frontContribution(40, 5, 120)).toBeGreaterThan(0);
  });
});
