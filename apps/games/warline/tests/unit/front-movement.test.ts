import { makeMoveIntent, RectBounds } from "@shipshitgames/engine";
import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { createMoveState, resetMoveState, updateMovement } from "../../src/front/movement";

describe("Warline front movement feel", () => {
  test("movement ramps into velocity instead of teleporting at full speed", () => {
    const { move, rig, state } = makeHarness();
    move.forward = true;

    updateMovement(rig, move, state, RectBounds.square(40), [], 1 / 60);

    expect(state.forwardVelocity).toBeGreaterThan(0);
    expect(state.forwardVelocity).toBeLessThan(8.25);
    expect(state.wasMoving).toBe(true);
    expect(state.startBoostTimer).toBeGreaterThan(0);
  });

  test("release brakes existing velocity and reset clears it", () => {
    const { move, rig, state } = makeHarness();
    state.forwardVelocity = 6;

    updateMovement(rig, move, state, RectBounds.square(40), [], 1 / 60);

    expect(state.forwardVelocity).toBeLessThan(6);
    resetMoveState(state);
    expect(state.forwardVelocity).toBe(0);
    expect(state.wasMoving).toBe(false);
  });
});

function makeHarness() {
  const move = makeMoveIntent();
  const state = createMoveState();
  const rig = {
    body: { position: new THREE.Vector3(0, 1.7, 0) },
    movePlanar(right: number, forward: number) {
      this.body.position.x += right;
      this.body.position.z += forward;
    },
  } as any;

  return { move, rig, state };
}
