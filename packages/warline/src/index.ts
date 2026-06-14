/**
 * @shipshitgames/warline — pure core barrel (spec §9).
 *
 * Re-exports types, constants, map, operations, reducer, commands, summary.
 * Deliberately does NOT export ./client (browser-only, depends on partysocket)
 * so this entry stays dependency-free and safe to import on the edge server.
 */

// commands (spec §6)
export type { CommandResult } from "./commands";
export { applyCommand, canAfford } from "./commands";
// narrative events (spec §5 extension)
export type { NarrativeEventDef } from "./events";
export { applyNarrative, NARRATIVE, NARRATIVE_EVENTS, narrativeSeed, pickNarrativeEvent } from "./events";
// map (spec §3)
export {
  breachById,
  clamp,
  createInitialWorld,
  laneById,
  neighborsOf,
  regionById,
} from "./map";
// operations (spec §4)
export type { GameOperationMeta } from "./operations";
export { GAME_OPERATIONS, GAME_SLUGS, operationKindFor, WAR_RESOURCE, warResourceFor } from "./operations";
// palette
export { FACTION_COLOR } from "./palette";
// reducer (spec §5)
export type { ApplyResult } from "./reducer";
export {
  applyOperation,
  clampContribution,
  escalationFactor,
  magnitude,
  makeEventId,
  resetWorld,
  tick,
} from "./reducer";
// summary (spec §7)
export { summarize } from "./summary";
// types + constants (spec §1, §2)
export type {
  Breach,
  Command,
  CommandKind,
  Faction,
  GameSlug,
  HumanFaction,
  Lane,
  OperationBreakdown,
  OperationKind,
  OperationResult,
  Region,
  ResourceBag,
  ResourceKind,
  Summary,
  WarEvent,
  WorldState,
} from "./types";
export {
  COMMAND_COSTS,
  COMMAND_EFFECT,
  ECON,
  ESCALATION,
  FEED_MAX,
  MAX_CONTRIBUTION,
  RESOURCE_KINDS,
  SCHEMA_VERSION,
  TICK,
  TICK_MS,
  WAR_EFFORT,
} from "./types";
// war effort — collective damage progression (#280)
export type { WarEffortBonus } from "./warEffort";
export { NEUTRAL_WAR_EFFORT, warEffortBonus, warEffortPool } from "./warEffort";
export { HUMAN_FACTIONS } from "./world";
