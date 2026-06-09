import * as THREE from "three";
import { CONSTANTS } from "../constants";
import { clampToLane } from "./movement";
import type { RenderSystem } from "./RenderSystem";

// Translates raw keyboard + pointer events into a normalized move intent and a
// click-to-move target on the ground plane. No game logic here.
export class InputSystem {
  // WASD / arrow keys -> a -1..1 vector in lane space (x = strafe, z = forward)
  readonly move = new THREE.Vector2(0, 0);

  // Click-to-move world target (null when none / consumed)
  clickTarget: THREE.Vector3 | null = null;

  // Returns true if it actually redeployed (so the same click isn't also a move).
  onRestart: (() => boolean) | null = null;

  private readonly keys = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly render: RenderSystem,
  ) {
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    // Clear AND recompute on focus loss — otherwise the cached move vector keeps
    // its last non-zero value and the champion drifts forever after an alt-tab.
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.recompute();
    });
    canvas.addEventListener("pointerdown", (e) => this.onPointer(e));
    // Suppress the context menu so right-drag camera feel isn't hijacked.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (k === "r" && down) {
      if (!e.repeat) this.onRestart?.(); // ignore key auto-repeat so holding R doesn't respawn every frame
      return;
    }
    const tracked = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    if (!tracked.includes(k)) return;
    e.preventDefault();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    this.recompute();
  }

  private recompute(): void {
    let x = 0;
    let z = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) z += 1; // forward = +Z
    if (this.keys.has("s") || this.keys.has("arrowdown")) z -= 1;
    this.move.set(x, z);
    if (this.move.lengthSq() > 0) {
      this.move.normalize();
      this.clickTarget = null; // keyboard overrides a pending click-move
    }
  }

  private onPointer(e: PointerEvent): void {
    // Only the primary button (left-click / touch / pen) issues orders; a
    // right- or middle-click must not redeploy or walk the champion.
    if (e.button !== 0) return;

    // When the match is over a click redeploys — and is NOT also a move order.
    if (this.onRestart?.()) return;

    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.render.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.ground, hit)) {
      // Clamp into the legal play area so the target is always reachable
      // (otherwise an off-lane click leaves a sticky, never-cleared order).
      clampToLane(hit, CONSTANTS.champion.retreatZ);
      this.clickTarget = hit;
    } else {
      this.clickTarget = null;
    }
  }

  get hasKeyboardMove(): boolean {
    return this.move.lengthSq() > 0;
  }
}
