import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/constants";
import { buildLevelAt, buildLevel1 } from "../../src/game/levels";
import { platformToAABB, resolveAgainstSolids } from "../../src/game/physics";
import type { LevelData } from "../../src/game/types";

const DT = 1 / 60;
const HERO_HW = CONSTANTS.HERO_WIDTH / 2;
const HERO_HH = CONSTANTS.HERO_HEIGHT / 2;

interface JumpRoute {
  from: number;
  to: number;
  dir?: -1 | 1;
}

function slabs(level: LevelData) {
  return level.platforms
    .filter((p) => p.kind === "slab")
    .map((p) => ({
      platform: p,
      x0: p.x - p.w / 2,
      x1: p.x + p.w / 2,
      top: p.y + p.h / 2,
    }));
}

function hasPlayableJumpWindow(level: LevelData, route: JumpRoute): boolean {
  const solidAabbs = level.platforms.filter((p) => p.kind === "slab").map(platformToAABB);
  const routeSlabs = slabs(level);
  const from = routeSlabs[route.from];
  const to = routeSlabs[route.to];
  const dir = route.dir ?? 1;
  if (!from || !to) return false;

  const edgeStart = dir > 0 ? from.x1 - HERO_HW - 0.05 : from.x0 + HERO_HW + 0.05;
  const maxRunup = Math.min(2, from.platform.w / 2);

  for (let runup = 0; runup <= maxRunup; runup += 0.25) {
    const startX = Math.max(from.x0 + HERO_HW + 0.01, Math.min(from.x1 - HERO_HW - 0.01, edgeStart - dir * runup));

    for (let jumpDelay = 0; jumpDelay <= 0.9; jumpDelay += DT) {
      if (landsOnTarget({ level, solidAabbs, from, to, dir, startX, jumpDelay })) {
        return true;
      }
    }
  }

  return false;
}

function landsOnTarget({
  solidAabbs,
  from,
  to,
  dir,
  startX,
  jumpDelay,
}: {
  level: LevelData;
  solidAabbs: ReturnType<typeof platformToAABB>[];
  from: ReturnType<typeof slabs>[number];
  to: ReturnType<typeof slabs>[number];
  dir: -1 | 1;
  startX: number;
  jumpDelay: number;
}): boolean {
  let x = startX;
  let y = from.top + HERO_HH;
  let vx = 0;
  let vy = 0;
  let grounded = true;
  let coyote = CONSTANTS.COYOTE_TIME;
  let jumpBuffer = 0;
  let jumped = false;

  for (let frame = 0; frame < 240; frame++) {
    const time = frame * DT;
    const target = dir * CONSTANTS.MOVE_SPEED;
    const accel = grounded ? CONSTANTS.ACCEL : CONSTANTS.AIR_ACCEL;
    vx += Math.sign(target - vx) * accel * DT;
    if (Math.sign(target) === Math.sign(vx) && Math.abs(vx) > Math.abs(target)) {
      vx = target;
    }

    if (grounded) coyote = CONSTANTS.COYOTE_TIME;
    else if (coyote > 0) coyote -= DT;

    if (!jumped && time >= jumpDelay) {
      jumpBuffer = CONSTANTS.JUMP_BUFFER;
      jumped = true;
    } else if (jumpBuffer > 0) {
      jumpBuffer -= DT;
    }

    if (jumpBuffer > 0 && coyote > 0) {
      vy = CONSTANTS.JUMP_VELOCITY;
      grounded = false;
      coyote = 0;
      jumpBuffer = 0;
    }

    let gravity = CONSTANTS.GRAVITY;
    if (vy < 0) gravity *= CONSTANTS.FALL_GRAVITY_MULT;
    vy -= gravity * DT;
    if (vy < -CONSTANTS.MAX_FALL_SPEED) vy = -CONSTANTS.MAX_FALL_SPEED;

    const result = resolveAgainstSolids(x, y, HERO_HW, HERO_HH, vx, vy, DT, solidAabbs);
    x = result.x;
    y = result.y;
    vx = result.vx;
    vy = result.vy;
    grounded = result.grounded;

    const feetY = y - HERO_HH;
    const onTargetX = x >= to.x0 + HERO_HW * 0.2 && x <= to.x1 - HERO_HW * 0.2;
    const onTargetTop = Math.abs(feetY - to.top) < 0.05;
    if (grounded && onTargetX && onTargetTop) return true;
    if (y < CONSTANTS.KILL_FLOOR_Y) return false;
  }

  return false;
}

describe("Rothulk physics", () => {
  test("running from a slab's top-left corner does not get pinned as a wall hit", () => {
    const level = buildLevel1();
    const firstRaisedStep = level.platforms.find((p) => p.kind === "slab" && p.x === 26 && p.y === 2.5);

    expect(firstRaisedStep).toBeDefined();

    const step = platformToAABB(firstRaisedStep!);
    const hw = CONSTANTS.HERO_WIDTH / 2;
    const hh = CONSTANTS.HERO_HEIGHT / 2;
    const startX = step.x - step.hw - hw;
    const standingY = step.y + step.hh + hh;

    const result = resolveAgainstSolids(startX, standingY, hw, hh, CONSTANTS.MOVE_SPEED, -1, 1 / 60, [step]);

    expect(result.x).toBeGreaterThan(startX);
    expect(result.vx).toBe(CONSTANTS.MOVE_SPEED);
    expect(result.grounded).toBe(true);
  });

  test("level 1 required rising jumps have a normal-input route", () => {
    const level = buildLevelAt(0);
    const requiredJumps: JumpRoute[] = [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 4, to: 5 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
      { from: 9, to: 10 },
    ];

    for (const route of requiredJumps) {
      expect(hasPlayableJumpWindow(level, route), `level 1 slab ${route.from} -> ${route.to}`).toBe(true);
    }
  });

  test("level 2 required rising jumps have a normal-input route", () => {
    const level = buildLevelAt(1);
    const requiredJumps: JumpRoute[] = [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, dir: -1 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 9, to: 10 },
      { from: 10, to: 11 },
    ];

    for (const route of requiredJumps) {
      expect(hasPlayableJumpWindow(level, route), `level 2 slab ${route.from} -> ${route.to}`).toBe(true);
    }
  });
});
