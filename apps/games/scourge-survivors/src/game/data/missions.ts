import { type ArenaMap, CAMPAIGN_ORDER, campaignSequence } from "./maps";

export type MissionPhase = "idle" | "active" | "complete";

export type MissionObjectiveKind = "secure-breachhead" | "sever-repeater" | "extract";

export interface MissionCheckpoint {
  id: string;
  mapId: string;
  name: string;
  spawn: { x: number; z: number };
}

export interface MissionEncounter {
  id: string;
  mapId: string;
  name: string;
  waveBudget: number;
  hasBoss: boolean;
  choirOutcome: "sever-local-node";
}

export interface MissionObjective {
  id: string;
  mapId: string;
  kind: MissionObjectiveKind;
  label: string;
  completion: "boss-defeated" | "mission-complete";
}

export interface MissionStageState {
  index: number;
  mapId: string;
  mapName: string;
  checkpoint: MissionCheckpoint;
  encounter: MissionEncounter;
  objective: MissionObjective;
  extractionObjective: MissionObjective;
}

export interface MissionRunState {
  missionId: string | null;
  missionTitle: string;
  startMapId: string | null;
  phase: MissionPhase;
  stageIndex: number;
  objectiveId: string | null;
  checkpointId: string | null;
  encounterId: string | null;
  extractionReady: boolean;
  completed: boolean;
  stages: MissionStageState[];
}

const ASHGATE_BREACH_MISSION_ID = "ashgate-breach";
const ASHGATE_BREACH_MISSION_TITLE = "Ashgate Breach";

export function createIdleMissionState(): MissionRunState {
  return {
    missionId: null,
    missionTitle: "",
    startMapId: null,
    phase: "idle",
    stageIndex: 0,
    objectiveId: null,
    checkpointId: null,
    encounterId: null,
    extractionReady: false,
    completed: false,
    stages: [],
  };
}

export function createMissionRun(startMapId: string = CAMPAIGN_ORDER[0]): MissionRunState {
  const maps = campaignSequence(startMapId);
  const stages = maps.map((map, index) => createMissionStage(map, index, maps.length));
  const first = stages[0];

  return {
    missionId: ASHGATE_BREACH_MISSION_ID,
    missionTitle: ASHGATE_BREACH_MISSION_TITLE,
    startMapId: first.mapId,
    phase: "active",
    stageIndex: 0,
    objectiveId: first.objective.id,
    checkpointId: first.checkpoint.id,
    encounterId: first.encounter.id,
    extractionReady: false,
    completed: false,
    stages,
  };
}

export function currentMissionStage(run: MissionRunState): MissionStageState | null {
  return run.stages[run.stageIndex] ?? null;
}

export function currentMissionObjective(run: MissionRunState): MissionObjective | null {
  const stage = currentMissionStage(run);
  if (!stage || !run.objectiveId) return null;
  if (stage.objective.id === run.objectiveId) return stage.objective;
  if (stage.extractionObjective.id === run.objectiveId) return stage.extractionObjective;
  return null;
}

export function currentMissionCheckpoint(run: MissionRunState): MissionCheckpoint | null {
  const stage = currentMissionStage(run);
  if (!stage || !run.checkpointId) return null;
  return stage.checkpoint.id === run.checkpointId ? stage.checkpoint : null;
}

export function currentMissionEncounter(run: MissionRunState): MissionEncounter | null {
  const stage = currentMissionStage(run);
  if (!stage || !run.encounterId) return null;
  return stage.encounter.id === run.encounterId ? stage.encounter : null;
}

export function advanceMissionAfterBoss(run: MissionRunState): MissionRunState {
  if (!run.missionId || run.phase === "idle" || run.stages.length === 0) return run;

  const nextStageIndex = run.stageIndex + 1;
  if (nextStageIndex < run.stages.length) {
    const next = run.stages[nextStageIndex];
    return {
      ...run,
      phase: "active",
      stageIndex: nextStageIndex,
      objectiveId: next.objective.id,
      checkpointId: next.checkpoint.id,
      encounterId: next.encounter.id,
      extractionReady: false,
      completed: false,
    };
  }

  const finalStage = currentMissionStage(run);
  if (!finalStage) return run;
  return {
    ...run,
    phase: "complete",
    objectiveId: finalStage.extractionObjective.id,
    checkpointId: finalStage.checkpoint.id,
    encounterId: null,
    extractionReady: true,
    completed: true,
  };
}

function createMissionStage(map: ArenaMap, index: number, totalStages: number): MissionStageState {
  const stageNumber = index + 1;
  return {
    index,
    mapId: map.id,
    mapName: map.name,
    checkpoint: {
      id: `${map.id}-breachhead`,
      mapId: map.id,
      name: `${map.name} breachhead`,
      spawn: { ...map.spawn },
    },
    encounter: {
      id: `${map.id}-choir-guard`,
      mapId: map.id,
      name: `${map.name} Choir guard`,
      waveBudget: stageNumber,
      hasBoss: true,
      choirOutcome: "sever-local-node",
    },
    objective: {
      id: `${map.id}-sever-repeater`,
      mapId: map.id,
      kind: "sever-repeater",
      label: `Sever the local Choir relay inside ${map.name}`,
      completion: "boss-defeated",
    },
    extractionObjective: {
      id: `${map.id}-extract`,
      mapId: map.id,
      kind: "extract",
      label: index === totalStages - 1 ? "Extract after the source burn" : "Push to the next breach chamber",
      completion: "mission-complete",
    },
  };
}
