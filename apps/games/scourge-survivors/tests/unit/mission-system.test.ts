import { describe, expect, it } from "vitest";
import { PLAYER_MAX_HEALTH, STAGE_CLEAR_HEAL, STAGE_DIFFICULTY_STEP } from "../../src/game/constants";
import type { GameContext } from "../../src/game/context";
import { type ArenaMap, getMap } from "../../src/game/data/maps";
import {
  advanceMissionAfterBoss,
  createIdleMissionState,
  createMissionRun,
  currentMissionCheckpoint,
  currentMissionEncounter,
  currentMissionObjective,
  currentMissionStage,
  missionEncounterById,
  missionObjectiveById,
  missionSegmentById,
  missionStageReferenceErrors,
} from "../../src/game/data/missions";
import { MissionSystem } from "../../src/game/modes/MissionSystem";
import type { GameSystems } from "../../src/game/systems";

function missionHarness() {
  const calls: string[] = [];
  const ctx = {
    campaign: false,
    sandbox: true,
    survivors: true,
    mission: createIdleMissionState(),
    campaignMaps: [] as ArenaMap[],
    campaignStage: 99,
    status: "gameover",
    health: 62,
    maxHealthValue: PLAYER_MAX_HEALTH,
    currentMap: getMap("ashgate"),
  };
  const sys = {
    multiplayer: { leaveMultiplayer: (toMenu: boolean) => calls.push(`multiplayer:leave:${toMenu}`) },
    survivors: {
      recomputeStats: () => calls.push("survivors:recompute"),
      clearSurvivorsEntities: () => calls.push("survivors:clear"),
      initSurvivorsRun: () => {
        throw new Error("campaign start must not initialize Survivors progression");
      },
    },
    arena: {
      buildArena: (map: ArenaMap) => {
        ctx.currentMap = map;
        calls.push(`arena:build:${map.id}`);
      },
      placeAtSpawn: () => calls.push("arena:spawn"),
    },
    player: { resetPlayer: () => calls.push("player:reset") },
    fx: { clearTransientFx: () => calls.push("fx:clear") },
    pve: { startWaveSystem: () => calls.push("pve:start") },
    hud: {
      emit: () => calls.push("hud:emit"),
      announce: (text: string) => calls.push(`hud:announce:${text}`),
    },
    input: { requestLock: () => calls.push("input:lock") },
    gameOver: { gameOver: (outcome: "win" | "dead") => calls.push(`gameover:${outcome}`) },
  };

  return {
    calls,
    ctx,
    system: new MissionSystem(ctx as unknown as GameContext, sys as unknown as GameSystems),
  };
}

describe("mission campaign architecture", () => {
  it("builds an authored mission run with objective, checkpoint, and encounter state", () => {
    const run = createMissionRun("maw");

    expect(run).toMatchObject({
      missionId: "ashgate-breach",
      missionTitle: "Ashgate Breach",
      journeyId: "perdition-descent",
      journeyName: "The Perdition Descent",
      phase: "active",
      stageIndex: 0,
      extractionReady: false,
      completed: false,
    });
    expect(run.stages.map((stage) => stage.mapId)).toEqual(["maw", "perdition"]);
    expect(run.stages.map((stage) => stage.difficultyMultiplier)).toEqual([
      1 + STAGE_DIFFICULTY_STEP * 2,
      1 + STAGE_DIFFICULTY_STEP * 3,
    ]);
    expect(run.stages.map((stage) => stage.healOnEnter)).toEqual([STAGE_CLEAR_HEAL, STAGE_CLEAR_HEAL]);
    expect(currentMissionStage(run)?.mapName).toBe("The Maw");
    expect(currentMissionObjective(run)).toMatchObject({
      kind: "sever-repeater",
      label: "Sever the local Choir relay inside The Maw",
      completion: "boss-defeated",
    });
    expect(currentMissionCheckpoint(run)).toMatchObject({ name: "The Maw breachhead", spawn: { x: 0, z: -32 } });
    expect(currentMissionEncounter(run)).toMatchObject({
      name: "The Maw Choir guard",
      hasBoss: true,
      choirOutcome: "sever-local-node",
    });
  });

  it("authors Ashgate as a branching mission graph", () => {
    const stage = createMissionRun("ashgate").stages[0];

    expect(stage.checkpoint.spawn).toEqual({ x: -26, z: 28 });
    expect(stage).toMatchObject({
      entrySegmentId: "ashgate-drop-yard",
      initialObjectiveId: "ashgate-secure-breachhead",
      initialEncounterId: "ashgate-entry-skirmish",
    });
    expect(stage.segments.map((segment) => segment.id)).toEqual([
      "ashgate-drop-yard",
      "ashgate-furnace-approach",
      "ashgate-foundry-floor",
      "ashgate-service-bypass",
      "ashgate-biomass-vault",
      "ashgate-source-chamber",
      "ashgate-extraction",
    ]);
    expect(missionSegmentById(stage, "ashgate-furnace-approach")?.next).toEqual([
      { segmentId: "ashgate-foundry-floor", gateId: "ashgate-foundry-route" },
      { segmentId: "ashgate-service-bypass", gateId: "ashgate-bypass-route" },
    ]);
    expect(stage.encounters.map((encounter) => encounter.pattern)).toEqual([
      "entry-skirmish",
      "corridor-ambush",
      "holdout",
      "elite-reveal",
      "boss-finale",
    ]);
    expect(missionEncounterById(stage, "ashgate-choir-guard")).toMatchObject({
      pattern: "boss-finale",
      hasBoss: true,
      setPiece: {
        kind: "breach-host-boss",
        enemy: "breach-boss",
      },
    });
    expect(missionObjectiveById(stage, "ashgate-destroy-biomass")).toMatchObject({
      completion: "interacted",
      completionTargetId: "ashgate-burn-biomass-trigger",
      nextObjectiveIds: ["ashgate-sever-repeater"],
    });
    expect(stage.setPieces.map((setPiece) => setPiece.kind)).toEqual([
      "biomass-organ",
      "choir-repeater",
      "breach-host-boss",
    ]);
    expect(new Set(stage.pickups.map((pickup) => pickup.kind))).toEqual(new Set(["ammo", "health"]));
  });

  it("keeps authored mission references internally consistent", () => {
    const run = createMissionRun("ashgate");

    expect(run.stages.map(missionStageReferenceErrors)).toEqual(run.stages.map(() => []));
  });

  it("advances stages independently from the Survivors economy", () => {
    const run = createMissionRun("ashgate");
    const next = advanceMissionAfterBoss(run);
    const done = run.stages.reduce((state) => advanceMissionAfterBoss(state), run);

    expect(next.stageIndex).toBe(1);
    expect(currentMissionStage(next)?.mapId).toBe("hollowlanes");
    expect(next.extractionReady).toBe(false);
    expect(JSON.stringify(next).toLowerCase()).not.toMatch(/\b(xp|draft|shop|gold)\b/);

    expect(done.phase).toBe("complete");
    expect(done.completed).toBe(true);
    expect(done.extractionReady).toBe(true);
    expect(currentMissionObjective(done)).toMatchObject({ kind: "extract", completion: "mission-complete" });
    expect(currentMissionEncounter(done)).toBeNull();
  });

  it("owns campaign start and completion without initializing Survivors progression", () => {
    const { calls, ctx, system } = missionHarness();

    system.startCampaign("maw");

    expect(ctx.campaign).toBe(true);
    expect(ctx.sandbox).toBe(false);
    expect(ctx.survivors).toBe(false);
    expect(ctx.status).toBe("pointerlock-needed");
    expect(ctx.campaignStage).toBe(0);
    expect(ctx.campaignMaps.map((map) => map.id)).toEqual(["maw", "perdition"]);
    expect(currentMissionObjective(ctx.mission)?.label).toBe("Sever the local Choir relay inside The Maw");
    expect(calls).toEqual(
      expect.arrayContaining([
        "multiplayer:leave:false",
        "survivors:recompute",
        "arena:build:maw",
        "player:reset",
        "survivors:clear",
        "pve:start",
        "input:lock",
      ]),
    );

    calls.length = 0;
    ctx.health = 88;
    system.onBossDefeated();

    expect(ctx.campaignStage).toBe(1);
    expect(ctx.currentMap.id).toBe("perdition");
    expect(ctx.health).toBe(PLAYER_MAX_HEALTH);
    expect(calls).toEqual(expect.arrayContaining(["arena:build:perdition", "arena:spawn", "pve:start"]));

    calls.length = 0;
    system.onBossDefeated();

    expect(ctx.mission.completed).toBe(true);
    expect(ctx.mission.extractionReady).toBe(true);
    expect(calls).toContain("gameover:win");
  });
});
