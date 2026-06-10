import * as THREE from "three";
import { COLORS } from "../../game/constants";
import { clamp } from "../../game/math";
import type { RenderSystem } from "../RenderSystem";

// Boss beam telegraph: a faint warning line, then the hot burning beam, both
// laid out along the locked firing path (BossEncounter owns the state machine).
// Scourge threat => toxic palette (readability rule in constants.ts).
export class BossBeam {
  private geom = new THREE.PlaneGeometry(1, 1);
  private warnMat = new THREE.MeshBasicMaterial({
    color: COLORS.toxic,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private fireMat = new THREE.MeshBasicMaterial({
    color: COLORS.toxicHot,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private warn: THREE.Mesh | null = null;
  private fire: THREE.Mesh | null = null;

  constructor(private readonly render: RenderSystem) {}

  /** Warning line along the locked beam path; t01 ramps urgency 0 -> 1. */
  showWarn(x1: number, y1: number, x2: number, y2: number, width: number, t01: number) {
    this.warn ??= this.make(this.warnMat);
    if (this.fire) this.fire.visible = false;
    // A thin line that solidifies as firing approaches.
    this.layout(this.warn, x1, y1, x2, y2, width * 0.35);
    this.warnMat.opacity = 0.18 + 0.3 * clamp(t01, 0, 1);
  }

  /** The burning beam along the same locked path; t01 is remaining life 1 -> 0. */
  showFire(x1: number, y1: number, x2: number, y2: number, width: number, t01: number) {
    this.fire ??= this.make(this.fireMat);
    if (this.warn) this.warn.visible = false;
    this.layout(this.fire, x1, y1, x2, y2, width);
    this.fireMat.opacity = 0.45 + 0.45 * clamp(t01, 0, 1);
  }

  hide() {
    if (this.warn) this.warn.visible = false;
    if (this.fire) this.fire.visible = false;
  }

  dispose() {
    if (this.warn) this.render.remove(this.warn);
    if (this.fire) this.render.remove(this.fire);
    this.geom.dispose();
    this.warnMat.dispose();
    this.fireMat.dispose();
  }

  private make(mat: THREE.MeshBasicMaterial): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geom, mat);
    mesh.visible = false;
    this.render.add(mesh);
    return mesh;
  }

  private layout(mesh: THREE.Mesh, x1: number, y1: number, x2: number, y2: number, width: number) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    mesh.visible = true;
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, -0.3);
    mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    mesh.scale.set(len, width, 1);
  }
}
