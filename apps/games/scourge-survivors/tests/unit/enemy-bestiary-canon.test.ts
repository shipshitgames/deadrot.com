// Canon-name reconciliation guard (#361): the Scourge Survivors enemy/boss names
// the game shows must match the canon bestiary in the typed lore derivative
// (`@shipshitgames/assets/lore`, sourced from apps/lore/content/Bestiary). The
// vault leads; this test fails if the game and the canon drift apart — the swarm
// archetypes that ARE a named bestiary host (Ripper, Spitter, Wound-Hound,
// Quaver) plus the Breach-Boss label are pinned, and the game's reconciled roster
// must be the canon enemies it actually fields.
import { getCreature, getGameLore } from "@shipshitgames/assets/lore";
import { describe, expect, it } from "vitest";
import { ENEMY_ARCHETYPES, SCOURGE_THREAT_TIERS } from "../../src/game/data/enemies";

const GAME_SLUG = "scourge-survivors";

// game archetype id → canon bestiary slug it must read identically to.
const ARCHETYPE_TO_BESTIARY: Record<string, string> = {
  grunt: "swarm-ripper",
  shooter: "swarm-spitter",
  hound: "wound-hound",
  flier: "quaver",
};

describe("enemy names reconcile with the canon bestiary (#361)", () => {
  for (const [archetype, slug] of Object.entries(ARCHETYPE_TO_BESTIARY)) {
    it(`${archetype} is named exactly after bestiary "${slug}"`, () => {
      const creature = getCreature(slug);
      expect(creature, `bestiary is missing canon creature "${slug}"`).toBeTruthy();
      expect(ENEMY_ARCHETYPES[archetype as keyof typeof ENEMY_ARCHETYPES].name).toBe(creature?.name);
    });
  }

  it("the breach-boss tier label matches the canon Breach-Boss", () => {
    expect(SCOURGE_THREAT_TIERS.breachBoss.label).toBe(getCreature("breach-boss")?.name);
  });

  it("the game declares its reconciled canon roster in the typed lore", () => {
    const roster = getGameLore(GAME_SLUG)?.enemySlugs ?? [];
    // Every canon-named host the game fields must be on the typed roster.
    for (const slug of [...Object.values(ARCHETYPE_TO_BESTIARY), "breach-boss"]) {
      expect(roster, `enemy "${slug}" missing from ${GAME_SLUG} enemySlugs`).toContain(slug);
    }
    // And every rostered slug must resolve to a real bestiary creature.
    for (const slug of roster) {
      expect(getCreature(slug), `roster slug "${slug}" not in bestiary`).toBeTruthy();
    }
  });

  it("the renamed flier is canon 'Quaver', never the old 'Quaver Host'", () => {
    expect(ENEMY_ARCHETYPES.flier.name).toBe("Quaver");
    expect(ENEMY_ARCHETYPES.flier.name).not.toBe("Quaver Host");
  });
});
