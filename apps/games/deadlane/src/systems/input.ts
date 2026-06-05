import * as THREE from "three";
import { worldToCell, inBounds, isPathCell } from "../board";

export interface HoverCell {
  col: number;
  row: number;
}

/**
 * InputSystem raycasts the pointer onto the board ground plane and reports the
 * hovered cell + click events. It is intentionally dumb: it knows about the
 * grid, not about game rules (cost/occupancy). The Game decides validity.
 */
export class InputSystem {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  hover: HoverCell | null = null;
  private clickedCell: HoverCell | null = null;
  private pointerOnScreen = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly groundPlane: THREE.Mesh,
  ) {
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerleave", () => {
      this.pointerOnScreen = false;
      this.hover = null;
    });
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerOnScreen = true;
  }

  private cellUnderPointer(): HoverCell | null {
    if (!this.pointerOnScreen) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.groundPlane, false);
    if (hits.length === 0) return null;
    const p = hits[0].point;
    const { col, row } = worldToCell(p.x, p.z);
    if (!inBounds(col, row)) return null;
    return { col, row };
  }

  private onMove(e: PointerEvent): void {
    this.updatePointer(e);
    this.hover = this.cellUnderPointer();
  }

  private onDown(e: PointerEvent): void {
    this.updatePointer(e);
    this.clickedCell = this.cellUnderPointer();
  }

  /** True if the hovered cell could legally hold a tower (empty, off-path). */
  static isBuildable(
    cell: HoverCell | null,
    occupied: Set<string>,
  ): boolean {
    if (!cell) return false;
    if (isPathCell(cell.col, cell.row)) return false;
    if (occupied.has(`${cell.col},${cell.row}`)) return false;
    return true;
  }

  /** Consume a click made this frame, if any. */
  takeClick(): HoverCell | null {
    const c = this.clickedCell;
    this.clickedCell = null;
    return c;
  }
}
