import type { firstPersonPointerLock, makeMoveIntent, RectBounds } from "@shipshitgames/engine";
import type * as THREE from "three";

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.72;
export const MOVE_SPEED = 8.25;
export const JUMP_VELOCITY = 7.6;
export const GRAVITY = 22;

export interface JumpState {
  velocity: number;
  grounded: boolean;
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
  bounds: RectBounds,
  obstacleBoxes: THREE.Box3[],
  delta: number,
) {
  const forward = (move.forward ? 1 : 0) - (move.back ? 1 : 0);
  const right = (move.right ? 1 : 0) - (move.left ? 1 : 0);
  if (forward === 0 && right === 0) return;

  const len = Math.hypot(forward, right) || 1;
  const stepRight = (right / len) * MOVE_SPEED * delta;
  const stepForward = (forward / len) * MOVE_SPEED * delta;

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
