/**
 * Pure first-person weapon pose evaluation.
 *
 * The evaluator deliberately owns no Three.js objects and mutates only an
 * optional caller-owned output. WeaponSystem reuses one input/output pair every
 * frame; tests can omit the output for a convenient value-style API. Stateful
 * blend channels are explicit numbers, which keeps replay and frame-rate tests
 * deterministic instead of hiding mutable springs inside the renderer.
 */

export interface WeaponAnimInput {
  time: number;
  dt: number;
  moveSpeed: number;
  sprinting: boolean;
  firing: boolean;
  fireAge: number;
  shotCounter: number;
  recoilStrength: number;
  reloading: boolean;
  reloadElapsed: number;
  reloadDuration: number;
  verticalVelocity: number;
  grounded: boolean;
  landingVelocity: number;
  landingAge: number;
  ads: number;
  yawDelta: number;
  pitchDelta: number;
  sprintBlend: number;
  lookYaw: number;
  lookPitch: number;
}

export interface WeaponPoseAxis {
  x: number;
  y: number;
  z: number;
}

export interface WeaponPose {
  position: WeaponPoseAxis;
  rotation: WeaponPoseAxis;
  magazineOffset: WeaponPoseAxis;
  fovNudge: number;
  slideOffset: number;
  sprintBlend: number;
  lookYaw: number;
  lookPitch: number;
}

const MAX_STEP = 0.25;
const TAU = Math.PI * 2;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function saturate(value: number): number {
  return clamp(value, 0, 1);
}

function smooth(value: number): number {
  const t = saturate(value);
  return t * t * (3 - 2 * t);
}

function damp(current: number, target: number, response: number, dt: number): number {
  return target + (current - target) * Math.exp(-response * dt);
}

function deterministicSigned(counter: number): number {
  const n = Math.sin((Math.trunc(finite(counter)) + 1) * 12.9898) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/**
 * Create a zeroed pose suitable for caller-owned reuse in a hot update loop.
 */
export function createWeaponPose(): WeaponPose {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    magazineOffset: { x: 0, y: 0, z: 0 },
    fovNudge: 0,
    slideOffset: 0,
    sprintBlend: 0,
    lookYaw: 0,
    lookPitch: 0,
  };
}

/**
 * Evaluate all weapon animation layers additively over the rest pose.
 *
 * `sprintBlend`, `lookYaw`, and `lookPitch` are returned spring channels that
 * the next input feeds back. Exponential damping makes constant-target blends
 * independent of frame subdivision. Absolute `time`, `fireAge`, and
 * `reloadElapsed` keep the remaining curves deterministic.
 */
export function evaluateWeaponPose(input: WeaponAnimInput, out: WeaponPose = createWeaponPose()): WeaponPose {
  const dt = clamp(finite(input.dt), 0, MAX_STEP);
  const time = finite(input.time);
  const ads = saturate(finite(input.ads));
  const moveSpeed = Math.max(0, finite(input.moveSpeed));
  const fireAge = Math.max(0, finite(input.fireAge, 999));
  const recoilStrength = clamp(Math.max(0, finite(input.recoilStrength)), 0, 0.15);
  const reloadDuration = Math.max(0.0001, finite(input.reloadDuration, 1));
  const reloadElapsed = clamp(finite(input.reloadElapsed), 0, reloadDuration);
  const verticalVelocity = clamp(finite(input.verticalVelocity), -80, 80);
  const landingVelocity = clamp(finite(input.landingVelocity), -80, 0);
  const landingAge = Math.max(0, finite(input.landingAge, 999));
  const yawDelta = finite(input.yawDelta);
  const pitchDelta = finite(input.pitchDelta);

  const fireInterrupt = input.firing || fireAge < 0.14;
  const sprintTarget = input.sprinting && !fireInterrupt && !input.reloading && ads < 0.12 ? 1 : 0;
  const sprintBlend = damp(saturate(finite(input.sprintBlend)), sprintTarget, sprintTarget > 0 ? 9 : 15, dt);

  const angularDt = Math.max(dt, 1 / 1000);
  const yawVelocity = clamp(yawDelta / angularDt, -18, 18);
  const pitchVelocity = clamp(pitchDelta / angularDt, -18, 18);
  const lookYaw = damp(clamp(finite(input.lookYaw), -0.14, 0.14), clamp(-yawVelocity * 0.012, -0.14, 0.14), 20, dt);
  const lookPitch = damp(
    clamp(finite(input.lookPitch), -0.11, 0.11),
    clamp(-pitchVelocity * 0.01, -0.11, 0.11),
    20,
    dt,
  );

  const idlePhase = (time * 0.72) % TAU;
  const adsSway = 1 - ads * 0.88;
  const idleX = Math.sin(idlePhase) * 0.006 * adsSway;
  const idleY = (Math.sin(idlePhase * 2) * 0.003 + Math.sin(time * 1.55) * 0.0035) * adsSway;

  const speedT = saturate(moveSpeed / 12);
  const bobAmplitude = speedT * (0.007 + sprintBlend * 0.007) * adsSway;
  const bobPhase = time * (7.5 + speedT * 4.5);
  const bobX = Math.cos(bobPhase) * bobAmplitude;
  const bobY = Math.abs(Math.sin(bobPhase)) * bobAmplitude * 1.15;

  const recoil = fireAge < 0.8 ? Math.exp(-fireAge * 15) : 0;
  const recoilRoll = deterministicSigned(input.shotCounter) * recoilStrength * recoil;
  const slideTravel = fireAge < 0.3 ? Math.max(0.025, recoilStrength * 1.45) * Math.exp(-fireAge * 38) : 0;

  const jump = input.grounded ? 0 : clamp(verticalVelocity / 14, -1, 1);
  const landing =
    landingVelocity < 0 && landingAge < 0.8
      ? saturate(-landingVelocity / 18) * Math.exp(-landingAge * 11) * (1 - Math.exp(-landingAge * 55))
      : 0;

  out.position.x = idleX + bobX - ads * 0.45 + sprintBlend * 0.115 + lookYaw * 0.36;
  out.position.y =
    idleY + bobY + ads * 0.32 - sprintBlend * 0.17 - Math.max(0, jump) * 0.055 - landing * 0.105 + lookPitch * 0.26;
  out.position.z = -ads * 0.04 + sprintBlend * 0.085 + recoilStrength * recoil * 1.3 + Math.min(0, jump) * 0.025;
  out.rotation.x =
    -sprintBlend * 0.31 - recoilStrength * recoil * 2.8 - Math.max(0, jump) * 0.09 + landing * 0.17 + lookPitch;
  out.rotation.y = sprintBlend * 0.28 + lookYaw;
  out.rotation.z = sprintBlend * 0.24 + recoilRoll * 0.7 + bobX * 1.4 + lookYaw * 0.35;
  out.magazineOffset.x = 0;
  out.magazineOffset.y = 0;
  out.magazineOffset.z = 0;
  out.slideOffset = slideTravel;
  out.fovNudge = sprintBlend * 1.15 + recoilStrength * recoil * 7;

  if (input.reloading) {
    const p = saturate(reloadElapsed / reloadDuration);
    const tilt = p < 0.16 ? smooth(p / 0.16) : p < 0.78 ? 1 : 1 - smooth((p - 0.78) / 0.22);
    let magazineTravel = 0;
    if (p >= 0.18 && p < 0.38) magazineTravel = smooth((p - 0.18) / 0.2);
    else if (p >= 0.38 && p < 0.55) magazineTravel = 1;
    else if (p >= 0.55 && p < 0.75) magazineTravel = 1 - smooth((p - 0.55) / 0.2);
    const boltRelease = p >= 0.72 && p < 0.88 ? Math.sin(((p - 0.72) / 0.16) * Math.PI) : 0;

    out.position.x -= tilt * 0.055;
    out.position.y -= tilt * 0.13;
    out.position.z += tilt * 0.075;
    out.rotation.x -= tilt * 0.48;
    out.rotation.y += tilt * 0.24;
    out.rotation.z -= tilt * 0.32;
    out.magazineOffset.x = magazineTravel * 0.035;
    out.magazineOffset.y = -magazineTravel * 0.34;
    out.magazineOffset.z = magazineTravel * 0.08;
    out.slideOffset = Math.max(out.slideOffset, boltRelease * 0.065);
    out.fovNudge *= 1 - tilt;
  }

  out.sprintBlend = sprintBlend;
  out.lookYaw = lookYaw;
  out.lookPitch = lookPitch;
  return out;
}
