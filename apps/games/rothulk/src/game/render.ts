import * as THREE from "three";
import { COLORS, CONSTANTS } from "../constants";
import type { ChargerState, LevelData } from "./types";

// Owns the Three.js scene, the orthographic side camera, and all meshes built
// from primitives. Side-scroller / 2.5D: we look down -Z at a flat XY world.
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;

  // Hero parts so we can animate them.
  readonly hero = new THREE.Group();
  private heroBody!: THREE.Mesh;
  private heroHead!: THREE.Mesh;
  private heroFlashMat!: THREE.MeshStandardMaterial;

  // Dynamic mesh pools keyed by entity index.
  readonly scourgeMeshes: THREE.Group[] = [];
  readonly spitterMeshes: THREE.Group[] = [];
  readonly chargerMeshes: THREE.Group[] = [];
  readonly globMeshes: THREE.Mesh[] = [];
  readonly emberMeshes: THREE.Mesh[] = [];
  readonly moverMeshes: THREE.Mesh[] = [];
  private levelObjects: THREE.Object3D[] = [];
  private coreMesh!: THREE.Mesh;
  private coreGlowMat!: THREE.MeshBasicMaterial;
  private coreIgnited = false;
  private checkpointMesh!: THREE.Mesh;
  private exitMesh!: THREE.Group;
  private exitGlowMat!: THREE.MeshBasicMaterial;
  private exitArmed = false;

  // Ignite flash overlay (full-bleed billboard tied to camera).
  private flashMesh!: THREE.Mesh;
  private flashMat!: THREE.MeshBasicMaterial;
  private flashAmount = 0;

  private aspect = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLORS.void, 1);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, CONSTANTS.CAMERA_MIN_Y, 20);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(COLORS.hellfire, 0.6);
    key.position.set(-3, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(COLORS.blood, 0.4);
    rim.position.set(4, 2, 6);
    this.scene.add(rim);

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  // --- Static + dynamic level geometry ------------------------------------
  buildLevel(level: LevelData) {
    // Clear any prior level (on restart) but keep lights + hero + flash.
    for (const object of this.levelObjects) this.scene.remove(object);
    this.levelObjects.length = 0;
    this.scourgeMeshes.length = 0;
    this.spitterMeshes.length = 0;
    this.chargerMeshes.length = 0;
    this.globMeshes.length = 0;
    this.emberMeshes.length = 0;
    this.moverMeshes.length = 0;
    this.coreIgnited = level.core.ignited;
    this.exitArmed = false;

    // Backdrop: a huge dark void plane far behind everything.
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(level.width + 60, 80),
      new THREE.MeshBasicMaterial({ color: COLORS.void }),
    );
    bg.position.set(level.width / 2, 6, -8);
    this.addLevelObject(bg);

    // Platforms.
    const slabMat = new THREE.MeshStandardMaterial({
      color: COLORS.gunmetal,
      roughness: 0.85,
      metalness: 0.4,
    });
    const slabEdgeMat = new THREE.MeshStandardMaterial({
      color: COLORS.iron,
      roughness: 0.9,
      metalness: 0.3,
    });
    const fleshMat = new THREE.MeshStandardMaterial({
      color: COLORS.fleshDark,
      roughness: 1,
      metalness: 0,
    });

    for (const p of level.platforms) {
      if (p.kind === "flesh") {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 0.6), fleshMat);
        m.position.set(p.x, p.y, -4);
        this.addLevelObject(m);
        // toxic veins — sparse glowing nodes on the flesh wall
        const vein = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshBasicMaterial({ color: COLORS.toxic }),
        );
        vein.position.set(p.x + (Math.random() - 0.5) * p.w * 0.6, p.y + 1, -3.4);
        this.addLevelObject(vein);
      } else {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 1.4), slabMat);
        m.position.set(p.x, p.y, 0);
        this.addLevelObject(m);
        // bone-light top trim so platform tops read clearly
        const trim = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.14, 1.5), slabEdgeMat);
        trim.position.set(p.x, p.y + p.h / 2, 0.01);
        this.addLevelObject(trim);
      }
    }

    // Hazards.
    for (const h of level.hazards) {
      if (h.kind === "acid") {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(h.w, h.h, 1.2),
          new THREE.MeshBasicMaterial({ color: COLORS.toxic }),
        );
        m.position.set(h.x, h.y, 0.1);
        m.material.transparent = true;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.55;
        this.addLevelObject(m);
      } else {
        // bone spikes — a row of cones
        const count = Math.max(2, Math.round(h.w / 0.6));
        const coneMat = new THREE.MeshStandardMaterial({
          color: COLORS.bone,
          roughness: 0.7,
        });
        for (let i = 0; i < count; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, h.h, 5), coneMat);
          const cx = h.x - h.w / 2 + (i + 0.5) * (h.w / count);
          cone.position.set(cx, h.y - h.h / 2 + h.h / 2, 0.2);
          this.addLevelObject(cone);
        }
      }
    }

    // Moving platforms.
    const moverMat = new THREE.MeshStandardMaterial({
      color: COLORS.rust,
      roughness: 0.7,
      metalness: 0.5,
      emissive: COLORS.hellfire,
      emissiveIntensity: 0.25,
    });
    for (const mv of level.movers) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(mv.w, mv.h, 1.4), moverMat);
      m.position.set(mv.x, mv.y, 0);
      this.addLevelObject(m);
      this.moverMeshes.push(m);
    }

    // Scourge blobs — blood spheres with toxic core node.
    for (const s of level.scourge) {
      const g = new THREE.Group();
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(s.size / 2, 12, 10),
        new THREE.MeshStandardMaterial({
          color: COLORS.blood,
          roughness: 0.6,
          emissive: COLORS.bloodHot,
          emissiveIntensity: 0.2,
        }),
      );
      blob.scale.y = 0.8;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(s.size * 0.18, 8, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.toxic }),
      );
      node.position.y = s.size * 0.18;
      g.add(blob, node);
      g.position.set(s.x, s.y, 0.2);
      this.addLevelObject(g);
      this.scourgeMeshes.push(g);
    }

    // Spitters — rooted lobber mounds, wet flesh with a toxic maw.
    for (const sp of level.spitters) {
      const g = new THREE.Group();
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(sp.size / 2, 12, 10),
        new THREE.MeshStandardMaterial({
          color: COLORS.fleshWet,
          roughness: 0.7,
          emissive: COLORS.toxic,
          emissiveIntensity: 0.2,
        }),
      );
      mound.scale.y = 0.75;
      const maw = new THREE.Mesh(
        new THREE.SphereGeometry(sp.size * 0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.toxic }),
      );
      maw.position.y = sp.size * 0.3;
      g.add(mound, maw);
      g.position.set(sp.x, sp.y, 0.2);
      this.addLevelObject(g);
      this.spitterMeshes.push(g);
    }

    // Chargers — armored rams: flesh-wet body, bone horn facing forward.
    for (const c of level.chargers) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(c.w, c.h, 0.9),
        new THREE.MeshStandardMaterial({
          color: COLORS.fleshWet,
          roughness: 0.6,
          emissive: COLORS.blood,
          emissiveIntensity: 0.25,
        }),
      );
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.6, 5),
        new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.7 }),
      );
      horn.rotation.z = -Math.PI / 2;
      horn.position.set(c.w / 2 + 0.2, c.h * 0.15, 0);
      g.add(body, horn);
      g.position.set(c.x, c.y, 0.2);
      this.addLevelObject(g);
      this.chargerMeshes.push(g);
    }

    // Toxic globs — pooled spitter projectiles, hidden until launched.
    for (let i = 0; i < CONSTANTS.MAX_GLOBS; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(CONSTANTS.GLOB_SIZE / 2, 8, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.toxic }),
      );
      m.visible = false;
      this.addLevelObject(m);
      this.globMeshes.push(m);
    }

    // Embers — hellfire octahedrons.
    for (const e of level.embers) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(CONSTANTS.EMBER_SIZE),
        new THREE.MeshBasicMaterial({ color: COLORS.hellfire }),
      );
      m.position.set(e.x, e.y, 0.3);
      this.addLevelObject(m);
      this.emberMeshes.push(m);
    }

    // Checkpoint — a bone pylon that lights blood-red when reached.
    this.checkpointMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6),
      new THREE.MeshStandardMaterial({
        color: COLORS.bone,
        emissive: COLORS.iron,
        emissiveIntensity: 0.2,
      }),
    );
    this.checkpointMesh.position.set(level.checkpoint.x, level.checkpoint.y, 0.1);
    this.addLevelObject(this.checkpointMesh);

    // Breach-core — pulsing toxic-green icosahedron in a gunmetal cradle.
    this.coreGlowMat = new THREE.MeshBasicMaterial({ color: COLORS.toxic });
    this.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), this.coreGlowMat);
    this.coreMesh.position.set(level.core.x, level.core.y, 0.3);
    this.addLevelObject(this.coreMesh);
    const cradle = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.16, 8, 16),
      new THREE.MeshStandardMaterial({ color: COLORS.gunmetal, metalness: 0.6 }),
    );
    cradle.position.copy(this.coreMesh.position);
    this.addLevelObject(cradle);

    // Exit marker — the Pyre boarding spike becomes the escape target after ignition.
    this.exitMesh = new THREE.Group();
    const spike = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6),
      new THREE.MeshStandardMaterial({
        color: COLORS.gunmetal,
        roughness: 0.75,
        metalness: 0.5,
        emissive: COLORS.iron,
        emissiveIntensity: 0.25,
      }),
    );
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshBasicMaterial({
        color: COLORS.hellfire,
        transparent: true,
        opacity: 0.2,
      }),
    );
    flame.position.y = 1.55;
    this.exitGlowMat = flame.material as THREE.MeshBasicMaterial;
    this.exitMesh.add(spike, flame);
    this.exitMesh.position.set(level.exit.x, level.exit.y - 1.1, 0.35);
    this.addLevelObject(this.exitMesh);
  }

  buildHero() {
    if (this.hero.parent) return; // already built
    // Body — bone-white box.
    this.heroBody = new THREE.Mesh(
      new THREE.BoxGeometry(CONSTANTS.HERO_WIDTH, CONSTANTS.HERO_HEIGHT * 0.7, 0.8),
      new THREE.MeshStandardMaterial({
        color: COLORS.bone,
        roughness: 0.6,
        emissive: COLORS.iron,
        emissiveIntensity: 0.15,
      }),
    );
    this.heroBody.position.y = -CONSTANTS.HERO_HEIGHT * 0.15;
    // Head — blood-red, the Pyre warmark.
    this.heroFlashMat = new THREE.MeshStandardMaterial({
      color: COLORS.blood,
      roughness: 0.5,
      emissive: COLORS.blood,
      emissiveIntensity: 0.3,
    });
    this.heroHead = new THREE.Mesh(
      new THREE.BoxGeometry(CONSTANTS.HERO_WIDTH * 0.7, CONSTANTS.HERO_HEIGHT * 0.32, 0.7),
      this.heroFlashMat,
    );
    this.heroHead.position.y = CONSTANTS.HERO_HEIGHT * 0.34;
    this.hero.add(this.heroBody, this.heroHead);
    this.scene.add(this.hero);

    // Full-screen ignite flash, parented to the camera so it always covers view.
    this.flashMat = new THREE.MeshBasicMaterial({
      color: COLORS.hellfire,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    this.flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), this.flashMat);
    this.flashMesh.position.set(0, 0, -1); // in front of camera
    this.flashMesh.renderOrder = 999;
    this.camera.add(this.flashMesh);
    this.scene.add(this.camera);
  }

  setHeroTransform(x: number, y: number, facing: number, squash: number) {
    this.hero.position.set(x, y, 0.4);
    this.hero.scale.set(1 + (1 - squash) * 0.0, squash, 1);
    // lean slightly toward facing direction
    this.hero.rotation.z = -facing * 0.05;
    if (facing !== 0) this.heroHead.position.x = facing * 0.12;
  }

  setHeroHurt(invuln: number) {
    // Strobe between bone and blood-hot while invulnerable.
    if (invuln > 0) {
      const on = Math.floor(invuln * 12) % 2 === 0;
      this.heroFlashMat.emissiveIntensity = on ? 0.9 : 0.3;
      this.heroFlashMat.color.setHex(on ? COLORS.bloodHot : COLORS.blood);
      this.hero.visible = on || invuln < 0.2;
    } else {
      this.heroFlashMat.emissiveIntensity = 0.3;
      this.heroFlashMat.color.setHex(COLORS.blood);
      this.hero.visible = true;
    }
  }

  setHeroVisible(v: boolean) {
    this.hero.visible = v;
  }

  triggerFlash() {
    this.flashAmount = 1;
  }

  setCoreIgnited() {
    this.coreIgnited = true;
    this.coreGlowMat.color.setHex(COLORS.hellfire);
  }

  setExitArmed(armed: boolean) {
    this.exitArmed = armed;
    this.exitGlowMat.opacity = armed ? 0.95 : 0.2;
  }

  setScourgeFeral(index: number, feral: boolean) {
    const group = this.scourgeMeshes[index];
    if (!group) return;
    const blob = group.children[0] as THREE.Mesh | undefined;
    const node = group.children[1] as THREE.Mesh | undefined;
    const blobMat = blob?.material as THREE.MeshStandardMaterial | undefined;
    const nodeMat = node?.material as THREE.MeshBasicMaterial | undefined;
    blobMat?.emissive.setHex(feral ? COLORS.hellfire : COLORS.bloodHot);
    blobMat?.color.setHex(feral ? COLORS.fleshWet : COLORS.blood);
    nodeMat?.color.setHex(feral ? COLORS.hellfire : COLORS.toxic);
  }

  // Tint a charger to telegraph its state: red-hot mid-charge, dim when dazed.
  setChargerState(index: number, state: ChargerState) {
    const group = this.chargerMeshes[index];
    if (!group) return;
    const body = group.children[0] as THREE.Mesh | undefined;
    const mat = body?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    if (state === "charge") {
      mat.emissive.setHex(COLORS.bloodHot);
      mat.emissiveIntensity = 0.9;
    } else if (state === "stunned") {
      mat.emissive.setHex(COLORS.iron);
      mat.emissiveIntensity = 0.1;
    } else {
      mat.emissive.setHex(COLORS.blood);
      mat.emissiveIntensity = 0.25;
    }
  }

  setCheckpointReached() {
    (this.checkpointMesh.material as THREE.MeshStandardMaterial).emissive.setHex(COLORS.blood);
    (this.checkpointMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
    (this.checkpointMesh.material as THREE.MeshStandardMaterial).color.setHex(COLORS.bloodHot);
  }

  // Per-frame visual tick (pulses, flash decay).
  animate(time: number, dt: number) {
    if (this.coreMesh) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      this.coreMesh.scale.setScalar(1 + pulse * 0.12);
      this.coreMesh.rotation.y += dt * 1.2;
      this.coreMesh.rotation.x += dt * 0.6;
      this.coreGlowMat.color.setHex(this.coreIgnited ? COLORS.hellfire : COLORS.toxic);
    }
    if (this.exitMesh) {
      const pulse = this.exitArmed ? 0.75 + 0.25 * Math.sin(time * 7) : 0.2;
      this.exitGlowMat.opacity = this.exitArmed ? pulse : 0.2;
      this.exitMesh.rotation.z = Math.sin(time * 3) * 0.025;
    }
    for (const m of this.emberMeshes) {
      if (m.visible) m.rotation.y += dt * 3;
    }
    for (const g of this.scourgeMeshes) {
      g.rotation.z = Math.sin(time * 8 + g.position.x) * 0.08;
    }
    if (this.flashAmount > 0) {
      this.flashAmount = Math.max(0, this.flashAmount - dt * 1.5);
      this.flashMat.opacity = this.flashAmount * 0.85;
    }
  }

  // Orthographic camera follows the hero with lead + clamping.
  updateCamera(targetX: number, targetY: number, levelWidth: number) {
    const halfW = (CONSTANTS.VIEW_HEIGHT * this.aspect) / 2;
    let camX = targetX + CONSTANTS.CAMERA_LEAD;
    camX = Math.max(halfW, Math.min(levelWidth - halfW, camX));
    const camY = Math.max(CONSTANTS.CAMERA_MIN_Y, targetY + 2);
    this.camera.position.x += (camX - this.camera.position.x) * 0.18;
    this.camera.position.y += (camY - this.camera.position.y) * 0.12;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private addLevelObject(object: THREE.Object3D) {
    this.scene.add(object);
    this.levelObjects.push(object);
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.aspect = w / h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    const halfH = CONSTANTS.VIEW_HEIGHT / 2;
    const halfW = halfH * this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}
