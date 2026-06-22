import { describe, expect, test } from "bun:test";
import { bestiary, spriteUrl } from "@/lib/content";

// Guard for the broken-portrait class of regression (#361): a typed bestiary
// creature whose `spriteBase` has no SPRITE_BASE_PATHS mapping silently falls
// back to the bare base string (e.g. "enemy-hound" → /enemy-hound, not a real
// asset), rendering a broken image on the public bestiary / universe / codex.
// Adding Wound-Hound + Quaver exposed exactly this gap. Every non-null
// spriteBase must resolve to a real .webp asset, not the bare fallback.
describe("public web bestiary portraits resolve to real assets", () => {
  for (const creature of bestiary) {
    if (!creature.spriteBase) continue;
    test(`${creature.slug} spriteBase "${creature.spriteBase}" resolves to a .webp`, () => {
      const url = spriteUrl(creature.spriteBase);
      expect(url, `${creature.slug}: spriteUrl returned null`).toBeTruthy();
      expect(url, `${creature.slug}: unmapped spriteBase fell back to the bare base`).toContain(".webp");
    });
  }
});
