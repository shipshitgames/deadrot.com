import * as THREE from "three";
import { CONSTANTS } from "../constants";
import type { AbilityKey } from "./abilities";
import type { RenderSystem } from "./RenderSystem";

// Translates raw keyboard + pointer events into a normalized move intent, a
// click-to-move target on the ground plane, edge-latched Q/W/E ability
// presses, and an on-demand cursor aim point. No game logic here.
//
// Movement lives on the arrow keys + click/tap; Q, W, and E are reserved for
// abilities (MOBA-style), which is why WASD no longer steers the champion.
export class InputSystem {
  // Arrow keys -> a -1..1 vector in lane space (x = strafe, z = forward)
  readonly move = new THREE.Vector2(0, 0);

  // Click-to-move world target (null when none / consumed)
  clickTarget: THREE.Vector3 | null = null;

  // Returns true if it actually redeployed (so the same click isn't also a move).
  onRestart: (() => boolean) | null = null;

  private readonly keys = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  // Edge-latched ability presses, consumed once per simulation tick.
  private readonly abilityPresses: AbilityKey[] = [];
  // Last known pointer position (client space) for skillshot aiming.
  private lastPointer: { x: number; y: number } | null = null;

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
    canvas.addEventListener("pointermove", (e) => {
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    // Suppress the context menu so right-drag camera feel isn't hijacked.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (k === "r" && down) {
      if (!e.repeat) this.onRestart?.(); // ignore key auto-repeat so holding R doesn't respawn every frame
      return;
    }
    if (k === "q" || k === "w" || k === "e") {
      e.preventDefault();
      if (down && !e.repeat && this.abilityPresses.length < 4) this.abilityPresses.push(k);
      return;
    }
    const tracked = ["arrowup", "arrowdown", "arrowleft", "arrowright"];
    if (!tracked.includes(k)) return;
    e.preventDefault();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    this.recompute();
  }

  private recompute(): void {
    let x = 0;
    let z = 0;
    if (this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("arrowright")) x += 1;
    if (this.keys.has("arrowup")) z += 1; // forward = +Z
    if (this.keys.has("arrowdown")) z -= 1;
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

    // Any press also refreshes the aim point (touch never sends pointermove first).
    this.lastPointer = { x: e.clientX, y: e.clientY };

    // When the match is over a click redeploys — and is NOT also a move order.
    if (this.onRestart?.()) return;

    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.render.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.ground, hit)) {
      // Clamp into the legal play area so the target is always reachable
      // (otherwise an off-lane click leaves a sticky, never-cleared order).
      const clamp = CONSTANTS.arena.laneClamp;
      hit.x = THREE.MathUtils.clamp(hit.x, -clamp, clamp);
      hit.z = THREE.MathUtils.clamp(hit.z, CONSTANTS.champion.retreatZ, CONSTANTS.base.enemyZ - 1);
      this.clickTarget = hit;
    } else {
      this.clickTarget = null;
    }
  }

  /** Drain this tick's edge-latched Q/W/E presses. */
  takeAbilities(): AbilityKey[] {
    if (this.abilityPresses.length === 0) return [];
    const out = this.abilityPresses.slice();
    this.abilityPresses.length = 0;
    return out;
  }

  /** Where the cursor currently points on the ground plane (null = unknown). */
  aimPoint(): THREE.Vector3 | null {
    if (!this.lastPointer) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    this.ndc.set(
      ((this.lastPointer.x - rect.left) / rect.width) * 2 - 1,
      -((this.lastPointer.y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.render.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, hit) ? hit : null;
  }

  get hasKeyboardMove(): boolean {
    return this.move.lengthSq() > 0;
  }
}
