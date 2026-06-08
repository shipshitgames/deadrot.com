import {
  type ActionMap,
  type CaptureRig,
  clearMoveIntent,
  type InputActionHandler,
  InputSystem as InputBinder,
  type InputHooks,
} from "@shipshitgames/engine";
import { JUMP_VELOCITY, WEAPON_ORDER, type WeaponId } from "../constants";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";

export type FpsAction = "reload" | "melee" | "weapon1" | "weapon2" | "weapon3" | "weapon4" | "weapon5";

export const fpsActionMap = {
  KeyR: "reload",
  KeyF: "melee",
  KeyV: "melee",
  Digit1: "weapon1",
  Digit2: "weapon2",
  Digit3: "weapon3",
  Digit4: "weapon4",
  Digit5: "weapon5",
} satisfies ActionMap<FpsAction>;

const weaponSlot: Record<Extract<FpsAction, `weapon${number}`>, number> = {
  weapon1: 0,
  weapon2: 1,
  weapon3: 2,
  weapon4: 3,
  weapon5: 4,
};

export class FpsActionHandler implements InputActionHandler<FpsAction> {
  constructor(private readonly sys: Pick<GameSystems, "weapon">) {}

  handleAction(action: FpsAction): void {
    switch (action) {
      case "reload":
        this.sys.weapon.startReload();
        break;
      case "melee":
        this.sys.weapon.tryMelee();
        break;
      case "weapon1":
      case "weapon2":
      case "weapon3":
      case "weapon4":
      case "weapon5": {
        const weapon = WEAPON_ORDER[weaponSlot[action]] as WeaponId | undefined;
        if (weapon) this.sys.weapon.switchWeapon(weapon);
        break;
      }
    }
  }
}

export class PointerLockRig implements CaptureRig {
  lockRetry = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly sys: Pick<GameSystems, "hud" | "weapon">,
  ) {}

  get captured(): boolean {
    return this.ctx.rig.captured;
  }

  bind(): void {
    this.ctx.rig.on("capture", this.onCapture);
    this.ctx.rig.on("release", this.onRelease);
  }

  unbind(): void {
    this.ctx.rig.off("capture", this.onCapture);
    this.ctx.rig.off("release", this.onRelease);
    window.clearTimeout(this.lockRetry);
    this.lockRetry = 0;
    this.clearLocomotionModifiers();
  }

  requestCapture(): void {
    if (this.ctx.status !== "pointerlock-needed" && this.ctx.status !== "paused" && this.ctx.status !== "playing") {
      return;
    }
    if (this.captured) return;
    this.lockPointer();
  }

  releaseCapture(silent?: boolean): void {
    this.ctx.rig.releaseCapture(silent);
  }

  clearLocomotionModifiers(): void {
    this.ctx.wantsSprint = false;
    this.ctx.wantsCrouch = false;
  }

  private lockPointer(allowRetry = true): void {
    try {
      const res = this.ctx.rig.requestCapture();
      if (res && typeof res.catch === "function") {
        res.catch(() => this.scheduleLockRetry(allowRetry));
      }
    } catch {
      // Browsers impose a short cooldown after Esc exits pointer lock, during
      // which requestPointerLock fails. Retry once after the cooldown clears.
      this.scheduleLockRetry(allowRetry);
    }
  }

  private scheduleLockRetry(allowRetry: boolean): void {
    if (!allowRetry || this.ctx.status !== "paused") return;
    window.clearTimeout(this.lockRetry);
    this.lockRetry = window.setTimeout(() => {
      if (this.ctx.status === "paused") this.lockPointer(false);
    }, 1300);
  }

  private onCapture = (): void => {
    if (this.ctx.status === "pointerlock-needed" || this.ctx.status === "paused") {
      this.ctx.status = "playing";
      this.sys.hud.emit();
    }
  };

  private onRelease = (): void => {
    if (this.ctx.status === "playing") {
      this.ctx.status = "paused";
      this.ctx.firing = false;
      this.sys.weapon.stopAds();
      clearMoveIntent(this.ctx.move);
      this.clearLocomotionModifiers();
      this.sys.hud.emit();
    }
  };
}

/**
 * FPS input adapter. The genre-neutral DOM plumbing + WASD/jump movement live in
 * the engine ({@link InputBinder}); this class supplies the FPS *policy* — when
 * input is live, the weapon verbs (reload / melee / weapon-swap / fire), and the
 * pointer-lock capture lifecycle + retry. Capture events come off `ctx.rig`.
 */
export class InputSystem {
  private binder: InputBinder<FpsAction> | null = null;
  private captureRig: PointerLockRig | null = null;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  // ------------------------------------------------------------------- events

  bindEvents() {
    const actionHandler = new FpsActionHandler(this.sys);
    this.captureRig = new PointerLockRig(this.ctx, this.sys);
    this.binder = new InputBinder<FpsAction>(this.hooks(actionHandler));
    this.binder.bind();
    window.addEventListener("keydown", this.onLocomotionKeyDown);
    window.addEventListener("keyup", this.onLocomotionKeyUp);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    this.captureRig.bind();
  }

  removeListeners() {
    this.binder?.unbind();
    this.binder = null;
    window.removeEventListener("keydown", this.onLocomotionKeyDown);
    window.removeEventListener("keyup", this.onLocomotionKeyUp);
    window.removeEventListener("wheel", this.onWheel);
    this.captureRig?.unbind();
    this.captureRig = null;
  }

  /** The FPS half of input handed to the engine binder. */
  private hooks(actionHandler: FpsActionHandler): InputHooks<FpsAction> {
    return {
      move: this.ctx.move,
      actions: fpsActionMap,
      actionHandler,
      isActive: () => this.ctx.status === "playing",

      onJump: () => {
        if (this.ctx.canJump) {
          this.ctx.velocity.y = JUMP_VELOCITY;
          this.ctx.canJump = false;
        }
      },

      // While paused, Esc re-acquires pointer lock (resumes the game).
      onResumeKey: () => {
        if (this.ctx.status === "paused") this.requestLock();
      },

      onPointerDown: (button) => {
        if (!this.ctx.rig.captured || this.ctx.status !== "playing") return;
        if (button === 2) {
          this.sys.weapon.startAds();
          return;
        }
        if (button !== 0) return;
        this.ctx.firing = true;
        this.ctx.triggerQueued = true;
      },

      onPointerUp: (button) => {
        if (button === 0) this.ctx.firing = false;
        else if (button === 2) this.sys.weapon.stopAds();
      },

      onResize: () => {
        if (this.ctx.disposed) return;
        const w = this.ctx.container.clientWidth;
        const h = this.ctx.container.clientHeight;
        this.ctx.rig.resize(w / h);
        this.ctx.renderer.setSize(w, h);
      },

      suppressContextMenu: () => this.ctx.status === "playing", // right-click = ADS, no menu
    };
  }

  // --------------------------------------------------- pointer-lock capture (FPS)

  private onLocomotionKeyDown = (e: KeyboardEvent) => {
    if (this.ctx.status !== "playing") return;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.ctx.wantsSprint = true;
    } else if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "KeyC") {
      e.preventDefault();
      this.ctx.wantsCrouch = true;
    }
  };

  private onLocomotionKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.ctx.wantsSprint = false;
    } else if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "KeyC") {
      e.preventDefault();
      this.ctx.wantsCrouch = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.ctx.status !== "playing") return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (this.ctx.aimingDownSights) {
      e.preventDefault();
      this.sys.weapon.cycleAdsZoom(dir);
      return;
    }

    const weapons = WEAPON_ORDER.filter((id) => this.ctx.unlocked.has(id));
    if (weapons.length <= 1) return;
    const current = Math.max(0, weapons.indexOf(this.ctx.activeWeapon));
    const next = weapons[(current + dir + weapons.length) % weapons.length];
    e.preventDefault();
    this.sys.weapon.switchWeapon(next);
  };

  requestLock() {
    this.captureRig?.requestCapture();
  }
}
