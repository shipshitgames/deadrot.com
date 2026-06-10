import { CONSTANTS } from "../../constants";
import type { Charger, Ember, Hazard, LevelData, MovingPlatform, Platform, Scourge, Spitter } from "../types";

// Level 2 — 'The Maw Spire': the Rothulk's vertical gut, climbed after the
// first node is severed. Same tile/hazard vocabulary as level 1 (slabs, flesh
// walls, acid, bone spikes, movers) but the route climbs hard, and it
// introduces the new Scourge roster:
//   - Spitters: rooted lobbers perched on ledges, arcing toxic globs.
//   - Chargers: armored rams that bull-rush the hero's row and stun on walls.
// Checkpoint cadence matches level 1: one mid-level pylon before the corridor.
export function buildLevel2(): LevelData {
  const platforms: Platform[] = [];

  const slab = (x: number, y: number, w: number, h = 1): Platform => ({
    kind: "slab",
    x: x + w / 2,
    y: y + h / 2,
    w,
    h,
  });

  // --- Opening ground + charger corridor -----------------------------------
  platforms.push(slab(0, 0, 12));
  platforms.push(slab(14, 0, 14)); // long flat run — the charger's hunting lane

  // --- Acid gap into the zigzag climb ---------------------------------------
  platforms.push(slab(31, 1, 4));
  platforms.push(slab(37, 3, 4)); // first spitter perch — stomp it or weave
  platforms.push(slab(31, 5, 4));
  platforms.push(slab(37, 7, 4));
  platforms.push(slab(43, 9, 4));

  // --- Checkpoint shelf ------------------------------------------------------
  platforms.push(slab(49, 10, 10));

  // --- High spike corridor (second charger prowls it) -----------------------
  platforms.push(slab(60, 10, 18));

  // --- Crown traverse: lift up, hop the gut chasm ---------------------------
  platforms.push(slab(84, 16, 5));
  platforms.push(slab(91, 14, 4));
  platforms.push(slab(97, 16, 4));

  // --- Core landing ----------------------------------------------------------
  platforms.push(slab(112, 16, 8));

  // Decorative fleshy backing walls — doubled rows for the tall spire.
  for (let i = 0; i < 13; i++) {
    platforms.push({
      kind: "flesh",
      x: i * 10 + 5,
      y: -3,
      w: 10.5,
      h: 8,
    });
  }
  for (let i = 3; i < 13; i++) {
    platforms.push({
      kind: "flesh",
      x: i * 10 + 5,
      y: 7,
      w: 10.5,
      h: 8,
    });
  }

  const movers: MovingPlatform[] = [
    // Vertical lift from the spike corridor up to the crown traverse.
    {
      x: 81,
      y: 11.5,
      w: 3.2,
      h: 0.8,
      toX: 81,
      toY: 16.5,
      t: 0,
      dir: 1,
      baseX: 81,
      baseY: 11.5,
      vx: 0,
      vy: 0,
    },
    // Ferry across the gut chasm to the core landing.
    {
      x: 103,
      y: 16.5,
      w: 3.6,
      h: 0.8,
      toX: 109,
      toY: 16.5,
      t: 0,
      dir: 1,
      baseX: 103,
      baseY: 16.5,
      vx: 0,
      vy: 0,
    },
  ];

  const hazards: Hazard[] = [
    // Acid pool under the gap into the climb.
    { kind: "acid", x: 30, y: -1.4, w: 6, h: 1.4 },
    // Bone spikes breaking up the high corridor — jump the patches.
    { kind: "spikes", x: 66, y: 11.45, w: 2.4, h: 0.9 },
    { kind: "spikes", x: 71, y: 11.45, w: 2.4, h: 0.9 },
    // The gut chasm below the crown traverse.
    { kind: "acid", x: 95, y: -1.4, w: 26, h: 1.4 },
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

  const scourge: Scourge[] = [mkScourge(8, 1.05, 2.5), mkScourge(52, 11.05, 1.5), mkScourge(93, 15.05, 1.2)];

  const mkSpitter = (x: number, y: number): Spitter => ({
    x,
    y,
    size: CONSTANTS.SPITTER_SIZE,
    cooldown: 0,
    alive: true,
    popTimer: 0,
  });

  const spitters: Spitter[] = [
    mkSpitter(39, 4.45), // guards the climb mouth — the introduction
    mkSpitter(58, 11.45), // shells the checkpoint shelf from the corridor lip
    mkSpitter(87, 17.45), // bombards the lift ride to the crown
  ];

  const mkCharger = (x: number, y: number, minX: number, maxX: number): Charger => ({
    x,
    y,
    vx: CONSTANTS.CHARGER_PATROL_SPEED,
    w: CONSTANTS.CHARGER_WIDTH,
    h: CONSTANTS.CHARGER_HEIGHT,
    minX,
    maxX,
    facing: 1,
    state: "patrol",
    stunTimer: 0,
    alive: true,
    popTimer: 0,
  });

  const chargers: Charger[] = [
    mkCharger(21, 1.5, 14.7, 27.3), // hunting lane — teaches bait-then-stomp
    mkCharger(75, 11.5, 60.7, 77.3), // spike corridor bull
    mkCharger(116, 17.5, 112.7, 119.3), // core landing guardian
  ];

  const mkEmber = (x: number, y: number): Ember => ({
    x,
    y,
    collected: false,
    bob: Math.random() * Math.PI * 2,
  });

  const embers: Ember[] = [
    mkEmber(8, 2),
    mkEmber(20, 2.5),
    mkEmber(33, 3.5),
    mkEmber(39, 5.5),
    mkEmber(33, 7.5),
    mkEmber(45, 11.5),
    mkEmber(53, 12.5),
    mkEmber(68.5, 12.8),
    mkEmber(81, 14),
    mkEmber(93, 16.2),
    mkEmber(99, 18),
    mkEmber(105, 18),
  ];

  return {
    name: "The Maw Spire",
    loreId: "cinder",
    front: "hulk",
    width: 126,
    spawn: { x: CONSTANTS.HERO_SPAWN_X, y: CONSTANTS.HERO_SPAWN_Y },
    platforms,
    movers,
    hazards,
    scourge,
    spitters,
    chargers,
    embers,
    checkpoint: { x: 53, y: 11.6, reached: false },
    core: { x: 117.5, y: 18.2 },
    exit: {
      x: CONSTANTS.HERO_SPAWN_X,
      y: CONSTANTS.HERO_SPAWN_Y,
      radius: CONSTANTS.EXIT_RADIUS,
    },
  };
}
