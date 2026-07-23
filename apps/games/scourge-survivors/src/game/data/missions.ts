import type { EnemyArchetypeId } from "./enemies";
import {
  type ArenaMap,
  campaignSequence,
  DEFAULT_JOURNEY,
  DEFAULT_JOURNEY_ID,
  JOURNEYS,
  type JourneyId,
  type JourneyStageDefinition,
  journeyStageSequence,
} from "./maps";

export type MissionPhase = "idle" | "active" | "complete";

export type MissionObjectiveKind =
  | "secure-breachhead"
  | "clear-ambush"
  | "destroy-biomass"
  | "sever-repeater"
  | "extract";
export type MissionObjectiveCompletion =
  | "trigger-entered"
  | "encounter-cleared"
  | "interacted"
  | "boss-defeated"
  | "mission-complete";
export type MissionEncounterPattern = "entry-skirmish" | "corridor-ambush" | "holdout" | "elite-reveal" | "boss-finale";
export type MissionPickupKind = "health" | "ammo" | "damage" | "dual";
export type MissionSpawnArchetype = EnemyArchetypeId | "breach-boss";

export interface MissionPoint {
  x: number;
  z: number;
}

export interface MissionVolume {
  center: MissionPoint;
  size: MissionPoint;
}

export interface MissionTrigger {
  id: string;
  mapId: string;
  kind: "enter-volume" | "interact" | "encounter-cleared";
  volume?: MissionVolume;
  targetId?: string;
}

export interface MissionGate {
  id: string;
  mapId: string;
  fromSegmentId: string;
  toSegmentId: string;
  mode: "locked" | "one-way";
  unlock: {
    kind: "trigger" | "objective" | "encounter";
    targetId: string;
  };
}

export interface MissionSegmentTransition {
  segmentId: string;
  gateId?: string;
}

export interface MissionSegment {
  id: string;
  mapId: string;
  name: string;
  kind: "entry" | "traversal" | "combat" | "objective" | "finale" | "extraction";
  volume: MissionVolume;
  entryTriggerId: string;
  encounterIds: string[];
  objectiveIds: string[];
  pickupIds: string[];
  next: MissionSegmentTransition[];
}

export interface MissionSpawnGroup {
  id: string;
  archetype: MissionSpawnArchetype;
  count: number;
  origin: MissionPoint;
  radius: number;
}

export interface MissionSetPiece {
  id: string;
  mapId: string;
  kind: "biomass-organ" | "choir-repeater" | "breach-host-boss";
  position: MissionPoint;
  enemy?: Extract<MissionSpawnArchetype, "breach-boss">;
}

export interface MissionPickupPlacement {
  id: string;
  mapId: string;
  segmentId: string;
  kind: MissionPickupKind;
  position: MissionPoint;
  respawn: "never";
}

export interface MissionCheckpoint {
  id: string;
  mapId: string;
  name: string;
  spawn: MissionPoint;
}

export interface MissionEncounter {
  id: string;
  mapId: string;
  name: string;
  pattern: MissionEncounterPattern;
  triggerId: string;
  spawnGroups: MissionSpawnGroup[];
  gateIds: string[];
  waveBudget: number;
  hasBoss: boolean;
  choirOutcome?: "sever-local-node";
  setPiece?: MissionSetPiece;
}

export interface MissionObjective {
  id: string;
  mapId: string;
  kind: MissionObjectiveKind;
  label: string;
  completion: MissionObjectiveCompletion;
  completionTargetId?: string;
  nextObjectiveIds: string[];
}

export interface MissionStageState {
  index: number;
  mapId: string;
  mapName: string;
  difficultyMultiplier: number;
  healOnEnter: number;
  checkpoint: MissionCheckpoint;
  entrySegmentId: string;
  initialObjectiveId: string;
  initialEncounterId: string;
  encounter: MissionEncounter;
  objective: MissionObjective;
  extractionObjective: MissionObjective;
  segments: MissionSegment[];
  triggers: MissionTrigger[];
  gates: MissionGate[];
  encounters: MissionEncounter[];
  objectives: MissionObjective[];
  pickups: MissionPickupPlacement[];
  setPieces: MissionSetPiece[];
}

export interface MissionRunState {
  missionId: string | null;
  missionTitle: string;
  journeyId: JourneyId | null;
  journeyName: string;
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
    journeyId: null,
    journeyName: "",
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

export function createMissionRun(
  startMapId: string = DEFAULT_JOURNEY.stages[0].mapId,
  journeyId: JourneyId = DEFAULT_JOURNEY_ID,
): MissionRunState {
  const journey = JOURNEYS[journeyId];
  const maps = campaignSequence(startMapId, journeyId);
  const definitions = journeyStageSequence(startMapId, journeyId);
  const stages = maps.map((map, index) => createMissionStage(map, definitions[index], index, maps.length));
  const first = stages[0];

  return {
    missionId: ASHGATE_BREACH_MISSION_ID,
    missionTitle: ASHGATE_BREACH_MISSION_TITLE,
    journeyId,
    journeyName: journey.name,
    startMapId: first.mapId,
    phase: "active",
    stageIndex: 0,
    objectiveId: first.initialObjectiveId,
    checkpointId: first.checkpoint.id,
    encounterId: first.initialEncounterId,
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
  return stage.objectives.find((objective) => objective.id === run.objectiveId) ?? null;
}

export function currentMissionCheckpoint(run: MissionRunState): MissionCheckpoint | null {
  const stage = currentMissionStage(run);
  if (!stage || !run.checkpointId) return null;
  return stage.checkpoint.id === run.checkpointId ? stage.checkpoint : null;
}

export function currentMissionEncounter(run: MissionRunState): MissionEncounter | null {
  const stage = currentMissionStage(run);
  if (!stage || !run.encounterId) return null;
  return stage.encounters.find((encounter) => encounter.id === run.encounterId) ?? null;
}

export function missionSegmentById(stage: MissionStageState, segmentId: string): MissionSegment | null {
  return stage.segments.find((segment) => segment.id === segmentId) ?? null;
}

export function missionEncounterById(stage: MissionStageState, encounterId: string): MissionEncounter | null {
  return stage.encounters.find((encounter) => encounter.id === encounterId) ?? null;
}

export function missionObjectiveById(stage: MissionStageState, objectiveId: string): MissionObjective | null {
  return stage.objectives.find((objective) => objective.id === objectiveId) ?? null;
}

/**
 * Structural validation for authored mission content. Runtime systems can rely
 * on these references instead of carrying mission-specific conditionals.
 */
export function missionStageReferenceErrors(stage: MissionStageState): string[] {
  const errors: string[] = [];
  const segmentIds = idSet(stage.segments);
  const triggerIds = idSet(stage.triggers);
  const gateIds = idSet(stage.gates);
  const encounterIds = idSet(stage.encounters);
  const objectiveIds = idSet(stage.objectives);
  const pickupIds = idSet(stage.pickups);
  const setPieceIds = idSet(stage.setPieces);

  requireRef(errors, segmentIds, stage.entrySegmentId, "entrySegmentId");
  requireRef(errors, objectiveIds, stage.initialObjectiveId, "initialObjectiveId");
  requireRef(errors, encounterIds, stage.initialEncounterId, "initialEncounterId");

  for (const segment of stage.segments) {
    requireRef(errors, triggerIds, segment.entryTriggerId, `${segment.id}.entryTriggerId`);
    for (const id of segment.encounterIds) requireRef(errors, encounterIds, id, `${segment.id}.encounterIds`);
    for (const id of segment.objectiveIds) requireRef(errors, objectiveIds, id, `${segment.id}.objectiveIds`);
    for (const id of segment.pickupIds) requireRef(errors, pickupIds, id, `${segment.id}.pickupIds`);
    for (const transition of segment.next) {
      requireRef(errors, segmentIds, transition.segmentId, `${segment.id}.next.segmentId`);
      if (transition.gateId) requireRef(errors, gateIds, transition.gateId, `${segment.id}.next.gateId`);
    }
  }

  for (const gate of stage.gates) {
    requireRef(errors, segmentIds, gate.fromSegmentId, `${gate.id}.fromSegmentId`);
    requireRef(errors, segmentIds, gate.toSegmentId, `${gate.id}.toSegmentId`);
    const targets =
      gate.unlock.kind === "trigger" ? triggerIds : gate.unlock.kind === "objective" ? objectiveIds : encounterIds;
    requireRef(errors, targets, gate.unlock.targetId, `${gate.id}.unlock.targetId`);
  }

  for (const trigger of stage.triggers) {
    if (trigger.kind === "encounter-cleared" && trigger.targetId) {
      requireRef(errors, encounterIds, trigger.targetId, `${trigger.id}.targetId`);
    }
    if (trigger.kind === "interact" && trigger.targetId) {
      requireRef(errors, setPieceIds, trigger.targetId, `${trigger.id}.targetId`);
    }
  }

  for (const encounter of stage.encounters) {
    requireRef(errors, triggerIds, encounter.triggerId, `${encounter.id}.triggerId`);
    for (const id of encounter.gateIds) requireRef(errors, gateIds, id, `${encounter.id}.gateIds`);
  }

  for (const objective of stage.objectives) {
    if (objective.completionTargetId) {
      const targets =
        objective.completion === "encounter-cleared" || objective.completion === "boss-defeated"
          ? encounterIds
          : triggerIds;
      requireRef(errors, targets, objective.completionTargetId, `${objective.id}.completionTargetId`);
    }
    for (const id of objective.nextObjectiveIds) {
      requireRef(errors, objectiveIds, id, `${objective.id}.nextObjectiveIds`);
    }
  }

  for (const pickup of stage.pickups) {
    requireRef(errors, segmentIds, pickup.segmentId, `${pickup.id}.segmentId`);
  }

  return errors;
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
      objectiveId: next.initialObjectiveId,
      checkpointId: next.checkpoint.id,
      encounterId: next.initialEncounterId,
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

function createMissionStage(
  map: ArenaMap,
  definition: JourneyStageDefinition,
  index: number,
  totalStages: number,
): MissionStageState {
  const stageNumber = index + 1;
  const checkpoint: MissionCheckpoint = {
    id: `${map.id}-breachhead`,
    mapId: map.id,
    name: `${map.name} breachhead`,
    spawn: { ...map.spawn },
  };
  const encounter: MissionEncounter = {
    id: `${map.id}-choir-guard`,
    mapId: map.id,
    name: `${map.name} Choir guard`,
    pattern: "boss-finale",
    triggerId: `${map.id}-enter-source-chamber`,
    spawnGroups: [
      spawnGroup(`${map.id}-boss`, "breach-boss", 1, { x: 0, z: 4 }, 0),
      spawnGroup(`${map.id}-boss-screen`, "flier", Math.min(4, stageNumber + 1), { x: 0, z: 10 }, 14),
    ],
    gateIds: [`${map.id}-open-extraction`],
    waveBudget: stageNumber,
    hasBoss: true,
    choirOutcome: "sever-local-node",
    setPiece: {
      id: `${map.id}-breach-host`,
      mapId: map.id,
      kind: "breach-host-boss",
      position: { x: 0, z: 4 },
      enemy: "breach-boss",
    },
  };
  const objective: MissionObjective = {
    id: `${map.id}-sever-repeater`,
    mapId: map.id,
    kind: "sever-repeater",
    label: `Sever the local Choir relay inside ${map.name}`,
    completion: "boss-defeated",
    completionTargetId: encounter.id,
    nextObjectiveIds: [`${map.id}-extract`],
  };
  const extractionObjective: MissionObjective = {
    id: `${map.id}-extract`,
    mapId: map.id,
    kind: "extract",
    label: index === totalStages - 1 ? "Extract after the source burn" : "Push to the next breach chamber",
    completion: "mission-complete",
    nextObjectiveIds: [],
  };
  const content =
    map.id === "ashgate"
      ? createAshgateBreachContent(encounter, objective, extractionObjective)
      : createArenaStageContent(map, encounter, objective, extractionObjective);

  return {
    index,
    mapId: map.id,
    mapName: map.name,
    difficultyMultiplier: definition.difficultyMultiplier,
    healOnEnter: definition.healOnEnter,
    checkpoint,
    encounter,
    objective,
    extractionObjective,
    ...content,
  };
}

interface MissionStageContent {
  entrySegmentId: string;
  initialObjectiveId: string;
  initialEncounterId: string;
  segments: MissionSegment[];
  triggers: MissionTrigger[];
  gates: MissionGate[];
  encounters: MissionEncounter[];
  objectives: MissionObjective[];
  pickups: MissionPickupPlacement[];
  setPieces: MissionSetPiece[];
}

function createArenaStageContent(
  map: ArenaMap,
  encounter: MissionEncounter,
  objective: MissionObjective,
  extractionObjective: MissionObjective,
): MissionStageContent {
  const combatSegmentId = `${map.id}-source-chamber`;
  const extractionSegmentId = `${map.id}-extraction`;
  const extractionGateId = `${map.id}-open-extraction`;
  const enterTriggerId = `${map.id}-enter-source-chamber`;
  const extractionTriggerId = `${map.id}-enter-extraction`;
  const pickups: MissionPickupPlacement[] = [
    pickup(`${map.id}-pre-finale-ammo`, map.id, combatSegmentId, "ammo", {
      x: map.spawn.x + 3,
      z: map.spawn.z,
    }),
    pickup(`${map.id}-pre-finale-health`, map.id, combatSegmentId, "health", {
      x: map.spawn.x - 3,
      z: map.spawn.z,
    }),
  ];

  return {
    entrySegmentId: combatSegmentId,
    initialObjectiveId: objective.id,
    initialEncounterId: encounter.id,
    segments: [
      segment({
        id: combatSegmentId,
        mapId: map.id,
        name: `${map.name} source chamber`,
        kind: "finale",
        volume: volume(0, 0, 72, 72),
        entryTriggerId: enterTriggerId,
        encounterIds: [encounter.id],
        objectiveIds: [objective.id],
        pickupIds: pickups.map((item) => item.id),
        next: [{ segmentId: extractionSegmentId, gateId: extractionGateId }],
      }),
      segment({
        id: extractionSegmentId,
        mapId: map.id,
        name: `${map.name} extraction`,
        kind: "extraction",
        volume: volume(0, 32, 18, 12),
        entryTriggerId: extractionTriggerId,
        objectiveIds: [extractionObjective.id],
      }),
    ],
    triggers: [
      enterVolume(enterTriggerId, map.id, volume(0, 0, 72, 72)),
      enterVolume(extractionTriggerId, map.id, volume(0, 32, 18, 12)),
    ],
    gates: [gate(extractionGateId, map.id, combatSegmentId, extractionSegmentId, "locked", "encounter", encounter.id)],
    encounters: [encounter],
    objectives: [objective, extractionObjective],
    pickups,
    setPieces: encounter.setPiece ? [encounter.setPiece] : [],
  };
}

function createAshgateBreachContent(
  finale: MissionEncounter,
  finaleObjective: MissionObjective,
  extractionObjective: MissionObjective,
): MissionStageContent {
  const mapId = "ashgate";
  const triggers: MissionTrigger[] = [
    enterVolume("ashgate-enter-drop-yard", mapId, volume(-25, 24, 24, 20)),
    enterVolume("ashgate-enter-furnace-approach", mapId, volume(-12, 8, 20, 18)),
    enterVolume("ashgate-enter-foundry-floor", mapId, volume(9, 8, 20, 20)),
    enterVolume("ashgate-enter-service-bypass", mapId, volume(-25, -7, 16, 24)),
    enterVolume("ashgate-enter-biomass-vault", mapId, volume(8, -12, 22, 18)),
    {
      id: "ashgate-burn-biomass-trigger",
      mapId,
      kind: "interact",
      volume: volume(10, -15, 5, 5),
      targetId: "ashgate-biomass-organ",
    },
    enterVolume("ashgate-enter-source-chamber", mapId, volume(0, -27, 26, 16)),
    enterVolume("ashgate-enter-extraction", mapId, volume(27, -28, 12, 12)),
  ];
  const entry = encounter({
    id: "ashgate-entry-skirmish",
    mapId,
    name: "Drop-yard skirmish",
    pattern: "entry-skirmish",
    triggerId: "ashgate-enter-drop-yard",
    spawnGroups: [
      spawnGroup("ashgate-entry-rippers", "grunt", 5, { x: -10, z: 16 }, 7),
      spawnGroup("ashgate-entry-spitter", "shooter", 1, { x: 2, z: 10 }, 2),
    ],
    gateIds: ["ashgate-yard-bulkhead"],
    waveBudget: 1,
  });
  const ambush = encounter({
    id: "ashgate-corridor-ambush",
    mapId,
    name: "Infected corridor ambush",
    pattern: "corridor-ambush",
    triggerId: "ashgate-enter-furnace-approach",
    spawnGroups: [
      spawnGroup("ashgate-ambush-hounds", "hound", 3, { x: -4, z: -1 }, 5),
      spawnGroup("ashgate-ambush-spitters", "shooter", 2, { x: 5, z: -2 }, 5),
    ],
    gateIds: ["ashgate-foundry-route", "ashgate-bypass-route"],
    waveBudget: 2,
  });
  const holdout = encounter({
    id: "ashgate-foundry-holdout",
    mapId,
    name: "Foundry-floor holdout",
    pattern: "holdout",
    triggerId: "ashgate-enter-foundry-floor",
    spawnGroups: [
      spawnGroup("ashgate-holdout-rippers", "grunt", 8, { x: 18, z: 1 }, 9),
      spawnGroup("ashgate-holdout-charger", "charger", 1, { x: 22, z: -8 }, 3),
    ],
    gateIds: ["ashgate-foundry-to-vault"],
    waveBudget: 3,
  });
  const elite = encounter({
    id: "ashgate-bypass-elite",
    mapId,
    name: "Service-bypass elite reveal",
    pattern: "elite-reveal",
    triggerId: "ashgate-enter-service-bypass",
    spawnGroups: [
      spawnGroup("ashgate-bypass-hulk", "tank", 1, { x: -22, z: -16 }, 3),
      spawnGroup("ashgate-bypass-screen", "shooter", 2, { x: -12, z: -18 }, 5),
    ],
    gateIds: ["ashgate-bypass-to-vault"],
    waveBudget: 3,
  });
  const pickups: MissionPickupPlacement[] = [
    pickup("ashgate-yard-ammo", mapId, "ashgate-drop-yard", "ammo", { x: -20, z: 20 }),
    pickup("ashgate-foundry-health", mapId, "ashgate-foundry-floor", "health", { x: 18, z: 12 }),
    pickup("ashgate-bypass-ammo", mapId, "ashgate-service-bypass", "ammo", { x: -24, z: -11 }),
    pickup("ashgate-vault-health", mapId, "ashgate-biomass-vault", "health", { x: 7, z: -18 }),
    pickup("ashgate-finale-ammo", mapId, "ashgate-source-chamber", "ammo", { x: -9, z: -24 }),
  ];
  const objectives: MissionObjective[] = [
    {
      id: "ashgate-secure-breachhead",
      mapId,
      kind: "secure-breachhead",
      label: "Secure the Ashgate drop yard",
      completion: "encounter-cleared",
      completionTargetId: entry.id,
      nextObjectiveIds: ["ashgate-clear-corridor"],
    },
    {
      id: "ashgate-clear-corridor",
      mapId,
      kind: "clear-ambush",
      label: "Break the infected corridor ambush",
      completion: "encounter-cleared",
      completionTargetId: ambush.id,
      nextObjectiveIds: ["ashgate-destroy-biomass"],
    },
    {
      id: "ashgate-destroy-biomass",
      mapId,
      kind: "destroy-biomass",
      label: "Burn the biomass feeding the local relay",
      completion: "interacted",
      completionTargetId: "ashgate-burn-biomass-trigger",
      nextObjectiveIds: [finaleObjective.id],
    },
    finaleObjective,
    extractionObjective,
  ];
  const setPieces: MissionSetPiece[] = [
    {
      id: "ashgate-biomass-organ",
      mapId,
      kind: "biomass-organ",
      position: { x: 10, z: -15 },
    },
    {
      id: "ashgate-choir-repeater",
      mapId,
      kind: "choir-repeater",
      position: { x: 0, z: -30 },
    },
    ...(finale.setPiece ? [finale.setPiece] : []),
  ];
  const gates: MissionGate[] = [
    gate(
      "ashgate-yard-bulkhead",
      mapId,
      "ashgate-drop-yard",
      "ashgate-furnace-approach",
      "locked",
      "encounter",
      entry.id,
    ),
    gate(
      "ashgate-foundry-route",
      mapId,
      "ashgate-furnace-approach",
      "ashgate-foundry-floor",
      "one-way",
      "encounter",
      ambush.id,
    ),
    gate(
      "ashgate-bypass-route",
      mapId,
      "ashgate-furnace-approach",
      "ashgate-service-bypass",
      "one-way",
      "encounter",
      ambush.id,
    ),
    gate(
      "ashgate-foundry-to-vault",
      mapId,
      "ashgate-foundry-floor",
      "ashgate-biomass-vault",
      "locked",
      "encounter",
      holdout.id,
    ),
    gate(
      "ashgate-bypass-to-vault",
      mapId,
      "ashgate-service-bypass",
      "ashgate-biomass-vault",
      "locked",
      "encounter",
      elite.id,
    ),
    gate(
      "ashgate-vault-to-source",
      mapId,
      "ashgate-biomass-vault",
      "ashgate-source-chamber",
      "locked",
      "objective",
      "ashgate-destroy-biomass",
    ),
    gate(
      "ashgate-open-extraction",
      mapId,
      "ashgate-source-chamber",
      "ashgate-extraction",
      "locked",
      "encounter",
      finale.id,
    ),
  ];
  const segments: MissionSegment[] = [
    segment({
      id: "ashgate-drop-yard",
      mapId,
      name: "Drop Yard",
      kind: "entry",
      volume: volume(-25, 24, 24, 20),
      entryTriggerId: "ashgate-enter-drop-yard",
      encounterIds: [entry.id],
      objectiveIds: ["ashgate-secure-breachhead"],
      pickupIds: ["ashgate-yard-ammo"],
      next: [{ segmentId: "ashgate-furnace-approach", gateId: "ashgate-yard-bulkhead" }],
    }),
    segment({
      id: "ashgate-furnace-approach",
      mapId,
      name: "Infected Furnace Approach",
      kind: "traversal",
      volume: volume(-12, 8, 20, 18),
      entryTriggerId: "ashgate-enter-furnace-approach",
      encounterIds: [ambush.id],
      objectiveIds: ["ashgate-clear-corridor"],
      next: [
        { segmentId: "ashgate-foundry-floor", gateId: "ashgate-foundry-route" },
        { segmentId: "ashgate-service-bypass", gateId: "ashgate-bypass-route" },
      ],
    }),
    segment({
      id: "ashgate-foundry-floor",
      mapId,
      name: "Foundry Floor",
      kind: "combat",
      volume: volume(9, 8, 20, 20),
      entryTriggerId: "ashgate-enter-foundry-floor",
      encounterIds: [holdout.id],
      pickupIds: ["ashgate-foundry-health"],
      next: [{ segmentId: "ashgate-biomass-vault", gateId: "ashgate-foundry-to-vault" }],
    }),
    segment({
      id: "ashgate-service-bypass",
      mapId,
      name: "Service Bypass",
      kind: "combat",
      volume: volume(-25, -7, 16, 24),
      entryTriggerId: "ashgate-enter-service-bypass",
      encounterIds: [elite.id],
      pickupIds: ["ashgate-bypass-ammo"],
      next: [{ segmentId: "ashgate-biomass-vault", gateId: "ashgate-bypass-to-vault" }],
    }),
    segment({
      id: "ashgate-biomass-vault",
      mapId,
      name: "Biomass Vault",
      kind: "objective",
      volume: volume(8, -12, 22, 18),
      entryTriggerId: "ashgate-enter-biomass-vault",
      objectiveIds: ["ashgate-destroy-biomass"],
      pickupIds: ["ashgate-vault-health"],
      next: [{ segmentId: "ashgate-source-chamber", gateId: "ashgate-vault-to-source" }],
    }),
    segment({
      id: "ashgate-source-chamber",
      mapId,
      name: "Relay Source Chamber",
      kind: "finale",
      volume: volume(0, -27, 26, 16),
      entryTriggerId: "ashgate-enter-source-chamber",
      encounterIds: [finale.id],
      objectiveIds: [finaleObjective.id],
      pickupIds: ["ashgate-finale-ammo"],
      next: [{ segmentId: "ashgate-extraction", gateId: "ashgate-open-extraction" }],
    }),
    segment({
      id: "ashgate-extraction",
      mapId,
      name: "Ashgate Extraction",
      kind: "extraction",
      volume: volume(27, -28, 12, 12),
      entryTriggerId: "ashgate-enter-extraction",
      objectiveIds: [extractionObjective.id],
    }),
  ];

  return {
    entrySegmentId: "ashgate-drop-yard",
    initialObjectiveId: "ashgate-secure-breachhead",
    initialEncounterId: entry.id,
    segments,
    triggers,
    gates,
    encounters: [entry, ambush, holdout, elite, finale],
    objectives,
    pickups,
    setPieces,
  };
}

function volume(x: number, z: number, width: number, depth: number): MissionVolume {
  return {
    center: { x, z },
    size: { x: width, z: depth },
  };
}

function enterVolume(id: string, mapId: string, target: MissionVolume): MissionTrigger {
  return { id, mapId, kind: "enter-volume", volume: target };
}

function gate(
  id: string,
  mapId: string,
  fromSegmentId: string,
  toSegmentId: string,
  mode: MissionGate["mode"],
  unlockKind: MissionGate["unlock"]["kind"],
  targetId: string,
): MissionGate {
  return {
    id,
    mapId,
    fromSegmentId,
    toSegmentId,
    mode,
    unlock: { kind: unlockKind, targetId },
  };
}

function segment(
  value: Omit<MissionSegment, "encounterIds" | "objectiveIds" | "pickupIds" | "next"> &
    Partial<Pick<MissionSegment, "encounterIds" | "objectiveIds" | "pickupIds" | "next">>,
): MissionSegment {
  return {
    encounterIds: [],
    objectiveIds: [],
    pickupIds: [],
    next: [],
    ...value,
  };
}

function encounter(value: Omit<MissionEncounter, "hasBoss" | "choirOutcome" | "setPiece">): MissionEncounter {
  return {
    ...value,
    hasBoss: false,
  };
}

function spawnGroup(
  id: string,
  archetype: MissionSpawnArchetype,
  count: number,
  origin: MissionPoint,
  radius: number,
): MissionSpawnGroup {
  return { id, archetype, count, origin, radius };
}

function pickup(
  id: string,
  mapId: string,
  segmentId: string,
  kind: MissionPickupKind,
  position: MissionPoint,
): MissionPickupPlacement {
  return { id, mapId, segmentId, kind, position, respawn: "never" };
}

function idSet(values: { id: string }[]): Set<string> {
  return new Set(values.map((value) => value.id));
}

function requireRef(errors: string[], ids: Set<string>, id: string, path: string): void {
  if (!ids.has(id)) errors.push(`${path} references missing "${id}"`);
}
