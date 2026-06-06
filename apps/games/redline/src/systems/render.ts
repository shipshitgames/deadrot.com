/**
 * Render system. Owns the Three.js scene, the orthographic side camera, all
 * primitive meshes for the course + runner + trail, and the camera/juice.
 *
 * Everything is built from Three.js primitives — no external art. The look:
 *   - runner  : bone capsule with a hellfire core + a fading motion trail
 *   - ground  : gunmetal platforms with a hellfire trim strip
 *   - ramps   : gunmetal kickers with a hellfire leading edge
 *   - spikes  : blood-red creep growths (jump them)
 *   - bars    : blood-red low creep arches (roll under)
 *   - embers  : hellfire octahedrons (speed pickups)
 *   - beacon  : a tall hellfire pillar at the finish
 */

import * as THREE from "three";
import { COLORS, CAMERA, WORLD, RUNNER, EMBER, TRAIL } from "../constants";
import type { Course } from "../types";
import type { Runner } from "../entities/runner";

interface TrailGhost {
  mesh: THREE.Mesh;
  x: number;
  y: number;
}

export class Render {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;

  private runnerMesh!: THREE.Group;
  private runnerCore!: THREE.Mesh;
  private trail: TrailGhost[] = [];
  private trailTimer = 0;

  private emberMeshes: THREE.Mesh[] = [];
  private beacon!: THREE.Group;
  private beaconLight!: THREE.PointLight;

  // camera state
  private shake = 0;
  private shakeSeed = Math.random() * 1000;
  private viewHeight = CAMERA.viewHeight;

  private aspect = 1;
  private elapsed = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLORS.void, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.void);
    this.scene.fog = new THREE.Fog(COLORS.void, 38, 78);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, CAMERA.height, 30);

    this.addLights();
    this.resize();
  }

  private addLights() {
    this.scene.add(new THREE.AmbientLight(COLORS.bone, 0.45));

    const key = new THREE.DirectionalLight(COLORS.bone, 0.9);
    key.position.set(-6, 12, 14);
    this.scene.add(key);

    // Hellfire fill from below for that lit-from-the-pit hell glow.
    const fill = new THREE.DirectionalLight(COLORS.hellfire, 0.35);
    fill.position.set(8, -6, 6);
    this.scene.add(fill);
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  /** Build (or rebuild) all course geometry + the runner. Call on (re)start. */
  buildCourse(course: Course, runner: Runner) {
    // wipe everything except lights/camera-independent state
    this.clearGroup();
    this.emberMeshes = [];
    this.trail = [];

    this.buildPlatforms(course);
    this.buildRamps(course);
    this.buildHazards(course);
    this.buildEmbers(course);
    this.buildBeacon(course);
    this.buildBackdrop(course);
    this.buildRunner(runner);
    this.buildTrail();
  }

  private disposables: THREE.Object3D[] = [];

  private track<T extends THREE.Object3D>(obj: T): T {
    this.disposables.push(obj);
    this.scene.add(obj);
    return obj;
  }

  private clearGroup() {
    for (const o of this.disposables) {
      this.scene.remove(o);
      o.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) {
            mat.forEach((x) => {
              x.dispose();
            });
          } else mat.dispose();
        }
      });
    }
    this.disposables = [];
  }

  private buildPlatforms(course: Course) {
    const depth = 6;
    const thickness = 8;
    const matTop = new THREE.MeshStandardMaterial({
      color: COLORS.gunmetal,
      roughness: 0.85,
      metalness: 0.4,
    });
    const matTrim = new THREE.MeshStandardMaterial({
      color: COLORS.hellfire,
      emissive: COLORS.hellfire,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    });

    for (const p of course.platforms) {
      const w = p.x1 - p.x0;
      if (w <= 0) continue;

      const block = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, depth), matTop);
      block.position.set(p.x0 + w / 2, p.topY - thickness / 2, 0);
      this.track(block);

      // hellfire trim strip along the top lip
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, depth + 0.02), matTrim);
      trim.position.set(p.x0 + w / 2, p.topY - 0.02, 0);
      this.track(trim);
    }
  }

  private buildRamps(course: Course) {
    const matRamp = new THREE.MeshStandardMaterial({
      color: COLORS.gunmetal,
      roughness: 0.7,
      metalness: 0.5,
    });
    const matEdge = new THREE.MeshStandardMaterial({
      color: COLORS.hellfire,
      emissive: COLORS.hellfire,
      emissiveIntensity: 0.6,
    });

    for (const r of course.ramps) {
      const run = r.x1 - r.x0;
      const depth = 6;
      // Build a right-triangle wedge as a custom geometry.
      const g = new THREE.BufferGeometry();
      const z = depth / 2;
      const b = r.baseY;
      const top = r.baseY + r.rise;
      // 6 verts -> 8 triangles (slope, back, bottom, two sides)
      const verts = new Float32Array([
        // slope face (low-left to high-right), front + back
        0,
        b,
        z,
        run,
        top,
        z,
        run,
        b,
        z, // front lower tri
        0,
        b,
        z,
        0,
        b,
        -z,
        run,
        top,
        z, // wrap
        run,
        top,
        z,
        0,
        b,
        -z,
        run,
        top,
        -z,
        run,
        b,
        z,
        run,
        top,
        z,
        run,
        top,
        -z,
        run,
        b,
        z,
        run,
        top,
        -z,
        run,
        b,
        -z,
        0,
        b,
        z,
        run,
        b,
        z,
        run,
        b,
        -z,
        0,
        b,
        z,
        run,
        b,
        -z,
        0,
        b,
        -z,
      ]);
      g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
      g.computeVertexNormals();
      const wedge = new THREE.Mesh(g, matRamp);
      wedge.position.set(r.x0, 0, 0);
      this.track(wedge);

      // glowing leading edge at the top
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, depth + 0.1), matEdge);
      edge.position.set(r.x1, top, 0);
      this.track(edge);
    }
  }

  private buildHazards(course: Course) {
    const matCreep = new THREE.MeshStandardMaterial({
      color: COLORS.blood,
      emissive: COLORS.bloodHot,
      emissiveIntensity: 0.18,
      roughness: 0.6,
      metalness: 0.1,
    });
    // sparing toxic nodes — Scourge signature
    const matNode = new THREE.MeshStandardMaterial({
      color: COLORS.toxic,
      emissive: COLORS.toxic,
      emissiveIntensity: 0.7,
    });

    for (const h of course.hazards) {
      const depth = 5;
      if (h.kind === "spike") {
        // jagged blood creep: a cone + a couple of barbs
        const cone = new THREE.Mesh(new THREE.ConeGeometry(h.width * 0.7, h.height, 6), matCreep);
        cone.position.set(h.x, h.baseY + h.height / 2, 0);
        this.track(cone);

        const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), matNode);
        node.position.set(h.x, h.baseY + h.height * 0.62, 0.35);
        this.track(node);
      } else {
        // low arch: a side leg + a top bar (you roll under the bar)
        const top = h.baseY + h.height;
        const bottomOfBar = h.baseY + h.clearance;
        const barH = top - bottomOfBar;

        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, h.clearance, 0.4), matCreep);
        leftLeg.position.set(h.x - h.width * 0.5, h.baseY + h.clearance / 2, 0);
        this.track(leftLeg);

        const bar = new THREE.Mesh(new THREE.BoxGeometry(h.width + 1.0, barH, depth * 0.8), matCreep);
        bar.position.set(h.x, bottomOfBar + barH / 2, 0);
        this.track(bar);

        const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), matNode);
        node.position.set(h.x, bottomOfBar + barH / 2, 0.5);
        this.track(node);
      }
    }
  }

  private buildEmbers(course: Course) {
    const geo = new THREE.OctahedronGeometry(EMBER.radius, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.hellfire,
      emissive: COLORS.hellfire,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.2,
    });
    for (const e of course.embers) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(e.x, e.y, 0);
      m.userData.ember = e;
      this.emberMeshes.push(m);
      this.track(m);
    }
  }

  private buildBeacon(course: Course) {
    const group = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.1, 22, 8),
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 0.85,
        roughness: 0.35,
      }),
    );
    pillar.position.y = WORLD.groundY + 11;
    group.add(pillar);

    const cap = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 0),
      new THREE.MeshStandardMaterial({
        color: COLORS.bloodHot,
        emissive: COLORS.bloodHot,
        emissiveIntensity: 1.0,
      }),
    );
    cap.position.y = WORLD.groundY + 22;
    group.add(cap);

    this.beaconLight = new THREE.PointLight(COLORS.hellfire, 2.2, 30, 1.6);
    this.beaconLight.position.set(0, WORLD.groundY + 12, 4);
    group.add(this.beaconLight);

    group.position.x = course.beaconX;
    this.beacon = group;
    this.track(group);
  }

  /** Distant parallax silhouettes — broken Scourge-rot skyline. */
  private buildBackdrop(course: Course) {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.iron,
      roughness: 1,
      metalness: 0,
    });
    const rng = (s: number) => {
      const x = Math.sin(s * 99.13) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 60; i++) {
      const x = (i / 60) * (course.beaconX + 60) - 10;
      const h = 6 + rng(i + 1) * 16;
      const w = 2 + rng(i + 9) * 3;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), mat);
      slab.position.set(x, WORLD.groundY - 4 + h / 2, -18 - rng(i + 3) * 10);
      this.track(slab);
    }
  }

  private buildRunner(runner: Runner) {
    const group = new THREE.Group();

    // bone capsule body
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(RUNNER.radius, RUNNER.height - RUNNER.radius * 2, 6, 12),
      new THREE.MeshStandardMaterial({
        color: COLORS.bone,
        roughness: 0.55,
        metalness: 0.2,
      }),
    );
    group.add(body);

    // hellfire core (glows hotter at speed)
    this.runnerCore = new THREE.Mesh(
      new THREE.SphereGeometry(RUNNER.radius * 0.55, 12, 12),
      new THREE.MeshStandardMaterial({
        color: COLORS.hellfire,
        emissive: COLORS.hellfire,
        emissiveIntensity: 1.0,
      }),
    );
    group.add(this.runnerCore);

    const glow = new THREE.PointLight(COLORS.hellfire, 1.4, 10, 2);
    group.add(glow);

    group.position.set(runner.x, runner.y, 0);
    this.runnerMesh = group;
    this.track(group);
  }

  private buildTrail() {
    const geo = new THREE.CapsuleGeometry(RUNNER.radius * 0.92, RUNNER.height - RUNNER.radius * 2, 4, 8);
    for (let i = 0; i < TRAIL.segments; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: COLORS.hellfire,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.trail.push({ mesh: m, x: 0, y: 0 });
      this.track(m);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  update(dt: number, runner: Runner, course: Course) {
    this.elapsed += dt;
    const frac = runner.speedFrac;

    // runner mesh position + crouch squash/stretch
    this.runnerMesh.position.set(runner.x, runner.y, 0);
    const stretchY = runner.crouch * (1 + frac * 0.12); // slight vertical stretch at speed
    const squashX = 1 + (1 - runner.crouch) * 0.6 + frac * 0.08;
    this.runnerMesh.scale.set(squashX, stretchY, 1);
    // lean forward into the run
    this.runnerMesh.rotation.z = -frac * 0.12 - (runner.dashing ? 0.18 : 0);

    // spin the core, heat it with speed
    this.runnerCore.rotation.x += dt * 6;
    const coreMat = this.runnerCore.material as THREE.MeshStandardMaterial;
    coreMat.emissiveIntensity = 0.8 + frac * 1.6;
    coreMat.color.setHex(frac > RUNNER.redlineFrac ? COLORS.bloodHot : COLORS.hellfire);

    // flicker hit state
    if (runner.invuln > 0) {
      this.runnerMesh.visible = Math.floor(this.elapsed * 30) % 2 === 0;
    } else {
      this.runnerMesh.visible = true;
    }

    this.updateTrail(dt, runner, frac);
    this.updateEmbers(dt);
    this.updateBeacon();
    this.updateCamera(dt, runner, course, frac);
  }

  private updateTrail(dt: number, runner: Runner, frac: number) {
    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && (runner.vx > RUNNER.baseSpeed * 1.4 || runner.dashing)) {
      this.trailTimer = TRAIL.spacing;
      // shift samples down the chain
      for (let i = this.trail.length - 1; i > 0; i--) {
        this.trail[i].x = this.trail[i - 1].x;
        this.trail[i].y = this.trail[i - 1].y;
      }
      this.trail[0].x = runner.x;
      this.trail[0].y = runner.y;
    }

    for (let i = 0; i < this.trail.length; i++) {
      const gh = this.trail[i];
      const mat = gh.mesh.material as THREE.MeshBasicMaterial;
      if (gh.x === 0 && gh.y === 0) {
        gh.mesh.visible = false;
        continue;
      }
      const t = 1 - i / this.trail.length;
      gh.mesh.visible = true;
      gh.mesh.position.set(gh.x, gh.y, -0.2);
      mat.opacity = t * 0.4 * (0.4 + frac);
      mat.color.setHex(frac > RUNNER.redlineFrac ? COLORS.bloodHot : COLORS.hellfire);
      const s = 0.5 + t * 0.5;
      gh.mesh.scale.set(s, s * runner.crouch, 1);
    }
  }

  private updateEmbers(dt: number) {
    for (const m of this.emberMeshes) {
      const e = m.userData.ember as { collected: boolean };
      if (e.collected) {
        if (m.visible) {
          // quick pop-out
          m.scale.multiplyScalar(0.78);
          if (m.scale.x < 0.05) m.visible = false;
        }
        continue;
      }
      m.rotation.y += dt * 2.2;
      m.rotation.x += dt * 1.4;
      m.position.y += Math.sin(this.elapsed * 3 + m.position.x) * dt * 0.4;
    }
  }

  private updateBeacon() {
    const pulse = 0.7 + Math.sin(this.elapsed * 4) * 0.3;
    this.beaconLight.intensity = 1.6 + pulse;
    this.beacon.rotation.y += 0.003;
  }

  private updateCamera(dt: number, runner: Runner, course: Course, frac: number) {
    // lead the runner; pull back slightly at top speed (FOV-like punch)
    const targetX = runner.x + CAMERA.lead;
    const k = 1 - Math.exp(-CAMERA.followLerp * dt);
    this.camera.position.x += (targetX - this.camera.position.x) * k;

    // keep some vertical follow when high in the air, but mostly fixed
    const targetY = CAMERA.height + Math.max(0, runner.y - 3) * 0.25;
    this.camera.position.y += (targetY - this.camera.position.y) * k;

    // zoom out a touch at redline -> sense of speed
    const targetView = CAMERA.viewHeight * (1 + CAMERA.zoomOutAtTop * frac);
    this.viewHeight += (targetView - this.viewHeight) * (1 - Math.exp(-6 * dt));
    this.applyProjection();

    // screen-shake decay + apply as a small offset
    this.shake = Math.max(0, this.shake - CAMERA.shakeDecay * dt * this.shake);
    if (this.shake > 0.001) {
      const t = this.elapsed * 60 + this.shakeSeed;
      this.camera.position.x += Math.sin(t * 1.7) * this.shake * 0.5;
      this.camera.position.y += Math.cos(t * 2.3) * this.shake;
    }

    // beacon point-light reach: brighten as you approach (handled by progress in HUD)
    void course;

    this.camera.lookAt(this.camera.position.x, this.camera.position.y - CAMERA.height * 0.0, 0);
  }

  /** Kick the screen-shake (called on stagger). */
  kickShake(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  private applyProjection() {
    const halfH = this.viewHeight / 2;
    const halfW = halfH * this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.aspect = w / h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.applyProjection();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.clearGroup();
    this.renderer.dispose();
  }
}
