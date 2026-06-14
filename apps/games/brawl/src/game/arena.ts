// Arena Brawl — smash-style multi-fighter rules (#357).
//
// Pure, deterministic helpers for the chaotic 2-4 fighter mode: damage-percent
// knockback, platform support, ring-out detection, stock ranking, and bot
// targeting. Everything here is side-effect free so it can be unit tested
// without a WebGL context; `Game` wires these into the imperative loop.

import { FIGHTERS, type FighterId } from "./roster";

/** Tunables for the Arena (smash) ruleset. Kept in one literal for testability. */
export const ARENA_RULES = {
  minSlots: 2,
  maxSlots: 4,
  defaultSlots: 3,
  /** Lives per fighter. Lose one on every ring-out; 0 = eliminated. */
  stocks: 3,
  /** Seconds a fighter is intangible after respawning. */
  respawnInvuln: 1.4,
  /** Where ring-out'd fighters drop back in from. */
  respawn: { x: 0, y: 8 },
  /** Start positions on the main platform (player takes index 0). Slots are
   *  filled by prefix (2/3/4 fighters use the first N), so the ORDER matters:
   *  every prefix must keep fighters ≥4 apart — clear of the bot engage range
   *  (2.6) and max attack reach (2.9) — or packed 3-4 line-ups trade hits on the
   *  opening frame (no free hits at the bell, and the fresh-start snapshot stays
   *  at 0 damage). Outer pair first, then the inner pair: min spacing is 4. */
  spawnPoints: [-6, 6, -2, 2],
  /** Solid main platform: standing requires x within [left, right], top at y=0. */
  platform: { left: -7, right: 7, top: 0 },
  /** One-way raised platforms — land from above, pass through from below. */
  sidePlatforms: [
    { left: -6.4, right: -3.4, top: 2.1 },
    { left: 3.4, right: 6.4, top: 2.1 },
  ],
  /** Death boundary. Outside this box in any direction = ring-out. */
  blast: { left: -13.5, right: 13.5, bottom: -9, top: 13 },
  /** Knockback scaling. Velocity grows with the target's accumulated damage. */
  knockback: {
    base: 4.4,
    damageDivisor: 42,
    horizontal: 1,
    vertical: 0.62,
    launchHeavy: 2.2,
    launchSpecial: 3.4,
  },
  /** Horizontal drag (per second) while knocked back. Ground bites harder. */
  groundDrag: 7.5,
  airDrag: 1.2,
  /** Weight derived from maxHealth — heavier fighters resist knockback. */
  weight: { divisor: 115, min: 0.75, max: 1.4 },
  /** Dynamic camera framing for the multi-fighter view (acceptance #4). */
  camera: {
    /** Max horizontal offset of the focus point from stage center. */
    xClamp: 3,
    /** Max upward offset of the focus point. */
    yClamp: 4,
    /** How much the tallest fighter pulls the focus up. */
    yScale: 0.25,
    /** Orthographic zoom-out so 2-4 fighters stay framed. */
    zoom: 1.36,
    /** Exponential follow speed. */
    lerp: 6,
  },
} as const;

const ARENA_FIGHTER_IDS: readonly FighterId[] = FIGHTERS.map((fighter) => fighter.id);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Clamp a requested fighter count into the supported 2-4 range. */
export function clampSlots(count: number): number {
  return clamp(Math.round(count), ARENA_RULES.minSlots, ARENA_RULES.maxSlots);
}

/**
 * Pick the fighter line-up for an Arena match. The chosen fighter always takes
 * slot 0; the remaining slots are filled with distinct roster members in order,
 * cycling only if more slots than fighters are requested.
 */
export function chooseArenaRoster(
  playerId: FighterId,
  slotCount: number,
  roster: readonly FighterId[] = ARENA_FIGHTER_IDS,
): FighterId[] {
  const slots = clampSlots(slotCount);
  const others = roster.filter((id) => id !== playerId);
  const lineup: FighterId[] = [playerId];
  let i = 0;
  while (lineup.length < slots && others.length > 0) {
    lineup.push(others[i % others.length] as FighterId);
    i += 1;
  }
  return lineup;
}

/** Normalised weight in [min, max]; heavier fighters fly less far. */
export function fighterWeight(maxHealth: number): number {
  const { divisor, min, max } = ARENA_RULES.weight;
  return clamp(maxHealth / divisor, min, max);
}

export interface KnockbackInput {
  /** Base push from the attack spec. */
  basePush: number;
  /** Target's accumulated damage percent (post-hit). */
  damagePercent: number;
  /** Target weight (see `fighterWeight`). */
  weight: number;
  /** Attacker facing — sets horizontal direction. */
  facing: 1 | -1;
  /** Extra upward launch for heavy/special finishers. */
  launch?: number;
}

export interface Vec2 {
  vx: number;
  vy: number;
}

/**
 * Launch velocity for a hit. Magnitude scales with the target's damage so a
 * fresh fighter barely budges while a battered one rockets toward the blast
 * zone — the core smash feel that turns ring-outs into the win condition.
 */
export function knockback({ basePush, damagePercent, weight, facing, launch = 0 }: KnockbackInput): Vec2 {
  const k = ARENA_RULES.knockback;
  const scale = 1 + Math.max(0, damagePercent) / k.damageDivisor;
  const magnitude = ((k.base + basePush) * scale) / weight;
  return {
    vx: facing * magnitude * k.horizontal,
    vy: magnitude * k.vertical + launch,
  };
}

/** Extra upward launch for an attack kind. Heavies and specials pop higher. */
export function launchBonus(kind: "light" | "heavy" | "special"): number {
  if (kind === "heavy") return ARENA_RULES.knockback.launchHeavy;
  if (kind === "special") return ARENA_RULES.knockback.launchSpecial;
  return 0;
}

/**
 * Pick the launch to apply when a target is hit more than once in the same
 * frame. Knockback is a *set* (not additive) velocity — damage already
 * accumulates per hit, so the latest launch reflects the higher damage. When
 * two attackers connect on the same frame we keep the stronger of the two so a
 * weak jab can't sap the momentum of a simultaneous heavy. Stacking (`+=`)
 * would double-count and fling the target absurdly far.
 */
export function strongerLaunch(current: Vec2, next: Vec2): Vec2 {
  const cur = current.vx * current.vx + current.vy * current.vy;
  const nxt = next.vx * next.vx + next.vy * next.vy;
  return nxt >= cur ? next : current;
}

/** True when a position is past the blast boundary in any direction. */
export function isRingOut(x: number, y: number, blast = ARENA_RULES.blast): boolean {
  return x < blast.left || x > blast.right || y < blast.bottom || y > blast.top;
}

export interface SupportInput {
  /** Height last frame (used for one-way crossing detection). */
  prevY: number;
  /** Current height before support resolution. */
  y: number;
  /** Vertical velocity (>0 = rising, skip landing). */
  vy: number;
  /** Horizontal position. */
  x: number;
}

export interface SupportResult {
  y: number;
  vy: number;
  grounded: boolean;
}

/**
 * Resolve floor/platform support for a falling fighter. The main platform is
 * solid ground at y=0 but only where the fighter is over it — walk off the edge
 * and there is nothing to stand on (the fall that sets up a ring-out). Side
 * platforms are one-way: you land on them from above and pass through from
 * below. The fighter snaps to the highest platform it crossed this frame.
 */
export function resolveSupport({ prevY, y, vy, x }: SupportInput): SupportResult {
  if (vy > 0) return { y, vy, grounded: false };
  const eps = 0.001;
  const tops: number[] = [];
  const main = ARENA_RULES.platform;
  if (x >= main.left && x <= main.right) tops.push(main.top);
  for (const side of ARENA_RULES.sidePlatforms) {
    if (x >= side.left && x <= side.right) tops.push(side.top);
  }
  let landing: number | null = null;
  for (const top of tops) {
    const wasAbove = prevY >= top - eps;
    const crossed = y <= top + eps;
    if (wasAbove && crossed && (landing === null || top > landing)) landing = top;
  }
  if (landing !== null) return { y: landing, vy: 0, grounded: true };
  return { y, vy, grounded: false };
}

/** True when there is no platform under this x (fighter is over the void). */
export function isOverVoid(x: number): boolean {
  const main = ARENA_RULES.platform;
  if (x >= main.left && x <= main.right) return false;
  return !ARENA_RULES.sidePlatforms.some((side) => x >= side.left && x <= side.right);
}

export interface RankableFighter {
  eliminated: boolean;
  stocks: number;
  damage: number;
}

/**
 * Placement order for the arena: survivors before the eliminated, then more
 * stocks, then less damage. Used to crown a winner when the timer runs out and
 * to order the scoreboard.
 */
export function rankArena<T extends RankableFighter>(fighters: readonly T[]): T[] {
  return [...fighters].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (a.stocks !== b.stocks) return b.stocks - a.stocks;
    return a.damage - b.damage;
  });
}

/** Number of fighters still in the match. */
export function aliveCount(fighters: readonly RankableFighter[]): number {
  return fighters.reduce((count, fighter) => count + (fighter.eliminated ? 0 : 1), 0);
}

export interface Positioned {
  x: number;
  y: number;
  eliminated: boolean;
}

/** Nearest non-eliminated fighter to `self` (squared distance), or null. */
export function nearestTarget<T extends Positioned>(self: { x: number; y: number }, others: readonly T[]): T | null {
  let best: T | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const other of others) {
    if (other.eliminated) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = other;
    }
  }
  return best;
}

/**
 * Edge guard for bot movement: true if stepping `dir` from `x` would carry the
 * bot off the main platform. Keeps grounded bots from suiciding off the ledge.
 */
export function wouldStepOffEdge(x: number, dir: number, margin = 0.85): boolean {
  if (dir === 0) return false;
  const next = x + Math.sign(dir) * margin;
  return next < ARENA_RULES.platform.left || next > ARENA_RULES.platform.right;
}

/** Direction a fighter should travel to get back over the stage center. */
export function recoveryDir(x: number): 1 | -1 {
  return x < 0 ? 1 : -1;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where the Arena camera should look so every live fighter stays framed. The
 * focus tracks the horizontal midpoint of the pack (clamped near center) and
 * lifts toward the highest fighter, so a 3- or 4-way scramble spreading across
 * the stage never pushes anyone off-screen (acceptance #4). Paired with the
 * `camera.zoom` pull-back in the renderer.
 */
export function arenaCameraFocus(positions: readonly Point[], cfg = ARENA_RULES.camera): Point {
  if (positions.length === 0) return { x: 0, y: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of positions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: clamp((minX + maxX) / 2, -cfg.xClamp, cfg.xClamp),
    y: clamp(maxY * cfg.yScale, 0, cfg.yClamp),
  };
}
