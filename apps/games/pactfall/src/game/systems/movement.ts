import * as THREE from "three";
import { CONSTANTS } from "../constants";

// Pure lane-movement math shared by EntitySystem and InputSystem.

/**
 * Step `pos` toward (tx, tz) on the ground plane by at most `speed * dt`,
 * never closer than `stop`. Returns the (pre-step) flat distance to the target.
 */
export function stepToward(pos: THREE.Vector3, tx: number, tz: number, speed: number, dt: number, stop = 0): number {
  const dx = tx - pos.x;
  const dz = tz - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > stop) {
    const step = Math.min(speed * dt, dist - stop);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
  }
  return dist;
}

/**
 * Clamp `pos` into the legal play area: |x| within the lane, z between `minZ`
 * and just short of the Warden base.
 */
export function clampToLane(pos: THREE.Vector3, minZ: number): void {
  const clamp = CONSTANTS.arena.laneClamp;
  pos.x = THREE.MathUtils.clamp(pos.x, -clamp, clamp);
  pos.z = THREE.MathUtils.clamp(pos.z, minZ, CONSTANTS.base.enemyZ - 1);
}
