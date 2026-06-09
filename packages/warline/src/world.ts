/**
 * @shipshitgames/warline — shared internal world helpers.
 *
 * Pure helpers used by both the reducer (spec §5) and commands (spec §6):
 * deep-enough world cloning, capped newest-first feed pushes, and the
 * human-faction predicate/constant.
 */

import type { Faction, HumanFaction, WarEvent, WorldState } from "./types";
import { FEED_MAX } from "./types";

/** The two human Pact factions, in canonical order. */
export const HUMAN_FACTIONS: HumanFaction[] = ["pyre", "wardens"];

/** Whether `f` is one of the human Pact factions. */
export function isHuman(f: Faction): boolean {
  return f === "pyre" || f === "wardens";
}

/** Clone a world deep enough that every mutated array/object is copied. */
export function cloneWorld(state: WorldState): WorldState {
  return {
    ...state,
    resources: { ...state.resources },
    regions: state.regions.map((r) => ({ ...r })),
    lanes: state.lanes.map((l) => ({ ...l })),
    breaches: state.breaches.map((b) => ({ ...b })),
    feed: state.feed.slice(),
  };
}

/** Push a feed event, newest-first, capped at FEED_MAX. */
export function pushEvent(state: WorldState, event: WarEvent): void {
  state.feed.unshift(event);
  if (state.feed.length > FEED_MAX) {
    state.feed.length = FEED_MAX;
  }
}
