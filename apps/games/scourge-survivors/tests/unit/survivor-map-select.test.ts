import { describe, expect, it } from "vitest";
import { CAMPAIGN_ORDER, DEFAULT_MAP_ID, getMap, MAP_PICKER, MAPS, normalizeMapId } from "../../src/game/data/maps";
import {
  SURVIVOR_RUN_CHAPTERS,
  SURVIVOR_RUN_GOAL_TIME,
  survivorChapterAt,
  survivorChapterStart,
} from "../../src/game/data/survivors";

// Issue #276: the run flow is Character Select -> Map Select -> Run. The picked
// map must persist for the whole run, so (a) every picker entry has to resolve
// to a real map, (b) a saved/garbage map id has to normalize safely, and
// (c) run chapters are pure pacing data with no map binding left.
describe("survivor map select (#276)", () => {
  it("offers every shipped map in the picker, each resolving to itself", () => {
    expect(MAP_PICKER.map((m) => m.id)).toEqual(CAMPAIGN_ORDER);
    expect(new Set(MAP_PICKER.map((m) => m.id))).toEqual(new Set(Object.keys(MAPS)));
    for (const meta of MAP_PICKER) {
      expect(getMap(meta.id).id, meta.id).toBe(meta.id);
      expect(meta.name, meta.id).toBeTruthy();
      expect(meta.subtitle, meta.id).toBeTruthy();
    }
  });

  it("normalizes valid stored map ids to themselves", () => {
    for (const id of CAMPAIGN_ORDER) {
      expect(normalizeMapId(id), id).toBe(id);
    }
  });

  it("falls back to the default map for garbage / missing stored values", () => {
    for (const garbage of ["", "ASHGATE", "not-a-map", "maw2", "{}", null, undefined]) {
      expect(normalizeMapId(garbage), String(garbage)).toBe(DEFAULT_MAP_ID);
    }
    expect(normalizeMapId()).toBe(DEFAULT_MAP_ID);
    expect(MAPS[DEFAULT_MAP_ID]).toBeDefined();
  });

  it("keeps run chapters as pure pacing beats with no map binding", () => {
    for (const chapter of SURVIVOR_RUN_CHAPTERS) {
      expect("mapId" in chapter, chapter.name).toBe(false);
      expect(chapter.duration, chapter.name).toBeGreaterThan(0);
    }
  });

  it("keeps the chapter timeline covering the full run goal time", () => {
    const total = SURVIVOR_RUN_CHAPTERS.reduce((sum, c) => sum + c.duration, 0);
    expect(total).toBe(SURVIVOR_RUN_GOAL_TIME);
    // Boundary behaviour: the first second of each chapter maps to its index.
    for (let i = 0; i < SURVIVOR_RUN_CHAPTERS.length; i++) {
      expect(survivorChapterAt(survivorChapterStart(i)), `chapter ${i}`).toBe(i);
    }
    expect(survivorChapterAt(0)).toBe(0);
    expect(survivorChapterAt(SURVIVOR_RUN_GOAL_TIME)).toBe(SURVIVOR_RUN_CHAPTERS.length - 1);
  });
});
