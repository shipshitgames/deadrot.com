export const ARENA = {
  halfWidth: 10.8,
  groundY: -3.65,
  gravity: 30,
  roundSeconds: 60,
  fighterWidth: 2.15,
  fighterHeight: 3.35,
  minSpacing: 1.22,
} as const;

// Canon front-taxonomy class — see the `front-taxonomy` frontmatter in
// apps/lore/content/Maps.md (the cross-game map registry).
export type Front = "holdout" | "lane" | "breach" | "orbital";

// Canon location: see apps/lore/content/Locations/The-Hollow-Lanes.md and
// apps/lore/content/Maps.md (cross-game map registry). Both Brawl modes are
// fought in the "No-Man's-Land Pocket" — a cratered hollow on The Hollow Lanes,
// the same lane front Scourge-Survivors and Redline cross. `loreId` is the join
// key into the War-for-the-Lanes registry; `front` is its front-taxonomy class.
export const MAP = {
  name: "No-Man's-Land Pocket",
  loreId: "hollowlanes",
  front: "lane" as Front,
} as const;
