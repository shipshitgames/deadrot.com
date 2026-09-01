/**
 * Deterministic enemy pose sampling lives outside Three.js so animation timing
 * can be locked down without a renderer. Runtime callers reuse pose records;
 * tests may omit `out` for convenience.
 */

export type EnemyRigKind = "melee" | "ranged" | "flying" | "hound" | "boss";
export type EnemyAnimState = "idle" | "walk" | "run" | "attack" | "hit" | "death" | "hover";

export const ENEMY_POSE_JOINTS = [
  "root",
  "pelvis",
  "spine",
  "head",
  "upperArmL",
  "foreArmL",
  "handL",
  "upperArmR",
  "foreArmR",
  "handR",
  "thighL",
  "shinL",
  "footL",
  "thighR",
  "shinR",
  "footR",
  "frontThighL",
  "frontShinL",
  "frontFootL",
  "frontThighR",
  "frontShinR",
  "frontFootR",
  "wingL",
  "wingR",
] as const;

export type EnemyPoseJoint = (typeof ENEMY_POSE_JOINTS)[number];

export interface EnemyJointPose {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export type EnemyPose = Record<EnemyPoseJoint, EnemyJointPose>;

function createJointPose(): EnemyJointPose {
  return {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
}

/** Allocate pose storage once; Enemy reuses three records for every frame. */
export function createEnemyPose(): EnemyPose {
  return {
    root: createJointPose(),
    pelvis: createJointPose(),
    spine: createJointPose(),
    head: createJointPose(),
    upperArmL: createJointPose(),
    foreArmL: createJointPose(),
    handL: createJointPose(),
    upperArmR: createJointPose(),
    foreArmR: createJointPose(),
    handR: createJointPose(),
    thighL: createJointPose(),
    shinL: createJointPose(),
    footL: createJointPose(),
    thighR: createJointPose(),
    shinR: createJointPose(),
    footR: createJointPose(),
    frontThighL: createJointPose(),
    frontShinL: createJointPose(),
    frontFootL: createJointPose(),
    frontThighR: createJointPose(),
    frontShinR: createJointPose(),
    frontFootR: createJointPose(),
    wingL: createJointPose(),
    wingR: createJointPose(),
  };
}

export function copyEnemyPose(source: EnemyPose, target: EnemyPose): EnemyPose {
  for (const jointName of ENEMY_POSE_JOINTS) {
    const sourceJoint = source[jointName];
    const targetJoint = target[jointName];
    targetJoint.offsetX = sourceJoint.offsetX;
    targetJoint.offsetY = sourceJoint.offsetY;
    targetJoint.offsetZ = sourceJoint.offsetZ;
    targetJoint.rotationX = sourceJoint.rotationX;
    targetJoint.rotationY = sourceJoint.rotationY;
    targetJoint.rotationZ = sourceJoint.rotationZ;
  }
  return target;
}

function clearPose(pose: EnemyPose) {
  for (const jointName of ENEMY_POSE_JOINTS) {
    const joint = pose[jointName];
    joint.offsetX = 0;
    joint.offsetY = 0;
    joint.offsetZ = 0;
    joint.rotationX = 0;
    joint.rotationY = 0;
    joint.rotationZ = 0;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeInOut(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function writeIdle(pose: EnemyPose, kind: EnemyRigKind, t: number) {
  const breath = Math.sin(t * 1.8);
  pose.pelvis.offsetY = breath * 0.018;
  pose.spine.rotationX = breath * 0.025;
  pose.head.rotationX = -pose.spine.rotationX * 0.7;

  if (kind === "melee") {
    pose.spine.rotationX += 0.16;
    pose.head.rotationX -= 0.1;
    pose.upperArmL.rotationX = 0.12;
    pose.upperArmR.rotationX = 0.12;
  } else if (kind === "boss") {
    pose.spine.rotationX = 0.08 + breath * 0.012;
    pose.upperArmL.rotationZ = -0.12;
    pose.upperArmR.rotationZ = 0.18;
  } else if (kind === "hound") {
    pose.spine.rotationX = breath * 0.018;
    pose.head.rotationX = -0.08 - pose.spine.rotationX;
  }
}

function writeLocomotion(pose: EnemyPose, kind: EnemyRigKind, t: number, speed01: number, running: boolean) {
  const speed = clamp01(speed01);
  const strideScale = (running ? 0.88 : 0.58) * (0.35 + speed * 0.65);
  const stride = Math.sin(t) * strideScale;
  const liftL = Math.max(0, Math.sin(t));
  const liftR = Math.max(0, -Math.sin(t));
  const bob = Math.abs(Math.sin(t * 2)) * (running ? 0.085 : 0.045) * speed;
  const lean = speed * (running ? 0.2 : 0.1);

  pose.pelvis.offsetY = bob;
  pose.pelvis.rotationY = Math.sin(t) * 0.055 * speed;
  pose.spine.rotationX = lean;
  pose.head.rotationX = -lean * 0.82;

  if (kind === "hound") {
    pose.thighL.rotationX = -stride;
    pose.shinL.rotationX = 0.22 + liftL * 0.52;
    pose.footL.rotationX = -liftL * 0.28;
    pose.thighR.rotationX = stride;
    pose.shinR.rotationX = 0.22 + liftR * 0.52;
    pose.footR.rotationX = -liftR * 0.28;
    pose.frontThighL.rotationX = stride;
    pose.frontShinL.rotationX = 0.15 + liftR * 0.48;
    pose.frontFootL.rotationX = -liftR * 0.24;
    pose.frontThighR.rotationX = -stride;
    pose.frontShinR.rotationX = 0.15 + liftL * 0.48;
    pose.frontFootR.rotationX = -liftL * 0.24;
    pose.spine.rotationX += Math.sin(t * 2) * 0.05;
    pose.head.rotationX -= pose.spine.rotationX * 0.45;
    return;
  }

  pose.thighL.rotationX = stride;
  pose.shinL.rotationX = liftL * 0.72;
  pose.footL.rotationX = -liftL * 0.34;
  pose.thighR.rotationX = -stride;
  pose.shinR.rotationX = liftR * 0.72;
  pose.footR.rotationX = -liftR * 0.34;
  pose.upperArmL.rotationX = -stride * 0.82;
  pose.foreArmL.rotationX = -0.14 - liftR * 0.22;
  pose.upperArmR.rotationX = stride * 0.82;
  pose.foreArmR.rotationX = -0.14 - liftL * 0.22;

  if (kind === "ranged") {
    pose.upperArmR.rotationX = -0.72 + stride * 0.16;
    pose.upperArmR.rotationY = -0.14;
    pose.foreArmR.rotationX = -0.78;
    pose.upperArmL.rotationX = -0.38 - stride * 0.12;
    pose.foreArmL.rotationX = -0.46;
  }
}

function writeHover(pose: EnemyPose, t: number, speed01: number) {
  const speed = clamp01(speed01);
  const flap = Math.sin(t * 1.35);
  pose.root.offsetY = Math.sin(t * 0.55) * 0.1;
  pose.pelvis.rotationX = 0.12 + speed * 0.12;
  pose.spine.rotationX = -0.06 - speed * 0.08;
  pose.head.rotationX = -pose.spine.rotationX * 0.8;
  pose.upperArmL.rotationZ = -0.28;
  pose.upperArmR.rotationZ = 0.28;
  pose.foreArmL.rotationX = -0.18;
  pose.foreArmR.rotationX = -0.18;
  pose.wingL.rotationZ = -0.34 - flap * 0.42;
  pose.wingR.rotationZ = 0.34 + flap * 0.42;
  pose.wingL.rotationY = 0.12 + flap * 0.08;
  pose.wingR.rotationY = -0.12 - flap * 0.08;
}

function writeAttack(pose: EnemyPose, kind: EnemyRigKind, t: number) {
  const phase = clamp01(t);
  const windup = phase < 0.34 ? easeInOut(phase / 0.34) : 1;
  const strike = phase < 0.34 ? 0 : phase < 0.62 ? easeInOut((phase - 0.34) / 0.28) : 1;
  const recover = phase < 0.62 ? 0 : easeInOut((phase - 0.62) / 0.38);
  const actionWeight = 1 - recover;
  const armSwing = lerp(-1.3 * windup, 1.05, strike) * actionWeight;

  pose.pelvis.rotationY += lerp(-0.18 * windup, 0.2, strike) * actionWeight;
  pose.spine.rotationX += lerp(-0.22 * windup, 0.38, strike) * actionWeight;
  pose.spine.rotationY += lerp(-0.35 * windup, 0.28, strike) * actionWeight;
  pose.head.rotationY -= pose.spine.rotationY * 0.48;
  pose.upperArmR.rotationX += armSwing;
  pose.upperArmR.rotationZ += 0.24 * windup * actionWeight;
  pose.foreArmR.rotationX += (-0.72 * windup + 0.24 * strike) * actionWeight;
  pose.upperArmL.rotationX += -0.24 * windup * actionWeight;

  if (kind === "hound") {
    pose.spine.rotationX += 0.34 * strike * actionWeight;
    pose.head.rotationX += -0.42 * windup * actionWeight + 0.58 * strike * actionWeight;
    pose.head.offsetZ += 0.28 * strike * actionWeight;
    pose.frontThighL.rotationX -= 0.38 * windup * actionWeight;
    pose.frontThighR.rotationX -= 0.38 * windup * actionWeight;
  } else if (kind === "flying") {
    pose.wingL.rotationZ -= 0.34 * windup * actionWeight;
    pose.wingR.rotationZ += 0.34 * windup * actionWeight;
  } else if (kind === "boss") {
    pose.upperArmL.rotationX -= 0.44 * windup * actionWeight;
    pose.spine.rotationZ += 0.16 * strike * actionWeight;
  }
}

function writeHit(pose: EnemyPose, kind: EnemyRigKind, t: number) {
  const weight = 1 - easeInOut(clamp01(t));
  const massScale = kind === "boss" ? 0.48 : kind === "hound" ? 0.82 : 1;
  pose.pelvis.offsetZ -= 0.12 * weight * massScale;
  pose.spine.rotationX -= 0.42 * weight * massScale;
  pose.spine.rotationZ += 0.18 * weight * massScale;
  pose.head.rotationX += 0.32 * weight * massScale;
  pose.head.rotationZ -= 0.12 * weight * massScale;
  pose.upperArmL.rotationZ -= 0.2 * weight * massScale;
  pose.upperArmR.rotationZ += 0.34 * weight * massScale;
}

function writeDeath(pose: EnemyPose, kind: EnemyRigKind, t: number) {
  const settle = easeInOut(clamp01(t));
  const splay = Math.sin(Math.min(1, t) * Math.PI) * (1 - settle * 0.28);
  pose.root.offsetY = -0.82 * settle;
  pose.root.offsetZ = 0.24 * settle;
  pose.root.rotationX = (kind === "hound" ? 0.72 : 1.34) * settle;
  pose.root.rotationZ = (kind === "boss" ? 0.28 : 0.16) * settle;
  pose.pelvis.offsetY = -0.36 * settle;
  pose.spine.rotationX = 0.38 * settle;
  pose.head.rotationX = -0.52 * settle;
  pose.head.rotationZ = 0.22 * settle;
  pose.upperArmL.rotationZ = -0.78 * settle - splay * 0.18;
  pose.upperArmR.rotationZ = 0.92 * settle + splay * 0.22;
  pose.foreArmL.rotationX = -0.54 * settle;
  pose.foreArmR.rotationX = -0.3 * settle;
  pose.thighL.rotationZ = -0.48 * settle;
  pose.thighR.rotationZ = 0.56 * settle;
  pose.shinL.rotationX = 0.62 * settle;
  pose.shinR.rotationX = 0.34 * settle;
  pose.frontThighL.rotationZ = -0.42 * settle;
  pose.frontThighR.rotationZ = 0.42 * settle;
  pose.wingL.rotationZ = -1.08 * settle;
  pose.wingR.rotationZ = 1.08 * settle;
}

function blendPose(target: EnemyPose, fromPose: EnemyPose | undefined, blend: number) {
  const amount = clamp01(blend);
  for (const jointName of ENEMY_POSE_JOINTS) {
    const targetJoint = target[jointName];
    const fromJoint = fromPose?.[jointName];
    targetJoint.offsetX = lerp(fromJoint?.offsetX ?? 0, targetJoint.offsetX, amount);
    targetJoint.offsetY = lerp(fromJoint?.offsetY ?? 0, targetJoint.offsetY, amount);
    targetJoint.offsetZ = lerp(fromJoint?.offsetZ ?? 0, targetJoint.offsetZ, amount);
    targetJoint.rotationX = lerp(fromJoint?.rotationX ?? 0, targetJoint.rotationX, amount);
    targetJoint.rotationY = lerp(fromJoint?.rotationY ?? 0, targetJoint.rotationY, amount);
    targetJoint.rotationZ = lerp(fromJoint?.rotationZ ?? 0, targetJoint.rotationZ, amount);
  }
}

/**
 * Sample one pose into reusable storage. `t` is gait phase for locomotion and
 * normalized clip time for attack, hit, and death. A transition snapshot may
 * be supplied so state changes crossfade from the exact previously rendered
 * pose instead of re-sampling a stale state.
 */
export function evaluateEnemyPose(
  state: EnemyAnimState,
  kind: EnemyRigKind,
  t: number,
  speed01: number,
  blend = 1,
  fromPose?: EnemyPose,
  out: EnemyPose = createEnemyPose(),
): EnemyPose {
  clearPose(out);

  if (state === "hover") {
    writeHover(out, t, speed01);
  } else if (state === "walk" || state === "run") {
    writeLocomotion(out, kind, t, speed01, state === "run");
  } else if (state === "death") {
    writeDeath(out, kind, t);
  } else {
    if (kind === "flying") writeHover(out, t * 5, speed01);
    else if (state === "attack" || state === "hit") {
      if (speed01 > 0.08) writeLocomotion(out, kind, t * Math.PI * 2, speed01, speed01 > 0.72);
      else writeIdle(out, kind, t * 2);
    } else {
      writeIdle(out, kind, t);
    }

    if (state === "attack") writeAttack(out, kind, t);
    else if (state === "hit") writeHit(out, kind, t);
  }

  blendPose(out, fromPose, blend);
  return out;
}
