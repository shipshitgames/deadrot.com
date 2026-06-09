// THE DRYDOCK — starblight's permanent meta-upgrade shop, where the Warden frame
// is refit between sorties. Pure module (no THREE / DOM imports) so it is
// unit-testable and shared by the React shell, the engine seam, and the tests.
//
// Persistence is a small localStorage blob; the currency (WRECKAGE) is the run's
// salvage banked at run end. Mirrors scourge-survivors' shop (data/survivors.ts +
// storage.ts), co-located here since starblight has no storage module yet.
//
// Meta-upgrades are intentionally tame vs. the in-run draft build identity: they
// only bias the START of a run, they never replace the level-up draft.

export type ShopId = "frame" | "magnet" | "tithe" | "phalanxcache";

export interface ShopDef {
  id: ShopId;
  name: string;
  desc: string;
  /** Unicode glyph (matches the weapon/passive icons in upgrades.ts). */
  icon: string;
  max: number;
  baseCost: number;
}

export const SHOP_UPGRADES: ShopDef[] = [
  { id: "frame", name: "REINFORCED FRAME", desc: "+20 starting integrity per tier", icon: "▣", max: 5, baseCost: 40 },
  {
    id: "magnet",
    name: "SALVAGE MAGNET",
    desc: "+15% starting salvage magnet per tier",
    icon: "⊹",
    max: 4,
    baseCost: 35,
  },
  {
    id: "tithe",
    name: "SALVAGE TITHE",
    desc: "+12% wreckage banked per run per tier",
    icon: "◆",
    max: 4,
    baseCost: 50,
  },
  {
    id: "phalanxcache",
    name: "PHALANX CACHE",
    desc: "Start every sortie with Phalanx Drones",
    icon: "◎",
    max: 1,
    baseCost: 95,
  },
];

export const SHOP_BY_ID: Record<ShopId, ShopDef> = Object.fromEntries(
  SHOP_UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
) as Record<ShopId, ShopDef>;

export type ShopTiers = Partial<Record<ShopId, number>>;

/** Cost to buy the next tier (current owned tier -> tier + 1). +55%-of-base ramp. */
export function shopCost(def: ShopDef, tier: number): number {
  return Math.round(def.baseCost * (1 + tier * 0.55));
}

export interface DrydockState {
  wreckage: number;
  tiers: ShopTiers;
}

const DRYDOCK_KEY = "starblight.drydock.v1";

/** Defensive read — defaults to an empty drydock on any parse / storage error. */
export function loadDrydock(): DrydockState {
  try {
    const raw = localStorage.getItem(DRYDOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DrydockState>;
      return {
        wreckage: Math.max(0, Number(parsed.wreckage) || 0),
        tiers: parsed.tiers && typeof parsed.tiers === "object" ? (parsed.tiers as ShopTiers) : {},
      };
    }
  } catch {
    // corrupt blob or storage unavailable (private mode / SSR / tests)
  }
  return { wreckage: 0, tiers: {} };
}

/** Write-through; swallows quota / private-mode errors. */
export function saveDrydock(state: DrydockState): void {
  try {
    localStorage.setItem(DRYDOCK_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/**
 * Pure buy reducer: buy the next tier of `id` when it isn't maxed and there is
 * enough wreckage. Returns the SAME reference for an impossible purchase so the
 * caller can cheaply detect (and skip persisting) a no-op. Never mutates input.
 */
export function applyBuy(state: DrydockState, id: ShopId): DrydockState {
  const def = SHOP_BY_ID[id];
  if (!def) return state;
  const tier = state.tiers[id] ?? 0;
  if (tier >= def.max) return state;
  const cost = shopCost(def, tier);
  if (state.wreckage < cost) return state;
  return {
    wreckage: state.wreckage - cost,
    tiers: { ...state.tiers, [id]: tier + 1 },
  };
}
