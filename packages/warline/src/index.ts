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
export { GAME_OPERATIONS, GAME_SLUGS, operationKindFor } from "./operations";

// palette
export { FACTION_COLOR } from "./palette";

// reducer (spec §5)
export type { ApplyResult } from "./reducer";
export {
  applyOperation,
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
  FEED_MAX,
  RESOURCE_KINDS,
  SCHEMA_VERSION,
  TICK,
  TICK_MS,
} from "./types";
export { HUMAN_FACTIONS } from "./world";
