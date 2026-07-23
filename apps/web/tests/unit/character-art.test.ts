import { describe, expect, test } from "bun:test";

import { characterArtUrl, characterArtVariants, characters } from "@/lib/content";

describe("catalog-backed character art", () => {
  for (const character of characters) {
    test(`${character.name} resolves a catalog illustration`, () => {
      const variants = characterArtVariants(character);
      expect(variants.length).toBeGreaterThan(0);
      expect(characterArtUrl(character)).toContain("/entities/");
      expect(variants.every((variant) => variant.path.endsWith(".webp"))).toBe(true);
    });
  }

  test("Ranger resolves a distinct plate for each supported game", () => {
    const ranger = characters.find((character) => character.slug === "ranger");
    expect(ranger).toBeTruthy();
    if (!ranger) return;

    expect(characterArtUrl(ranger, "scourge-survivors")).not.toBe(characterArtUrl(ranger, "pactfall"));
  });

  test("Pyre Duelist exposes Brawl as an explicit Pactfall alias", () => {
    const duelist = characters.find((character) => character.slug === "pyre-duelist");
    expect(duelist).toBeTruthy();
    if (!duelist) return;

    const brawl = characterArtVariants(duelist).find((variant) => variant.game === "brawl");
    expect(brawl?.sourceGame).toBe("pactfall");
    expect(brawl?.url).toBe(characterArtUrl(duelist, "pactfall"));
  });
});
