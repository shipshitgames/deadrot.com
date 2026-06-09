// Floating damage/score numbers: pooled DOM elements positioned by projecting a
// world position through the game camera. DOM (not sprites) keeps the pixel-font
// styling consistent with each game's HUD layer and costs nothing in the scene.

import * as THREE from "three";

export type DamageNumberKind = "normal" | "head" | "crit";

export interface DamageNumbersOptions {
  /** Max simultaneous numbers before the oldest is recycled. Default 40. */
  max?: number;
  /** Seconds a number stays alive. Default 0.7. */
  ttl?: number;
  /** Screen-space rise over the lifetime, in px. Default 46. */
  rise?: number;
  /** Font stack; defaults to the HUD's monospace pixel look. */
  fontFamily?: string;
  /** Colors per kind. Defaults: bone / hellfire / blood. */
  colors?: Partial<Record<DamageNumberKind, string>>;
}

interface FloatingNumber {
  el: HTMLSpanElement;
  world: { x: number; y: number; z: number };
  age: number;
  active: boolean;
}

const DEFAULT_COLORS: Record<DamageNumberKind, string> = {
  normal: "#e9e3d6", // bone
  head: "#ff7a18", // hellfire
  crit: "#ff2d2d", // blood
};

export class DamageNumbers {
  private readonly numbers: FloatingNumber[] = [];
  private readonly max: number;
  private readonly ttl: number;
  private readonly rise: number;
  private readonly fontFamily: string;
  private readonly colors: Record<DamageNumberKind, string>;
  // The renderer only refreshes matrixWorldInverse during render, so we keep our
  // own view matrix and recompute it once per update/spawn — not per number.
  private readonly view = new THREE.Matrix4();
  private readonly scratch = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    private camera: THREE.Camera,
    opts: DamageNumbersOptions = {},
  ) {
    this.max = opts.max ?? 40;
    this.ttl = opts.ttl ?? 0.7;
    this.rise = opts.rise ?? 46;
    this.fontFamily = opts.fontFamily ?? '"Courier New", monospace';
    this.colors = { ...DEFAULT_COLORS, ...opts.colors };
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }
  }

  /** Swap the projection camera (e.g. after a mode change). */
  setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  /** Spawn a floating number at a world position. */
  spawn(world: { x: number; y: number; z: number }, text: string | number, kind: DamageNumberKind = "normal") {
    const n = this.acquire();
    n.world = { ...world };
    n.age = 0;
    n.active = true;
    n.el.textContent = String(text);
    n.el.style.color = this.colors[kind];
    n.el.style.fontSize = kind === "normal" ? "14px" : "19px";
    n.el.style.fontWeight = kind === "normal" ? "600" : "800";
    this.refreshView();
    this.place(n);
  }

  /** Re-project live numbers; call once per rendered frame. */
  update(dt: number) {
    let any = false;
    for (const n of this.numbers) {
      if (!n.active) continue;
      n.age += dt;
      if (n.age >= this.ttl) {
        n.active = false;
        n.el.style.display = "none";
        continue;
      }
      any = true;
    }
    if (!any) return;
    this.refreshView();
    for (const n of this.numbers) {
      if (n.active) this.place(n);
    }
  }

  dispose() {
    for (const n of this.numbers) n.el.remove();
    this.numbers.length = 0;
  }

  private refreshView() {
    this.camera.updateMatrixWorld();
    this.view.copy(this.camera.matrixWorld).invert();
  }

  private place(n: FloatingNumber) {
    const v = this.scratch.set(n.world.x, n.world.y, n.world.z).applyMatrix4(this.view);
    if (v.z >= 0) {
      // Behind the camera (cameras look down -Z) — hide without expiring.
      n.el.style.display = "none";
      return;
    }
    v.applyMatrix4(this.camera.projectionMatrix);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const frac = n.age / this.ttl;
    const px = (v.x * 0.5 + 0.5) * w;
    const py = (-v.y * 0.5 + 0.5) * h - frac * this.rise;
    n.el.style.display = "block";
    n.el.style.opacity = String(1 - frac * frac);
    n.el.style.transform = `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  }

  private acquire(): FloatingNumber {
    for (const n of this.numbers) {
      if (!n.active) return n;
    }
    if (this.numbers.length < this.max) {
      const el = document.createElement("span");
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.pointerEvents = "none";
      el.style.whiteSpace = "nowrap";
      el.style.fontFamily = this.fontFamily;
      el.style.textShadow = "0 1px 2px rgba(0,0,0,0.9)";
      el.style.willChange = "transform, opacity";
      el.style.display = "none";
      this.container.appendChild(el);
      const n: FloatingNumber = { el, world: { x: 0, y: 0, z: 0 }, age: 0, active: false };
      this.numbers.push(n);
      return n;
    }
    // All busy: recycle the oldest.
    let oldest = this.numbers[0]!;
    for (const n of this.numbers) {
      if (n.age > oldest.age) oldest = n;
    }
    return oldest;
  }
}
