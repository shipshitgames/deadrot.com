import type { firstPersonPointerLock, makeMoveIntent, RectBounds } from "@shipshitgames/engine";
import type * as THREE from "three";

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.72;
const MOVE_SPEED = 8.25;
const MOVE_ACCEL = 72;
const MOVE_DAMPING = 11;
const MOVE_BRAKE_DAMPING = 18;
const MOVE_START_BOOST_TIME = 0.14;
const MOVE_START_BOOST_MULT = 0.24;
const MOVE_STOP_EPSILON = 0.05;
export const JUMP_VELOCITY = 7.6;
const GRAVITY = 22;

export interface JumpState {
  velocity: number;
  grounded: boolean;
}

export interface MoveState {
  rightVelocity: number;
  forwardVelocity: number;
  wasMoving: boolean;
  startBoostTimer: number;
}

export function createMoveState(): MoveState {
  return {
    rightVelocity: 0,
    forwardVelocity: 0,
    wasMoving: false,
    startBoostTimer: 0,
  };
}

export function resetMoveState(state: MoveState) {
  state.rightVelocity = 0;
  state.forwardVelocity = 0;
  state.wasMoving = false;
  state.startBoostTimer = 0;
}

export function updateJump(rig: ReturnType<typeof firstPersonPointerLock>, delta: number, state: JumpState) {
  if (state.velocity === 0 && rig.body.position.y <= PLAYER_HEIGHT) {
    state.grounded = true;
    return;
  }
  rig.body.position.y += state.velocity * delta;
  state.velocity -= GRAVITY * delta;
  if (rig.body.position.y <= PLAYER_HEIGHT) {
    rig.body.position.y = PLAYER_HEIGHT;
    state.velocity = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }
}

export function updateMovement(
  rig: ReturnType<typeof firstPersonPointerLock>,
  move: ReturnType<typeof makeMoveIntent>,
  state: MoveState,
  bounds: RectBounds,
  obstacleBoxes: THREE.Box3[],
  delta: number,
) {
  const forward = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
  const right = (move.right ? 1 : 0) - (move.left ? 1 : 0);
  const moving = forward !== 0 || right !== 0;
  if (moving && !state.wasMoving) state.startBoostTimer = MOVE_START_BOOST_TIME;
  state.wasMoving = moving;

  const damping = moving ? MOVE_DAMPING : MOVE_BRAKE_DAMPING;
  const damp = Math.max(0, 1 - damping * delta);
  state.rightVelocity *= damp;
  state.forwardVelocity *= damp;

  if (moving) {
    const len = Math.hypot(forward, right) || 1;
    const boost =
      state.startBoostTimer > 0 ? 1 + MOVE_START_BOOST_MULT * (state.startBoostTimer / MOVE_START_BOOST_TIME) : 1;
    const desiredRight = (right / len) * MOVE_SPEED;
    const desiredForward = (forward / len) * MOVE_SPEED;
    const maxStep = MOVE_ACCEL * boost * delta;
    const dr = desiredRight - state.rightVelocity;
    const df = desiredForward - state.forwardVelocity;
    const dist = Math.hypot(dr, df);
    if (dist > maxStep && dist > 0) {
      state.rightVelocity += (dr / dist) * maxStep;
      state.forwardVelocity += (df / dist) * maxStep;
    } else {
      state.rightVelocity = desiredRight;
      state.forwardVelocity = desiredForward;
    }
  } else if (Math.hypot(state.rightVelocity, state.forwardVelocity) < MOVE_STOP_EPSILON) {
    state.rightVelocity = 0;
    state.forwardVelocity = 0;
  }
  state.startBoostTimer = Math.max(0, state.startBoostTimer - delta);

  const stepRight = state.rightVelocity * delta;
  const stepForward = state.forwardVelocity * delta;
  if (stepRight === 0 && stepForward === 0) return;

  const prevX = rig.body.position.x;
  const prevZ = rig.body.position.z;
  rig.movePlanar(stepRight, stepForward);
  bounds.clampXZ(rig.body.position, 1.25);
  if (collides(rig.body.position.x, rig.body.position.z, obstacleBoxes)) {
    rig.body.position.x = prevX;
    rig.body.position.z = prevZ;
    tryMoveAxis(rig, bounds, obstacleBoxes, stepRight, 0);
    tryMoveAxis(rig, bounds, obstacleBoxes, 0, stepForward);
  }
}

function tryMoveAxis(
  rig: ReturnType<typeof firstPersonPointerLock>,
  bounds: RectBounds,
  obstacleBoxes: THREE.Box3[],
  stepRight: number,
  stepForward: number,
) {
  if (stepRight === 0 && stepForward === 0) return;
  const prevX = rig.body.position.x;
  const prevZ = rig.body.position.z;
  rig.movePlanar(stepRight, stepForward);
  bounds.clampXZ(rig.body.position, 1.25);
  if (collides(rig.body.position.x, rig.body.position.z, obstacleBoxes)) {
    rig.body.position.x = prevX;
    rig.body.position.z = prevZ;
  }
}

function collides(x: number, z: number, boxes: THREE.Box3[]): boolean {
  for (const box of boxes) {
    if (
      x >= box.min.x - PLAYER_RADIUS &&
      x <= box.max.x + PLAYER_RADIUS &&
      z >= box.min.z - PLAYER_RADIUS &&
      z <= box.max.z + PLAYER_RADIUS
    ) {
      return true;
    }
  }
  return false;
}
