/**
 * Touch control maths — the headless half of the mobile input scheme.
 *
 * Desktop play is pointer-lock: the browser hands the game raw mouse deltas and
 * WASD booleans. A phone has neither, so this module rebuilds both from finger
 * gestures, and does it in pure functions/classes so the whole scheme is
 * testable without a DOM, a canvas, or a real device.
 *
 * The DOM wiring lives in `systems/TouchControlSystem.ts`; the on-screen pad
 * lives in `components/hud/TouchPad.tsx`. Nothing in this file touches either.
 */

import type { MoveIntent } from "@shipshitgames/engine";
import type * as THREE from "three";

/**
 * How far (px) the thumb travels from the stick origin before the stick reads
 * as fully deflected. Tuned against the pad's rendered radius so the visual
 * knob hits the ring exactly when the intent saturates.
 */
export const STICK_RADIUS = 56;

/**
 * Deflection below this fraction of {@link STICK_RADIUS} is treated as a dead
 * thumb rather than a walk. Phones report sub-pixel jitter while a finger rests
 * on the glass, and without a deadzone the player drifts while standing still.
 */
export const STICK_DEADZONE = 0.22;

/**
 * Past this fraction the player is asking to sprint. MoveIntent is boolean, so
 * an analog stick cannot express walk speed directly — but the game already has
 * a sprint modifier, which gives the stick three honest tiers (idle / walk /
 * sprint) without inventing an analog channel the engine would ignore.
 */
export const STICK_SPRINT = 0.85;

/** Radians of look per pixel dragged. ~1.5 screen-widths for a full turn. */
export const LOOK_SENSITIVITY = 0.0038;

/**
 * Pitch is clamped just shy of straight up/down. Reaching exactly ±π/2 gimbal-
 * locks the YXZ euler and the view rolls, so the same epsilon PointerLockControls
 * uses is applied here.
 */
export const PITCH_LIMIT = Math.PI / 2 - 0.02;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * True when the primary pointer cannot hover or click precisely — phones and
 * tablets. `matchMedia` is the authoritative signal; `maxTouchPoints` is the
 * fallback for engines that do not implement the pointer media query, and both
 * are guarded because this runs under jsdom and SSR too.
 */
export function isCoarsePointer(win: Window | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win) return false;
  try {
    if (typeof win.matchMedia === "function") {
      const query = win.matchMedia("(pointer: coarse)");
      if (query && typeof query.matches === "boolean") return query.matches;
    }
  } catch {
    // matchMedia can throw on a malformed query in older engines; fall through.
  }
  return (win.navigator?.maxTouchPoints ?? 0) > 0;
}

/** A finger's deflection from where it first landed, in stick-radius units. */
export interface StickVector {
  /** -1 (left) … +1 (right). */
  x: number;
  /** -1 (forward/up-screen) … +1 (back). */
  y: number;
  /** 0 … 1, already clamped to the ring. */
  magnitude: number;
}

/**
 * The movement thumbstick.
 *
 * Floating rather than fixed: the origin is wherever the thumb lands inside the
 * pad's hit area, so the player never has to look down to find it. One finger
 * at a time — the stick claims a pointer id on press and ignores every other
 * pointer until that one lifts, which is what keeps it from fighting the look
 * drag for the same touch.
 */
export class TouchStick {
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;

  get active(): boolean {
    return this.pointerId !== null;
  }

  /** The origin, for drawing the floating base. Meaningless while inactive. */
  get origin(): { x: number; y: number } {
    return { x: this.originX, y: this.originY };
  }

  start(pointerId: number, x: number, y: number): boolean {
    if (this.pointerId !== null) return false;
    this.pointerId = pointerId;
    this.originX = this.currentX = x;
    this.originY = this.currentY = y;
    return true;
  }

  move(pointerId: number, x: number, y: number): boolean {
    if (this.pointerId !== pointerId) return false;
    this.currentX = x;
    this.currentY = y;
    return true;
  }

  end(pointerId: number): boolean {
    if (this.pointerId !== pointerId) return false;
    this.pointerId = null;
    this.originX = this.originY = this.currentX = this.currentY = 0;
    return true;
  }

  /** Release unconditionally — used when play is interrupted mid-gesture. */
  reset(): void {
    this.pointerId = null;
    this.originX = this.originY = this.currentX = this.currentY = 0;
  }

  vector(): StickVector {
    if (this.pointerId === null) return { x: 0, y: 0, magnitude: 0 };
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) return { x: 0, y: 0, magnitude: 0 };

    // Clamp to the ring: past the radius the stick saturates rather than
    // reading "more than fully pushed".
    const magnitude = Math.min(1, dist / STICK_RADIUS);
    return { x: (dx / dist) * magnitude, y: (dy / dist) * magnitude, magnitude };
  }
}

/** What a stick deflection asks the player character to do this frame. */
export interface LocomotionIntent {
  sprint: boolean;
}

/**
 * Fold a stick deflection into the engine's boolean {@link MoveIntent}.
 *
 * The intent is fully rewritten every call — including the all-false case — so
 * a lifted thumb stops the player rather than latching the last direction.
 * Screen-space `y` is negated because dragging *up* the glass means forward.
 */
export function applyStickToMove(vec: StickVector, move: MoveIntent): LocomotionIntent {
  if (vec.magnitude < STICK_DEADZONE) {
    move.forward = move.back = move.left = move.right = false;
    return { sprint: false };
  }

  // Per-axis thresholds (rather than one dominant direction) keep the diagonals
  // reachable, which is how a keyboard behaves with two keys held.
  const axis = STICK_DEADZONE * 0.7;
  move.forward = vec.y < -axis;
  move.back = vec.y > axis;
  move.left = vec.x < -axis;
  move.right = vec.x > axis;

  return { sprint: vec.magnitude >= STICK_SPRINT };
}

/**
 * The look drag.
 *
 * Accumulates raw pixel deltas between frames; the game drains them once per
 * update via {@link consume}. Deltas are batched rather than applied on the
 * event because a phone can deliver several pointermoves per animation frame,
 * and rotating the camera mid-frame would tear the aim against the render.
 */
export class TouchLook {
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private accumX = 0;
  private accumY = 0;

  get active(): boolean {
    return this.pointerId !== null;
  }

  start(pointerId: number, x: number, y: number): boolean {
    if (this.pointerId !== null) return false;
    this.pointerId = pointerId;
    this.lastX = x;
    this.lastY = y;
    return true;
  }

  move(pointerId: number, x: number, y: number): boolean {
    if (this.pointerId !== pointerId) return false;
    this.accumX += x - this.lastX;
    this.accumY += y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    return true;
  }

  end(pointerId: number): boolean {
    if (this.pointerId !== pointerId) return false;
    this.pointerId = null;
    return true;
  }

  /** Drop the finger AND any un-drained motion — for pause/teardown. */
  reset(): void {
    this.pointerId = null;
    this.accumX = this.accumY = 0;
  }

  /** Drain the pending drag as look deltas in radians, zeroing the buffer. */
  consume(sensitivity = LOOK_SENSITIVITY): { yaw: number; pitch: number } {
    const yaw = this.accumX * sensitivity;
    const pitch = this.accumY * sensitivity;
    this.accumX = this.accumY = 0;
    return { yaw, pitch };
  }
}

/**
 * Turn the player by a look delta.
 *
 * `body` is the rig's canonical player transform — for the first-person rig it
 * *is* the camera, so writing its orientation is exactly what pointer-lock does
 * on desktop, and the two never contend: lock is never engaged on touch, so
 * PointerLockControls' mousemove handler never fires.
 *
 * YXZ order is what the rig's own yaw/pitch getters read back, and roll is
 * pinned to zero so a diagonal drag can never tilt the horizon.
 */
export function applyLookDelta(body: THREE.Object3D, yawDelta: number, pitchDelta: number, scratch: THREE.Euler): void {
  scratch.setFromQuaternion(body.quaternion, "YXZ");
  scratch.y -= yawDelta;
  scratch.x = clamp(scratch.x - pitchDelta, -PITCH_LIMIT, PITCH_LIMIT);
  scratch.z = 0;
  body.quaternion.setFromEuler(scratch);
}
