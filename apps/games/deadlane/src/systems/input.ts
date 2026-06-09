import {
  type CameraRig,
  clearMoveIntent,
  InputSystem as InputBinder,
  type MoveIntent,
  makeMoveIntent,
} from "@shipshitgames/engine";
import * as THREE from "three";
import { inBounds, worldToCell } from "../board";

export interface HoverCell {
  col: number;
  row: number;
}

/**
 * InputSystem binds first-person movement and reports the tile under the
 * crosshair. It stays rules-light: the Game decides cost, range, and occupancy.
 */
export class InputSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly binder: InputBinder;
  readonly move: MoveIntent = makeMoveIntent();
  active = false;
  wantsSprint = false;
  private buildQueued = false;

  constructor(
    private readonly rig: CameraRig,
    private readonly groundPlane: THREE.Mesh,
    private readonly onPause: () => void,
  ) {
    this.binder = new InputBinder({
      move: this.move,
      isActive: () => this.active,
      onActionKey: (code) => this.onActionKey(code),
      onPointerDown: (button) => {
        if (button === 0) this.buildQueued = true;
      },
      suppressContextMenu: () => this.active,
    });
    this.binder.bind();
    window.addEventListener("keydown", this.onRawKeyDown);
    window.addEventListener("keyup", this.onRawKeyUp);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.clearTransientInput();
  }

  clearTransientInput(): void {
    clearMoveIntent(this.move);
    this.wantsSprint = false;
    this.buildQueued = false;
  }

  aimedCell(): HoverCell | null {
    this.rig.pickRay(0, 0, this.raycaster);
    const hits = this.raycaster.intersectObject(this.groundPlane, false);
    if (hits.length === 0) return null;
    const p = hits[0].point;
    const { col, row } = worldToCell(p.x, p.z);
    if (!inBounds(col, row)) return null;
    return { col, row };
  }

  dispose(): void {
    this.binder.unbind();
    window.removeEventListener("keydown", this.onRawKeyDown);
    window.removeEventListener("keyup", this.onRawKeyUp);
  }

  takeBuildAction(): boolean {
    const queued = this.buildQueued;
    this.buildQueued = false;
    return queued;
  }

  private onActionKey(code: string): void {
    if (code === "KeyE") this.buildQueued = true;
    if (code === "ShiftLeft" || code === "ShiftRight") this.wantsSprint = true;
  }

  private onRawKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.code === "Escape") {
      e.preventDefault();
      this.onPause();
    } else if (e.code === "KeyE") {
      e.preventDefault();
      this.buildQueued = true;
    } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.wantsSprint = true;
    }
  };

  private onRawKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "KeyE") {
      e.preventDefault();
    } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.wantsSprint = false;
    }
  };
}
