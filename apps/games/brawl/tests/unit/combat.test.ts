import { describe, expect, test } from "bun:test";
import { attackDamage, guardedDamage } from "../../src/game/combat";
import { fighterById, pickOpponent } from "../../src/game/roster";

describe("Brawl combat rules", () => {
  test("game-selected rivals bias non-Scourge picks into a Scourge fight", () => {
    expect(pickOpponent("pyre-duelist")).toBe("scourge-render");
    expect(pickOpponent("warden-bastion")).toBe("scourge-render");
  });

  test("Scourge selections get a faction opponent", () => {
    expect(fighterById(pickOpponent("trucebreaker")).faction).not.toBe("Scourge");
  });

  test("guard keeps chip damage meaningful but much lower", () => {
    const fighter = fighterById("pyre-duelist");
    expect(attackDamage("heavy", fighter)).toBe(13);
    expect(guardedDamage(13, true)).toBeLessThan(13);
    expect(guardedDamage(2, true)).toBeGreaterThanOrEqual(1);
  });
});
