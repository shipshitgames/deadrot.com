// Warline operation identity for Scourge Survivors (#361). Every run is an
// operation feeding the shared front: the operation NAME and its one-line frame
// are canon and live in the typed lore (`@shipshitgames/assets/lore` →
// games.json `warlineRole`), so the in-game run summary tells the player exactly
// what they just ran AND what it bought the front — without re-authoring canon
// strings in game code. The run's contribution is the biomass banked into the
// shared cross-game war-effort pool (#280), the same value App.tsx reports to
// the Warline front, so the number on the summary equals the number that ships.

import { getGameLore } from "@shipshitgames/assets/lore";
import { runBiomass } from "./survivors";

const SLUG = "scourge-survivors";

const role = getGameLore(SLUG)?.warlineRole;

/** Canon operation name shown on the run summary (lore: games.json warlineRole). */
export const OPERATION_NAME: string = role?.operation ?? "Breach Purge";

/** Canon one-line operation frame (what this op is, for the front report). */
export const OPERATION_LINE: string =
  role?.line ?? "A lone Pyre operator drops into a live breach to grind the Scourge down from the inside.";

/** Biomass this run banks into the shared Warline front — the same contribution
 *  App.tsx reports to the cross-game war-effort pool. Credited regardless of
 *  outcome: even a lost run thins the nest the front is bleeding to contain. */
export function frontContribution(kills: number, level: number, time: number): number {
  return runBiomass(kills, level, time);
}
