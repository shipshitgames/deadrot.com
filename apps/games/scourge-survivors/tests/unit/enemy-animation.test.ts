import { describe, expect, it } from "vitest";
import {
  createEnemyPose,
  ENEMY_POSE_JOINTS,
  type EnemyJointPose,
  type EnemyPose,
  evaluateEnemyPose,
} from "../../src/game/render/models/enemyAnimation";

function poseValues(pose: EnemyPose): number[] {
  return ENEMY_POSE_JOINTS.flatMap((jointName) => {
    const joint = pose[jointName];
    return [joint.offsetX, joint.offsetY, joint.offsetZ, joint.rotationX, joint.rotationY, joint.rotationZ];
  });
}

function jointValues(joint: EnemyJointPose): number[] {
  return [joint.offsetX, joint.offsetY, joint.offsetZ, joint.rotationX, joint.rotationY, joint.rotationZ];
}

describe("evaluateEnemyPose", () => {
  it("is deterministic for identical inputs", () => {
    const first = evaluateEnemyPose("run", "melee", 2.375, 0.84, 1);
    const second = evaluateEnemyPose("run", "melee", 2.375, 0.84, 1);

    expect(second).toEqual(first);
  });

  it("keeps opposing gait limbs counter-phased", () => {
    const pose = evaluateEnemyPose("walk", "melee", Math.PI / 2, 1, 1);

    expect(pose.thighL.rotationX).toBeCloseTo(-pose.thighR.rotationX);
    expect(pose.upperArmL.rotationX).toBeCloseTo(-pose.upperArmR.rotationX);
    expect(Math.sign(pose.thighL.rotationX)).toBe(-Math.sign(pose.upperArmL.rotationX));
  });

  it("moves monotonically through wind-up and then through the strike", () => {
    const start = evaluateEnemyPose("attack", "melee", 0, 0, 1).upperArmR.rotationX;
    const windupMid = evaluateEnemyPose("attack", "melee", 0.17, 0, 1).upperArmR.rotationX;
    const windupEnd = evaluateEnemyPose("attack", "melee", 0.34, 0, 1).upperArmR.rotationX;
    const strikeMid = evaluateEnemyPose("attack", "melee", 0.48, 0, 1).upperArmR.rotationX;
    const strikeEnd = evaluateEnemyPose("attack", "melee", 0.62, 0, 1).upperArmR.rotationX;

    expect(start).toBeGreaterThan(windupMid);
    expect(windupMid).toBeGreaterThan(windupEnd);
    expect(strikeMid).toBeGreaterThan(windupEnd);
    expect(strikeEnd).toBeGreaterThan(strikeMid);
  });

  it("settles the death collapse and holds the final pose", () => {
    const settling = evaluateEnemyPose("death", "boss", 0.55, 0, 1);
    const settled = evaluateEnemyPose("death", "boss", 1, 0, 1);
    const held = evaluateEnemyPose("death", "boss", 8, 0, 1);

    expect(settling.root.offsetY).toBeGreaterThan(settled.root.offsetY);
    expect(settling.root.rotationX).toBeLessThan(settled.root.rotationX);
    expect(held).toEqual(settled);
  });

  it("crossfades within source and target bounds without invalid rotations", () => {
    const from = evaluateEnemyPose("walk", "hound", 1.1, 0.45, 1, undefined, createEnemyPose());
    const target = evaluateEnemyPose("run", "hound", 2.4, 1, 1, undefined, createEnemyPose());
    const blended = evaluateEnemyPose("run", "hound", 2.4, 1, 0.38, from, createEnemyPose());

    for (const jointName of ENEMY_POSE_JOINTS) {
      const fromValues = jointValues(from[jointName]);
      const targetValues = jointValues(target[jointName]);
      const blendedValues = jointValues(blended[jointName]);
      for (let index = 0; index < blendedValues.length; index++) {
        const value = blendedValues[index] ?? Number.NaN;
        const fromValue = fromValues[index] ?? Number.NaN;
        const targetValue = targetValues[index] ?? Number.NaN;
        expect(Number.isFinite(value), `${jointName}[${index}] is finite`).toBe(true);
        expect(value, `${jointName}[${index}] lower bound`).toBeGreaterThanOrEqual(
          Math.min(fromValue, targetValue) - 1e-10,
        );
        expect(value, `${jointName}[${index}] upper bound`).toBeLessThanOrEqual(
          Math.max(fromValue, targetValue) + 1e-10,
        );
      }
    }

    for (const value of poseValues(blended)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThan(Math.PI * 2);
    }
  });
});
