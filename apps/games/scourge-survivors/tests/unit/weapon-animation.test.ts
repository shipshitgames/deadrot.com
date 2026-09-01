import { describe, expect, it } from "vitest";
import {
  createWeaponPose,
  evaluateWeaponPose,
  type WeaponAnimInput,
  type WeaponPose,
} from "../../src/game/render/models/weaponAnimation";

const RELOAD_DURATION = 1.2;

function baseInput(): WeaponAnimInput {
  return {
    time: 4.25,
    dt: 1 / 60,
    moveSpeed: 0,
    sprinting: false,
    firing: false,
    fireAge: 999,
    shotCounter: 7,
    recoilStrength: 0.05,
    reloading: false,
    reloadElapsed: 0,
    reloadDuration: RELOAD_DURATION,
    verticalVelocity: 0,
    grounded: true,
    landingVelocity: 0,
    landingAge: 999,
    ads: 0,
    yawDelta: 0,
    pitchDelta: 0,
    sprintBlend: 0,
    lookYaw: 0,
    lookPitch: 0,
  };
}

function expectPoseClose(actual: WeaponPose, expected: WeaponPose, precision = 8): void {
  expect(actual.position.x).toBeCloseTo(expected.position.x, precision);
  expect(actual.position.y).toBeCloseTo(expected.position.y, precision);
  expect(actual.position.z).toBeCloseTo(expected.position.z, precision);
  expect(actual.rotation.x).toBeCloseTo(expected.rotation.x, precision);
  expect(actual.rotation.y).toBeCloseTo(expected.rotation.y, precision);
  expect(actual.rotation.z).toBeCloseTo(expected.rotation.z, precision);
  expect(actual.magazineOffset.x).toBeCloseTo(expected.magazineOffset.x, precision);
  expect(actual.magazineOffset.y).toBeCloseTo(expected.magazineOffset.y, precision);
  expect(actual.magazineOffset.z).toBeCloseTo(expected.magazineOffset.z, precision);
  expect(actual.fovNudge).toBeCloseTo(expected.fovNudge, precision);
  expect(actual.slideOffset).toBeCloseTo(expected.slideOffset, precision);
  expect(actual.sprintBlend).toBeCloseTo(expected.sprintBlend, precision);
  expect(actual.lookYaw).toBeCloseTo(expected.lookYaw, precision);
  expect(actual.lookPitch).toBeCloseTo(expected.lookPitch, precision);
}

function feedState(input: WeaponAnimInput, pose: WeaponPose): void {
  input.sprintBlend = pose.sprintBlend;
  input.lookYaw = pose.lookYaw;
  input.lookPitch = pose.lookPitch;
}

describe("first-person weapon animation evaluator", () => {
  it("is deterministic for identical numeric input", () => {
    const input = baseInput();
    input.moveSpeed = 8;
    input.sprinting = true;
    input.fireAge = 0.035;
    input.yawDelta = 0.018;
    input.pitchDelta = -0.007;

    expect(evaluateWeaponPose(input)).toEqual(evaluateWeaponPose(input));
  });

  it("returns recoil and reciprocating travel to the same rest pose", () => {
    const restInput = baseInput();
    const rest = evaluateWeaponPose(restInput);
    const firedInput = { ...restInput, fireAge: 0 };
    const fired = evaluateWeaponPose(firedInput);
    const settled = evaluateWeaponPose({ ...restInput, fireAge: 1.5 });

    expect(fired.position.z).toBeGreaterThan(rest.position.z);
    expect(fired.rotation.x).toBeLessThan(rest.rotation.x);
    expect(fired.slideOffset).toBeGreaterThan(0);
    expectPoseClose(settled, rest);
  });

  it("finishes the reload keyframes exactly at the configured gameplay duration", () => {
    const restInput = baseInput();
    const rest = evaluateWeaponPose(restInput);
    const middle = evaluateWeaponPose({
      ...restInput,
      reloading: true,
      reloadElapsed: RELOAD_DURATION * 0.46,
    });
    const finished = evaluateWeaponPose({
      ...restInput,
      reloading: true,
      reloadElapsed: RELOAD_DURATION,
    });

    expect(middle.magazineOffset.y).toBeLessThan(-0.3);
    expect(Math.abs(middle.rotation.x - rest.rotation.x)).toBeGreaterThan(0.2);
    expectPoseClose(finished, rest);
  });

  it("converges when one 16ms step is subdivided into two 8ms steps", () => {
    const oneStep = baseInput();
    oneStep.dt = 0.016;
    oneStep.time = 0.016;
    oneStep.moveSpeed = 9;
    oneStep.sprinting = true;
    oneStep.yawDelta = 0.016 * 1.4;
    oneStep.pitchDelta = 0.016 * -0.6;
    const pose16 = evaluateWeaponPose(oneStep);

    const twoSteps = baseInput();
    twoSteps.dt = 0.008;
    twoSteps.moveSpeed = 9;
    twoSteps.sprinting = true;
    const pose8 = createWeaponPose();
    for (let step = 1; step <= 2; step++) {
      twoSteps.time = step * 0.008;
      twoSteps.yawDelta = 0.008 * 1.4;
      twoSteps.pitchDelta = 0.008 * -0.6;
      evaluateWeaponPose(twoSteps, pose8);
      feedState(twoSteps, pose8);
    }

    expectPoseClose(pose8, pose16, 7);
  });

  it("blends sprint fully in and interruptibly back out", () => {
    const input = baseInput();
    const pose = createWeaponPose();
    input.dt = 1 / 60;
    input.sprinting = true;
    for (let frame = 0; frame < 120; frame++) {
      input.time += input.dt;
      evaluateWeaponPose(input, pose);
      feedState(input, pose);
    }
    expect(pose.sprintBlend).toBeGreaterThan(0.999);
    expect(pose.position.y).toBeLessThan(-0.14);

    input.firing = true;
    input.fireAge = 0;
    for (let frame = 0; frame < 60; frame++) {
      input.time += input.dt;
      input.fireAge += input.dt;
      evaluateWeaponPose(input, pose);
      feedState(input, pose);
    }
    expect(pose.sprintBlend).toBeLessThan(0.001);
  });

  it("keeps the idle sway alive but small, and quiets it down the sights", () => {
    // Peak-to-peak of the idle layer over a couple of breathing cycles. The hip
    // pose has to visibly breathe; the ADS pose has to hold still enough to aim
    // through, which is what adsSway is for.
    const swayRange = (ads: number) => {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let step = 0; step < 240; step++) {
        const pose = evaluateWeaponPose({ ...baseInput(), time: step * 0.05, ads });
        // Subtract the constant ADS pull-in so only the moving part is measured.
        const sway = pose.position.x + ads * 0.45;
        min = Math.min(min, sway);
        max = Math.max(max, sway);
      }
      return max - min;
    };

    const hip = swayRange(0);
    const sighted = swayRange(1);

    expect(hip).toBeGreaterThan(0.008); // a standing weapon is never dead still
    expect(hip).toBeLessThan(0.05); // ...and never drifts far enough to read as drunk
    expect(sighted).toBeLessThan(hip * 0.2);
  });

  it("pulls the weapon to centre and raises it when aiming down the sights", () => {
    const rest = evaluateWeaponPose(baseInput());
    const sighted = evaluateWeaponPose({ ...baseInput(), ads: 1 });

    expect(sighted.position.x).toBeLessThan(rest.position.x - 0.4); // swung to the crosshair
    expect(sighted.position.y).toBeGreaterThan(rest.position.y + 0.3); // lifted to eye line
  });

  it("drops the muzzle on the way up and reaches for the ground on the way down", () => {
    const rest = evaluateWeaponPose(baseInput());
    const rising = evaluateWeaponPose({ ...baseInput(), grounded: false, verticalVelocity: 14 });
    const falling = evaluateWeaponPose({ ...baseInput(), grounded: false, verticalVelocity: -14 });

    // Leaving the ground: the weapon lags behind the body and the muzzle dips.
    expect(rising.position.y).toBeLessThan(rest.position.y);
    expect(rising.rotation.x).toBeLessThan(rest.rotation.x);

    // Falling is a different pose, not a mirrored one: the weapon pushes forward
    // rather than lifting, so a jump reads as an arc instead of a bounce.
    expect(falling.position.z).toBeLessThan(rest.position.z);
    expect(falling.position.y).toBeCloseTo(rest.position.y, 8);
  });

  it("absorbs a landing as a ramp and settles back to rest", () => {
    const rest = evaluateWeaponPose(baseInput());
    const land = (landingAge: number) => evaluateWeaponPose({ ...baseInput(), landingVelocity: -12, landingAge });

    // The impact frame itself is still the rest pose — the dip ramps in over the
    // next few frames, so a hard landing compresses rather than snapping.
    expectPoseClose(land(0), rest);

    const absorbing = land(0.035);
    expect(absorbing.position.y).toBeLessThan(rest.position.y - 0.02); // knees give
    expect(absorbing.rotation.x).toBeGreaterThan(rest.rotation.x + 0.03); // muzzle kicks up

    expectPoseClose(land(1), rest);
  });

  it("never emits NaN or infinity for extreme delta/input values", () => {
    const pose = evaluateWeaponPose({
      ...baseInput(),
      time: Number.NaN,
      dt: Number.POSITIVE_INFINITY,
      moveSpeed: Number.POSITIVE_INFINITY,
      fireAge: Number.NaN,
      shotCounter: Number.NaN,
      recoilStrength: Number.POSITIVE_INFINITY,
      reloadElapsed: Number.POSITIVE_INFINITY,
      reloadDuration: Number.NaN,
      verticalVelocity: Number.NEGATIVE_INFINITY,
      landingVelocity: Number.NEGATIVE_INFINITY,
      landingAge: Number.NaN,
      ads: Number.POSITIVE_INFINITY,
      yawDelta: Number.POSITIVE_INFINITY,
      pitchDelta: Number.NEGATIVE_INFINITY,
      sprintBlend: Number.NaN,
      lookYaw: Number.POSITIVE_INFINITY,
      lookPitch: Number.NEGATIVE_INFINITY,
    });
    const values = [
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.rotation.x,
      pose.rotation.y,
      pose.rotation.z,
      pose.magazineOffset.x,
      pose.magazineOffset.y,
      pose.magazineOffset.z,
      pose.fovNudge,
      pose.slideOffset,
      pose.sprintBlend,
      pose.lookYaw,
      pose.lookPitch,
    ];

    for (const value of values) expect(Number.isFinite(value)).toBe(true);
  });
});
