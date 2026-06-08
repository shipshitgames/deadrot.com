import { CONSTANTS } from "../constants";
import type { LevelData, Platform, Scourge, Ember, Hazard, MovingPlatform } from "./types";

// Canon location: see apps/lore/content/Locations/The-Rothulk.md and
// apps/lore/content/Locations/Cinder-Flats.md and apps/lore/content/Maps.md (cross-game map registry).
//
// A single hand-authored level: the interior of 'The Rothulk', a named beached
// breach-ship lying in Cinder Flats. Iron/gunmetal slabs bolted over fleshy
// walls; acid pools and bone spikes; two moving platforms; a mid-level
// checkpoint; the breach-core at the end.
export function buildLevel(): LevelData {
  const platforms: Platform[] = [];

  const slab = (x: number, y: number, w: number, h = 1): Platform => ({
    kind: "slab",
    x: x + w / 2,
    y: y + h / 2,
    w,
    h,
  });

  // --- Opening ground ------------------------------------------------------
  platforms.push(slab(0, 0, 14));
  platforms.push(slab(16, 0, 6));
  // small step up
  platforms.push(slab(24, 2, 4));
  platforms.push(slab(30, 4, 5));

  // --- Gap with acid below + floating slabs --------------------------------
  platforms.push(slab(38, 3, 3));
  platforms.push(slab(44, 5, 3));
  platforms.push(slab(50, 3, 4));

  // landing shelf before checkpoint
  platforms.push(slab(57, 1, 9));

  // --- After checkpoint: rising staircase ----------------------------------
  platforms.push(slab(70, 2, 4));
  platforms.push(slab(77, 4, 4));
  platforms.push(slab(84, 6, 4));

  // --- Spike corridor floor ------------------------------------------------
  platforms.push(slab(91, 1, 12));

  // --- Final approach: gaps bridged by movers ------------------------------
  platforms.push(slab(106, 2, 4));
  platforms.push(slab(120, 4, 6)); // core landing

  // Decorative fleshy backing walls (Scourge tissue behind the metal).
  for (let i = 0; i < 14; i++) {
    platforms.push({
      kind: "flesh",
      x: i * 10 + 5,
      y: -3,
      w: 10.5,
      h: 8,
    });
  }

  const movers: MovingPlatform[] = [
    // Lift across the acid gap before the spike corridor.
    {
      x: 99,
      y: 2,
      w: 3.2,
      h: 0.8,
      toX: 99,
      toY: 6,
      t: 0,
      dir: 1,
      vx: 0,
      vy: 0,
    },
    // Ferry over the final chasm to the core.
    {
      x: 112,
      y: 4,
      w: 3.6,
      h: 0.8,
      toX: 117,
      toY: 4,
      t: 0,
      dir: 1,
      vx: 0,
      vy: 0,
    },
  ];

  const hazards: Hazard[] = [
    // Acid pool under the floating-slab gap.
    { kind: "acid", x: 41, y: -1.4, w: 14, h: 1.4 },
    // Bone spikes lining the corridor floor.
    { kind: "spikes", x: 94, y: 1.55, w: 2.4, h: 0.9 },
    { kind: "spikes", x: 97, y: 1.55, w: 2.4, h: 0.9 },
    // Acid in the final chasm.
    { kind: "acid", x: 113, y: -1.0, w: 11, h: 1.4 },
  ];

  const mkScourge = (x: number, y: number, range: number): Scourge => ({
    x,
    y,
    vx: CONSTANTS.SCOURGE_SPEED,
    size: CONSTANTS.SCOURGE_SIZE,
    minX: x - range,
    maxX: x + range,
    alive: true,
    feral: false,
    popTimer: 0,
  });

  const scourge: Scourge[] = [
    mkScourge(10, 1.05, 2.5),
    mkScourge(18, 1.05, 1.5),
    mkScourge(59, 2.05, 3),
    mkScourge(85, 7.05, 1.4),
    mkScourge(94, 2.05, 4),
    mkScourge(121, 5.05, 2),
  ];

  const mkEmber = (x: number, y: number): Ember => ({
    x,
    y,
    collected: false,
    bob: Math.random() * Math.PI * 2,
  });

  const embers: Ember[] = [
    mkEmber(8, 2),
    mkEmber(25, 4),
    mkEmber(38, 5),
    mkEmber(44, 7),
    mkEmber(50, 5),
    mkEmber(70, 4),
    mkEmber(77, 6),
    mkEmber(84, 8),
    mkEmber(91, 3.2),
    mkEmber(106, 4),
    mkEmber(113, 6),
  ];

  return {
    name: "The Rothulk",
    loreId: "cinder",
    front: "hulk",
    width: 130,
    platforms,
    movers,
    hazards,
    scourge,
    embers,
    checkpoint: { x: 60, y: 2.6, reached: false },
    core: { x: 122.5, y: 6.2, ignited: false },
    exit: {
      x: CONSTANTS.HERO_SPAWN_X,
      y: CONSTANTS.HERO_SPAWN_Y,
      radius: CONSTANTS.EXIT_RADIUS,
      reached: false,
    },
  };
}
