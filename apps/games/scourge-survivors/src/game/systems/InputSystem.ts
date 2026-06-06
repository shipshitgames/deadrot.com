import { InputSystem as InputBinder, type InputHooks } from "@shipshitgames/engine";
import type { GameContext } from "../context";
import type { GameSystems } from "../systems";
import { JUMP_VELOCITY, WEAPON_ORDER } from "../constants";

/**
 * FPS input adapter. The genre-neutral DOM plumbing + WASD/jump movement live in
 * the engine ({@link InputBinder}); this class supplies the FPS *policy* — when
 * input is live, the weapon verbs (reload / melee / weapon-swap / fire), and the
 * pointer-lock capture lifecycle + retry. Capture events come off `ctx.rig`.
 */
export class InputSystem {
  lockRetry = 0;
  private binder: InputBinder | null = null;

  constructor(
    private ctx: GameContext,
    private sys: GameSystems,
  ) {}

  // ------------------------------------------------------------------- events

  bindEvents() {
    this.binder = new InputBinder(this.hooks());
    this.binder.bind();
    window.addEventListener("keydown", this.onLocomotionKeyDown);
    window.addEventListener("keyup", this.onLocomotionKeyUp);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    this.ctx.rig.on("capture", this.onLock);
    this.ctx.rig.on("release", this.onUnlock);
  }

  removeListeners() {
    this.binder?.unbind();
    this.binder = null;
    window.removeEventListener("keydown", this.onLocomotionKeyDown);
    window.removeEventListener("keyup", this.onLocomotionKeyUp);
    window.removeEventListener("wheel", this.onWheel);
    this.ctx.rig.off("capture", this.onLock);
    this.ctx.rig.off("release", this.onUnlock);
    this.clearLocomotionModifiers();
  }

  /** The FPS half of input handed to the engine binder. */
  private hooks(): InputHooks {
    return {
      move: this.ctx.move,
      isActive: () => this.ctx.status === "playing",

      onJump: () => {
        if (this.ctx.canJump) {
          this.ctx.velocity.y = JUMP_VELOCITY;
          this.ctx.canJump = false;
        }
      },

      onActionKey: (code) => {
        switch (code) {
          case "KeyR":
            this.sys.weapon.startReload();
            break;
          case "KeyF":
          case "KeyV":
            this.sys.weapon.tryMelee();
            break;
          case "Digit1":
            this.sys.weapon.switchWeapon(WEAPON_ORDER[0]);
            break;
          case "Digit2":
            this.sys.weapon.switchWeapon(WEAPON_ORDER[1]);
            break;
          case "Digit3":
            this.sys.weapon.switchWeapon(WEAPON_ORDER[2]);
            break;
          case "Digit4":
            this.sys.weapon.switchWeapon(WEAPON_ORDER[3]);
            break;
          case "Digit5":
            this.sys.weapon.switchWeapon(WEAPON_ORDER[4]);
            break;
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

  private clearLocomotionModifiers() {
    this.ctx.wantsSprint = false;
    this.ctx.wantsCrouch = false;
  }

  onLock = () => {
    if (this.ctx.status === "pointerlock-needed" || this.ctx.status === "paused") {
      this.ctx.status = "playing";
      this.sys.hud.emit();
    }
  };

  onUnlock = () => {
    if (this.ctx.status === "playing") {
      this.ctx.status = "paused";
      this.ctx.firing = false;
      this.sys.weapon.stopAds();
      this.ctx.move.forward = this.ctx.move.back = this.ctx.move.left = this.ctx.move.right = false;
      this.clearLocomotionModifiers();
      this.sys.hud.emit();
    }
  };

  requestLock() {
    if (this.ctx.status !== "pointerlock-needed" && this.ctx.status !== "paused") return;
    this.lockPointer();
  }

  lockPointer(allowRetry = true) {
    try {
      const res: unknown = this.ctx.renderer.domElement.requestPointerLock();
      if (res && typeof (res as Promise<void>).catch === "function") {
        (res as Promise<void>).catch(() => this.scheduleLockRetry(allowRetry));
      }
    } catch {
      // Browsers impose a short cooldown after Esc exits pointer lock, during
      // which requestPointerLock fails. Retry once after the cooldown clears.
      this.scheduleLockRetry(allowRetry);
    }
  }

  scheduleLockRetry(allowRetry: boolean) {
    if (!allowRetry || this.ctx.status !== "paused") return;
    window.clearTimeout(this.lockRetry);
    this.lockRetry = window.setTimeout(() => {
      if (this.ctx.status === "paused") this.lockPointer(false);
    }, 1300);
  }
}
