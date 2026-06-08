/**
 * The Runner — a Pyre courier. A bone/hellfire capsule with momentum, a
 * satisfying variable-height jump, a dash-roll, and stagger on impact.
 *
 * Physics is all here; it consumes Input and is stepped against the Course by
 * the physics system, which calls the hooks below (land / fall / hit).
 */

import { RUNNER, WORLD } from "../constants";
import type { Input } from "../systems/input";
import type { RunnerState } from "../types";

export class Runner {
  x: number = WORLD.startX;
  y: number = WORLD.groundY + RUNNER.radius;
  vx: number = RUNNER.baseSpeed;
  vy = 0;

  onGround = true;
  state: RunnerState = "run";

  // posture: 1 = upright, dashCrouchScale = rolling low
  crouch = 1;

  // timers
  private coyote: number = 0; // remaining coyote window
  private jumpBuffer = 0; // remaining buffered-jump window
  private dashTimer = 0; // remaining dash time
  private dashCool = 0; // remaining dash cooldown
  private stagger = 0; // remaining stagger lock
  invuln = 0; // remaining i-frames

  // event flags raised this frame (read + cleared by game for juice/audio)
  justJumped = false;
  justDashed = false;
  justLanded = false;
  justHit = false;

  reset() {
    this.x = WORLD.startX;
    this.y = WORLD.groundY + RUNNER.radius;
    this.vx = RUNNER.baseSpeed;
    this.vy = 0;
    this.onGround = true;
    this.state = "run";
    this.crouch = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.dashTimer = 0;
    this.dashCool = 0;
    this.stagger = 0;
    this.invuln = 0;
    this.clearEvents();
  }

  clearEvents() {
    this.justJumped = false;
    this.justDashed = false;
    this.justLanded = false;
    this.justHit = false;
  }

  get dashing(): boolean {
    return this.dashTimer > 0;
  }
  get staggered(): boolean {
    return this.stagger > 0;
  }
  /** Rolling low enough to clear a "bar" hazard. */
  get isLow(): boolean {
    return this.dashing;
  }
  get speedFrac(): number {
    return Math.min(1, Math.max(0, (this.vx - RUNNER.baseSpeed) / (RUNNER.topSpeed - RUNNER.baseSpeed)));
  }

  /**
   * Integrate horizontal velocity from input. Called every step.
   * Vertical integration / collision is handled by the physics system.
   */
  updateHorizontal(dt: number, input: Input) {
    // tick timers
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.dashCool = Math.max(0, this.dashCool - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.stagger > 0) this.stagger = Math.max(0, this.stagger - dt);

    const locked = this.staggered;

    // --- Dash-roll ----------------------------------------------------------
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      if (this.dashTimer === 0) this.dashCool = RUNNER.dashCooldown;
    }
    if (!locked && input.consumeDash() && this.dashTimer === 0 && this.dashCool === 0) {
      this.dashTimer = RUNNER.dashTime;
      this.justDashed = true;
    }

    // --- Horizontal momentum ------------------------------------------------
    let target: number;
    if (locked) {
      target = RUNNER.baseSpeed * 0.5;
    } else if (input.accelerate) {
      target = RUNNER.topSpeed;
    } else {
      target = RUNNER.baseSpeed;
    }

    const rate = input.accelerate && !locked ? RUNNER.accel : RUNNER.decel;
    if (this.vx < target) this.vx = Math.min(target, this.vx + rate * dt);
    else this.vx = Math.max(target, this.vx - rate * dt);

    // Dash adds a temporary speed kick (and lets you roll under low creep).
    const dashBonus = this.dashing ? RUNNER.dashSpeedBonus : 0;

    // --- Jump (buffered + coyote + variable height) -------------------------
    if (!locked && input.consumeJump()) this.jumpBuffer = RUNNER.jumpBufferTime;

    const canJump = this.onGround || this.coyote > 0;
    if (!locked && this.jumpBuffer > 0 && canJump) {
      this.vy = RUNNER.jumpVel;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.justJumped = true;
    }
    // Cut the jump short when the key is released while ascending.
    if (!this.onGround && this.vy > 0 && !input.jumpHeld) {
      this.vy = Math.min(this.vy, RUNNER.jumpVel * RUNNER.cutJumpMul);
    }

    // Apply horizontal movement.
    this.x += (this.vx + dashBonus) * dt;

    // --- Posture (smooth crouch toward dash target) -------------------------
    const crouchTarget = this.dashing ? RUNNER.dashCrouchScale : 1;
    const k = 1 - Math.exp(-18 * dt);
    this.crouch += (crouchTarget - this.crouch) * k;

    // --- State for HUD / visuals -------------------------------------------
    if (this.staggered) this.state = "hit";
    else if (!this.onGround) this.state = "air";
    else if (this.dashing) this.state = "dash";
    else this.state = "run";
  }

  /** Called by physics when the runner is in the air; integrates gravity. */
  integrateGravity(dt: number) {
    this.vy += WORLD.gravity * dt;
    if (this.vy < RUNNER.maxFallSpeed) this.vy = RUNNER.maxFallSpeed;
    this.y += this.vy * dt;
  }

  /** Physics calls this when the capsule rests on a surface at surfaceTopY. */
  land(surfaceTopY: number) {
    const wasAir = !this.onGround;
    this.y = surfaceTopY + RUNNER.radius;
    this.vy = 0;
    if (wasAir) {
      this.onGround = true;
      this.coyote = RUNNER.coyoteTime;
      this.justLanded = true;
    } else {
      this.onGround = true;
      this.coyote = RUNNER.coyoteTime;
    }
  }

  /** Physics calls this the moment the runner walks off an edge. */
  leaveGround() {
    if (this.onGround) {
      this.onGround = false;
      this.coyote = RUNNER.coyoteTime;
    }
  }

  /** Launched by a ramp: convert into an upward arc scaled by current speed. */
  launch(power: number) {
    if (this.vy < power) {
      this.vy = power;
      this.onGround = false;
      this.justJumped = true;
    }
  }

  /** Take a hazard hit: stagger, bleed speed, grant i-frames. */
  hit() {
    if (this.invuln > 0) return;
    this.stagger = RUNNER.staggerTime;
    this.invuln = RUNNER.invulnTime;
    this.vx = Math.max(RUNNER.baseSpeed * 0.5, this.vx * RUNNER.staggerSpeedMul);
    this.dashTimer = 0;
    this.justHit = true;
    this.state = "hit";
  }

  /** Pick up an ember: instant speed bonus (clamped a touch above top speed). */
  collectEmber(bonus: number) {
    this.vx = Math.min(RUNNER.topSpeed * 1.08, this.vx + bonus);
  }
}
