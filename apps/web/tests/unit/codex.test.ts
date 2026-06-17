import { describe, expect, test } from "bun:test";
import { GAME_APPS } from "@deadrot/catalog";
import { publicCodexAnchor } from "@deadrot/game-kit/codex";
import { publicCodexEntries, publicCodexSections } from "@/lib/codex";
import { bestiary, characters, factions, locations, timelineEvents } from "@/lib/content";

describe("publicCodexSections", () => {
  test("contains the expected generated sections", () => {
    expect(publicCodexSections.map((section) => section.id)).toEqual([
      "games",
      "factions",
      "characters",
      "bestiary",
      "locations",
      "timeline",
    ]);
    for (const section of publicCodexSections) {
      expect(section.entries.length).toBeGreaterThan(0);
    }
  });

  test("covers catalog games and lore derivatives", () => {
    const byKind = new Map(publicCodexSections.map((section) => [section.kind, section.entries]));

    expect(
      byKind
        .get("game")
        ?.map((entry) => entry.slug)
        .sort(),
    ).toEqual(GAME_APPS.map((game) => game.slug).sort());
    expect(byKind.get("faction")?.length).toBe(factions.length);
    expect(byKind.get("character")?.length).toBe(characters.length);
    expect(byKind.get("bestiary")?.length).toBe(bestiary.length);
    expect(byKind.get("location")?.length).toBe(locations.length);
    expect(byKind.get("timeline")?.length).toBe(timelineEvents.length);
  });

  test("uses stable public codex anchors without duplicates", () => {
    const anchors = publicCodexEntries.map((entry) => entry.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);

    for (const entry of publicCodexEntries) {
      expect(entry.anchor).toBe(publicCodexAnchor(entry.kind, entry.slug));
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.summary.trim().length).toBeGreaterThan(0);
    }
  });

  test("detail-backed entries link to their stable pages and page-native entries link to codex anchors", () => {
    for (const entry of publicCodexEntries) {
      if (entry.kind === "location" || entry.kind === "timeline") {
        expect(entry.href).toBe(`/codex#${entry.anchor}`);
      } else {
        expect(entry.href.startsWith("/codex#")).toBe(false);
      }
    }
  });
});
