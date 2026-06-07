import {
  type CameraRig,
  clearMoveIntent,
  InputSystem as InputBinder,
  type MoveIntent,
  makeMoveIntent,
} from "@shipshitgames/engine";
import * as THREE from "three";
import { inBounds, isPathCell, worldToCell } from "../board";

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
  wantsBuild = false;

  constructor(
    private readonly rig: CameraRig,
    private readonly groundPlane: THREE.Mesh,
  ) {
    this.binder = new InputBinder({
      move: this.move,
      isActive: () => this.active,
      onActionKey: (code) => this.onActionKey(code),
      onPointerDown: (button) => {
        if (button === 0) this.wantsBuild = true;
      },
      onPointerUp: (button) => {
        if (button === 0) this.wantsBuild = false;
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
    this.wantsBuild = false;
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

  private onActionKey(code: string): void {
    if (code === "KeyE") this.wantsBuild = true;
    if (code === "ShiftLeft" || code === "ShiftRight") this.wantsSprint = true;
  }

  private onRawKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.code === "KeyE") {
      e.preventDefault();
      this.wantsBuild = true;
    } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.wantsSprint = true;
    }
  };

  private onRawKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "KeyE") {
      e.preventDefault();
      this.wantsBuild = false;
    } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      this.wantsSprint = false;
    }
  };

  /** True if the hovered cell could legally hold a tower (empty, off-path). */
  static isBuildable(cell: HoverCell | null, occupied: Set<string>): boolean {
    if (!cell) return false;
    if (isPathCell(cell.col, cell.row)) return false;
    if (occupied.has(`${cell.col},${cell.row}`)) return false;
    return true;
  }
}
