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
export { GAME_OPERATIONS, operationKindFor } from "./operations";
// reducer (spec §5)
export type { ApplyResult } from "./reducer";
export {
  applyOperation,
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
  RESOURCE_KINDS,
  SCHEMA_VERSION,
  TICK,
  TICK_MS,
} from "./types";
