import { describe, expect, it } from "vitest";
import { STAGE_CLEAR_HEAL, STAGE_DIFFICULTY_STEP } from "../../src/game/constants";
import {
  campaignSequence,
  DEFAULT_JOURNEY,
  DEFAULT_JOURNEY_MAP_IDS,
  JOURNEYS,
  journeyStageSequence,
  MAP_PICKER,
} from "../../src/game/data/maps";
import { createMissionRun } from "../../src/game/data/missions";

describe("structured-run journey data (#84)", () => {
  it("authors the canonical descent as a named escalating journey", () => {
    expect(Object.keys(JOURNEYS)).toEqual(["perdition-descent"]);
    expect(DEFAULT_JOURNEY).toMatchObject({
      id: "perdition-descent",
      name: "The Perdition Descent",
    });
    expect(DEFAULT_JOURNEY_MAP_IDS).toEqual(["ashgate", "hollowlanes", "maw", "perdition"]);
    expect(DEFAULT_JOURNEY.stages.map((stage) => stage.difficultyMultiplier)).toEqual([
      1,
      1 + STAGE_DIFFICULTY_STEP,
      1 + STAGE_DIFFICULTY_STEP * 2,
      1 + STAGE_DIFFICULTY_STEP * 3,
    ]);
    expect(DEFAULT_JOURNEY.stages.map((stage) => stage.healOnEnter)).toEqual([
      0,
      STAGE_CLEAR_HEAL,
      STAGE_CLEAR_HEAL,
      STAGE_CLEAR_HEAL,
    ]);
    expect(campaignSequence("ashgate").map((map) => map.biomeId)).toEqual(["foundry", "bone", "rot", "perdition"]);
  });

  it("slices from an authored start without wrapping back toward the surface", () => {
    const stages = journeyStageSequence("maw");

    expect(stages.map((stage) => stage.mapId)).toEqual(["maw", "perdition"]);
    expect(campaignSequence("maw").map((map) => map.id)).toEqual(["maw", "perdition"]);
    expect(journeyStageSequence("unknown")).toBe(DEFAULT_JOURNEY.stages);
  });

  it("drives mission metadata and picker order from the same journey", () => {
    const run = createMissionRun("hollowlanes");

    expect(run.journeyId).toBe(DEFAULT_JOURNEY.id);
    expect(run.stages.map((stage) => stage.mapId)).toEqual(["hollowlanes", "maw", "perdition"]);
    expect(run.stages.map((stage) => stage.difficultyMultiplier)).toEqual(
      DEFAULT_JOURNEY.stages.slice(1).map((stage) => stage.difficultyMultiplier),
    );
    expect(MAP_PICKER.slice(0, DEFAULT_JOURNEY_MAP_IDS.length).map((map) => map.id)).toEqual(DEFAULT_JOURNEY_MAP_IDS);
  });
});
