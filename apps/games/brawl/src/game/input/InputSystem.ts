import type { AttackKind, InputAction } from "../types";

const KEY_ACTIONS: Record<string, InputAction> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "jump",
  ArrowUp: "jump",
  Space: "jump",
  KeyS: "guard",
  ArrowDown: "guard",
  ShiftLeft: "guard",
  ShiftRight: "guard",
  KeyJ: "light",
  KeyK: "heavy",
  KeyL: "special",
};

export interface InputEventTarget {
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListener): void;
}

/** Owns every Brawl input listener plus held/edge-triggered input state. */
export class InputSystem {
  private readonly held = new Set<InputAction>();
  private readonly virtualHeld = new Set<InputAction>();
  private attackQueue: AttackKind | null = null;
  private jumpQueued = false;
  private started = false;
  private menuOverlayOpen = false;

  constructor(
    private readonly onPauseRequest: () => void,
    private readonly target: InputEventTarget = window,
  ) {}

  start() {
    if (this.started) return;
    this.started = true;
    this.target.addEventListener("keydown", this.onKeyDown as EventListener, { passive: false });
    this.target.addEventListener("keyup", this.onKeyUp as EventListener);
    this.target.addEventListener("blur", this.onBlur as EventListener);
  }

  command(action: InputAction) {
    if (action === "jump") {
      this.jumpQueued = true;
      return;
    }
    if (action === "light" || action === "heavy" || action === "special") this.attackQueue = action;
  }

  setVirtual(action: InputAction, pressed: boolean) {
    if (pressed) this.virtualHeld.add(action);
    else this.virtualHeld.delete(action);
  }

  isHeld(action: InputAction): boolean {
    return this.held.has(action) || this.virtualHeld.has(action);
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  consumeAttack(): AttackKind | null {
    const queued = this.attackQueue;
    this.attackQueue = null;
    return queued;
  }

  setMenuOverlayOpen(open: boolean) {
    this.menuOverlayOpen = open;
    if (open) this.clear();
  }

  clear() {
    this.held.clear();
    this.virtualHeld.clear();
    this.attackQueue = null;
    this.jumpQueued = false;
  }

  dispose() {
    if (this.started) {
      this.target.removeEventListener("keydown", this.onKeyDown as EventListener);
      this.target.removeEventListener("keyup", this.onKeyUp as EventListener);
      this.target.removeEventListener("blur", this.onBlur as EventListener);
    }
    this.started = false;
    this.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat && !this.menuOverlayOpen) this.onPauseRequest();
      return;
    }
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    if (action === "jump") this.jumpQueued = true;
    if (action === "light" || action === "heavy" || action === "special") this.attackQueue = action;
    else this.held.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    this.held.delete(action);
  };

  private readonly onBlur = () => this.clear();
}
