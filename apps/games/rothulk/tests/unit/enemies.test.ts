import { describe, expect, test } from "bun:test";
import { CONSTANTS } from "../../src/constants";
import {
  type ChargerTuning,
  globLaunchVelocity,
  type SpitterTuning,
  updateCharger,
  updateSpitter,
} from "../../src/game/enemies";
import type { Charger, Spitter } from "../../src/game/types";

const chargerTuning: ChargerTuning = {
  patrolSpeed: CONSTANTS.CHARGER_PATROL_SPEED,
  chargeSpeed: CONSTANTS.CHARGER_CHARGE_SPEED,
  triggerRange: CONSTANTS.CHARGER_TRIGGER_RANGE,
  rowTolerance: CONSTANTS.CHARGER_ROW_TOLERANCE,
  stunTime: CONSTANTS.CHARGER_STUN_TIME,
};

const spitterTuning: SpitterTuning = {
  range: CONSTANTS.SPITTER_RANGE,
  cooldown: CONSTANTS.SPITTER_COOLDOWN,
};

function mkCharger(overrides: Partial<Charger> = {}): Charger {
  return {
    x: 20,
    y: 1.5,
    vx: CONSTANTS.CHARGER_PATROL_SPEED,
    w: CONSTANTS.CHARGER_WIDTH,
    h: CONSTANTS.CHARGER_HEIGHT,
    minX: 14,
    maxX: 27,
    facing: 1,
    state: "patrol",
    stunTimer: 0,
    alive: true,
    popTimer: 0,
    ...overrides,
  };
}

function mkSpitter(overrides: Partial<Spitter> = {}): Spitter {
  return {
    x: 40,
    y: 4.5,
    size: CONSTANTS.SPITTER_SIZE,
    cooldown: 0,
    alive: true,
    popTimer: 0,
    ...overrides,
  };
}

const DT = 1 / 60;

describe("Charger state machine", () => {
  test("patrols and bounces between its bounds when the hero is far away", () => {
    const c = mkCharger({ x: 26.9 });
    const heroX = 200; // far out of range
    const heroY = c.y;
    for (let i = 0; i < 120; i++) updateCharger(c, heroX, heroY, DT, chargerTuning);
    expect(c.state).toBe("patrol");
    expect(c.x).toBeLessThanOrEqual(c.maxX);
    expect(c.x).toBeGreaterThanOrEqual(c.minX);
    expect(c.vx).toBeLessThan(0); // bounced off the right wall
  });

  test("does not charge when the hero is in range but off its row", () => {
    const c = mkCharger();
    const heroY = c.y + chargerTuning.rowTolerance + 1; // jumping above
    const event = updateCharger(c, c.x + 2, heroY, DT, chargerTuning);
    expect(event).toBeNull();
    expect(c.state).toBe("patrol");
  });

  test("charges toward a hero on its row within trigger range", () => {
    const c = mkCharger();
    const event = updateCharger(c, c.x - 4, c.y, DT, chargerTuning);
    expect(event).toBe("charged");
    expect(c.state).toBe("charge");
    expect(c.facing).toBe(-1);
    expect(c.vx).toBe(-chargerTuning.chargeSpeed);
  });

  test("slams the wall, stuns, then recovers patrolling away from it", () => {
    const c = mkCharger();
    updateCharger(c, c.x + 4, c.y, DT, chargerTuning); // trigger → charging right
    const heroX = 200; // hero hops away; the bull keeps going

    let stunned = false;
    for (let i = 0; i < 600 && !stunned; i++) {
      stunned = updateCharger(c, heroX, 99, DT, chargerTuning) === "stunned";
    }
    expect(stunned).toBe(true);
    expect(c.state).toBe("stunned");
    expect(c.x).toBe(c.maxX);
    expect(c.vx).toBe(0);
    expect(c.stunTimer).toBe(chargerTuning.stunTime);

    // Stays dazed for the full window, then resumes patrol away from the wall.
    let recovered = false;
    for (let i = 0; i < 600 && !recovered; i++) {
      recovered = updateCharger(c, heroX, 99, DT, chargerTuning) === "recovered";
    }
    expect(recovered).toBe(true);
    expect(c.state).toBe("patrol");
    expect(c.vx).toBeLessThan(0);
    expect(c.facing).toBe(-1);
  });

  test("a dead charger only ticks down its death pop", () => {
    const c = mkCharger({ alive: false, popTimer: 0.3 });
    const event = updateCharger(c, c.x, c.y, 0.1, chargerTuning);
    expect(event).toBeNull();
    expect(c.popTimer).toBeCloseTo(0.2);
    expect(c.state).toBe("patrol");
  });
});

describe("Spitter state machine", () => {
  test("holds fire while the hero is out of range", () => {
    const sp = mkSpitter();
    const heroX = sp.x + spitterTuning.range + 1;
    expect(updateSpitter(sp, heroX, sp.y, DT, spitterTuning)).toBe(false);
    expect(sp.cooldown).toBeLessThanOrEqual(0);
  });

  test("fires once in range, then respects the cooldown", () => {
    const sp = mkSpitter();
    const heroX = sp.x - 5;

    expect(updateSpitter(sp, heroX, sp.y, DT, spitterTuning)).toBe(true);
    expect(sp.cooldown).toBe(spitterTuning.cooldown);

    // Immediately after firing it cannot fire again.
    expect(updateSpitter(sp, heroX, sp.y, DT, spitterTuning)).toBe(false);

    // After the cooldown elapses it fires again.
    let fired = false;
    for (let i = 0; i < 600 && !fired; i++) {
      fired = updateSpitter(sp, heroX, sp.y, DT, spitterTuning);
    }
    expect(fired).toBe(true);
  });

  test("a dead spitter never fires and ticks down its pop", () => {
    const sp = mkSpitter({ alive: false, popTimer: 0.3 });
    expect(updateSpitter(sp, sp.x, sp.y, 0.1, spitterTuning)).toBe(false);
    expect(sp.popTimer).toBeCloseTo(0.2);
  });
});

describe("Glob ballistics", () => {
  test("the lob lands exactly on the target after the arc time", () => {
    const fromX = 58;
    const fromY = 11.9;
    const toX = 50;
    const toY = 11.8;
    const { vx, vy } = globLaunchVelocity(fromX, fromY, toX, toY, CONSTANTS.GLOB_ARC_TIME, CONSTANTS.GLOB_GRAVITY);
    const t = CONSTANTS.GLOB_ARC_TIME;
    const landX = fromX + vx * t;
    const landY = fromY + vy * t - 0.5 * CONSTANTS.GLOB_GRAVITY * t * t;
    expect(landX).toBeCloseTo(toX, 5);
    expect(landY).toBeCloseTo(toY, 5);
  });

  test("the lob rises before it falls (a dodgeable arc, not a bullet)", () => {
    const { vy } = globLaunchVelocity(0, 5, 8, 5, CONSTANTS.GLOB_ARC_TIME, CONSTANTS.GLOB_GRAVITY);
    expect(vy).toBeGreaterThan(0);
  });
});
