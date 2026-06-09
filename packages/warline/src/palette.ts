/**
 * @shipshitgames/warline — canonical faction palette.
 *
 * Single source of truth for faction colors used by maps, legends, and 3D
 * scenes. Hex CSS strings; 3D consumers derive numeric values from these.
 */

import type { Faction } from "./types";

export const FACTION_COLOR: Record<Faction, string> = {
  wardens: "#c1121f",
  pyre: "#ff6a00",
  scourge: "#8bdc1f",
  neutral: "#34343c",
};
