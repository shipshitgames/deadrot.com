import * as THREE from "three";
import { WEAPON_ORDER } from "../constants";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";
import {
  applyLookDelta,
  applyStickToMove,
  isCoarsePointer,
  type StickVector,
  TouchLook,
  TouchStick,
} from "../touchControls";

/**
 * The mobile control scheme.
 *
 * Desktop play is pointer-lock: the browser feeds the game raw mouse deltas and
 * WASD. A phone offers neither, so this system rebuilds both — a floating
 * thumbstick for movement and a canvas drag for look — and feeds them into the
 * exact same `ctx.move` / `ctx.rig.body` the desktop path writes, so everything
 * downstream (movement, collision, weapons, the follow-cam) is unaware which
 * device it is serving.
 *
 * Division of labour: the maths lives in `../touchControls` (pure, unit-tested),
 * the visible pad lives in `components/hud/TouchPad.tsx`, and this class is the
 * seam — it owns the DOM listeners, the per-frame drain, and the verbs the pad
 * calls. It is inert on a mouse-and-keyboard machine.
 */
export class TouchControlSystem {
  /** Whether this device gets touch controls at all. Fixed for the session. */
  readonly enabled: boolean;

  private readonly stick = new TouchStick();
  private readonly look = new TouchLook();
  /** Reused so a per-frame look does not allocate. YXZ matches the rig's getters. */
  private readonly scratch = new THREE.Euler(0, 0, 0, "YXZ");
  private canvas: HTMLCanvasElement | null = null;
  /** Latched by the on-screen ADS button, which toggles rather than holds. */
  private adsHeld = false;

  constructor(
    private readonly ctx: GameContext,
    private readonly sys: GameSystems,
  ) {
    this.enabled = isCoarsePointer();
  }

  // ------------------------------------------------------------------ binding

  bind(): void {
    if (!this.enabled) return;
    const canvas = this.ctx.renderer.domElement;
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", this.onCanvasDown);
    canvas.addEventListener("pointermove", this.onCanvasMove);
    canvas.addEventListener("pointerup", this.onCanvasUp);
    canvas.addEventListener("pointercancel", this.onCanvasUp);
    // Without this the browser claims vertical drags for page scroll and
    // pinch-zoom, and the look gesture dies a few pixels in.
    canvas.style.touchAction = "none";
  }

  unbind(): void {
    const canvas = this.canvas;
    this.canvas = null;
    if (!canvas) return;
    canvas.removeEventListener("pointerdown", this.onCanvasDown);
    canvas.removeEventListener("pointermove", this.onCanvasMove);
    canvas.removeEventListener("pointerup", this.onCanvasUp);
    canvas.removeEventListener("pointercancel", this.onCanvasUp);
    this.releaseAll();
  }

  /** Drop every in-flight gesture — for pause, teardown, and mode changes. */
  releaseAll(): void {
    this.stick.reset();
    this.look.reset();
    this.adsHeld = false;
    this.ctx.firing = false;
    this.ctx.wantsSprint = false;
  }

  // ------------------------------------------------------------- look gesture

  private onCanvasDown = (e: PointerEvent): void => {
    if (!this.live()) return;
    // The canvas is the look surface only. Firing is a button on the pad, so a
    // drag to aim can never also pull the trigger.
    if (this.look.start(e.pointerId, e.clientX, e.clientY)) {
      this.canvas?.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  private onCanvasMove = (e: PointerEvent): void => {
    if (this.look.move(e.pointerId, e.clientX, e.clientY)) e.preventDefault();
  };

  private onCanvasUp = (e: PointerEvent): void => {
    if (!this.look.end(e.pointerId)) return;
    if (this.canvas?.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  };

  // ------------------------------------------------------- pad-facing verbs

  /**
   * The thumbstick. The pad element forwards its own pointer events here rather
   * than letting them reach the canvas, which is what keeps a thumb on the stick
   * from also swinging the camera.
   */
  stickStart(pointerId: number, x: number, y: number): boolean {
    if (!this.live()) return false;
    return this.stick.start(pointerId, x, y);
  }

  stickMove(pointerId: number, x: number, y: number): boolean {
    return this.stick.move(pointerId, x, y);
  }

  stickEnd(pointerId: number): void {
    if (!this.stick.end(pointerId)) return;
    // Zero the intent immediately: the next frame may not run before the player
    // notices, and a thumb-off that keeps walking feels broken.
    applyStickToMove({ x: 0, y: 0, magnitude: 0 }, this.ctx.move);
    this.ctx.wantsSprint = false;
  }

  /** Where the floating base is drawn, and how far the knob is pushed. */
  stickState(): { active: boolean; origin: { x: number; y: number }; vector: StickVector } {
    return { active: this.stick.active, origin: this.stick.origin, vector: this.stick.vector() };
  }

  setFiring(firing: boolean): void {
    if (!this.live()) {
      this.ctx.firing = false;
      return;
    }
    this.ctx.firing = firing;
    // Semi-autos consume a queued trigger rather than the held flag, so a tap
    // fires once on a pistol exactly as a mouse click does.
    if (firing) this.ctx.triggerQueued = true;
  }

  /** ADS is a toggle on touch — there is no second hand to hold a button. */
  toggleAds(): boolean {
    if (!this.live()) return false;
    this.adsHeld = !this.adsHeld;
    if (this.adsHeld) this.sys.weapon.startAds();
    else this.sys.weapon.stopAds();
    return this.adsHeld;
  }

  get aiming(): boolean {
    return this.adsHeld;
  }

  jump(): void {
    if (!this.live()) return;
    this.sys.input.tryJump();
  }

  reload(): void {
    if (this.live()) this.sys.weapon.startReload();
  }

  melee(): void {
    if (this.live()) this.sys.weapon.tryMelee();
  }

  /** Doors, windows, and ladders — the touch equivalent of the E key. */
  interact(): void {
    if (this.live()) this.sys.structures.interact();
  }

  /** Step to the next unlocked weapon; the pad has no room for five slots. */
  cycleWeapon(dir: 1 | -1 = 1): void {
    if (!this.live()) return;
    const weapons = WEAPON_ORDER.filter((id) => this.ctx.unlocked.has(id));
    if (weapons.length <= 1) return;
    const current = Math.max(0, weapons.indexOf(this.ctx.activeWeapon));
    this.sys.weapon.switchWeapon(weapons[(current + dir + weapons.length) % weapons.length]);
  }

  // -------------------------------------------------------------- per-frame

  /**
   * Fold this frame's gestures into the shared player state. Runs before
   * movement and collision so the stick and the drag land on the same frame the
   * player made them.
   */
  update(): void {
    if (!this.enabled) return;
    if (!this.live()) {
      this.look.consume(); // discard motion banked while paused
      return;
    }

    const { sprint } = applyStickToMove(this.stick.vector(), this.ctx.move);
    this.ctx.wantsSprint = sprint;

    const { yaw, pitch } = this.look.consume();
    if (yaw !== 0 || pitch !== 0) applyLookDelta(this.ctx.rig.body, yaw, pitch, this.scratch);
  }

  private live(): boolean {
    return this.enabled && !this.ctx.disposed && this.ctx.status === "playing";
  }
}
