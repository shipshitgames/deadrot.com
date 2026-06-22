// The Toll (#278): at the 10:00 mark of a Survivors run the breach sends a
// named reaper that ends the run — it one-shots under-progressed players, but
// enough PERMANENT shop progression lets the player withstand its strikes and
// even kill it. Pure helpers so the Survivors director stays deterministic and
// testable; tunables live in ../constants, identity comes from the lore data
// layer (never hardcoded names).

import { getLocation } from "@shipshitgames/assets/lore";
import {
  BOSS_COLOR,
  REAPER_RESIST_TOTAL_TIERS,
  REAPER_RESIST_VIGOR_TIERS,
  REAPER_RESISTED_TOUCH_DAMAGE,
  REAPER_TOUCH_DAMAGE,
  REAPER_WARNING_LEAD,
} from "../constants";
import { SCOURGE_THREAT_TIERS } from "./enemies";
import { SURVIVOR_RUN_GOAL_TIME } from "./survivors";

/** The reaper's lore-sourced face: the location's named climax threat. */
export interface ReaperIdentity {
  name: string;
  entitySlug: string;
  hostFamily: string;
  tint: number;
}

// Game map ids and lore location slugs diverge for two maps — this mapping is
// the explicit seam (game: data/maps.ts, lore: @shipshitgames/assets/lore).
export const REAPER_LOCATION_SLUG_BY_MAP: Record<string, string> = {
  ashgate: "ashgate",
  hollowlanes: "the-hollow-lanes",
  maw: "the-maw",
  perdition: "perdition",
};

// Host-family tints, picked to read against BOSS_COLOR 0xff1f4f and the canon
// DOOM palette (toxic green stays Scourge-only, per data/maps.ts).
export const REAPER_HOST_TINTS: Record<string, number> = {
  chitin: 0xd6a13f, // carapace amber
  "machine-graft": 0x8f9fb8, // graft steel
  "bone-titan": 0xe8e0c8, // bleached bone
  "rot-flesh": 0x8bdc1f, // Scourge toxic green
  voidship: 0x7f6fe0, // void violet
};

/** Resolve the map's named boss from the lore data layer (generic Breach-Boss fallback). */
export function reaperForMap(mapId: string): ReaperIdentity {
  const slug = REAPER_LOCATION_SLUG_BY_MAP[mapId];
  const boss = slug ? getLocation(slug)?.boss : undefined;
  if (!boss) {
    return {
      name: SCOURGE_THREAT_TIERS.breachBoss.label,
      entitySlug: "breach-boss",
      hostFamily: "rot-flesh",
      tint: BOSS_COLOR,
    };
  }
  return {
    name: boss.name,
    entitySlug: boss.entitySlug,
    hostFamily: boss.hostFamily,
    tint: REAPER_HOST_TINTS[boss.hostFamily] ?? BOSS_COLOR,
  };
}

/** The toll falls due: once the clock reaches arrival, spawn exactly once. */
export function shouldSpawnReaper(
  survClock: number,
  alreadySpawned: boolean,
  arrivalTime: number = SURVIVOR_RUN_GOAL_TIME,
): boolean {
  return !alreadySpawned && survClock >= arrivalTime;
}

/** One warning inside the lead window before arrival (the spawn owns >= arrival). */
export function reaperWarningDue(
  survClock: number,
  alreadyWarned: boolean,
  arrivalTime: number = SURVIVOR_RUN_GOAL_TIME,
  lead: number = REAPER_WARNING_LEAD,
): boolean {
  return !alreadyWarned && survClock >= arrivalTime - lead && survClock < arrivalTime;
}

/** Permanent progression gate: deep total shop investment AND a hardened suit. */
export function canResistReaper(tiers: Record<string, number>): boolean {
  let total = 0;
  for (const value of Object.values(tiers)) total += value;
  return total >= REAPER_RESIST_TOTAL_TIERS && (tiers.vigor ?? 0) >= REAPER_RESIST_VIGOR_TIERS;
}

/** Touch damage for this run's shop tiers: a guaranteed one-shot, or a survivable strike. */
export function reaperTouchDamage(tiers: Record<string, number>): number {
  return canResistReaper(tiers) ? REAPER_RESISTED_TOUCH_DAMAGE : REAPER_TOUCH_DAMAGE;
}
