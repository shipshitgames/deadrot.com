import { describe, expect, test } from "bun:test";
import { buildNotes, getBuildNote, latestBuildNote } from "@/lib/build-notes";

describe("buildNotes", () => {
  test("has at least one authored note with stable slugs", () => {
    expect(buildNotes.length).toBeGreaterThan(0);
    for (const note of buildNotes) {
      expect(note.slug).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(note.title.trim().length).toBeGreaterThan(0);
      expect(note.summary.trim().length).toBeGreaterThan(0);
    }
  });

  test("latestBuildNote points at the first note", () => {
    expect(latestBuildNote).toBe(buildNotes[0]);
    expect(getBuildNote(latestBuildNote.slug)).toBe(latestBuildNote);
  });

  test("each note includes validation evidence and release-note sections", () => {
    for (const note of buildNotes) {
      for (const section of [
        note.highlights,
        note.gameUpdates,
        note.warlineAndMeta,
        note.assetsAndAudio,
        note.mobileAndAccessibility,
        note.validation,
      ]) {
        expect(section.length).toBeGreaterThan(0);
      }

      for (const evidence of note.validation) {
        expect(evidence.command.trim().length).toBeGreaterThan(0);
        expect(evidence.result.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
