/**
 * @shipshitgames/engine — the embodied 3D game engine shared by every Ship Shit Games title.
 *
 * Scope: engine-core (loop, context base, system registry, snapshot HUD shell, transport)
 * + embodied-base ("the player is a body in a 3D world": movement, collision, world bounds,
 * camera rig, agent kinematics, presence). FPS/genre specifics live in the games.
 *
 * Built seam-by-seam out of scourge-survivors — see that repo's ENGINE-EXTRACTION-PLAN.md.
 */

// --- embodied-base: agents (seam: kinematic Agent + pluggable SteeringStrategy) ---
export { Agent, type PlanarVec } from "./agents/Agent";
export type { SteeringStrategy, SteerView } from "./agents/steering";
// --- embodied-base: camera rig (seam: CameraRig — the spine) ---
export {
  type CameraRig,
  type CameraRigPreset,
  firstPersonPointerLock,
  type RigCaptureEvent,
  type ThirdPersonFollowConfig,
  thirdPersonFollow,
} from "./camera/CameraRig";
export {
  type ActionMap,
  actionFor,
  applyMoveKey,
  clearMoveIntent,
  type MoveIntent,
  makeMoveIntent,
} from "./input/bindings";
// --- embodied-base: input (seam: DOM bindings + movement; genre verbs stay game-side) ---
export { type InputHooks, InputSystem } from "./input/InputSystem";
// --- embodied-base: spawn (seam: where the next enemy enters the world) ---
export {
  type RectScatterConfig,
  RectScatterSpawnProvider,
  type SpawnPoint,
  type SpawnPointProvider,
  type SpawnRequest,
} from "./spawn";
// --- embodied-base: world bounds (seam: WorldBounds) ---
export {
  type MapBounds,
  makeBounds,
  RectBounds,
  type WorldBounds,
} from "./world/bounds";
